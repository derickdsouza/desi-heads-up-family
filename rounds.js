"use strict";

function newRound(tie = false) {
  const idx = g.rounds.length;
  let cat;
  if (cfg.mode === "Mixed categories") cat = "Mixed categories";
  else {
    if (!g.order.length) g.order = mix(cfg.cats);
    cat = g.order.pop();
  }
  g.rounds.push({
    cat,
    tie,
    first: idx % 2,
    seconds: tie ? 30 : cfg.seconds,
    turns: [null, null],
    adjust: [0, 0],
    pools: null,
  });
  save();
}
const active = () => (round().turns[round().first] ? 1 - round().first : round().first);
function countTurns(i) {
  return g.rounds.filter((r) => r.turns[i]).length;
}
function nextName(i) {
  const m = cfg.members[i];
  return m.length ? m[countTurns(i) % m.length] : "";
}
function leader() {
  const [a, b] = totals();
  return a === b
    ? "Scores are level"
    : esc(cfg.names[a > b ? 0 : 1]) + " leads by " + Math.abs(a - b);
}
function roundTitle() {
  return round().tie
    ? "Tie-breaker"
    : "Round " + g.rounds.length + (cfg.rounds === "Unlimited" ? "" : " of " + cfg.rounds);
}
function handoff() {
  const r = round(),
    i = active(),
    started = r.turns.some(Boolean),
    members = cfg.members[i];
  return panel(
    roundTitle(),
    esc(cfg.names[i]) + " is up",
    notify(message) +
      '<p class="lead">' +
      (started ? "Second turn in this round." : "First turn in this round.") +
      " " +
      r.seconds +
      ' seconds to guess.</p><div class="box ' +
      (i ? "orange" : "blue") +
      '">' +
      (!started && cfg.mode === "Choose each round"
        ? field("Category", sel("roundCat", cfg.cats, r.cat))
        : '<div class="kicker">Category</div><h2>' + esc(r.cat) + "</h2>") +
      "<p>" +
      clue(r.cat) +
      "</p>" +
      (members.length
        ? field("Current guesser", sel("player", members, g.guesser || nextName(i)))
        : '<p class="muted">Pass the phone to a new guesser.</p>') +
      "</div>" +
      (cfg.motion
        ? "<p>" +
          (motion?.isCalibrated
            ? "Tilt controls are ready."
            : "Tilt controls use the phone’s motion sensors. Hold it sideways with the screen facing your team.") +
          '</p><div class="row">' +
          btn("calibrate", motion?.isCalibrated ? "Recalibrate" : "Enable & calibrate tilt") +
          btn("manual", "Use buttons only") +
          "</div>"
        : "<p>Button controls are on. " + btn("offerMotion", "Enable tilt", "link") + "</p>") +
      '<div class="actions">' +
      btn("start", "Start turn", "primary") +
      btn("practice", "Practice") +
      btn("board", "Scoreboard") +
      '</div><details><summary>Host controls</summary><div class="row">' +
      (!started ? btn("swap", "Change starting team") : "") +
      btn("end", "End game early") +
      btn("reset", "Reset game") +
      '</div></details><p class="muted">' +
      leader() +
      " · " +
      (started ? "Next round follows this turn" : "Next up: " + esc(cfg.names[1 - i])) +
      "</p>",
  );
}
function clue(n) {
  return /act it out/i.test(n)
    ? "Use gestures only. Keep your clues silent."
    : /bollywood|music|song/i.test(n)
      ? "Act, hum or give clues without saying the answer."
      : "Give clues without saying any part of the answer.";
}
function deal() {
  const r = round();
  if (r.pools) return;
  const words = [
    ...new Set(
      r.cat === "Mixed categories" ? cfg.cats.flatMap((c) => allDecks()[c]) : allDecks()[r.cat],
    ),
  ];
  const seen = new Set(
    g.rounds.flatMap((v) => v.turns.flatMap((t) => (t ? t.cards.map((c) => c.word) : []))),
  );
  let pool = mix(words.filter((w) => !seen.has(w)));
  if (!r.tie) {
    pool.push(...mix(words.filter((w) => seen.has(w))));
  } else if (pool.length < 2) {
    const any = mix([...new Set(Object.values(allDecks()).flat())].filter((w) => !seen.has(w)));
    pool = any;
    r.cat = "Mixed categories";
  }
  const half = Math.floor(pool.length / 2);
  r.pools = [pool.slice(0, half), pool.slice(half, 2 * half)];
}
function takeTurn(isPractice) {
  const i = active();
  practice = isPractice;
  const player = $("#player")?.value || g.guesser || nextName(i);
  g.guesser = null;
  if (!isPractice) {
    deal();
    if (round().pools[i].length === 0) {
      setMessage("Every fresh card has been used. You can declare a shared victory.");
      return;
    }
  }
  const cards = isPractice
    ? ["Masala dosa", "Rotary telephone", "Pressure cooker", "Sholay"]
    : round().pools[i];
  const t = {
    team: i,
    player,
    deck: [...cards],
    cards: [],
    remaining: (isPractice ? 30 : round().seconds) * 1000,
    phase: "paused",
  };
  if (isPractice) pTurn = t;
  else g.turn = t;
  save();
  begin();
}
