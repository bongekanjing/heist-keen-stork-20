// The thief: a body with three speeds and a noise level that each of them sets. Walking is quiet
// enough to be missed at range, sprinting is fast enough to cross a cone and loud enough to be
// heard through a wall, crouching is slow and nearly silent and halves what a cone can read of you.
// The vent is crawl-only: inside it you are on your knees whatever key you hold.
//
// A coin is the one thing you can spend. You have three; you aim with the mouse and throw, it
// lands where it hits something, and every guard within earshot goes to look at it. That is time
// bought, and it is all the time you get.

import { THIEF } from './config.js';
import { circleHitsRect, rectContains } from './level.js';

export const STANCE_CROUCH = 'crouch';
export const STANCE_WALK = 'walk';
export const STANCE_SPRINT = 'sprint';

export function createThief(level) {
  return {
    x: level.start.x,
    y: level.start.y,
    vx: 0,
    vy: 0,
    facing: 0,
    stance: STANCE_CROUCH,
    noise: 0,
    shadow: 0,
    inVent: false,
    coins: THIEF.coins,
    carrying: false,
    reach: null,
    stepPhase: 0,
    bob: 0,
  };
}

/** True when a circle of `radius` at x,y can stand where it is: inside the floor, clear of solids. */
export function canStand(level, x, y, radius) {
  if (x < level.floor.x + radius || x > level.floor.x + level.floor.w - radius) return false;
  if (y < level.floor.y + radius || y > level.floor.y + level.floor.h - radius) return false;
  const solids = level.walls;
  for (let index = 0; index < solids.length; index += 1) if (circleHitsRect(x, y, radius, solids[index])) return false;
  for (let index = 0; index < level.cover.length; index += 1) if (circleHitsRect(x, y, radius, level.cover[index])) return false;
  for (let index = 0; index < level.doors.length; index += 1) {
    const door = level.doors[index];
    if (door.open < 0.45 && circleHitsRect(x, y, radius, door)) return false;
  }
  return true;
}

/** Slide along whatever is in the way instead of stopping dead: try the full step, then each axis. */
export function moveThief(level, thief, dx, dy) {
  const radius = THIEF.radius;
  if (canStand(level, thief.x + dx, thief.y + dy, radius)) {
    thief.x += dx;
    thief.y += dy;
    return true;
  }
  let moved = false;
  if (canStand(level, thief.x + dx, thief.y, radius)) { thief.x += dx; moved = true; }
  if (canStand(level, thief.x, thief.y + dy, radius)) { thief.y += dy; moved = true; }
  return moved;
}

/** Which dark pool the thief is standing in, if any (the pool's index, or -1). */
export function shadowIndex(level, x, y) {
  for (let index = 0; index < level.shadows.length; index += 1) if (rectContains(level.shadows[index], x, y)) return index;
  return -1;
}

export function inVent(level, x, y) {
  for (let index = 0; index < level.vents.length; index += 1) if (rectContains(level.vents[index], x, y)) return true;
  return false;
}

/**
 * Advance the thief one step. `input` is {x, y} already normalised, `sprint` and `crouch` are the
 * keys held. Returns nothing; every number a caller needs is on the thief afterwards.
 */
