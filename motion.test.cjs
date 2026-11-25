const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMotionControl } = require('./motion.js');

function rig(apis = {}) {
  let time = 0;
  const timers = new Set();
  const win = Object.assign(new EventTarget(), {
    DeviceOrientationEvent: class {},
    performance: { now: () => time },
    setInterval: fn => (timers.add(fn), fn),
    clearInterval: fn => timers.delete(fn),
    screen: { orientation: Object.assign(new EventTarget(), { angle: 90 }) },
  }, apis);
  const control = createMotionControl(win);
  const event = (type, data) => win.dispatchEvent(Object.assign(new Event(type), data));
  const tick = ms => {
    const end = time + ms;
    while (time < end) {
      time += 40;
      for (const fn of timers) fn();
    }
  };
  return { win, control, tick, event, orient: (beta, gamma) => event('deviceorientation', { beta, gamma }) };
}

test('down scores once, up passes, and level advances even on change-only sensors', async () => {
  const r = rig();
  assert.ok(await r.control.enable());
  const ready = r.control.calibrate();
  r.orient(0, 85);
  r.tick(2000);
  assert.ok(await ready);
  const seen = [];
  r.control.play(action => seen.push(action), () => seen.push('next'));
  r.tick(400);
  r.orient(180, 45);
  r.tick(2000);
  assert.deepEqual(seen, ['correct']);
  r.orient(0, 40);
  r.tick(800);
  assert.deepEqual(seen, ['correct']);
  r.orient(0, 85);
  r.tick(600);
  r.orient(0, 40);
  r.tick(600);
  assert.deepEqual(seen, ['correct', 'next', 'pass']);
});

test('presets use the calibrated neutral in either landscape direction and portrait', async () => {
  for (const [angle, gamma, beta] of [[90, 80, 0], [270, -80, 0], [0, 0, 80]]) {
    for (const [preset, degrees, expected] of [
      ['easy', 28, ['pass']], ['standard', 28, []], ['standard', 39, ['pass']], ['strict', 39, []],
    ]) {
      const r = rig();
      r.win.screen.orientation.angle = angle;
      await r.control.enable();
      const ready = r.control.calibrate();
      r.orient(beta, gamma);
      r.tick(2000);
      assert.ok(await ready);
      r.control.preset(preset);
      const actions = [];
      r.control.play(a => actions.push(a));
      r.tick(400);
      r.orient(beta ? beta - degrees : 0, gamma ? Math.sign(gamma) * (80 - degrees) : 0);
      r.tick(650);
      assert.deepEqual(actions, expected);
    }
  }
});

test('handoffs, pauses, shakes and brief threshold crossings cannot score', async () => {
  const r = rig();
  await r.control.enable();
  const ready = r.control.calibrate();
  r.orient(0, 90);
  r.tick(2000);
  assert.ok(await ready);
  const seen = [];
  r.orient(0, 30);
  r.control.play(a => seen.push(a));
  r.tick(700);
  r.orient(0, 90);
  r.tick(400);
  for (let j = 0; j < 4; j++) {
    r.orient(0, 30);
    r.tick(120);
    r.orient(0, 90);
    r.tick(120);
  }
  r.control.stop();
  r.orient(0, 30);
  r.tick(2000);
  r.control.play(a => seen.push(a), null, msg => seen.push(msg));
  r.tick(600);
  assert.deepEqual(seen, []);
  r.win.screen.orientation.angle = 270;
  r.win.screen.orientation.dispatchEvent(new Event('change'));
  assert.match(seen[0], /recalibrate/);
  assert.equal(r.control.isCalibrated, false);
});

test('gravity-only fallback rejects acceleration spikes, recognises downward tilt and reports signal loss', async () => {
  const r = rig({ DeviceOrientationEvent: null, DeviceMotionEvent: class {} });
  const gravity = (x, z, ms) => {
    for (let t = 0; t < ms; t += 40) {
      r.event('devicemotion', { accelerationIncludingGravity: { x, y: 0, z } });
      r.tick(40);
    }
  };
  assert.ok(await r.control.enable());
  const ready = r.control.calibrate();
  gravity(-9.8, 0, 2000);
  assert.ok(await ready);
  const seen = [];
  r.control.play(a => seen.push(a), null, msg => seen.push(msg));
  gravity(-9.8, 0, 400);
  gravity(-3, -20, 600);
  assert.deepEqual(seen, []);
  gravity(-6.93, -6.93, 600);
  assert.deepEqual(seen, ['correct']);
  r.tick(2100);
  assert.match(seen[1], /stopped/);
});

