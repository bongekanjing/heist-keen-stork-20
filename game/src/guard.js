// A guard's head: what it decides, given what its ears and its cone told it. On its beat it walks
// its loop. A noise inside earshot puts it in 'look' — it turns toward the sound, walks to it if
// the sound was loud, and stares for a few seconds before going back to the loop. Seeing the thief
// puts it in 'chase': the cone narrows, the walk speeds up, and it keeps the last place it saw you
// rather than following you through a wall.
//
// A guard is never told where the thief is. It is told what it can see and hear this step, which
// is the whole of the fairness in the game.

import { GUARD } from './config.js';
import { linkEye, rotateToward, stepPatrol, turnToward } from './patrol.js';
import { canStand } from './thief.js';
import { angleBetween, lineOfSight } from './vision.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_LOOK = 'look';
export const GUARD_CHASE = 'chase';

/** Send a guard to look at a point, with how long it should stare once it gets there. */
export function sendToLook(guard, x, y, loud) {
  if (guard.state === GUARD_CHASE) return;
  guard.state = GUARD_LOOK;
  guard.lookAt = { x, y };
  guard.lookFor = GUARD.investigateSeconds * (loud ? 1.15 : 0.85);
  guard.curious = true;
  guard.reached = false;
}

/** A guard that has seen the thief: remember the spot, and keep the cone on it. */
export function raiseChase(guard, x, y) {
  guard.state = GUARD_CHASE;
  guard.lookAt = { x, y };
  guard.lookFor = 3.2;
  guard.alert = true;
}

/** Back to the beat, from the nearest waypoint so it does not walk the whole loop again. */
export function resumePatrol(guard) {
  guard.state = GUARD_PATROL;
  guard.lookAt = null;
  guard.lookFor = 0;
  guard.alert = false;
  guard.reached = false;
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < guard.path.length; index += 1) {
    const distance = Math.hypot(guard.path[index].x - guard.x, guard.path[index].y - guard.y);
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  }
  guard.target = best;
  if (bestDistance < 6) guard.target = (best + 1) % guard.path.length;
}

/** Walk a guard toward a point at a given speed; returns true on arrival. */
function walkToward(level, guard, x, y, speed, dt) {
  const dx = x - guard.x;
  const dy = y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 4) return true;
  const wanted = Math.atan2(dy, dx);
  guard.facing = rotateToward(guard.facing, wanted, GUARD.turn * 1.6, dt);
  const travel = Math.min(distance, speed * dt * (Math.abs(turnToward(guard.facing, wanted)) < 0.7 ? 1 : 0.4));
  const nx = guard.x + Math.cos(guard.facing) * travel;
  const ny = guard.y + Math.sin(guard.facing) * travel;
  // A guard never walks through a closed door or a crate, and never leaves the floor.
  if (canStand(level, nx, ny, GUARD.radius)) {
    guard.x = nx;
    guard.y = ny;
  } else if (canStand(level, nx, guard.y, GUARD.radius)) {
    guard.x = nx;
  } else if (canStand(level, guard.x, ny, GUARD.radius)) {
    guard.y = ny;
  }
  guard.speed = speed;
  return false;
}

/**
 * Advance one guard. `heard` is the noise events it can hear this step, `seen` says whether its
 * own cone read the thief (and how well), and `thief` is only read when `seen` is true.
 */
