// The Meridian Deposit, third floor, after hours: one room in four parts and the data that
// describes it. Nothing here draws or moves: it is the floor plan (walls, cover, doors, the vent,
// the service corridor, the display case, the loading dock) plus where the guards walk, where the
// cameras hang, where the dark pools are, and where the thief comes in.
//
// The plan, left to right and top to bottom:
//   - the roof vent runs along the top, crawl-only, with a camera inside it and two grates down;
//   - the reading hall is the middle, with pillars and crates that break every sight line;
//   - the vault room is on the right, holding the Halcyon diamond, with two ways in: the vault
//     door from the hall, and the freight lift from the corridor;
//   - the service corridor runs along the bottom the whole width, from the loading dock to the
//     power box, and it is the only way to kill the cameras.
// So three routes: over the top through the vent (quick, watched), straight through the hall
// (short, patrolled), or down and along the corridor (slow, safe, and it pays for the terminal).

export const ROOM = { x: 34, y: 96, w: 1212, h: 544 };
export const FLOOR = { x: 58, y: 120, w: 1164, h: 496 };

/** Walls: the perimeter and the partitions. They block movement and every line of sight. */
export const WALLS = [
  { x: 34, y: 96, w: 1212, h: 24, label: 'north wall' },
  { x: 34, y: 616, w: 1212, h: 24, label: 'south wall' },
  { x: 34, y: 96, w: 24, h: 544, label: 'west wall' },
  { x: 1222, y: 96, w: 24, h: 544, label: 'east wall' },

  // The vent wall: crawl space above, hall below, two grates through it at x 140-212 and 636-708.
  { x: 58, y: 190, w: 82, h: 18 },
  { x: 212, y: 190, w: 424, h: 18 },
  { x: 708, y: 190, w: 66, h: 18 },

  // The vault partition, with the vault door's opening left out at y 400-470.
  { x: 774, y: 120, w: 26, h: 280 },
  { x: 774, y: 470, w: 26, h: 30 },

  // The corridor wall, with the stair door (300-372), the service door (700-772) and the
  // freight lift (940-1000) left out.
  { x: 58, y: 500, w: 242, h: 20 },
  { x: 372, y: 500, w: 328, h: 20 },
  { x: 772, y: 500, w: 168, h: 20 },
  { x: 1000, y: 500, w: 222, h: 20 },

  // Alcoves off the corridor: stub walls that cut its long sight line into three pockets.
  { x: 520, y: 588, w: 22, h: 28 },
  { x: 860, y: 588, w: 22, h: 28 },
];

/** Cover: chest height. Blocks movement and sight, never sound. */
export const COVER = [
  { x: 330, y: 262, w: 54, h: 54, kind: 'pillar' },
  { x: 560, y: 262, w: 54, h: 54, kind: 'pillar' },
  { x: 150, y: 392, w: 84, h: 58, kind: 'crates' },
  { x: 430, y: 410, w: 86, h: 60, kind: 'crates' },
  { x: 176, y: 462, w: 108, h: 26, kind: 'desk' },
  { x: 880, y: 286, w: 52, h: 52, kind: 'plinth' },
  { x: 1128, y: 308, w: 56, h: 56, kind: 'plinth' },
  { x: 620, y: 430, w: 64, h: 56, kind: 'crates' },
];

/** Doors swing by default shut: a shut door is a wall to every cone, an open one is a gap. */
export const DOORS = [
  { id: 'vault', name: 'Vault door', x: 774, y: 400, w: 26, h: 70, axis: 'v' },
  { id: 'stair', name: 'Stair door', x: 300, y: 500, w: 72, h: 20, axis: 'h' },
  { id: 'service', name: 'Service door', x: 700, y: 500, w: 72, h: 20, axis: 'h' },
  { id: 'freight', name: 'Freight lift', x: 940, y: 500, w: 60, h: 20, axis: 'h' },
];

/** Dark pools. Standing in one cuts what a cone can read of you down to a whisper. */
export const SHADOWS = [
  { x: 60, y: 122, w: 712, h: 66, label: 'vent' },
  { x: 420, y: 336, w: 152, h: 84, label: 'dead lamp' },
  { x: 1090, y: 400, w: 122, h: 80, label: 'vault corner' },
  { x: 420, y: 524, w: 170, h: 56, label: 'corridor' },
  { x: 138, y: 528, w: 178, h: 84, label: 'dock' },
];

/** The vent: crawl-only floor, drawn with slats. */
export const VENTS = [{ x: 60, y: 122, w: 712, h: 66 }];

