/* Screen elevation is positive facing the ceiling and negative facing the floor.
   The screen normal is independent of which short edge points left. */
(function () {
  'use strict';
  function createMotionControl(win) {
    const degrees = 180 / Math.PI;
    const now = () => win.performance.now();
    const orientation = win.screen?.orientation;
    const screenAngle = () => orientation?.angle ?? win.orientation ?? 0;
    let angle = screenAngle();
    let enabled = false, reason = '', threshold = 35, baseline = null;
    let elevation = null, readAt = -Infinity, fromOrientation = false;
    let levelSince = null;
    let active = null, calibration = null, timer = null;
    let filtered = null, candidate = null, since = 0, lastScore = 0, gate = 'start';
    const subscriptions = [];
    // iOS WebKit exposes Core Motion gravity with negative Z when face-up.
    const nav = win.navigator;
    const appleMobile = /^(iPhone|iPad|iPod)$/.test(nav?.platform)
      || (nav?.platform === 'MacIntel' && nav.maxTouchPoints > 1);
    let gravitySign = appleMobile ? -1 : 1;
    let up = null;

    function listen(target, type, fn) {
      target?.addEventListener(type, fn);
      if (target) subscriptions.push(() => target.removeEventListener(type, fn));
    }

    function stop() {
      active = null;
      filtered = null;
      candidate = null;
      win.clearInterval(timer);
      timer = null;
      calibration?.resolve(false);
      calibration = null;
    }

    function invalidate(message) {
      const notify = active?.invalid;
      reason = message;
      baseline = null;
      stop();
      notify?.(message);
    }

    function checkAngle() {
      if (angle === screenAngle()) return;
      angle = screenAngle();
      elevation = null;
      fromOrientation = false;
      invalidate('The phone rotated. Hold it facing your team and recalibrate.');
    }

    function record(value, orientationSample) {
      const t = now();
      if (!fromOrientation && t - readAt >= 500) levelSince = null;
      elevation = value;
      fromOrientation = orientationSample;
      readAt = t;
      if (baseline !== null && Math.abs(value - baseline) <= 15) levelSince ??= t;
      else levelSince = null;
    }

    function orientationReading(e) {
      if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
      checkAngle();
      const beta = e.beta / degrees, gamma = e.gamma / degrees;
      const normalZ = Math.cos(beta) * Math.cos(gamma);
      up = { x: -Math.cos(beta) * Math.sin(gamma), y: Math.sin(beta), z: normalZ };
      record(Math.asin(Math.max(-1, Math.min(1, normalZ))) * degrees, true);
    }

    function motionReading(e) {
      checkAngle();
      const orientationAge = fromOrientation ? now() - readAt : Infinity;
      const g = e.accelerationIncludingGravity;
      if (!g || ![g.x, g.y, g.z].every(Number.isFinite)) return;
      const magnitude = Math.hypot(g.x, g.y, g.z);
      const a = e.acceleration;
      if (Math.abs(magnitude - 9.81) > 1.8 || (a && Math.hypot(a.x, a.y, a.z) > 2.5)) {
        if (orientationAge >= 350) elevation = levelSince = null;
        return;
      }
      // Compare near-simultaneous vectors, including X/Y for an upright
      // phone. A parallel or antiparallel pair identifies the sensor sign.
      if (orientationAge < 100) {
        const alignment = (up.x * g.x + up.y * g.y + up.z * g.z) / magnitude;
        if (Math.abs(alignment) > 0.95) gravitySign = Math.sign(alignment);
      }
      if (orientationAge < 350) return;
      record(Math.atan2(gravitySign * g.z, Math.hypot(g.x, g.y)) * degrees, false);
    }

    async function enable() {
      if (enabled) return true;
      const sources = [
        [win.DeviceOrientationEvent, 'deviceorientation', orientationReading],
        [win.DeviceMotionEvent, 'devicemotion', motionReading],
      ].filter(([api]) => api);
      reason = '';
      // Start every permission request inside the same user activation.
      const allowed = await Promise.all(sources.map(async ([api]) => {
        try { return !api.requestPermission || await api.requestPermission() === 'granted'; }
        catch { return false; }
      }));
      sources.forEach(([, type, fn], i) => { if (allowed[i]) listen(win, type, fn); });
      enabled = allowed.includes(true);
      if (!enabled) {
        reason = sources.length ? 'Motion permission was denied. Use the on-screen buttons.'
          : 'This device has no motion sensors available. Use the on-screen buttons.';
        return false;
      }
      angle = screenAngle();
      listen(orientation, 'change', checkAngle);
      listen(win, 'orientationchange', checkAngle);
      return true;
    }

    function sampleCalibration(t, value) {
      const c = calibration;
      // Use the last second so the player has time to settle into position.
      if (t >= c.start + 1000 && value !== null) c.samples.push(value);
      if (t < c.start + 2000) return;
      const samples = c.samples;
      const enough = samples.length >= 10 && value !== null;
      if (enough && Math.max(...samples) - Math.min(...samples) <= 10) {
        const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
        if (Math.abs(mean) < 55) {
          baseline = mean;
          levelSince = c.start + 1000;
        }
      }
      reason = baseline !== null ? '' : !enough
        ? 'No steady motion readings. Try again or use the on-screen buttons.'
        : 'Hold the screen upright, facing your team, and calibrate again.';
      calibration = null;
      stop();
      c.resolve(baseline !== null);
    }

    function step() {
      checkAngle();
      const t = now();
      // Change-only orientation retains its pose during play. Calibration
      // still needs a recent reading, and gravity is a streaming sensor.
      const validFor = fromOrientation ? (calibration ? 3000 : Infinity) : 500;
      const value = t - readAt < validFor ? elevation : null;
      if (calibration) return sampleCalibration(t, value);
      if (!active) return;
      if (value === null) {
        candidate = filtered = null;
        if (t - Math.max(readAt, active.start) > 2000) {
          invalidate('Motion readings stopped. Recalibrate or use the on-screen buttons.');
        }
        return;
      }
      const relative = value - baseline;
      filtered = filtered === null ? relative : filtered + 0.4 * (relative - filtered);
      let target = null;
      if (gate !== 'ready') {
        if (Math.abs(filtered) <= 15 && Math.abs(relative) <= 15) target = 'level';
      } else if (filtered <= -threshold && relative <= -threshold) target = 'correct';
      else if (filtered >= threshold && relative >= threshold) target = 'pass';
      if (target !== candidate) {
        candidate = target;
        since = t;
      }
      if (!candidate || t - since < 200) return;
      candidate = null;
      if (target === 'level') {
        if (gate === 'feedback' && t - lastScore < 320) return;
        const advance = gate === 'feedback';
        gate = 'ready';
        if (advance) active.neutral?.();
      } else {
        gate = 'feedback';
        lastScore = t;
        active.gesture(target);
      }
    }

    function calibrate() {
      checkAngle();
      stop();
      baseline = null;
      if (!enabled) return Promise.resolve(false);
      return new Promise(resolve => {
        calibration = { start: now(), samples: [], resolve };
        timer = win.setInterval(step, 40);
      });
    }

    return {
      enable, calibrate, stop,
      get reason() { return reason; },
      get isCalibrated() { return baseline !== null; },
      preset(name) { threshold = ({ easy: 25, standard: 35, strict: 45 })[String(name).toLowerCase()] ?? 35; },
      play(gesture, neutral, invalid) {
        stop();
        if (baseline === null) return false;
        active = { gesture, neutral, invalid, start: now() };
        // A settled phone can tilt as soon as the first card appears.
        const settled = levelSince !== null && now() - levelSince >= 200;
        gate = settled && (fromOrientation || now() - readAt < 500) ? 'ready' : 'start';
        timer = win.setInterval(step, 40);
        return true;
      },
      waitForNeutral() {
        if (!active) return;
        gate = 'feedback';
        lastScore = now();
        candidate = null;
      },
      destroy() {
        stop();
        subscriptions.splice(0).forEach(remove => remove());
        enabled = fromOrientation = false;
        baseline = elevation = null;
        readAt = -Infinity;
      },
    };
  }

  if (typeof window !== 'undefined') window.motionControl = createMotionControl(window);
  if (typeof module !== 'undefined' && module.exports) module.exports = { createMotionControl };
})();
