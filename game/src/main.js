// Boot, input and the one loop. Keyboard and pointer are read every frame; the run advances in
// fixed 1/60s steps (as many as a slow frame needs, none in a fast one) and the renderer paints
// what is there. Nothing here knows about pixels, and nothing here knows the rules: run.js does.
//
// A run moves title -> play -> won | caught, with a pause inside play, and Space or a click starts
// a new one from any of the end screens. Escape, P or a hidden tab pauses a live run.
//
// ?shot=<scene> stages one deterministic scene instead of running the loop: it plays the real rules
// forward, paints twice, and sets window.__shotReady for the screenshot harness.

import { STEP } from './config.js';
import { createRun, readBest, stepRun } from './run.js';
import { coinPreview, throwCoin } from './thief.js';
import { SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON, createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const renderer = createRenderer(canvas);

const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CROUCH = new Set(['ControlLeft', 'ControlRight', 'KeyC']);
const USE = new Set(['KeyE']);
const PAUSE = new Set(['KeyP', 'Escape']);

function announce(message) {
  if (statusLine) statusLine.textContent = message;
}

/**
 * Keyboard and pointer, with a throw queued rather than fired: a click between two frames has to
 * land, and a click held down must not empty the pouch.
 */
function createInput(target) {
  const held = new Set();
  let use = false;
  let sprint = false;
  let crouch = false;
  let pointer = { x: 640, y: 360 };
  let pendingThrow = false;
  let pendingPause = false;

  window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (LEFT.has(code) || RIGHT.has(code) || UP.has(code) || DOWN.has(code)) held.add(code);
    else if (SPRINT.has(code)) sprint = true;
    else if (CROUCH.has(code)) crouch = true;
    else if (USE.has(code)) use = true;
    else if (code === 'Space' && !event.repeat) pendingThrow = true;
    else if (PAUSE.has(code)) {
      if (!event.repeat) pendingPause = true;
      event.preventDefault();
      return;
    } else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    const code = event.code;
    if (LEFT.has(code) || RIGHT.has(code) || UP.has(code) || DOWN.has(code)) held.delete(code);
    else if (SPRINT.has(code)) sprint = false;
    else if (CROUCH.has(code)) crouch = false;
    else if (USE.has(code)) use = false;
  });

  // A key released while the tab was hidden never sends keyup: let everything go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    use = false;
    sprint = false;
    crouch = false;
  });

  function toWorld(event) {
    const rect = target.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    return {
      x: (event.clientX - rect.left - (rect.width - 1280 * scale) / 2) / scale,
      y: (event.clientY - rect.top - (rect.height - 720 * scale) / 2) / scale,
    };
  }

  target.addEventListener('pointermove', (event) => { pointer = toWorld(event); });
  target.addEventListener('pointerdown', (event) => {
    pointer = toWorld(event);
    if (event.button === 0) pendingThrow = true;
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The movement axes and the held modifiers, as the rules want them. */
    intent() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        if (LEFT.has(code)) x -= 1;
        else if (RIGHT.has(code)) x += 1;
        else if (UP.has(code)) y -= 1;
        else if (DOWN.has(code)) y += 1;
      }
      return { x, y, sprint, crouch, use };
    },
    pointer() { return pointer; },
    takeThrow() {
      if (!pendingThrow) return false;
      pendingThrow = false;
      return true;
    },
    takePause() {
      if (!pendingPause) return false;
      pendingPause = false;
      return true;
    },
    clear() {
      held.clear();
      use = false;
      pendingThrow = false;
      pendingPause = false;
    },
  };
}

