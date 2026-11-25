"use strict";

function summary() {
  const i = g.last,
    t = round().turns[i];
  return panel(
    roundTitle() + " · Turn complete",
    esc(cfg.names[i]) + " scored " + pts(t),
    '<p class="lead">' +
      esc(round().cat) +
      (t.player ? " · " + esc(t.player) : "") +
      "</p>" +
      review(g.rounds.length - 1, i) +
      '<div class="actions">' +
      btn(
        "continue",
        round().turns.every(Boolean) ? "Finish round" : "Pass the phone",
        "primary",
      ) +
      btn("replay", "Replay turn") +
      btn("board", "Scoreboard") +
      "</div>",
  );
}
function review(ri, i) {
  const t = g.rounds[ri].turns[i];
  return (
    "<details><summary>Review answers (" +
    t.cards.length +
    ")</summary>" +
    t.cards
      .map(
        (c, j) =>
          '<label class="summary-line"><span>' +
          esc(c.word) +
          '</span><select aria-label="Result for ' +
          esc(c.word) +
          '" data-card="' +
          [ri, i, j].join(",") +
          '">' +
          choices(["Correct", "Passed", "Unanswered"], c.result) +
          "</select></label>",
      )
      .join("") +
    "</details>"
  );
}
function scoreboard(final = false) {
  const sums = totals(),
    complete = g.rounds.filter((r) => r.turns.every(Boolean)).length;
  const rows = g.rounds
    .map(
      (r, ri) =>
        "<tr><td>" +
        esc(r.cat) +
        "<br><small>" +
        (r.tie ? "Tie-breaker" : "Round " + (ri + 1)) +
        "</small></td>" +
        [0, 1]
          .map(
            (i) =>
              "<td>" +
              (r.turns[i] || r.adjust[i]
                ? (r.turns[i] ? pts(r.turns[i]) : 0) + r.adjust[i]
                : "—") +
              "</td>",
          )
          .join("") +
        "</tr>",
    )
    .join("");
  const inProgress = !final && g.view === "handoff",
    orderText = inProgress
      ? '<p class="muted">Up now: ' +
        esc(cfg.names[active()]) +
        " · " +
        (round().turns.some(Boolean)
          ? "Last turn of this round"
          : "Next: " + esc(cfg.names[1 - active()])) +
        "</p>"
      : "";
  const tied = sums[0] === sums[1];
  let title = final
    ? tied
      ? g.shared
        ? "A shared victory!"
        : "It’s a tie!"
      : esc(cfg.names[sums[0] > sums[1] ? 0 : 1]) + " wins!"
    : "Scoreboard";
  return panel(
    final ? "Final results" : roundTitle(),
    title,
    '<p class="lead">' +
      leader() +
      " · " +
      complete +
      " complete round" +
      (complete === 1 ? "" : "s") +
      (final || cfg.rounds === "Unlimited"
        ? ""
        : " · " + Math.max(0, cfg.rounds - complete) + " remaining") +
      "</p>" +
      orderText +
      '<div class="grid">' +
      cfg.names
        .map(
          (n, i) =>
            '<div class="box ' +
            (i ? "orange" : "blue") +
            '"><strong>' +
            esc(n) +
            '</strong><div class="score">' +
            sums[i] +
            "</div><small>" +
            countTurns(i) +
            " completed turns</small></div>",
        )
        .join("") +
      '</div><table class="board"><thead><tr><th>Category</th>' +
      cfg.names.map((n) => "<th>" + esc(n) + "</th>").join("") +
      "</tr></thead><tbody>" +
      rows +
      "</tbody><tfoot><tr><th>Total</th><th>" +
      sums[0] +
      "</th><th>" +
      sums[1] +
      '</th></tr></tfoot></table><div class="actions">' +
      (final
        ? (tied && !g.shared
            ? btn("tie", "Play 30s tie-breaker", "primary") + btn("shareWin", "Share victory")
            : "") + btn("reset", "New game")
        : btn("return", "Return to game", "primary") + btn("end", "End game early")) +
      "</div><details><summary>Host score adjustments</summary>" +
      field(
        "Team",
        '<select id="adjTeam">' +
          cfg.names.map((n, i) => '<option value="' + i + '">' + esc(n) + "</option>").join("") +
          "</select>",
      ) +
      field(
        "Points to add or subtract",
        '<input type="number" id="adjPoints" step="1" value="1">',
      ) +
      btn("adjust", "Apply adjustment") +
      '<p id="error" role="alert"></p></details><details><summary>Turn history & answer review</summary>' +
      g.rounds
        .map(
          (r, ri) =>
            [0, 1]
              .map((i) =>
                r.turns[i]
                  ? "<h3>Round " +
                    (ri + 1) +
                    " · " +
                    esc(cfg.names[i]) +
                    "</h3><p>" +
                    esc(r.cat) +
                    " · " +
                    pts(r.turns[i]) +
                    " correct" +
                    (r.turns[i].player ? " · " + esc(r.turns[i].player) : "") +
                    "</p>" +
                    review(ri, i)
                  : "",
              )
              .join("") +
            (r.adjust.some(Boolean)
              ? "<p>Host adjustments: " +
                cfg.names
                  .map((n, i) => esc(n) + " " + (r.adjust[i] > 0 ? "+" : "") + r.adjust[i])
                  .join(" · ") +
                "</p>"
              : ""),
        )
        .join("") +
      "</details>",
  );
}