export function stepGuard(level, guard, dt, heard, seen, seenAt) {
  guard.speed = 0;

  // Hearing always wins over a beat, and never over eyes.
  if (heard && guard.state !== GUARD_CHASE) {
    sendToLook(guard, heard.x, heard.y, heard.loud);
  }

  if (seen) {
    if (guard.state !== GUARD_CHASE) raiseChase(guard, seenAt.x, seenAt.y);
    else { guard.lookAt = { x: seenAt.x, y: seenAt.y }; guard.lookFor = 3.2; }
  }

  if (guard.state === GUARD_PATROL) {
    stepPatrol(guard, dt);
  } else if (guard.state === GUARD_LOOK) {
    guard.lookFor -= dt;
    const dx = guard.lookAt.x - guard.x;
    const dy = guard.lookAt.y - guard.y;
    const distance = Math.hypot(dx, dy);
    const bearing = Math.atan2(dy, dx);
    if (distance > 46) {
      walkToward(level, guard, guard.lookAt.x, guard.lookAt.y, GUARD.investigateSpeed, dt);
      guard.facing = rotateToward(guard.facing, bearing, GUARD.turn, dt);
      guard.scan = 0;
    } else {
      guard.facing = rotateToward(guard.facing, bearing, GUARD.turn, dt);
      // Stand and sweep the cone over the thing that made the noise.
      guard.scan += dt * GUARD.scanRate * 1.9;
      guard.speed = 0;
    }
    if (guard.lookFor <= 0) resumePatrol(guard);
  } else if (guard.state === GUARD_CHASE) {
    guard.lookFor -= dt;
    const dx = guard.lookAt.x - guard.x;
    const dy = guard.lookAt.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 22) walkToward(level, guard, guard.lookAt.x, guard.lookAt.y, GUARD.chaseSpeed, dt);
    else guard.speed = 0;
    guard.facing = rotateToward(guard.facing, Math.atan2(dy, dx), GUARD.turn * 1.5, dt);
    guard.scan = 0;
    if (guard.lookFor <= 0) resumePatrol(guard);
  }

  linkEye(guard);
  if (guard.state === GUARD_CHASE) {
    // In a chase the cone is a spotlight: narrower, longer, and locked on the last sighting.
    guard.eye.half = 0.3;
    guard.eye.range = 340;
    guard.eye.angle = guard.facing;
  } else if (guard.state === GUARD_LOOK) {
    guard.eye.angle = guard.facing + Math.sin(guard.scan) * 0.7;
  }
  return guard;
}

/**
 * What this guard can hear this step: any coin that landed within earshot, any footstep whose
 * shout radius reaches it through the floor plan (ears work around corners, so no line test), and
 * a door that was just pulled open.
 */
export function hearsAt(level, guard, coins, thief, doorEvents) {
  for (let index = 0; index < coins.length; index += 1) {
    const coin = coins[index];
    if (!coin.landed || coin.heardBy === guard.id) continue;
    if (Math.hypot(coin.x - guard.x, coin.y - guard.y) < GUARD.hearCoin) {
      coin.heardBy = guard.id;
      return { x: coin.x, y: coin.y, loud: true };
    }
  }
  if (thief.noise > 0.12) {
    const radius = thief.noise * GUARD.hearSprint;
    if (Math.hypot(thief.x - guard.x, thief.y - guard.y) < radius) {
      // Hearing a sprint through a wall is the point; hearing a crouch is not.
      const blocked = !lineOfSight(guard.x, guard.y, thief.x, thief.y, level.walls);
      if (!blocked || thief.noise > 0.6) return { x: thief.x, y: thief.y, loud: thief.noise > 0.6 };
    }
  }
  if (doorEvents) {
    for (let index = 0; index < doorEvents.length; index += 1) {
      const event = doorEvents[index];
      if (event.heardBy === guard.id) continue;
      if (Math.hypot(event.x - guard.x, event.y - guard.y) < GUARD.hearDoor) {
        event.heardBy = guard.id;
        return { x: event.x, y: event.y, loud: false };
      }
    }
  }
  return null;
}

/** Does this guard's cone hold the thief right now? */
export function guardSees(guard, thief, rects, readTarget) {
  const target = { x: thief.x, y: thief.y, shadow: thief.shadow, stance: thief.stance === 'crouch' ? 0.72 : 1 };
  const value = readTarget(guard.eye, target, rects);
  return { seen: value > 0.06, value };
}

/** Close enough to put a hand on the thief. */
export function guardGrabs(guard, thief) {
  return Math.hypot(guard.x - thief.x, guard.y - thief.y) < GUARD.catchRange && angleBetween(guard.facing, Math.atan2(thief.y - guard.y, thief.x - guard.x)) < 1.5;
}
