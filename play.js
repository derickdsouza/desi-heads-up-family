"use strict";

function gameScreen() {
  const t = turn(),
    fb = t.phase === "feedback",
    p = t.phase === "paused",
    cd = t.phase === "countdown",
    word = t.deck[t.cards.length],
    last = t.cards.at(-1),
    clockAtTop = p || cd,
    clock =
      "<span" +
      (clockAtTop ? "" : ' class="turn-clock"') +
      ' role="timer" aria-label="Seconds remaining"><span id="clock">' +
      Math.ceil(t.remaining / 1000) +
      '</span><span aria-hidden="true">s</span></span>';
  return (
    '<section class="game" style="--font:' +
    { Medium: "6vw", Large: "8.5vw", "Extra large": "11vw" }[cfg.font] +
    '"><div class="topline"><span class="badge t' +
    t.team +
    '">' +
    (practice ? "Practice" : esc(cfg.names[t.team])) +
    "</span><span>" +
    esc(practice ? "Warm-up" : round().cat) +
    "</span>" +
    (clockAtTop ? clock : "") +
    '</div><div><p class="kicker">' +
    (p
      ? "Time is paused"
      : cd
        ? "Get ready"
        : fb
          ? ""
          : practice
            ? "Practice card"
            : "Guess the word") +
    "</p>" +
    (clockAtTop ? "" : clock) +
    '<h1 class="cardword" aria-live="polite">' +
    (p
      ? "Paused"
      : cd
        ? countdown
        : fb
          ? last.result === "Correct"
            ? "CORRECT! +1"
            : "PASS"
          : esc(word)) +
    "</h1>" +
    (fb
      ? "<p>" +
        (cfg.motion && motion?.isCalibrated
          ? "Return the phone to neutral."
          : "Next card coming up…") +
        "</p>"
      : "") +
    "</div><div>" +
    notify(message) +
    '<div class="actions">' +
    (p
      ? btn("resume", "Resume", "primary") +
        btn("restart", "Restart turn") +
        btn("cancel", "Cancel turn") +
        (cfg.motion ? btn("calibrate", "Recalibrate") : "")
      : cd
        ? btn("pause", "Pause")
        : (!fb
            ? btn("scorePass", "Pass", "pass") + btn("scoreCorrect", "Correct +1", "good")
            : "") +
          (fb ? btn("nextCard", "Show next card") : "") +
          btn("undo", "Undo", "secondary", t.cards.length ? "" : "disabled") +
          btn("pause", "Pause")) +
    "</div></div></section>"
  );
}
function resumeSensors() {
  if (cfg.motion && motion?.isCalibrated)
    motion.play(
      (k) => score(k === "correct" ? "Correct" : "Passed", true),
      () => advance(),
      () => {
        pause();
        setMessage("Phone orientation changed. Recalibrate tilt or continue with the buttons.");
      },
    );
}
function begin() {
  stopTurnClock();
  page = "game";
  message = "";
  const t = turn();
  if (t.cards.length >= t.deck.length) {
    finishTurn();
    return;
  }
  if (cfg.full && !document.fullscreenElement) {
    try {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } catch {}
  }
  const run = () => {
    t.phase = "playing";
    deadline = performance.now() + t.remaining;
    render();
    resumeSensors();
    timer = setInterval(tick, 100);
    save();
  };
  if (cfg.countdown) {
    countdown = 3;
    t.phase = "countdown";
    render();
    timer = setInterval(() => {
      if (--countdown > 0) render();
      else {
        clearInterval(timer);
        run();
      }
    }, 1000);
  } else run();
}
function tick() {
  const t = turn();
  if (!t) return;
  t.remaining = Math.max(0, deadline - performance.now());
  if (t.remaining === 0) {
    finishTurn();
    return;
  }
  const c = $("#clock");
  if (c) c.textContent = Math.ceil(t.remaining / 1000);
}
function pause() {
  const t = turn();
  if (!t) return;
  if (["playing", "feedback"].includes(t.phase)) {
    tick();
    if (page !== "game") return;
  }
  t.phase = "paused";
  stopTurnClock();
  save();
  render();
}
function beep(correct) {
  if (cfg.vibe)
    try {
      navigator.vibrate?.(correct ? [80, 40, 80] : 75);
    } catch {}
  if (cfg.sound && audio) {
    try {
      const o = audio.createOscillator(),
        gain = audio.createGain(),
        now = audio.currentTime;
      o.connect(gain);
      gain.connect(audio.destination);
      o.frequency.setValueAtTime(correct ? 523 : 250, now);
      o.frequency.setValueAtTime(correct ? 784 : 196, now + 0.09);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      o.start();
      o.stop(now + 0.22);
    } catch {}
  }
}
function score(result, sensor = false) {
  const t = turn();
  if (!t || t.phase !== "playing") return;
  tick();
  if (!turn() || page !== "game") return;
  t.cards.push({ word: t.deck[t.cards.length], result });
  t.phase = "feedback";
  beep(result === "Correct");
  save();
  render();
  if (!sensor) {
    motion?.waitForNeutral?.();
    delay = setTimeout(advance, 420);
  }
}
function advance() {
  const t = turn();
  if (!t || t.phase !== "feedback") return;
  clearTimeout(delay);
  if (t.cards.length === t.deck.length) {
    finishTurn();
    return;
  }
  t.phase = "playing";
  save();
  render();
}
function finishTurn() {
  const t = turn();
  if (!t) return;
  stopTurnClock();
  if (t.phase !== "feedback" && t.cards.length < t.deck.length)
    t.cards.push({ word: t.deck[t.cards.length], result: "Unanswered" });
  if (practice) {
    practice = false;
    pTurn = null;
    message = "Practice complete. Your team scores are unchanged.";
    goto("handoff");
    return;
  }
  const i = t.team;
  round().turns[i] = { cards: t.cards, player: t.player };
  g.last = i;
  g.turn = null;
  g.view = "summary";
  message = "";
  save();
  goto("summary");
}
