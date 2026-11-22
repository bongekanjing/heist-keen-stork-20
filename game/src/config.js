// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The HUD bands: a header strip above the room, a ticker strip below it. */
export const HUD = { top: 86, bottom: 690 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/**
 * One palette, five jobs: deep navy for the building, warm amber for every danger, one bright
 * accent for the thief, gold for the loot, cool grey-blue for the cover that keeps you safe.
 */
export const PALETTE = {
  backdrop: '#04070d',
  floor: '#0d1728',
  floorDeep: '#0a1120',
  floorEdge: '#122036',
  grid: 'rgba(92,142,205,0.07)',
  gridMajor: 'rgba(92,142,205,0.14)',
  wall: '#182742',
  wallTop: '#22375a',
  wallEdge: '#33527f',
  cover: '#3a5170',
  coverTop: '#50709a',
  coverEdge: '#6f92bd',
  amber: '#ffab2e',
  amberBright: '#ffcb63',
  amberDim: '#a86a14',
  amberCone: 'rgba(255,164,50,0.19)',
  amberConeHot: 'rgba(255,126,58,0.28)',
  amberEdge: 'rgba(255,196,99,0.9)',
  alarmRed: '#ff5f34',
  thief: '#3ff2c6',
  thiefDeep: '#0e8f7c',
  thiefGlow: 'rgba(63,242,198,0.28)',
  gold: '#ffd24a',
  goldDeep: '#a26f08',
  cyan: '#5fe3ff',
  text: '#e9f0f9',
  muted: '#8296b2',
  panel: 'rgba(8,14,25,0.9)',
  panelEdge: 'rgba(110,160,220,0.22)',
};

export const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif';
export const MONO = '"SF Mono", "Consolas", ui-monospace, monospace';

export const THIEF = {
  radius: 11,
  walk: 176,
  sprint: 302,
  crouch: 84,
  carryingScale: 0.9,
  noiseWalk: 0.34,
  noiseSprint: 1,
  noiseCrouch: 0.05,
  noiseCool: 1.9,
  coins: 3,
  coinSpeed: 640,
  coinRange: 440,
  coinFlight: 0.34,
  coinPing: 0.6,
};

export const GUARD = {
  radius: 12,
  turn: 3.2,
  catchRange: 30,
  patrolSpeed: 78,
  investigateSpeed: 116,
  chaseSpeed: 152,
  hearSprint: 250,
  hearCoin: 560,
  hearDoor: 190,
  investigateSeconds: 5.5,
  scanAmplitude: 0.62,
  scanRate: 1.35,
  pauseMin: 1.1,
  pauseMax: 2.4,
};

export const CAMERA = {
  sweepRate: 0.62,
  sweep: 0.5,
  halfAngle: 0.2,
  range: 296,
  disableHold: 2.4,
};

export const ALARM = {
  riseNear: 0.5,
  riseFar: 1.16,
  riseCamera: 0.62,
  fall: 0.42,
  hold: 0.45,
  grace: 1.8,
  evadedTo: 58,
  crouchScale: 0.74,
  shadowScale: 0.55,
  carryingScale: 1.12,
};

export const HEIST = {
  seconds: 200,
  getaway: 52,
  lootHold: 2.0,
  doorHold: 0.18,
  reach: 56,
};

export const BEST_KEY = 'quiet-hour.best';
