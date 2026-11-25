"use strict";

const $ = (s) => document.querySelector(s),
  app = $("#app"),
  modal = $("#modal");
const decks = DECKS,
  motion = window.motionControl,
  key = "desi-heads-up-v1";
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const btn = (a, t, cls = "secondary", attrs = "") =>
  '<button class="' + cls + '" data-act="' + a + '" ' + attrs + ">" + t + "</button>";
const choices = (arr, v) =>
  arr
    .map(
      (n) =>
        "<option " +
        (String(n) === String(v) ? "selected " : "") +
        'value="' +
        esc(n) +
        '">' +
        esc(n) +
        "</option>",
    )
    .join("");
const checked = (v) => (v ? "checked" : "");
const check = (id, title, v) =>
  '<label class="check"><input type="checkbox" id="' +
  id +
  '" ' +
  checked(v) +
  ">" +
  title +
  "</label>";
const field = (label, html) => '<label class="field">' + label + html + "</label>";
const sel = (id, arr, v) => '<select id="' + id + '">' + choices(arr, v) + "</select>";
const mix = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const defaults = () => ({
  names: ["Team A", "Team B"],
  members: [[], []],
  seconds: 90,
  rounds: 5,
  cats: Object.keys(decks),
  custom: {},
  mode: "Random order",
  motion: true,
  preset: "Standard",
  sound: true,
  vibe: true,
  countdown: true,
  font: "Large",
  full: false,
});
let cfg = defaults(),
  g = null,
  page = "home",
  step = 1,
  practice = false,
  pTurn = null,
  message = "",
  countdown = 0,
  deadline = 0,
  timer = 0,
  delay = 0,
  audio = null,
  pending = null,
  serial = 0,
  storageError = false;
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved?.cfg && saved?.g) {
    cfg = saved.cfg;
    g = saved.g;
    if (g.turn) g.turn.phase = "paused";
  }
} catch {}
const save = () => {
  try {
    if (g) localStorage.setItem(key, JSON.stringify({ cfg, g }));
    else localStorage.removeItem(key);
  } catch {
    storageError = true;
  }
};
const allDecks = () => ({ ...decks, ...cfg.custom }),
  round = () => g.rounds.at(-1),
  turn = () => (practice ? pTurn : g?.turn);
const totals = () =>
  g.rounds.reduce(
    (a, r) =>
      a.map(
        (s, i) =>
          s + r.adjust[i] + (r.turns[i]?.cards.filter((c) => c.result === "Correct").length || 0),
      ),
    [0, 0],
  );
const pts = (t) => t.cards.filter((c) => c.result === "Correct").length;
function stopTurnClock() {
  serial++;
  clearInterval(timer);
  clearTimeout(delay);
  motion?.stop();
}
function goto(p) {
  stopTurnClock();
  page = p;
  render();
  window.scrollTo(0, 0);
}
function setMessage(m) {
  message = m;
  render();
}
function notify(s) {
  return s ? '<p class="notice" role="status">' + esc(s) + "</p>" : "";
}
function panel(k, h, body) {
  return (
    '<section class="panel"><div class="eyebrow">' +
    k +
    "</div><h1>" +
    h +
    "</h1>" +
    body +
    "</section>"
  );
}
function showModal(html) {
  $("#modalBody").innerHTML = html;
  if (!modal.open) modal.showModal();
}
function confirmAction(text, fn) {
  pending = fn;
  showModal("<h2>" + esc(text) + "</h2>" + btn("confirm", "Confirm", "primary"));
}
function help() {
  showModal(
    "<h2>How to play</h2><ol><li>Make two teams and choose your categories.</li><li>One guesser holds the phone sideways against their forehead, screen facing their team.</li><li>Give clues without saying the word. For Act It Out, use gestures only.</li><li>Tilt the screen toward the floor for a correct guess, or toward the ceiling to pass. Bring it upright for the next card. You can also tap the buttons.</li><li>Each correct guess earns one point. Both teams play the same category, then the starting team changes.</li></ol>",
  );
}
