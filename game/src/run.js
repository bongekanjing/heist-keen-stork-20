// A run: the room, the thief, the guards, the coins, the alarm and the clock, plus the one function
// that advances all of them a sixtieth of a second. This is the rules of play with no browser in it
// — main.js owns the keyboard and the loop, shots.js replays the same step to reach a scene — so a
// screenshot and a live game can never disagree about what the rules are.
//
// Each step: the objectives first (doors, the case, the power box, the dock), then the thief's move
// and the noise it makes, then what every eye can read of the thief and what that does to the
// alarm, then each guard's own decision, then the clock. When the alarm is held at its top the
// thief is caught; when the diamond crosses the dock before the clock runs out, the run pays.

import { ALARM, HEIST } from './config.js';
import { createLevel, solidRects } from './level.js';
import { createAlarm, exposure, readTarget, stepAlarm } from './vision.js';
import { createGuard, seedGuard, stepCameraSweep } from './patrol.js';
import { GUARD_CHASE, guardGrabs, hearsAt, stepGuard } from './guard.js';
import { createThief, stepCoins, stepThief } from './thief.js';
import { heistScore, nearestInteraction, stepHeist } from './heist.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_WON } from './render.js';

/** Everything one attempt owns; a fresh run builds a fresh one, so no attempt inherits another's. */
export function createRun() {
  const level = createLevel();
  const thief = createThief(level);
  const guards = level.guards.map(createGuard);
  // Spread the beats, so the room never opens with every guard standing on waypoint one.
  seedGuard(guards[0], 0.18);
  seedGuard(guards[1], 0.46);
  if (guards[2] && guards[2].path.length > 1) seedGuard(guards[2], 0.64);
  // The level holds the live guards, so sight and patrol read the same bodies the renderer draws.
  level.guards = guards;

  return {
    level,
    thief,
    guards,
    cameras: level.cameras,
    coins: [],
    alarm: createAlarm(),
    clock: {
      elapsed: 0,
      remaining: HEIST.seconds,
      getaway: null,
      peak: 0,
      score: 0,
      scoreTime: 0,
      scoreQuiet: 0,
      scoreTools: 0,
      scoreSeconds: 0,
      grade: '',
    },
    screen: SCREEN_PLAY,
    rects: solidRects(level),
    prompt: null,
    aim: null,
    flash: 0,
    message: '',
    showRoom: true,
  };
}

/**
 * Advance the run one fixed step. `intent` is {x, y, sprint, crouch, use}; `dt` is the step.
 * Returns the screen the run ended on, or null while it is still going.
 */
export function stepRun(run, intent, dt) {
  const level = run.level;
  const thief = run.thief;
  const clock = run.clock;

  clock.elapsed += dt;
  run.rects = solidRects(level);
  run.flash = Math.max(0, run.flash - dt * 1.6);

  // Objectives first: doors swung this step are noise a guard nearby can hear.
  const doorEvents = [];
  const objectives = stepHeist(level, thief, intent.use, dt, clock);
  for (let index = 0; index < objectives.length; index += 1) {
    const event = objectives[index];
    if (event.kind === 'door') doorEvents.push(event);
    else if (event.kind === 'loot') {
      run.flash = 0.85;
      run.message = 'The Halcyon is out of the case. Get to the dock.';
    } else if (event.kind === 'power') {
      run.flash = 0.5;
      run.message = 'Power cut. Every camera is dead.';
    } else if (event.kind === 'exit') {
      return finishRun(run, true);
    }
  }

  // The move, and the noise it makes.
  const walk = Math.hypot(intent.x, intent.y);
  const input = walk > 1 ? { x: intent.x / walk, y: intent.y / walk } : { x: intent.x, y: intent.y };
  stepThief(level, thief, input, intent.sprint, intent.crouch, dt);
  stepCoins(run.coins, dt);

  // What every eye can read of the thief, and what that does to the meter.
  const read = exposure(level, thief, run.rects);
  const alarmEvent = stepAlarm(run.alarm, read.value, dt, thief.stance === 'crouch');
  if (run.alarm.value > clock.peak) clock.peak = run.alarm.value;

  if (alarmEvent === 1) {
    run.flash = 1;
    run.message = 'The alarm is up. Break the sight line.';
  } else if (alarmEvent === 2) {
    run.flash = 0.45;
    run.message = 'They lost you. Stay low.';
  } else if (alarmEvent === 3) {
    return finishRun(run, false);
  }

  // Each guard: what it hears, what it sees, then where it decides to go.
  let grabbed = false;
  for (let index = 0; index < run.guards.length; index += 1) {
    const guard = run.guards[index];
    const heard = hearsAt(level, guard, run.coins, thief, doorEvents);
    const target = { x: thief.x, y: thief.y, shadow: thief.shadow, stance: thief.stance === 'crouch' ? 0.72 : 1 };
    const reads = readTarget(guard.eye, target, run.rects);
    stepGuard(level, guard, dt, heard, reads > 0.06, { x: thief.x, y: thief.y });
    if (guard.state === GUARD_CHASE && guardGrabs(guard, thief)) grabbed = true;
  }

  // A hand closing on your shoulder is not an instant loss — it is the last alarm. A guard who
  // reaches you drives the meter to its ceiling and starts the same break-sight window every other
  // detection gets, so the thief is always given that moment to tear free. Only a meter that has
  // actually run out takes the run.
  if (grabbed && run.alarm.mode !== 'grace' && run.alarm.mode !== 'caught') {
    run.alarm.value = 100;
    run.alarm.mode = 'grace';
    run.alarm.grace = ALARM.grace;
    run.alarm.breakFor = 0;
    run.alarm.shake = 1;
    run.flash = 1;
    run.message = 'A guard has you. Break away.';
  }

  if (run.alarm.mode === 'caught') return finishRun(run, false);

  for (let index = 0; index < run.cameras.length; index += 1) {
    if (!run.cameras[index].disabled) stepCameraSweep(run.cameras[index], dt);
  }

  // The clock: the quiet hour first, then the getaway fuse.
  if (clock.getaway !== null) {
    clock.getaway -= dt;
    if (clock.getaway <= 0) return finishRun(run, false);
  } else {
    clock.remaining = Math.max(0, clock.remaining - dt);
    if (clock.remaining <= 0) return finishRun(run, false);
  }

  run.prompt = nearestInteraction(level, thief);
  if (run.alarm.mode === 'grace') run.message = 'Break the sight line.';
  return null;
}

/** Close the run out: score it and stop the world on the end screen. */
export function finishRun(run, escaped) {
  const clock = run.clock;
  if (escaped) {
    const score = heistScore(clock, { peak: clock.peak }, { taken: run.level.loot.taken, terminal: run.level.terminal.done });
    clock.score = score.total;
    clock.scoreTime = score.time;
    clock.scoreQuiet = score.quiet;
    clock.scoreTools = score.tools;
    clock.scoreSeconds = Math.ceil(clock.remaining);
    clock.grade = score.grade;
    run.screen = SCREEN_WON;
  } else {
    run.screen = SCREEN_CAUGHT;
  }
  return run.screen;
}

/** The best score this browser has seen, and a way to record a better one. */
export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem('quiet-hour.best') ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    if (value > readBest()) window.localStorage.setItem('quiet-hour.best', String(value));
  } catch {
    // Storage off: the best score lasts this visit only.
  }
}
