"use strict";

function home() {
  return (
    '<section class="hero"><div><div class="kicker">The Family Edition</div><h1>Desi <em>Heads Up!</em></h1><p class="lead">One phone, two teams, and a family full of clues. Celebrate 70 years with the films, food and memories everyone knows.</p>' +
    btn(
      g ? "resumeGame" : "setup",
      g ? "Open saved game &nbsp; →" : "Set up game &nbsp; →",
      "primary",
    ) +
    '</div><div class="poster" aria-label="Sample Good Old Days card: Doordarshan"><div class="postcard"><small>Good Old Days</small><div class="posterword">Doordarshan</div><small>Guess the word</small></div></div></section><section class="preview"><h2>Inside the family decks</h2><div class="decklist">' +
    Object.keys(decks)
      .map((n) => '<span class="chip">' + esc(n) + "</span>")
      .join("") +
    "</div></section>"
  );
}
function setup() {
  const names = cfg.names
    .map(
      (n, i) =>
        '<fieldset class="' +
        (i ? "orange" : "blue") +
        '"><legend>Team ' +
        (i ? "B" : "A") +
        "</legend>" +
        field("Team name", '<input id="name' + i + '" maxlength="45" value="' + esc(n) + '">') +
        field(
          "Players (optional)",
          '<textarea id="members' +
            i +
            '" placeholder="One name per line">' +
            esc(cfg.members[i].join("\n")) +
            "</textarea>",
        ) +
        "</fieldset>",
    )
    .join("");
  const settings =
    field("Seconds per turn", sel("seconds", [30, 60, 90, 120], cfg.seconds)) +
    field(
      "Number of rounds",
      sel(
        "rounds",
        [3, 5, 7, 10, "Custom", "Unlimited"],
        [3, 5, 7, 10, "Unlimited"].includes(cfg.rounds) ? cfg.rounds : "Custom",
      ),
    ) +
    '<div id="customCount" ' +
    ([3, 5, 7, 10, "Unlimited"].includes(cfg.rounds) ? "hidden" : "") +
    ">" +
    field(
      "Custom round count",
      '<input id="roundNum" type="number" min="1" max="999" value="' +
        (Number(cfg.rounds) || 5) +
        '">',
    ) +
    "</div>";
  const catHtml = Object.keys(allDecks())
    .map(
      (n) =>
        '<label class="check"><input class="category" type="checkbox" value="' +
        esc(n) +
        '" ' +
        checked(cfg.cats.includes(n)) +
        ">" +
        esc(n) +
        " (" +
        allDecks()[n].length +
        ")</label>",
    )
    .join("");
  const categories =
    '<fieldset><legend>Choose your decks</legend><div class="grid">' +
    catHtml +
    "</div></fieldset>" +
    field(
      "Category sequence",
      sel("mode", ["Random order", "Choose each round", "Mixed categories"], cfg.mode),
    ) +
    "<details><summary>Add a custom category</summary>" +
    field("Category name", '<input id="customName" maxlength="60">') +
    field("Cards, one per line", '<textarea id="customCards" rows="4"></textarea>') +
    btn("addDeck", "Add category") +
    "</details>";
  const prefs =
    check("motion", "Use tilt controls", cfg.motion) +
    field("Tilt sensitivity", sel("preset", ["Easy", "Standard", "Strict"], cfg.preset)) +
    check("sound", "Play sounds", cfg.sound) +
    check("vibe", "Vibrate where supported", cfg.vibe) +
    check("countdown", "Show a three-second countdown", cfg.countdown) +
    check("full", "Use full screen where supported", cfg.full) +
    field("Card text size", sel("font", ["Medium", "Large", "Extra large"], cfg.font));
  return panel(
    "Setup · " + step + " of 3",
    ["Your two teams", "Rounds & categories", "Game controls"][step - 1],
    (step === 1
      ? '<div class="grid">' + names + "</div>"
      : step === 2
        ? settings + categories
        : prefs) +
      '<p id="error" role="alert"></p><div class="actions">' +
      btn("back", "Back") +
      btn("next", step === 3 ? "Create game" : "Continue →", "primary") +
      "</div>",
  );
}
function capture() {
  if (step === 1) {
    cfg.names = [0, 1].map((i) => $("#name" + i).value.trim() || "Team " + (i ? "B" : "A"));
    cfg.members = [0, 1].map((i) =>
      $("#members" + i)
        .value.split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  if (step === 2) {
    cfg.seconds = Number($("#seconds").value);
    const r = $("#rounds").value;
    cfg.rounds = r === "Unlimited" ? r : Number(r === "Custom" ? $("#roundNum").value : r);
    cfg.mode = $("#mode").value;
    cfg.cats = [...document.querySelectorAll(".category:checked")].map((c) => c.value);
  }
  if (step === 3) {
    for (const k of ["motion", "sound", "vibe", "countdown", "full"]) cfg[k] = $("#" + k).checked;
    cfg.preset = $("#preset").value;
    cfg.font = $("#font").value;
  }
}
