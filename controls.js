"use strict";

function render() {
  const t = turn();
  document.body.className =
    page === "game"
      ? "gameplay" +
        (t?.phase === "feedback"
          ? t.cards.at(-1)?.result === "Correct"
            ? " correct-bg"
            : " pass-bg"
          : "")
      : "";
  const screens = {
    home,
    setup,
    handoff,
    game: gameScreen,
    summary,
    board: () => scoreboard(),
    final: () => scoreboard(true),
  };
  app.innerHTML =
    screens[page]() +
    (storageError ? notify("This browser could not save your game. Keep this tab open.") : "");
}
function nextRound() {
  if (round().turns.every(Boolean)) {
    if (round().tie || (cfg.rounds !== "Unlimited" && g.rounds.length >= cfg.rounds)) {
      endGame();
      return;
    }
    newRound();
  }
  g.view = "handoff";
  message = "";
  save();
  goto("handoff");
}
function endGame() {
  g.over = true;
  g.view = "final";
  save();
  goto("final");
}
async function calibration() {
  const nonce = serial;
  const from = page;
  motion?.preset(cfg.preset);
  if (!motion) {
    setMessage("Motion sensors are unavailable. Use the Correct and Pass buttons.");
    return;
  }
  const button = document.querySelector('[data-act="calibrate"],[data-act="offerMotion"]');
  if (button) button.disabled = true;
  const attempt = motion.enable();
  if (!(await attempt) || nonce !== serial) {
    if (nonce === serial) {
      cfg.motion = false;
      save();
      setMessage(
        (motion.reason || "Motion permission is unavailable.") + " Button controls are ready.",
      );
    }
    return;
  }
  cfg.motion = true;
  setMessage("Hold still for two seconds, phone sideways and screen facing your teammates.");
  const calBtn = document.querySelector('[data-act="calibrate"]');
  if (calBtn) calBtn.disabled = true;
  const ok = await motion.calibrate();
  if (nonce !== serial || from !== page) return;
  if (!ok) cfg.motion = false;
  message = ok
    ? "Calibrated! Tilt down for correct, up to pass."
    : (motion.reason || "No sensor reading.") + " Button controls are ready.";
  save();
  render();
}
function audioReady() {
  if (cfg.sound && !audio)
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  audio?.resume?.().catch(() => {});
}
function startWithControls(isPractice) {
  audioReady();
  if (cfg.motion && !motion?.isCalibrated) {
    showModal(
      '<h2>Choose your controls</h2><p>Calibrate tilt with the screen facing your team, or play this turn using buttons.</p><div class="actions">' +
        btn("modalCal", "Calibrate tilt", "primary") +
        btn(isPractice ? "practiceManual" : "startManual", "Use buttons") +
        "</div>",
    );
    return;
  }
  takeTurn(isPractice);
}
