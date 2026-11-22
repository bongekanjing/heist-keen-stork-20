// The job itself: the doors, the case, the power box, the clock and the way out. The thief brings
// hands; this file decides what they are close enough to use, how long using them takes, and what
// the run is worth when the dock door closes behind it.
//
// Interaction is proximity plus a held key: standing at something and holding E fills a bar, and
// letting go loses what you had. So every action costs the seconds it takes, in a room where the
// seconds are what the guards are using.

import { CAMERA, HEIST } from './config.js';

/** The nearest thing in reach, for the prompt above the thief's head. */
export function nearestInteraction(level, thief) {
  let best = null;
  let bestDistance = HEIST.reach;

  for (let index = 0; index < level.doors.length; index += 1) {
    const door = level.doors[index];
    const cx = door.x + door.w / 2;
    const cy = door.y + door.h / 2;
    const distance = Math.hypot(cx - thief.x, cy - thief.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { kind: 'door', door, x: cx, y: cy, label: door.open > 0.5 ? `CLOSE ${door.name}` : `OPEN ${door.name}` };
    }
  }

  const loot = level.loot;
  if (!loot.taken) {
    const cx = loot.x + loot.w / 2;
    const cy = loot.y + loot.h / 2;
    const distance = Math.hypot(cx - thief.x, cy - thief.y);
    if (distance < bestDistance + 20) {
      bestDistance = distance;
      best = { kind: 'loot', x: cx, y: cy, label: 'LIFT THE HALCYON' };
    }
  }

  const terminal = level.terminal;
  if (!terminal.done) {
    const distance = Math.hypot(terminal.x - thief.x, terminal.y - thief.y);
    if (distance < bestDistance + 10) {
      bestDistance = distance;
      best = { kind: 'terminal', x: terminal.x, y: terminal.y, label: 'CUT THE CAMERAS' };
    }
  }

  if (level.loot.taken) {
    const exit = level.exit;
    const distance = Math.hypot(exit.x + exit.w / 2 - thief.x, exit.y + exit.h / 2 - thief.y);
    if (distance < bestDistance + 30) {
      bestDistance = distance;
      best = { kind: 'exit', x: exit.x + exit.w / 2, y: exit.y + exit.h / 2, label: 'GET OUT' };
    }
  }
  return best;
}

/**
 * Advance every objective one step. `use` is true while the interact key is held. Returns the
 * events of this step as a list of short names, so the caller can react (sound, announce, end).
 */
export function stepHeist(level, thief, use, dt, clock) {
  const events = [];

  // Doors: a door in reach and held open swings, and swings back when let go.
  for (let index = 0; index < level.doors.length; index += 1) {
    const door = level.doors[index];
    const cx = door.x + door.w / 2;
    const cy = door.y + door.h / 2;
    const near = Math.hypot(cx - thief.x, cy - thief.y) < HEIST.reach;
    const target = near && use ? 1 : 0;
    if (target !== door.target) door.target = target;
    const before = door.open;
    const rate = dt / HEIST.doorHold;
    door.open = door.open < door.target ? Math.min(1, door.open + rate) : Math.max(0, door.open - rate);
    if (before < 0.45 && door.open >= 0.45) events.push({ kind: 'door', x: cx, y: cy });
  }

  const near = nearestInteraction(level, thief);

  // The case: hold to lift the stone. The hold only counts while you stand still and keep the key.
  if (near && near.kind === 'loot') {
    if (use) {
      level.loot.hold = Math.min(HEIST.lootHold, level.loot.hold + dt);
      if (level.loot.hold >= HEIST.lootHold) {
        level.loot.taken = true;
        thief.carrying = true;
        clock.getaway = HEIST.getaway;
        events.push({ kind: 'loot' });
      }
    } else {
      level.loot.hold = Math.max(0, level.loot.hold - dt * 1.6);
    }
  } else {
    level.loot.hold = Math.max(0, level.loot.hold - dt * 2.2);
  }

  // The power box: hold, and every camera dies with the box. Costs the seconds, and the box is
  // down in the corridor where the corridor guard walks.
  if (near && near.kind === 'terminal' && !level.terminal.done) {
    if (use) {
      level.terminal.progress = Math.min(1, level.terminal.progress + dt / CAMERA.disableHold);
      if (level.terminal.progress >= 1) {
        level.terminal.done = true;
        for (let index = 0; index < level.cameras.length; index += 1) level.cameras[index].disabled = true;
        events.push({ kind: 'power' });
      }
    } else {
      level.terminal.progress = Math.max(0, level.terminal.progress - dt * 0.8);
    }
  } else if (!level.terminal.done) {
    level.terminal.progress = Math.max(0, level.terminal.progress - dt * 1.4);
  }

  // Out: the dock door, with the stone in hand.
  if (level.loot.taken && near && near.kind === 'exit') events.push({ kind: 'exit' });

  return events;
}

/** How the run ended, and what it paid: quiet is worth more than loud, and time is worth the most. */
export function heistScore(clock, alarm, loot) {
  if (!loot.taken) return { total: 0, grade: 'NOTHING STOLEN' };
  const time = Math.max(0, Math.round(clock.getaway * 26));
  const quiet = Math.round(Math.max(0, 100 - alarm.peak) * 9);
  const tools = loot.terminal ? 60 : 0;
  const total = 420 + time + quiet + tools;
  const grade = total > 900 ? 'GHOST' : total > 740 ? 'CLEAN' : total > 600 ? 'LOUD' : 'BARELY';
  return { total, time, quiet, tools, grade };
}