/** The prize. Reaching it and holding takes the diamond, and starts the getaway. */
export const LOOT = { x: 1006, y: 152, w: 146, h: 92, name: 'Halcyon Diamond', value: '$4.2M' };

/** The loading dock: the only way out with the diamond. */
export const EXIT = { x: 58, y: 528, w: 66, h: 84, label: 'LOADING DOCK' };

/** The power box: hold it down and every camera dies for good. Costs the seconds it takes. */
export const TERMINAL = { x: 918, y: 594, r: 20, label: 'POWER' };

/** Where the thief comes in: in the shadow at the west end of the vent, just inside the grate. */
export const START = { x: 116, y: 168 };

/**
 * Cameras hang high and sweep a slow arc: narrow, long, and blind to anything a wall or a crate
 * stands between them and it.
 */
export const CAMERAS = [
  { id: 'vent-eye', x: 700, y: 140, base: Math.PI, sweep: 0.34, rate: 0.5, range: 330, half: 0.26, mount: 'vent' },
  { id: 'hall-eye', x: 520, y: 214, base: Math.PI / 2, sweep: 0.58, rate: 0.66, range: 306, half: 0.3, mount: 'north' },
  { id: 'vault-eye', x: 1044, y: 128, base: Math.PI / 2, sweep: 0.44, rate: 0.48, range: 246, half: 0.3, mount: 'north' },
];

/**
 * Guard beats. Each is a closed loop walked at that guard's pace; at a waypoint the guard stops,
 * turns on the spot and only then moves on, so the cone sweeps while the body is still.
 */
export const GUARDS = [
  {
    id: 'hall-sweep',
    name: 'Wren',
    path: [{ x: 260, y: 240 }, { x: 700, y: 240 }, { x: 700, y: 356 }, { x: 260, y: 356 }],
    pauses: [1.5, 1.0, 1.5, 1.0],
    pace: 74,
  },
  {
    id: 'vault-watch',
    name: 'Osprey',
    path: [{ x: 850, y: 200 }, { x: 850, y: 452 }, { x: 964, y: 452 }, { x: 964, y: 200 }],
    pauses: [1.2, 1.9, 1.2, 1.9],
    pace: 66,
  },
  {
    id: 'corridor',
    name: 'Pike',
    path: [{ x: 180, y: 556 }, { x: 1120, y: 556 }],
    pauses: 2.6,
    pace: 58,
  },
];

/** Reading the map at a glance: named zones the renderer sets in small caps. */
export const ZONES = [
  { x: 66, y: 126, w: 300, h: 20, text: 'ROOF VENT · CRAWL', tone: 'cyan' },
  { x: 66, y: 236, w: 240, h: 20, text: 'READING HALL', tone: 'muted' },
  { x: 66, y: 596, w: 280, h: 20, text: 'SERVICE CORRIDOR', tone: 'muted' },
  { x: 1006, y: 250, w: 190, h: 20, text: 'VAULT ROOM', tone: 'gold' },
];

/** Every rectangle that stops a body, a line of sight or a thrown coin. */
export function solidRects(level) {
  const rects = [];
  for (const wall of level.walls) rects.push(wall);
  for (const block of level.cover) rects.push(block);
  for (const door of level.doors) if (door.open < 0.45) rects.push(door);
  return rects;
}

export function rectContains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function circleHitsRect(x, y, radius, rect) {
  const nearX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearX;
  const dy = y - nearY;
  return dx * dx + dy * dy < radius * radius;
}

/** Build the mutable level state a run plays on. */
export function createLevel() {
  return {
    room: { ...ROOM },
    floor: { ...FLOOR },
    walls: WALLS.map((wall) => ({ ...wall })),
    cover: COVER.map((block) => ({ ...block })),
    doors: DOORS.map((door) => ({ ...door, open: 0, target: 0 })),
    shadows: SHADOWS.map((patch) => ({ ...patch })),
    vents: VENTS.map((vent) => ({ ...vent })),
    loot: { ...LOOT, taken: false, hold: 0 },
    exit: { ...EXIT },
    terminal: { ...TERMINAL, progress: 0, done: false },
    cameras: CAMERAS.map((camera) => ({ ...camera, angle: camera.base, disabled: false })),
    guards: GUARDS.map((guard) => ({ ...guard, path: guard.path.map((point) => ({ ...point })) })),
    zones: ZONES.map((zone) => ({ ...zone })),
    start: { ...START },
  };
}
