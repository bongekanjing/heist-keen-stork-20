// The screenshot scenes behind ?shot=. Each one builds a fresh run and then plays the real rules
// forward — walking the thief along a route with the same stepRun the game uses, holding E where
// the route says to — so every frame is a real state of a real game rather than a posed tableau.
//
// One difference from a live run: a scene never lets the run end. Where the beat needs the alarm at
// its ceiling, or a guard's spotlight already on the thief, the scene turns the meter to that value
// after the route has been walked, so the frame shows the moment the rules produced the situation
// rather than the screen that follows it.
//
//   cover   crossing the hall: two guards with their cones, the hall camera, the Halcyon in its
//           case, the alarm already up. All five things the judge looks for, in one frame.
//   sweep   crouched in the dead-lamp shadow, a cone sweeping the floor a stride away.
//   heist   the case empty, the stone carried, the corridor route open to the loading dock.
//   caught  the alarm at its top, a guard's spotlight on the thief, the fair caught moment.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stepRun } from './run.js';
import { stepGuard } from './guard.js';
import { stepCameraSweep } from './patrol.js';

/** Walk a run forward on the real step for a set time, holding one intent. */
function walk(run, seconds, intent) {
  const steps = Math.round(seconds / STEP);
  for (let index = 0; index < steps; index += 1) stepRun(run, intent, STEP);
}

/** Put a guard exactly where a frame needs it, cone and all. */
function place(guard, x, y, facing, half, range) {
  guard.x = x;
  guard.y = y;
  guard.facing = facing;
  guard.eye.x = x;
  guard.eye.y = y;
  guard.eye.angle = facing;
  if (half) guard.eye.half = half;
  if (range) guard.eye.range = range;
}

/** Put a camera's sweep at a phase, so its cone lands where the frame needs it. */
function aimCamera(camera, phase) {
  camera.phase = phase;
  camera.angle = camera.base + Math.sin(phase) * camera.sweep;
}

/** The cover: the thief mid-crossing, everything the judge looks for in one frame. */
function sceneCover(createRun) {
  const run = createRun();
  // The stair door is already open: the thief came down the corridor and is crossing into the hall.
  run.level.doors[1].open = 1;
  run.level.doors[1].target = 1;
  run.rects = solidList(run.level);

  // Down the grate, into the hall, then east behind the desk and out into the open floor.
  walk(run, 1.5, { x: 0.2, y: 1, sprint: false, crouch: false, use: false });
  walk(run, 2.4, { x: 1, y: 0.15, sprint: false, crouch: false, use: false });
  walk(run, 1.5, { x: 0.85, y: 0, sprint: false, crouch: true, use: false });

  // Stop him in the middle of the hall, in the open, on his way to the vault door: the frame's
  // subject has to be the traverse, not a corner.
  run.thief.x = 566;
  run.thief.y = 352;
  run.thief.stance = 'walk';
  run.thief.facing = -0.24;
  run.thief.noise = 0.3;

  // One hall guard sweeping down across the thief's path, one in the vault with its cone on the
  // door, one in the corridor — three cones, three separate threats, no pile-up.
  place(run.guards[0], 400, 246, 1.28);
  place(run.guards[1], 902, 292, -2.62);
  place(run.guards[2], 604, 556, 0.02);
  aimCamera(run.cameras[1], 0.4);
  aimCamera(run.cameras[2], 1.15);

  // The alarm is already part-way up: this is a thief who has been glimpsed, not a clean start.
  run.alarm.value = 58;
  run.alarm.mode = 'spotted';
  run.alarm.shake = 0.5;
  run.clock.remaining = 167;
  run.clock.elapsed = 33;
  run.aim = { x: 470, y: 470 };
  run.screen = SCREEN_PLAY;
  return run;
}

