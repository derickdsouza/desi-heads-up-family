"use strict";

function handle(a) {
  switch (a) {
    case "close":
      modal.close();
      break;
    case "confirm":
      modal.close();
      if (pending) {
        const fn = pending;
        pending = null;
        fn();
      }
      break;
    case "help":
      help();
      break;
    case "home":
      if (page !== "game") goto("home");
      break;
    case "setup":
      cfg = defaults();
      step = 1;
      goto("setup");
      break;
    case "resumeGame":
      message = "";
      goto(g.over ? "final" : g.turn ? "game" : g.view);
      break;
    case "back":
      capture();
      if (step > 1) {
        step--;
        render();
      } else goto("home");
      break;
    case "next":
      capture();
      if (
        step === 2 &&
        (!cfg.cats.length ||
          (cfg.rounds !== "Unlimited" &&
            (!Number.isInteger(cfg.rounds) || cfg.rounds < 1 || cfg.rounds > 999)))
      ) {
        $("#error").textContent = "Choose at least one category and a round count from 1 to 999.";
        break;
      }
      if (step < 3) {
        step++;
        goto("setup");
      } else {
        g = { rounds: [], turn: null, order: [], view: "handoff", over: false };
        newRound();
        message = "";
        goto("handoff");
      }
      break;
    case "addDeck": {
      const n = $("#customName").value.trim(),
        cards = [
          ...new Set(
            $("#customCards")
              .value.split("\n")
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ];
      if (
        !n ||
        Object.hasOwn(allDecks(), n) ||
        ["__proto__", "Mixed categories"].includes(n) ||
        cards.length < 2
      ) {
        $("#error").textContent =
          "Use a new category name and enter at least two different cards.";
        break;
      }
      capture();
      cfg.custom[n] = cards;
      cfg.cats.push(n);
      render();
      break;
    }
    case "calibrate":
    case "offerMotion":
    case "modalCal":
      if (modal.open) modal.close();
      calibration().catch(() => {
        cfg.motion = false;
        save();
        setMessage("Sensor access failed. Button controls are ready.");
      });
      break;
    case "manual":
      cfg.motion = false;
      motion?.destroy();
      save();
      setMessage("Button controls are ready.");
      break;
    case "swap":
      round().first = 1 - round().first;
      g.guesser = null;
      save();
      render();
      break;
    case "start":
    case "practice":
      startWithControls(a === "practice");
      break;
    case "startManual":
    case "practiceManual":
      modal.close();
      cfg.motion = false;
      takeTurn(a === "practiceManual");
      break;
    case "pause":
      pause();
      break;
    case "resume":
      begin();
      break;
    case "scoreCorrect":
      score("Correct");
      break;
    case "scorePass":
      score("Passed");
      break;
    case "nextCard":
      advance();
      break;
    case "undo": {
      const t = turn();
      if (t?.cards.length) {
        clearTimeout(delay);
        t.cards.pop();
        t.phase = "playing";
        motion?.stop();
        resumeSensors();
        save();
        render();
      }
      break;
    }
    case "restart":
      confirmAction("Restart this turn from zero?", () => {
        const t = turn();
        t.cards = [];
        t.remaining = (practice ? 30 : round().seconds) * 1000;
        begin();
      });
      break;
    case "cancel":
      confirmAction("Cancel this turn and discard its answers?", () => {
        practice = false;
        pTurn = null;
        g.turn = null;
        g.view = "handoff";
        save();
        message = "Turn cancelled. The same team can try again.";
        goto("handoff");
      });
      break;
    case "replay":
      if (totals()[g.last] < pts(round().turns[g.last])) {
        showModal(
          "<h2>Adjust the score first</h2><p>Replaying this turn would put the team below zero. Review its host adjustments on the scoreboard first.</p>",
        );
        break;
      }
      confirmAction("Replace this turn and its points?", () => {
        const i = g.last;
        g.guesser = round().turns[i].player;
        round().turns[i] = null;
        g.view = "handoff";
        save();
        goto("handoff");
      });
      break;
    case "continue":
      nextRound();
      break;
    case "board":
      goto("board");
      break;
    case "return":
      goto(g.view);
      break;
    case "end":
      confirmAction("End the game with the current scores?", endGame);
      break;
    case "reset":
      confirmAction("Clear the saved game and start again?", () => {
        g = null;
        cfg = defaults();
        practice = false;
        step = 1;
        message = "";
        motion?.destroy();
        save();
        goto("setup");
      });
      break;
    case "adjust": {
      const i = Number($("#adjTeam").value),
        n = Number($("#adjPoints").value);
      if (!Number.isSafeInteger(n) || !n || totals()[i] + n < 0) {
        $("#error").textContent =
          "Enter a whole-number change that keeps the team total at zero or higher.";
        break;
      }
      round().adjust[i] += n;
      g.shared = false;
      save();
      render();
      break;
    }
    case "tie":
      g.over = false;
      g.shared = false;
      newRound(true);
      g.view = "handoff";
      message = "Both teams get 30 seconds with fresh cards.";
      save();
      goto("handoff");
      break;
    case "shareWin":
      g.shared = true;
      save();
      render();
      break;
  }
}
