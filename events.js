"use strict";

document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act]");
  if (el) {
    ev.preventDefault();
    handle(el.dataset.act);
  }
});
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.id === "rounds") $("#customCount").hidden = el.value !== "Custom";
  if (el.id === "roundCat") {
    round().cat = el.value;
    round().pools = null;
    save();
    render();
  }
  if (el.id === "player") {
    g.guesser = el.value;
    save();
  }
  if (el.dataset.card) {
    const [ri, i, j] = el.dataset.card.split(",").map(Number);
    const c = g.rounds[ri].turns[i].cards[j];
    if (c.result === "Correct" && el.value !== "Correct" && totals()[i] < 1) {
      el.value = c.result;
      showModal(
        "<h2>Score already at zero</h2><p>Update the host adjustment before removing this point.</p>",
      );
      return;
    }
    c.result = el.value;
    g.shared = false;
    save();
    render();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && page === "game" && turn()?.phase !== "paused") pause();
});
window.addEventListener("pagehide", () => {
  if (page === "game" && turn()?.phase !== "paused") pause();
});
render();