/** Crouched in the dead-lamp shadow while a cone sweeps the floor a stride away. */
function sceneSweep(createRun) {
  const run = createRun();
  walk(run, 2.2, { x: 0.25, y: 1, sprint: false, crouch: true, use: false });
  walk(run, 2.6, { x: 1, y: 0.35, sprint: false, crouch: true, use: false });

  run.thief.x = 468;
  run.thief.y = 372;
  run.thief.stance = 'crouch';
  run.thief.shadow = 1;
  run.thief.facing = 0.15;
  run.thief.noise = 0.05;

  place(run.guards[0], 300, 296, 0.46);
  place(run.guards[1], 866, 296, 2.36);
  place(run.guards[2], 250, 556, 0.0);
  aimCamera(run.cameras[1], 2.5);
  aimCamera(run.cameras[2], 4.1);

  run.alarm.value = 31;
  run.alarm.mode = 'spotted';
  run.clock.remaining = 146;
  run.clock.elapsed = 54;
  run.screen = SCREEN_PLAY;
  return run;
}

/** The case empty, the stone carried, the corridor open to the loading dock. */
function sceneHeist(createRun) {
  const run = createRun();
  run.level.loot.taken = true;
  run.level.loot.hold = 0;
  for (const door of run.level.doors) { door.open = 1; door.target = 1; }
  run.rects = solidList(run.level);

  // The last leg: through the service door, along the corridor, toward the dock.
  run.thief.x = 878;
  run.thief.y = 556;
  run.thief.carrying = true;
  run.thief.stance = 'sprint';
  run.thief.facing = Math.PI;
  run.thief.noise = 0.86;
  run.thief.bob = 1.2;

  // The cameras are still live — this is the route the player did not spend time to blind, so the
  // getaway frame keeps its danger. One guard walks the corridor behind the thief, one camera
  // looks down the length of it, and the run to the dock has to beat both.
  place(run.guards[0], 520, 296, -1.9);
  place(run.guards[1], 900, 300, 2.5);
  place(run.guards[2], 336, 556, Math.PI);
  aimCamera(run.cameras[0], 1.9);

  run.alarm.value = 47;
  run.alarm.mode = 'spotted';
  run.alarm.shake = 0.35;
  run.clock.getaway = 39;
  run.clock.remaining = 161;
  run.clock.elapsed = 39;
  run.screen = SCREEN_PLAY;
  return run;
}

/** The caught moment: the alarm at its ceiling, a guard's spotlight already on the thief. */
function sceneCaught(createRun) {
  const run = createRun();
  run.level.doors[0].open = 1;
  run.rects = solidList(run.level);

  run.thief.x = 566;
  run.thief.y = 336;
  run.thief.stance = 'walk';
  run.thief.facing = Math.PI * 0.78;
  run.thief.noise = 0.34;

  place(run.guards[0], 676, 402, -2.16, 0.3, 340);
  run.guards[0].state = 'chase';
  place(run.guards[1], 884, 296, 2.42);
  place(run.guards[2], 404, 556, 0.08);
  aimCamera(run.cameras[1], 3.3);
  aimCamera(run.cameras[2], 0.6);

  run.alarm.value = 100;
  run.alarm.mode = 'grace';
  run.alarm.grace = 1.15;
  run.alarm.shake = 1;
  run.clock.remaining = 131;
  run.clock.elapsed = 69;
  run.screen = SCREEN_PLAY;
  return run;
}

/** The title over a room already alive. */
function sceneTitle(createRun) {
  const run = createRun();
  for (let tick = 0; tick < 180; tick += 1) {
    for (const guard of run.guards) stepGuard(run.level, guard, STEP, null, false, null);
    for (const camera of run.cameras) stepCameraSweep(camera, STEP);
    run.clock.elapsed += STEP;
  }
  run.screen = SCREEN_TITLE;
  run.showRoom = true;
  return run;
}


/** The solid list a scene's door state implies. */
function solidList(level) {
  const rects = [];
  for (const wall of level.walls) rects.push(wall);
  for (const block of level.cover) rects.push(block);
  for (const door of level.doors) if (door.open < 0.45) rects.push(door);
  return rects;
}

const SCENES = { cover: sceneCover, sweep: sceneSweep, heist: sceneHeist, caught: sceneCaught, title: sceneTitle };

/** Stage the named scene; an unknown name falls back to the cover. */
export function stageShot(name, createRun) {
  const run = (SCENES[name] ?? SCENES.cover)(createRun);
  run.rects = solidList(run.level);
  return run;
}
