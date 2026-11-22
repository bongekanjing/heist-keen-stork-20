// Sight, and what it costs. Every cone in the game is measured here: a segment cast from an eye to
// a point, cut short by whatever wall, crate or shut door stands between them. The same rays build
// the amber polygons the renderer fills, so what you see is exactly what the guards can see.
//
// The alarm is this file's other job. Exposure is how much of the thief the best eye can read this
// step (1 in the open, less crouched, much less in shadow, nothing behind cover); the alarm climbs
// while exposure holds and falls away the moment it stops. Reaching the top does not catch you on
// the spot: it starts a grace window, and line of sight broken inside it drops the alarm back to
// evaded. That is the fair caught moment — you are always given the moment to break the sight line.

import { ALARM } from './config.js';

/** Rays per cone: enough for a crisp edge, few enough to cast for every guard every step. */
const RAYS = 30;

/** Distance along a ray until it meets a rectangle, or Infinity. Slab test, in segment space. */
export function rayHit(x, y, dx, dy, rects) {
  let best = Infinity;
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    const minX = rect.x;
    const maxX = rect.x + rect.w;
    const minY = rect.y;
    const maxY = rect.y + rect.h;
    let tMin = 0;
    let tMax = best;
    if (Math.abs(dx) < 1e-9) {
      if (x < minX || x > maxX) continue;
    } else {
      let t1 = (minX - x) / dx;
      let t2 = (maxX - x) / dx;
      if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }
    if (Math.abs(dy) < 1e-9) {
      if (y < minY || y > maxY) continue;
    } else {
      let t1 = (minY - y) / dy;
      let t2 = (maxY - y) / dy;
      if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }
    if (tMin < best && tMin > 0) best = tMin;
  }
  return best;
}

/** True when nothing solid stands between two points. */
export function lineOfSight(x1, y1, x2, y2, rects) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return true;
  const hit = rayHit(x1, y1, dx / length, dy / length, rects);
  return hit >= length - 0.5;
}

/** The shortest angle between two bearings, always in [0, PI]. */
export function angleBetween(a, b) {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta);
}

/**
 * A cone's polygon, ready to fill: the eye, then one point per ray at whatever distance the first
 * solid left it. `half` is the half-angle, `range` the reach, both in world units.
 */
export function conePolygon(x, y, angle, half, range, rects, out = []) {
  out.length = 0;
  out.push(x, y);
  for (let index = 0; index <= RAYS; index += 1) {
    const bearing = angle - half + (half * 2 * index) / RAYS;
    const dx = Math.cos(bearing);
    const dy = Math.sin(bearing);
    let distance = rayHit(x, y, dx, dy, rects);
    if (distance > range) distance = range;
    if (!Number.isFinite(distance)) distance = range;
    out.push(x + dx * distance, y + dy * distance);
  }
  return out;
}

/**
 * How strongly one eye reads a target: 0 when the cone misses it or cover breaks the line, else
 * a falloff from 1 at the eye to 0.55 at the rim, times the shadow and stance multipliers.
 */
export function readTarget(eye, target, rects) {
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const distance = Math.hypot(dx, dy);
  if (distance > eye.range || distance < 1e-6) return 0;
  if (angleBetween(eye.angle, Math.atan2(dy, dx)) > eye.half) return 0;
  if (!lineOfSight(eye.x, eye.y, target.x, target.y, rects)) return 0;
  const falloff = 1 - 0.45 * (distance / eye.range);
  return falloff * (target.shadow > 0.5 ? ALARM.shadowScale : 1) * target.stance;
}

/**
 * The best read on the thief this step, from every guard and every live camera, plus the source
 * that made it, so the HUD can flash the right warning.
 */
export function exposure(level, thief, rects) {
  const target = {
    x: thief.x,
    y: thief.y,
    shadow: thief.shadow,
    stance: thief.stance === 'crouch' ? 1 - (1 - ALARM.crouchScale) : 1,
  };
  let best = 0;
  let by = null;
  for (let index = 0; index < level.guards.length; index += 1) {
    const guard = level.guards[index];
    if (guard.state === 'down') continue;
    const value = readTarget(guard.eye, target, rects) * (guard.alert ? 1 : 0.92);
    if (value > best) { best = value; by = guard; }
  }
  for (let index = 0; index < level.cameras.length; index += 1) {
    const camera = level.cameras[index];
    if (camera.disabled) continue;
    const value = readTarget(camera, target, rects) * 0.82;
    if (value > best) { best = value; by = camera; }
  }
  if (level.loot.taken) best *= ALARM.carryingScale;
  return { value: Math.min(1, best), by };
}

/** The alarm meter. `mode` is 'quiet', 'spotted' (rising), 'grace' (top reached, break sight) or 'caught'. */
export function createAlarm() {
  return { value: 0, mode: 'quiet', grace: 0, breakFor: 0, seenFor: 0, shake: 0 };
}

/**
 * Advance the meter one step. Returns an event: 0 nothing, 1 fully spotted (grace just began),
 * 2 the sight line was broken in time, 3 caught.
 */
export function stepAlarm(alarm, seen, dt, thiefCrouched) {
  let event = 0;
  alarm.shake = Math.max(0, alarm.shake - dt * 2.2);

  if (alarm.mode === 'grace') {
    alarm.grace -= dt;
    if (!seen) {
      alarm.breakFor += dt;
      if (alarm.breakFor >= 0.34) {
        alarm.mode = 'quiet';
        alarm.value = ALARM.evadedTo;
        alarm.breakFor = 0;
        alarm.grace = 0;
        alarm.shake = 0.9;
        event = 2;
      }
    } else {
      alarm.breakFor = 0;
      alarm.value = 100;
      if (alarm.grace <= 0) {
        alarm.mode = 'caught';
        event = 3;
      }
    }
    return event;
  }

  if (seen > 0) {
    const rise = ALARM.riseFar - (ALARM.riseFar - ALARM.riseNear) * seen;
    const crouch = thiefCrouched ? 1.12 : 1;
    alarm.value = Math.min(100, alarm.value + rise * crouch * 100 * dt * 0.55);
    alarm.seenFor += dt;
    alarm.mode = 'spotted';
    alarm.shake = Math.min(1, alarm.shake + dt * 1.6);
  } else {
    alarm.seenFor = 0;
    alarm.value = Math.max(0, alarm.value - ALARM.fall * 100 * dt);
    if (alarm.value < 1) alarm.mode = 'quiet';
  }

  if (alarm.value >= 100) {
    alarm.mode = 'grace';
    alarm.grace = ALARM.grace;
    alarm.breakFor = 0;
    event = 1;
  }
  return event;
}