/** Stage a screenshot scene, paint it twice, then flag it ready for the harness. */
function runShot(name) {
  const run = stageShot(name, createRun);
  let painted = 0;
  function paint() {
    renderer.draw(run);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let run = createRun();
  let accumulator = 0;
  let last = performance.now();
  let best = readBest();
  let caughtReason = 'The alarm held, and a hand closed on your shoulder.';

  /** The title sits on a room that is already alive: cones sweeping, guards on their beats. */
  function warmTitle() {
    run = createRun();
    for (let tick = 0; tick < 40; tick += 1) {
      for (const guard of run.guards) stepRun(run, { x: 0, y: 0, sprint: false, crouch: false, use: false }, STEP);
      for (const camera of run.cameras) {
        if (!camera.disabled) camera.phase = (camera.phase ?? 0) + STEP * camera.rate;
      }
    }
    run.clock.elapsed = 0;
    run.alarm.value = 0;
    run.alarm.mode = 'quiet';
    run.screen = SCREEN_TITLE;
  }
  warmTitle();

  function startRun() {
    run = createRun();
    accumulator = 0;
    input.clear();
    announce('In. Three coins, two hundred seconds, and the Halcyon in its case.');
  }

  /** The title's room still needs its cones to sweep, but its guards must not be able to catch anyone. */
  function stepTitleRoom(dt) {
    for (const guard of run.guards) {
      guard.pause = Math.max(0, guard.pause - dt);
      if (guard.pause === 0) guard.scan += dt * 1.1;
      guard.eye.angle = guard.facing + Math.sin(guard.scan) * 0.62;
    }
    for (const camera of run.cameras) {
      camera.phase = (camera.phase ?? 0) + dt * camera.rate;
      camera.angle = camera.base + Math.sin(camera.phase) * camera.sweep;
    }
    run.clock.elapsed += dt;
  }

  // Leaving the tab pauses a live run rather than letting guards walk on unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && run.screen === SCREEN_PLAY) {
      run.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (input.takePause()) {
      if (run.screen === SCREEN_PLAY) { run.screen = SCREEN_PAUSED; announce('Paused.'); ariaBusy(false); }
      else if (run.screen === SCREEN_PAUSED) { run.screen = SCREEN_PLAY; announce('Playing.'); }
    }

    const pointer = input.pointer();
    if (input.takeThrow()) {
      if (run.screen === SCREEN_TITLE || run.screen === SCREEN_WON || run.screen === SCREEN_CAUGHT) startRun();
      else if (run.screen === SCREEN_PLAY && run.thief.coins > 0) {
        const spot = coinPreview(run.level, run.thief, pointer.x, pointer.y);
        const coin = throwCoin(run.thief, spot.x, spot.y);
        if (coin) {
          run.coins.push(coin);
          announce('Coin away: the nearest guard will go and look.');
        }
      }
    }

    if (run.screen === SCREEN_TITLE) {
      accumulator = 0;
      stepTitleRoom(STEP);
    } else if (run.screen === SCREEN_PLAY) {
      run.aim = run.thief.coins > 0 ? coinPreview(run.level, run.thief, pointer.x, pointer.y) : null;
      while (accumulator >= STEP && run.screen === SCREEN_PLAY) {
        const ended = stepRun(run, input.intent(), STEP);
        if (ended === SCREEN_WON) {
          best = Math.max(best, run.clock.score);
          announce(`Clean getaway. ${run.clock.score} points, grade ${run.clock.grade}.`);
        } else if (ended === SCREEN_CAUGHT) {
          caughtReason = run.clock.getaway !== null
            ? 'The getaway ran out of clock. The dock door shut.'
            : run.alarm.mode === 'caught'
              ? 'The alarm held, and a hand closed on your shoulder.'
              : 'A guard heard you and found you on the floor.';
          announce('Caught.');
        }
        accumulator -= STEP;
      }
      if (run.screen !== SCREEN_PLAY) accumulator = 0;
    } else {
      accumulator = 0;
    }

    run.best = best;
    run.caughtReason = caughtReason;
    renderer.draw(run);
  }

  announce('The Quiet Hour. Press Space or click to begin.');
  window.__debug = { get run() { return run; } };
  requestAnimationFrame(frame);
}

function ariaBusy(playing) {
  if (!statusLine) return;
  statusLine.textContent = playing ? '' : statusLine.textContent;
}

if (shot) runShot(shot);
else runGame();
