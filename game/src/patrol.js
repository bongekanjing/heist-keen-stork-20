// Where things look, and when. A guard walks its loop of waypoints at its own pace, stops at each
// one for the pause its beat names, and turns on the spot: the cone swings before the body moves,
// which is the window a player reads. A camera never moves; only its bearing sweeps, slowly, on a
// sine, so its cone breathes across the floor rather than snapping.
//
// Nothing here draws. patrol.js decides bearings; guard.js decides why a guard left its beat.

import { GUARD } from './config.js';

/** Shortest turn from `from` to `to`, in radians, signed. */
export function turnToward(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/** Ease a bearing toward a wanted one at `rate` radians a second; returns the new bearing. */
export function rotateToward(from, to, rate, dt) {
  const delta = turnToward(from, to);
  const step = rate * dt;
  if (Math.abs(delta) <= step) return to;
  return from + Math.sign(delta) * step;
}

/** Give a fresh, plausible guard: on its first waypoint, facing the next one, cone closed to a slit. */
export function createGuard(guard) {
  const first = guard.path[0];
  const next = guard.path[1 % guard.path.length];
  return {
    id: guard.id,
    name: guard.name,
    path: guard.path,
    pauses: Array.isArray(guard.pauses) ? guard.pauses : guard.path.map(() => guard.pauses),
    pace: guard.pace,
    x: first.x,
    y: first.y,
    facing: Math.atan2(next.y - first.y, next.x - first.x),
    target: 1 % guard.path.length,
    pause: 0,
    state: 'patrol',
    speed: 0,
    lookAt: null,
    lookFor: 0,
    alert: false,
    // The cone: an eye, a centre bearing, a half-angle in radians and a reach in world units.
    eye: { x: first.x, y: first.y, angle: 0, half: 0.42, range: 268 },
    scan: 0,
    scanRate: GUARD.scanRate,
    // Set while the guard is chasing the thief: the cone narrows and reaches further.
    fixed: null,
  };
}

/** Guards start mid-beat so a first look at the room never shows them all stacked on waypoint one. */
export function seedGuard(guard, progress) {
  if (guard.path.length < 2) return guard;
  const span = guard.path.length - 1;
  guard.target = 1 + Math.floor(progress * span) % span;
  const from = guard.path[guard.target - 1];
  const to = guard.path[guard.target];
  const fraction = (progress * span) % 1;
  guard.x = from.x + (to.x - from.x) * fraction;
  guard.y = from.y + (to.y - from.y) * fraction;
  guard.facing = Math.atan2(to.y - from.y, to.x - from.x);
  guard.eye.x = guard.x;
  guard.eye.y = guard.y;
  guard.eye.angle = guard.facing;
  return guard;
}

/** Walk a patrolling guard one step along its loop, pausing and turning at each waypoint. */
export function stepPatrol(guard, dt) {
  const count = guard.path.length;
  guard.speed = 0;

  if (guard.pause > 0) {
    guard.pause -= dt;
    guard.scan += dt * guard.scanRate;
    guard.facing = rotateToward(guard.facing, guard.beatBearing ?? guard.facing, GUARD.turn, dt);
    guard.speed = 0;
  } else {
    const waypoint = guard.path[guard.target];
    const dx = waypoint.x - guard.x;
    const dy = waypoint.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) {
      guard.x = waypoint.x;
      guard.y = waypoint.y;
      guard.pause = guard.pauses[guard.target] ?? 1.2;
      guard.target = (guard.target + 1) % count;
      const next = guard.path[guard.target];
      guard.beatBearing = Math.atan2(next.y - waypoint.y, next.x - waypoint.x);
      guard.scan = 0;
    } else {
      const wanted = Math.atan2(dy, dx);
      guard.facing = rotateToward(guard.facing, wanted, GUARD.turn, dt);
      const speed = guard.pace * (Math.abs(turnToward(guard.facing, wanted)) < 0.5 ? 1 : 0.35);
      const travel = Math.min(distance, speed * dt);
      guard.x += Math.cos(guard.facing) * travel;
      guard.y += Math.sin(guard.facing) * travel;
      guard.speed = speed;
    }
  }

  linkEye(guard);
  return guard;
}

/** Put the eye on the body and sweep the cone around the body's bearing while standing still. */
export function linkEye(guard) {
  guard.eye.x = guard.x;
  guard.eye.y = guard.y;
  guard.eye.angle = guard.facing + Math.sin(guard.scan) * GUARD.scanAmplitude * (guard.pause > 0 ? 1 : 0.25);
  guard.eye.half = guard.alert ? 0.34 : 0.42;
  guard.eye.range = guard.alert ? 320 : 268;
}

/** Sweep a camera's bearing on a slow sine around the wall it hangs on. */
export function stepCameraSweep(camera, dt) {
  camera.phase = (camera.phase ?? 0) + dt * camera.rate;
  camera.angle = camera.base + Math.sin(camera.phase) * camera.sweep;
  if (Number.isNaN(camera.angle)) camera.angle = camera.base;
  return camera;
}

/** Freeze a camera's sweep at a given phase, so a screenshot of it is the same every time. */
export function setCameraPhase(camera, phase) {
  camera.phase = phase;
  camera.angle = camera.base + Math.sin(phase) * camera.sweep;
  return camera;
}

/** True when the guard has reached the point it was sent to look at. */
export function atLookPoint(guard, tolerance = 14) {
  if (!guard.lookAt) return true;
  return Math.hypot(guard.lookAt.x - guard.x, guard.lookAt.y - guard.y) < tolerance;
}