test('denial, missing readings and an unstable calibration each offer recovery', async () => {
  const denied = rig({ DeviceOrientationEvent: { requestPermission: async () => 'denied' } });
  assert.equal(await denied.control.enable(), false);
  assert.match(denied.control.reason, /permission/);
  const r = rig();
  assert.ok(await r.control.enable());
  const missing = r.control.calibrate();
  r.orient(null, null);
  r.tick(2000);
  assert.equal(await missing, false);
  const moving = r.control.calibrate();
  r.orient(0, 90);
  r.tick(1600);
  r.orient(0, 55);
  r.tick(400);
  assert.equal(await moving, false);
  assert.match(r.control.reason, /Hold/);
});

test('a sleeping orientation stream yields to live gravity and stale samples cannot recalibrate', async () => {
  const r = rig({ DeviceMotionEvent: class {} });
  await r.control.enable();
  const ready = r.control.calibrate();
  r.orient(0, 90);
  r.tick(2000);
  assert.ok(await ready);
  const seen = [];
  r.control.play(a => seen.push(a));
  r.tick(400);
  for (let i = 0; i < 20; i++) {
    r.event('devicemotion', { accelerationIncludingGravity: { x: 6.93, y: 0, z: -6.93 } });
    r.tick(40);
  }
  assert.deepEqual(seen, ['correct']);
  r.control.stop();
  r.tick(10000);
  const retry = r.control.calibrate();
  r.tick(2000);
  assert.equal(await retry, false);
});

test('a player can think with the phone upright for twenty seconds before tilting', async () => {
  const r = rig();
  await r.control.enable();
  const ready = r.control.calibrate();
  r.orient(0, 90);
  r.tick(2000);
  assert.ok(await ready);
  const seen = [];
  r.control.play(a => seen.push(a), null, msg => seen.push(msg));
  r.tick(20000);
  assert.deepEqual(seen, []);
  r.orient(180, 40);
  r.tick(600);
  assert.deepEqual(seen, ['correct']);
});

test('the first tilt after the countdown scores from either landscape hold', async () => {
  for (const [angle, side, pitch, action] of [[90, 1, 180, 'correct'], [270, -1, 0, 'pass']]) {
    const r = rig();
    r.win.screen.orientation.angle = angle;
    await r.control.enable();
    const ready = r.control.calibrate();
    r.orient(0, side * 88);
    r.tick(2000);
    assert.ok(await ready);
    r.tick(3000);
    const seen = [];
    r.control.play(a => seen.push(a));
    r.orient(pitch, side * 40);
    r.tick(600);
    assert.deepEqual(seen, [action]);
  }
});

test('gravity-only iPhone Safari scores screen down and passes screen up', async () => {
  const r = rig({
    DeviceOrientationEvent: null, DeviceMotionEvent: class {},
    navigator: { platform: 'iPhone' },
  });
  const gravity = (x, z, ms) => {
    for (let t = 0; t < ms; t += 40) {
      r.event('devicemotion', { accelerationIncludingGravity: { x, y: 0, z } });
      r.tick(40);
    }
  };
  await r.control.enable();
  const ready = r.control.calibrate();
  gravity(9.81, 0, 2000);
  assert.ok(await ready);
  const seen = [];
  r.control.play(a => seen.push(a), () => seen.push('next'));
  gravity(6.93, 6.93, 600);
  gravity(9.81, 0, 600);
  gravity(6.93, -6.93, 600);
  assert.deepEqual(seen, ['correct', 'next', 'pass']);
});

test('paired sensors agree on tilt direction when gravity takes over', async () => {
  // Platform alone cannot determine which convention the browser implements.
  for (const [platform, x] of [['iPhone', -9.81], ['unknown', 9.81]]) {
    const r = rig({ navigator: { platform }, DeviceMotionEvent: class {} });
    await r.control.enable();
    const ready = r.control.calibrate();
    r.orient(0, 90);
    r.event('devicemotion', { accelerationIncludingGravity: { x, y: 0, z: 0 } });
    r.tick(2000);
    assert.ok(await ready);
    const seen = [];
    r.control.play(a => seen.push(a));
    for (let i = 0; i < 16; i++) {
      const axis = Math.sign(x) * 6.93;
      r.event('devicemotion', { accelerationIncludingGravity: { x: axis, y: 0, z: axis } });
      r.tick(40);
    }
    assert.deepEqual(seen, ['correct']);
  }
});