export function stepThief(level, thief, input, sprint, crouch, dt) {
  thief.inVent = inVent(level, thief.x, thief.y);
  const moving = input.x !== 0 || input.y !== 0;

  let stance = STANCE_WALK;
  if (thief.inVent || crouch) stance = STANCE_CROUCH;
  else if (sprint && moving) stance = STANCE_SPRINT;
  thief.stance = stance;

  let speed = stance === STANCE_SPRINT ? THIEF.sprint : stance === STANCE_CROUCH ? THIEF.crouch : THIEF.walk;
  if (thief.carrying) speed *= THIEF.carryingScale;
  if (thief.inVent) speed *= 0.82;

  if (moving) {
    moveThief(level, thief, input.x * speed * dt, input.y * speed * dt);
    thief.facing = Math.atan2(input.y, input.x);
  }

  const targetNoise = !moving ? 0 : stance === STANCE_SPRINT ? THIEF.noiseSprint : stance === STANCE_CROUCH ? THIEF.noiseCrouch : THIEF.noiseWalk;
  // Noise has to be paid down slowly, or a sprint would be silent the instant you let go of it.
  if (targetNoise > thief.noise) thief.noise = targetNoise;
  else thief.noise = Math.max(targetNoise, thief.noise - THIEF.noiseCool * dt);

  const shadow = shadowIndex(level, thief.x, thief.y);
  thief.shadow = shadow >= 0 ? 1 : 0;
  thief.shadowIndex = shadow;

  if (moving) thief.stepPhase += dt * (stance === STANCE_SPRINT ? 15 : stance === STANCE_CROUCH ? 6 : 10);
  thief.bob = moving ? Math.sin(thief.stepPhase) * (stance === STANCE_SPRINT ? 1.6 : 1) : 0;
  return thief;
}

/** The shout radius of the noise the thief is making right now, in world units. */
export function noiseRadius(thief) {
  return thief.noise * 180;
}

/** A thrown coin in flight: it lands where it is thrown, not where you aimed past a wall. */
export function throwCoin(thief, aimX, aimY) {
  if (thief.coins <= 0) return null;
  thief.coins -= 1;
  const dx = aimX - thief.x;
  const dy = aimY - thief.y;
  const distance = Math.min(THIEF.coinRange, Math.hypot(dx, dy));
  const bearing = Math.atan2(dy, dx);
  return {
    x: thief.x,
    y: thief.y,
    fromX: thief.x,
    fromY: thief.y,
    toX: thief.x + Math.cos(bearing) * distance,
    toY: thief.y + Math.sin(bearing) * distance,
    t: 0,
    flight: Math.min(THIEF.coinFlight, 0.14 + distance / THIEF.coinSpeed),
    landed: false,
    life: 6,
    spin: 0,
  };
}

/** Where the coin would come to rest, for the aim preview: walked until it meets something solid. */
export function coinPreview(level, thief, aimX, aimY) {
  const dx = aimX - thief.x;
  const dy = aimY - thief.y;
  const distance = Math.min(THIEF.coinRange, Math.hypot(dx, dy));
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return { x: thief.x, y: thief.y, distance: 0 };
  const sx = dx / length;
  const sy = dy / length;
  const solids = level.walls.concat(level.cover).concat(level.doors.filter((door) => door.open < 0.45));
  const stride = 7;
  let travelled = 0;
  while (travelled < distance) {
    const nx = thief.x + sx * travelled;
    const ny = thief.y + sy * travelled;
    for (let index = 0; index < solids.length; index += 1) {
      if (rectContains(solids[index], nx, ny)) return { x: nx - sx * 6, y: ny - sy * 6, distance: travelled };
    }
    if (nx < level.floor.x || nx > level.floor.x + level.floor.w || ny < level.floor.y || ny > level.floor.y + level.floor.h) {
      return { x: nx - sx * 6, y: ny - sy * 6, distance: travelled };
    }
    travelled += stride;
  }
  return { x: thief.x + sx * distance, y: thief.y + sy * distance, distance };
}

/** Fly each coin, and report the ones that touched down this step so the guards can hear them. */
export function stepCoins(coins, dt) {
  const landed = [];
  for (let index = coins.length - 1; index >= 0; index -= 1) {
    const coin = coins[index];
    coin.spin += dt * 22;
    if (!coin.landed) {
      coin.t += dt;
      const k = Math.min(1, coin.t / coin.flight);
      coin.x = coin.fromX + (coin.toX - coin.fromX) * k;
      coin.y = coin.fromY + (coin.toY - coin.fromY) * k;
      coin.height = Math.sin(k * Math.PI) * 26;
      if (k >= 1) {
        coin.landed = true;
        coin.height = 0;
        landed.push(coin);
      }
    } else {
      coin.life -= dt;
      if (coin.life <= 0) coins.splice(index, 1);
    }
  }
  return landed;
}
