// Drawing only: level and state in, pixels out. The 1280x720 logical room is scaled to fit the
// window and centred. Every shape is a canvas 2D path built here — no images, no sprite sheet.
//
// The picture is ordered the way it has to be read: the floor and its blueprint grid, the dark
// pools, the cover, the cones (translucent amber, crisp edge, cut visibly by whatever stands in
// them), then the bodies, then the gold, then the HUD. The alarm meter is the widest object on the
// top band because it is the one number that ends a run.

import { FONT, HUD, MONO, PALETTE, THIEF } from './config.js';
import { conePolygon } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WON = 'won';
export const SCREEN_CAUGHT = 'caught';

const TAU = Math.PI * 2;

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** A rounded rectangle path, used for panels, crates and the vault case. */
function roundRect(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.quadraticCurveTo(x + w, y, x + w, y + radius);
  context.lineTo(x + w, y + h - radius);
  context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  context.lineTo(x + radius, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const coneBuf = [];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / 1280, height / 720);
    view.x = (width - 1280 * view.scale) / 2;
    view.y = (height - 720 * view.scale) / 2;
  }

  const fonts = new Map();
  function font(size, family = FONT, weight = '600') {
    const key = `${weight}${size}${family}`;
    let value = fonts.get(key);
    if (!value) { value = `${weight} ${size}px ${family}`; fonts.set(key, value); }
    return value;
  }

  function text(value, x, y, size, color, align = 'left', family = FONT, weight = '600') {
    context.font = font(size, family, weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function spaced(value, x, y, size, color, align, spacing, family = FONT, weight = '600') {
    context.font = font(size, family, weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.letterSpacing = `${spacing}px`;
    context.fillText(value, x, y);
    context.letterSpacing = '0px';
  }

  // ---------------------------------------------------------------- floor and building shell

  function drawFloor(level, time) {
    const floor = level.floor;
    context.fillStyle = PALETTE.floorDeep;
    context.fillRect(0, 0, 1280, 720);

    const wash = context.createLinearGradient(0, floor.y, 0, floor.y + floor.h);
    wash.addColorStop(0, PALETTE.floor);
    wash.addColorStop(0.55, '#0e1a2d');
    wash.addColorStop(1, '#0b1524');
    context.fillStyle = wash;
    context.fillRect(floor.x, floor.y, floor.w, floor.h);

    context.save();
    context.beginPath();
    context.rect(floor.x, floor.y, floor.w, floor.h);
    context.clip();

    context.lineWidth = 1;
    context.strokeStyle = PALETTE.grid;
    context.beginPath();
    for (let x = floor.x; x <= floor.x + floor.w; x += 26) { context.moveTo(x, floor.y); context.lineTo(x, floor.y + floor.h); }
    for (let y = floor.y; y <= floor.y + floor.h; y += 26) { context.moveTo(floor.x, y); context.lineTo(floor.x + floor.w, y); }
    context.stroke();

    context.strokeStyle = PALETTE.gridMajor;
    context.beginPath();
    for (let x = floor.x; x <= floor.x + floor.w; x += 130) { context.moveTo(x, floor.y); context.lineTo(x, floor.y + floor.h); }
    for (let y = floor.y; y <= floor.y + floor.h; y += 124) { context.moveTo(floor.x, y); context.lineTo(floor.x + floor.w, y); }
    context.stroke();

    // The vent: louvred slats, so it reads as a duct and not as more floor.
    for (let index = 0; index < level.vents.length; index += 1) {
      const vent = level.vents[index];
      context.fillStyle = 'rgba(6,12,22,0.66)';
      context.fillRect(vent.x, vent.y, vent.w, vent.h);
      context.strokeStyle = 'rgba(95,227,255,0.16)';
      context.lineWidth = 1;
      context.beginPath();
      for (let y = vent.y + 5; y < vent.y + vent.h - 3; y += 6) { context.moveTo(vent.x + 4, y); context.lineTo(vent.x + vent.w - 4, y); }
      context.stroke();
      const sweep = ((time * 34) % (vent.w + 260)) - 130;
      const shimmer = context.createLinearGradient(vent.x + sweep - 90, 0, vent.x + sweep + 90, 0);
      shimmer.addColorStop(0, 'rgba(95,227,255,0)');
      shimmer.addColorStop(0.5, 'rgba(95,227,255,0.09)');
      shimmer.addColorStop(1, 'rgba(95,227,255,0)');
      context.fillStyle = shimmer;
      context.fillRect(vent.x, vent.y, vent.w, vent.h);
    }

    // The grate mouths, where the vent meets the hall: two framed crawl holes.
    const grates = [[140, 190, 72], [636, 190, 72]];
    for (let index = 0; index < grates.length; index += 1) {
      const gx = grates[index][0];
      const gy = grates[index][1];
      const gw = grates[index][2];
      context.fillStyle = 'rgba(95,227,255,0.10)';
      context.fillRect(gx, gy - 4, gw, 26);
      context.strokeStyle = 'rgba(95,227,255,0.42)';
      context.lineWidth = 1.5;
      context.setLineDash([5, 5]);
      context.strokeRect(gx, gy - 4, gw, 26);
      context.setLineDash([]);
      context.beginPath();
      for (let s = 0; s < 5; s += 1) {
        const yy = gy + 2 + s * 4.5;
        context.moveTo(gx + 6, yy);
        context.lineTo(gx + gw - 6, yy);
      }
      context.strokeStyle = 'rgba(95,227,255,0.5)';
      context.lineWidth = 1;
      context.stroke();
    }

    // Dark pools. Elliptical and soft-edged, so a patch of dead light reads as a place you can
    // stand in rather than a black rectangle cut out of the floor.
    for (let index = 0; index < level.shadows.length; index += 1) {
      const patch = level.shadows[index];
      const cx = patch.x + patch.w / 2;
      const cy = patch.y + patch.h / 2;
      const rx = patch.w / 2;
      const ry = patch.h / 2;
      context.save();
      context.translate(cx, cy);
      context.scale(1, ry / rx);
      const shade = context.createRadialGradient(0, 0, rx * 0.06, 0, 0, rx);
      shade.addColorStop(0, 'rgba(2,6,13,0.66)');
      shade.addColorStop(0.44, 'rgba(2,6,13,0.52)');
      shade.addColorStop(0.74, 'rgba(3,8,16,0.26)');
      shade.addColorStop(1, 'rgba(3,8,16,0)');
      context.fillStyle = shade;
      context.beginPath();
      context.arc(0, 0, rx, 0, TAU);
      context.fill();
      context.restore();

      // A faint lit rim, so the eye reads the boundary as a pool of dark and not as a missing tile.
      context.beginPath();
      context.ellipse(cx, cy, rx * 0.94, ry * 0.86, 0, 0, TAU);
      context.strokeStyle = 'rgba(110,150,200,0.10)';
      context.lineWidth = 1;
      context.stroke();
    }
    context.restore();

    // The dock, chalked on the floor: the way out, marked even before the loot is in hand.
    const exit = level.exit;
    const lit = level.loot.taken;
    context.save();
    context.globalAlpha = lit ? 0.95 : 0.45;
    context.fillStyle = lit ? 'rgba(255,210,74,0.20)' : 'rgba(95,227,255,0.10)';
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    context.strokeStyle = lit ? PALETTE.gold : PALETTE.cyan;
    context.lineWidth = 2;
    context.setLineDash([9, 6]);
    context.strokeRect(exit.x + 3, exit.y + 3, exit.w - 6, exit.h - 6);
    context.setLineDash([]);
    // The arrow points at the wall it escapes through: the dock is on the west, so it points west.
    context.beginPath();
    context.moveTo(exit.x + exit.w / 2 - 11, exit.y + exit.h / 2);
    context.lineTo(exit.x + exit.w / 2 + 8, exit.y + exit.h / 2 - 13);
    context.lineTo(exit.x + exit.w / 2 + 8, exit.y + exit.h / 2 + 13);
    context.closePath();
    context.fillStyle = lit ? PALETTE.gold : 'rgba(95,227,255,0.55)';
    context.fill();
    context.restore();

    // Zone labels, in tiny caps, so the map explains itself.
    for (let index = 0; index < level.zones.length; index += 1) {
      const zone = level.zones[index];
      const color = zone.tone === 'cyan' ? 'rgba(95,227,255,0.58)' : zone.tone === 'gold' ? 'rgba(255,210,74,0.62)' : 'rgba(130,150,178,0.5)';
      spaced(zone.text, zone.x, zone.y + 14, 11, color, 'left', 1.6, MONO, '600');
    }
  }

  function drawWalls(level) {
    context.save();
    context.shadowColor = 'rgba(0,0,0,0.75)';
    context.shadowBlur = 16;
    context.shadowOffsetY = 4;
    for (let index = 0; index < level.walls.length; index += 1) {
      const wall = level.walls[index];
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
    }
    context.restore();

    for (let index = 0; index < level.walls.length; index += 1) {
      const wall = level.walls[index];
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.w, 3);
      context.strokeStyle = PALETTE.wallEdge;
      context.lineWidth = 1;
      context.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
    }
  }

  function drawCover(level) {
    for (let index = 0; index < level.cover.length; index += 1) {
      const block = level.cover[index];
      context.save();
      context.shadowColor = 'rgba(0,0,0,0.6)';
      context.shadowBlur = 12;
      context.shadowOffsetY = 5;
      context.fillStyle = PALETTE.cover;
      roundRect(context, block.x, block.y, block.w, block.h, block.kind === 'pillar' ? 4 : 3);
      context.fill();
      context.restore();

      context.fillStyle = PALETTE.coverTop;
      if (block.kind === 'pillar') {
        context.beginPath();
        context.arc(block.x + block.w / 2, block.y + block.h / 2, block.w * 0.36, 0, TAU);
        context.fill();
        context.strokeStyle = PALETTE.coverEdge;
        context.lineWidth = 2;
        context.stroke();
        context.beginPath();
        context.arc(block.x + block.w / 2, block.y + block.h / 2, block.w * 0.16, 0, TAU);
        context.fillStyle = 'rgba(12,20,34,0.8)';
        context.fill();
      } else if (block.kind === 'crates') {
        roundRect(context, block.x + 4, block.y + 4, block.w - 8, block.h - 8, 2);
        context.fill();
        context.strokeStyle = PALETTE.coverEdge;
        context.lineWidth = 1.4;
        context.stroke();
        context.beginPath();
        context.moveTo(block.x + 6, block.y + 6);
        context.lineTo(block.x + block.w - 6, block.y + block.h - 6);
        context.moveTo(block.x + block.w - 6, block.y + 6);
        context.lineTo(block.x + 6, block.y + block.h - 6);
        context.strokeStyle = 'rgba(111,146,189,0.45)';
        context.lineWidth = 1;
        context.stroke();
      } else if (block.kind === 'desk') {
        roundRect(context, block.x + 5, block.y + 5, block.w - 10, block.h - 8, 2);
        context.fill();
        context.fillStyle = 'rgba(12,20,34,0.55)';
        context.fillRect(block.x + 12, block.y + 9, block.w - 24, 5);
      } else {
        roundRect(context, block.x + 5, block.y + 5, block.w - 10, block.h - 10, 3);
        context.fill();
        context.strokeStyle = PALETTE.coverEdge;
        context.lineWidth = 1.4;
        context.stroke();
        context.fillStyle = 'rgba(255,210,74,0.20)';
        context.beginPath();
        context.arc(block.x + block.w / 2, block.y + block.h / 2, 6, 0, TAU);
        context.fill();
      }
    }
  }

  function drawDoors(level) {
    for (let index = 0; index < level.doors.length; index += 1) {
      const door = level.doors[index];
      const open = door.open;
      const passable = open > 0.45;
      context.save();
      context.translate(door.x, door.y);

      // A doorway is the one place a wall can be walked through, so it is the brightest edge in the
      // wall: a warm threshold wash on the floor plus two lit jambs, legible from across the room.
      if (passable) {
        context.fillStyle = 'rgba(255,171,46,0.16)';
        context.fillRect(0, 0, door.w, door.h);
      }

      const along = door.axis === 'h' ? door.w : door.h;
      const leaf = along * (1 - open);
      if (door.axis === 'h') {
        context.fillStyle = passable ? 'rgba(255,171,46,0.34)' : PALETTE.wallTop;
        context.fillRect(0, 0, leaf, door.h);
        context.strokeStyle = passable ? PALETTE.amber : PALETTE.wallEdge;
        context.lineWidth = 1.5;
        context.strokeRect(0.5, 0.5, Math.max(leaf, 0.5) - 1, door.h - 1);
      } else {
        context.fillStyle = passable ? 'rgba(255,171,46,0.34)' : PALETTE.wallTop;
        context.fillRect(0, 0, door.w, leaf);
        context.strokeStyle = passable ? PALETTE.amber : PALETTE.wallEdge;
        context.lineWidth = 1.5;
        context.strokeRect(0.5, 0.5, door.w - 1, Math.max(leaf, 0.5) - 1);
      }

      // The jambs: drawn last, on both ends of the opening, so the gap is bracketed even when shut.
      context.fillStyle = passable ? PALETTE.amberBright : 'rgba(255,171,46,0.7)';
      if (door.axis === 'h') {
        context.fillRect(-1.5, -2, 4, door.h + 4);
        context.fillRect(door.w - 2.5, -2, 4, door.h + 4);
        if (!passable) context.fillRect(door.w / 2 - 1.5, door.h / 2 - 5, 3, 10);
      } else {
        context.fillRect(-2, -1.5, door.w + 4, 4);
        context.fillRect(-2, door.h - 2.5, door.w + 4, 4);
        if (!passable) context.fillRect(door.w / 2 - 5, door.h / 2 - 1.5, 10, 3);
      }
      context.restore();
    }
  }

  // ---------------------------------------------------------------- cones, cameras, guards

  function drawCone(x, y, angle, half, range, rects, hot) {
    const points = conePolygon(x, y, angle, half, range, rects, coneBuf);
    context.beginPath();
    context.moveTo(points[0], points[1]);
    for (let index = 2; index < points.length; index += 2) context.lineTo(points[index], points[index + 1]);
    context.closePath();

    const glow = context.createRadialGradient(x, y, 4, x, y, range);
    if (hot) {
      glow.addColorStop(0, 'rgba(255,126,58,0.36)');
      glow.addColorStop(0.6, 'rgba(255,126,58,0.20)');
      glow.addColorStop(1, 'rgba(255,164,50,0.05)');
    } else {
      glow.addColorStop(0, 'rgba(255,164,50,0.30)');
      glow.addColorStop(0.6, PALETTE.amberCone);
      glow.addColorStop(1, 'rgba(255,164,50,0.04)');
    }
    context.fillStyle = glow;
    context.fill();

    context.strokeStyle = hot ? 'rgba(255,120,58,0.95)' : PALETTE.amberEdge;
    context.lineWidth = hot ? 2 : 1.4;
    context.stroke();

    context.beginPath();
    context.arc(x, y, Math.min(26, range * 0.12), angle - half, angle + half);
    context.strokeStyle = hot ? PALETTE.alarmRed : PALETTE.amberBright;
    context.lineWidth = 2;
    context.stroke();
  }

  function drawConeEdges(x, y, angle, half, range, rects, hot) {
    const points = conePolygon(x, y, angle, half, range, rects, coneBuf);
    context.beginPath();
    for (let side = 0; side < 2; side += 1) {
      const bearing = angle + (side === 0 ? -half : half);
      const index = side === 0 ? 2 : points.length - 2;
      const distance = Math.hypot(points[index] - x, points[index + 1] - y);
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(bearing) * distance, y + Math.sin(bearing) * distance);
    }
    context.strokeStyle = hot ? 'rgba(255,120,58,0.55)' : 'rgba(255,196,99,0.42)';
    context.lineWidth = 1;
    context.stroke();
  }

  function drawCameraCone(camera, rects) {
    if (camera.disabled) return;
    const points = conePolygon(camera.x, camera.y, camera.angle, camera.half, camera.range, rects, coneBuf);
    context.beginPath();
    context.moveTo(points[0], points[1]);
    for (let index = 2; index < points.length; index += 2) context.lineTo(points[index], points[index + 1]);
    context.closePath();

    // Camera light is colder and harder than a guard's: a pale wash with a fine bright edge, so a
    // still frame tells you at a glance which cone is bolted to the wall and which one is walking.
    const glow = context.createRadialGradient(camera.x, camera.y, 4, camera.x, camera.y, camera.range);
    glow.addColorStop(0, 'rgba(255,225,150,0.30)');
    glow.addColorStop(0.55, 'rgba(255,214,130,0.15)');
    glow.addColorStop(1, 'rgba(255,214,130,0.03)');
    context.fillStyle = glow;
    context.fill();
    context.strokeStyle = 'rgba(255,232,178,0.75)';
    context.lineWidth = 1.2;
    context.stroke();
  }

  function drawCameraBody(camera, time) {
    const live = !camera.disabled;
    const dark = live ? '#16263f' : '#101c2e';
    const trim = live ? PALETTE.amberBright : 'rgba(130,150,178,0.5)';
    const lift = 16;

    // A bracket up to the wall, so the housing reads as bolted on rather than lying on the floor.
    context.fillStyle = dark;
    context.fillRect(camera.x - 2.5, camera.y - lift - 8, 5, 12);
    context.fillStyle = 'rgba(130,160,200,0.35)';
    context.fillRect(camera.x - 7, camera.y - lift - 10, 14, 4);

    context.save();
    context.translate(camera.x, camera.y);

    if (live) {
      // A lens bloom at the apex: the one spot in the room that is unmistakably a machine eye.
      const bloom = context.createRadialGradient(0, 0, 2, 0, 0, 22);
      bloom.addColorStop(0, 'rgba(255,203,99,0.55)');
      bloom.addColorStop(0.5, 'rgba(255,171,46,0.16)');
      bloom.addColorStop(1, 'rgba(255,171,46,0)');
      context.fillStyle = bloom;
      context.fillRect(-24, -24, 48, 48);
    }

    context.rotate(camera.angle);

    // The housing: a hood that tapers to the lens, drawn as a solid CCTV body.
    context.beginPath();
    context.moveTo(-15, -11);
    context.lineTo(2, -9);
    context.lineTo(11, -6);
    context.lineTo(11, 6);
    context.lineTo(2, 9);
    context.lineTo(-15, 11);
    context.closePath();
    context.fillStyle = dark;
    context.fill();
    context.strokeStyle = trim;
    context.lineWidth = 2;
    context.stroke();

    // A hood lip across the top of the barrel, which is what makes the silhouette read as a camera.
    context.beginPath();
    context.moveTo(2, -11.5);
    context.lineTo(15, -8);
    context.lineTo(15, -4);
    context.lineTo(2, -6.5);
    context.closePath();
    context.fillStyle = live ? '#2a4166' : '#1a2740';
    context.fill();

    // The lens itself: a dark iris inside a bright bezel.
    context.beginPath();
    context.arc(11, 0, 6.5, 0, TAU);
    context.fillStyle = '#0a1120';
    context.fill();
    context.strokeStyle = trim;
    context.lineWidth = 2;
    context.stroke();
    context.beginPath();
    context.arc(11, 0, live ? 3.2 : 2, 0, TAU);
    context.fillStyle = live ? '#fff0c4' : '#3c4f68';
    context.fill();

    if (live) {
      // A slow sonar ring: on a static image it still reads as "this thing is live".
      const ring = 8 + Math.sin(time * 3.2) * 2.4;
      context.beginPath();
      context.arc(11, 0, ring + 4, 0, TAU);
      context.strokeStyle = 'rgba(255,203,99,0.42)';
      context.lineWidth = 1.4;
      context.stroke();
    }
    context.restore();

    // A short label under the housing, so a shrunk frame still says "camera".
    spaced(camera.disabled ? 'CAM DEAD' : 'CAM', camera.x, camera.y + 26, 9, camera.disabled ? 'rgba(130,150,178,0.55)' : 'rgba(255,203,99,0.85)', 'center', 2, MONO, '700');

    if (!live) {
      context.beginPath();
      context.moveTo(camera.x - 9, camera.y - 9);
      context.lineTo(camera.x + 9, camera.y + 9);
      context.moveTo(camera.x + 9, camera.y - 9);
      context.lineTo(camera.x - 9, camera.y + 9);
      context.strokeStyle = 'rgba(255,95,52,0.75)';
      context.lineWidth = 2;
      context.stroke();
    }
  }

  function drawGuardBody(guard, hot, time) {
    const x = guard.x;
    const y = guard.y;
    context.save();
    context.beginPath();
    context.ellipse(x, y + 11, 15, 6.5, 0, 0, TAU);
    context.fillStyle = 'rgba(0,0,0,0.5)';
    context.fill();

    // The torch cone's spill on the floor right in front of him, so the body and its light read as
    // one object.
    const spill = context.createRadialGradient(x, y, 6, x, y, 34);
    spill.addColorStop(0, hot ? 'rgba(255,95,52,0.34)' : 'rgba(255,171,46,0.26)');
    spill.addColorStop(1, 'rgba(255,171,46,0)');
    context.fillStyle = spill;
    context.fillRect(x - 34, y - 34, 68, 68);

    context.translate(x, y);
    context.rotate(guard.facing);

    // A caped figure: a broad cloak behind, a shoulder line, and a cap with a brim at the front.
    // Deliberately not a ring — nothing about this shape can be mistaken for a waypoint pip.
    context.beginPath();
    context.moveTo(7, 0);
    context.quadraticCurveTo(5, -12, -3, -14);
    context.quadraticCurveTo(-15, -12, -16, 0);
    context.quadraticCurveTo(-15, 12, -3, 14);
    context.quadraticCurveTo(5, 12, 7, 0);
    context.closePath();
    context.fillStyle = hot ? '#e08a24' : '#b8792c';
    context.fill();
    context.strokeStyle = hot ? PALETTE.alarmRed : '#ffd9a0';
    context.lineWidth = 2.2;
    context.stroke();

    // The cap: a dark brim across the front of the head, which is the silhouette cue at small size.
    context.beginPath();
    context.arc(2, 0, 7.4, 0, TAU);
    context.fillStyle = '#2b1c0c';
    context.fill();
    context.strokeStyle = '#ffd9a0';
    context.lineWidth = 1.6;
    context.stroke();
    context.beginPath();
    context.moveTo(9, -7);
    context.lineTo(9, 7);
    context.strokeStyle = hot ? PALETTE.alarmRed : PALETTE.amberBright;
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.stroke();
    context.lineCap = 'butt';

    // The torch lens, at the exact point the cone is cast from.
    context.beginPath();
    context.arc(10, 0, 3, 0, TAU);
    context.fillStyle = hot ? '#fff0e0' : '#fff4d2';
    context.fill();
    context.restore();

    if (guard.pause > 0 && Math.sin(time * 6) > 0.6) {
      context.beginPath();
      context.arc(x, y, 19, 0, TAU);
      context.strokeStyle = 'rgba(255,203,99,0.26)';
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function drawGuardCurious(guard, time) {
    if (guard.state !== 'look') return;
    const bob = Math.sin(time * 5) * 2;
    text('?', guard.x, guard.y - 24 + bob, 18, PALETTE.amberBright, 'center', FONT, '700');
  }

  function drawChaseMark(guard) {
    if (guard.state !== 'chase') return;
    text('!', guard.x, guard.y - 26, 22, PALETTE.alarmRed, 'center', FONT, '800');
  }

  // ---------------------------------------------------------------- loot, terminal, coins

  function drawVaultCase(level, time) {
    const loot = level.loot;
    const cx = loot.x + loot.w / 2;
    const cy = loot.y + loot.h / 2;
    if (loot.taken) {
      // The case reads as cracked from across the room: an open, dark, matte shell with the lid
      // hinged back, not the same bright gold box with a caption the player has to read.
      context.fillStyle = 'rgba(46,64,88,0.75)';
      roundRect(context, loot.x, loot.y, loot.w, loot.h, 4);
      context.fill();

      // The lid, hinged open above the box, thrown back and flat.
      context.beginPath();
      context.moveTo(loot.x + 6, loot.y - 2);
      context.lineTo(loot.x + loot.w - 6, loot.y - 2);
      context.lineTo(loot.x + loot.w - 16, loot.y - 34);
      context.lineTo(loot.x + 16, loot.y - 34);
      context.closePath();
      context.fillStyle = 'rgba(58,79,106,0.7)';
      context.fill();
      context.strokeStyle = 'rgba(255,210,74,0.3)';
      context.lineWidth = 1.2;
      context.stroke();

      // The velvet inside, dark and empty, with the diamond's square seat left vacant.
      context.fillStyle = 'rgba(4,8,15,0.92)';
      roundRect(context, loot.x + 10, loot.y + 10, loot.w - 20, loot.h - 20, 3);
      context.fill();

      context.beginPath();
      context.setLineDash([4, 4]);
      context.rect(loot.x + loot.w / 2 - 20, loot.y + loot.h / 2 - 13, 40, 26);
      context.strokeStyle = 'rgba(255,210,74,0.35)';
      context.lineWidth = 1;
      context.stroke();
      context.setLineDash([]);

      context.strokeStyle = 'rgba(120,140,170,0.5)';
      context.lineWidth = 1.6;
      roundRect(context, loot.x, loot.y, loot.w, loot.h, 4);
      context.stroke();
      return;
    }

    const halo = context.createRadialGradient(cx, cy, 8, cx, cy, 128);
    halo.addColorStop(0, 'rgba(255,210,74,0.32)');
    halo.addColorStop(0.55, 'rgba(255,210,74,0.11)');
    halo.addColorStop(1, 'rgba(255,210,74,0)');
    context.fillStyle = halo;
    context.fillRect(loot.x - 60, loot.y - 60, loot.w + 120, loot.h + 120);

    context.save();
    context.shadowColor = 'rgba(255,210,74,0.55)';
    context.shadowBlur = 18;
    context.fillStyle = 'rgba(255,210,74,0.13)';
    roundRect(context, loot.x, loot.y, loot.w, loot.h, 5);
    context.fill();
    context.restore();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2.2;
    roundRect(context, loot.x, loot.y, loot.w, loot.h, 5);
    context.stroke();

    context.save();
    context.translate(cx, cy - 4);
    const spin = Math.sin(time * 1.1) * 0.5;
    context.beginPath();
    context.moveTo(0, -26);
    context.lineTo(20 + spin * 6, -4);
    context.lineTo(0, 26);
    context.lineTo(-20 + spin * 6, -4);
    context.closePath();
    const gem = context.createLinearGradient(-20, -26, 20, 26);
    gem.addColorStop(0, '#fff3c4');
    gem.addColorStop(0.45, PALETTE.gold);
    gem.addColorStop(1, PALETTE.goldDeep);
    context.fillStyle = gem;
    context.fill();
    context.strokeStyle = '#fff8dd';
    context.lineWidth = 1.4;
    context.stroke();
    context.beginPath();
    context.moveTo(0, -26);
    context.lineTo(0, 26);
    context.moveTo(-20 + spin * 6, -4);
    context.lineTo(20 + spin * 6, -4);
    context.strokeStyle = 'rgba(255,255,255,0.55)';
    context.lineWidth = 1;
    context.stroke();
    context.restore();

    spaced(loot.name.toUpperCase(), cx, loot.y + loot.h + 18, 12, PALETTE.gold, 'center', 2.4, MONO);
    spaced(loot.value, cx, loot.y + loot.h + 34, 11, 'rgba(255,210,74,0.62)', 'center', 1.8, MONO);

    if (loot.hold > 0.02) {
      const width = 120;
      const x = cx - width / 2;
      const y = loot.y - 16;
      context.fillStyle = 'rgba(6,12,22,0.8)';
      context.fillRect(x, y, width, 6);
      context.fillStyle = PALETTE.gold;
      context.fillRect(x, y, width * clamp01(loot.hold / 2), 6);
    }
  }

  function drawTerminal(level, time) {
    const terminal = level.terminal;
    const live = !terminal.done;
    context.save();
    context.beginPath();
    context.arc(terminal.x, terminal.y, 20, 0, TAU);
    context.fillStyle = live ? 'rgba(14,24,40,0.95)' : 'rgba(20,60,54,0.9)';
    context.fill();
    context.strokeStyle = live ? 'rgba(255,171,46,0.9)' : PALETTE.thief;
    context.lineWidth = 2;
    context.stroke();

    context.beginPath();
    context.moveTo(terminal.x + 3, terminal.y - 11);
    context.lineTo(terminal.x - 6, terminal.y + 1);
    context.lineTo(terminal.x - 1, terminal.y + 1);
    context.lineTo(terminal.x - 3, terminal.y + 11);
    context.lineTo(terminal.x + 7, terminal.y - 2);
    context.lineTo(terminal.x + 1, terminal.y - 2);
    context.closePath();
    context.fillStyle = live ? PALETTE.amberBright : PALETTE.thief;
    context.fill();
    context.restore();

    spaced(terminal.label, terminal.x, terminal.y + 36, 10, live ? 'rgba(255,203,99,0.7)' : 'rgba(63,242,198,0.75)', 'center', 2, MONO);

    if (live && terminal.progress > 0.01) {
      context.beginPath();
      context.arc(terminal.x, terminal.y, 26, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01(terminal.progress));
      context.strokeStyle = PALETTE.cyan;
      context.lineWidth = 3;
      context.stroke();
    }
    if (live) {
      const pulse = 0.4 + Math.sin(time * 3) * 0.2;
      context.beginPath();
      context.arc(terminal.x, terminal.y, 24 + pulse * 4, 0, TAU);
      context.strokeStyle = `rgba(255,171,46,${(pulse * 0.4).toFixed(3)})`;
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function drawCoins(coins) {
    for (let index = 0; index < coins.length; index += 1) {
      const coin = coins[index];
      if (!coin.landed) {
        context.beginPath();
        context.arc(coin.x, coin.y - (coin.height ?? 0), 3.4, 0, TAU);
        context.fillStyle = PALETTE.gold;
        context.fill();
        context.beginPath();
        context.ellipse(coin.x, coin.y + 6, 5, 2, 0, 0, TAU);
        context.fillStyle = 'rgba(0,0,0,0.35)';
        context.fill();
      } else {
        context.beginPath();
        context.arc(coin.x, coin.y, 6 + Math.sin(coin.life * 5) * 1.2, 0, TAU);
        context.strokeStyle = 'rgba(255,210,74,0.34)';
        context.lineWidth = 1.4;
        context.stroke();
        context.beginPath();
        context.ellipse(coin.x, coin.y, 3.4 + Math.abs(Math.cos(coin.spin)) * 2, 3.2, 0, 0, TAU);
        context.fillStyle = PALETTE.gold;
        context.fill();
      }
    }
  }

  function drawThief(thief) {
    const x = thief.x;
    const y = thief.y;
    const crouched = thief.stance === 'crouch';
    const scale = crouched ? 0.9 : 1.06;
    const bob = thief.bob || 0;
    const bodyY = y + bob * 0.3;
    const step = Math.sin(bob * 2.2);

    // A tight, low halo: enough to lift him off the floor, not enough to blur into a glowing
    // marker. The read has to come from the silhouette, so the glow stays behind the body.
    const halo = context.createRadialGradient(x, y, 8, x, y, 34);
    halo.addColorStop(0, 'rgba(63,242,198,0.30)');
    halo.addColorStop(0.5, 'rgba(63,242,198,0.10)');
    halo.addColorStop(1, 'rgba(63,242,198,0)');
    context.fillStyle = halo;
    context.fillRect(x - 36, y - 36, 72, 72);

    context.save();

    // A hard contact shadow, offset down-right: this is what makes a flat top-down shape sit on a
    // floor instead of float above it, and it survives being shrunk.
    context.beginPath();
    context.ellipse(x + 3, y + 12, 16 * scale, 7 * scale, 0, 0, TAU);
    context.fillStyle = 'rgba(0,0,0,0.62)';
    context.fill();

    context.translate(x, bodyY);
    context.rotate(thief.facing);

    // The sight wedge, a whisper of facing, kept well under the body and narrow so it reads as a
    // direction of attention rather than a snout.
    context.beginPath();
    context.moveTo(10, 0);
    context.lineTo(44 * scale, -9 * scale);
    context.lineTo(44 * scale, 9 * scale);
    context.closePath();
    context.fillStyle = 'rgba(63,242,198,0.12)';
    context.fill();

    const DARK = '#05141c';

    // The legs: two tapered ovals trailing BEHIND the body, split apart, in a walking stride. Behind
    // and split is what makes a top-down figure read as standing and moving rather than crouching.
    context.fillStyle = '#1fa98c';
    context.strokeStyle = DARK;
    context.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      const swing = step * side * 4.5;
      context.beginPath();
      context.ellipse(-11 * scale + swing, side * 5.6 * scale, 7.4 * scale, 3.6 * scale, side * 0.16, 0, TAU);
      context.fill();
      context.stroke();
    }

    // Shoulders: a broad wedge, wide across the back, narrowing at the chest. The outline is dark,
    // not white — a white outline reads as a glow at thumbnail size, a dark one reads as a body.
    context.beginPath();
    context.moveTo(11 * scale, 0);
    context.quadraticCurveTo(7 * scale, -13 * scale, -6 * scale, -13.5 * scale);
    context.quadraticCurveTo(-15 * scale, -11 * scale, -15 * scale, 0);
    context.quadraticCurveTo(-15 * scale, 11 * scale, -6 * scale, 13.5 * scale);
    context.quadraticCurveTo(7 * scale, 13 * scale, 11 * scale, 0);
    context.closePath();
    context.fillStyle = PALETTE.thief;
    context.fill();
    context.strokeStyle = DARK;
    context.lineWidth = 2.4;
    context.lineJoin = 'round';
    context.stroke();

    // Arms: two ovals lying ACROSS the shoulders and reaching out past the torso, so the figure has
    // the wide, bilateral top-down silhouette a person actually makes. Drawn before the head.
    context.fillStyle = '#2bd8ae';
    context.strokeStyle = DARK;
    context.lineWidth = 1.8;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.ellipse(1 * scale + step * side * 3.5, side * 15 * scale, 4.6 * scale, 8.2 * scale, side * 0.28, 0, TAU);
      context.fill();
      context.stroke();
    }

    // A shoulder line across the back, for a bit of form.
    context.beginPath();
    context.moveTo(-4 * scale, -10 * scale);
    context.lineTo(-4 * scale, 10 * scale);
    context.strokeStyle = 'rgba(5,20,28,0.45)';
    context.lineWidth = 1.4;
    context.stroke();

    // The head: a solid pale mint disc, dark-keylined, sitting forward of the shoulders. Solid and
    // light, because a dark disc ringed in white is an eye, while a light disc is a head. Nothing
    // dark goes at its centre: any dot inside a pale circle reads as a pupil, and facing is
    // already carried by the sight wedge and the whole body's rotation.
    context.beginPath();
    context.arc(6 * scale, 0, 6.6 * scale, 0, TAU);
    context.fillStyle = '#c8fff1';
    context.fill();
    context.strokeStyle = DARK;
    context.lineWidth = 2;
    context.stroke();

    context.restore();

    if (crouched) {
      context.beginPath();
      context.arc(x, y, 26 * scale, 0, TAU);
      context.strokeStyle = 'rgba(63,242,198,0.42)';
      context.lineWidth = 1.4;
      context.setLineDash([5, 5]);
      context.stroke();
      context.setLineDash([]);
    }

    if (thief.carrying) {
      // The stone, held high: a bright cut gem with its own bloom, so cargo never reads as one more
      // amber objective tick. It is the only gold thing that travels with the thief.
      const gx = x + 14;
      const gy = y - 26;
      const bloom = context.createRadialGradient(gx, gy, 1, gx, gy, 20);
      bloom.addColorStop(0, 'rgba(255,226,120,0.55)');
      bloom.addColorStop(0.55, 'rgba(255,196,64,0.20)');
      bloom.addColorStop(1, 'rgba(255,196,64,0)');
      context.fillStyle = bloom;
      context.beginPath();
      context.arc(gx, gy, 20, 0, TAU);
      context.fill();

      context.beginPath();
      context.moveTo(gx, gy - 10);
      context.lineTo(gx + 8, gy - 2);
      context.lineTo(gx, gy + 9);
      context.lineTo(gx - 8, gy - 2);
      context.closePath();
      context.fillStyle = '#ffdf7a';
      context.fill();
      context.strokeStyle = '#fffdf0';
      context.lineWidth = 1.3;
      context.stroke();

      // A facet line down the middle, so the shape reads as a cut stone rather than a rhombus.
      context.beginPath();
      context.moveTo(gx, gy - 10);
      context.lineTo(gx, gy + 9);
      context.strokeStyle = 'rgba(160,110,20,0.5)';
      context.lineWidth = 0.9;
      context.stroke();
    }
  }

  function drawNoise(thief) {
    if (thief.noise < 0.06) return;
    const radius = 18 + thief.noise * 74;
    context.beginPath();
    context.arc(thief.x, thief.y, radius, 0, TAU);
    context.strokeStyle = `rgba(255,171,46,${(0.10 + thief.noise * 0.34).toFixed(3)})`;
    context.lineWidth = 1.4;
    context.setLineDash([3, 7]);
    context.stroke();
    context.setLineDash([]);
  }

  function drawAim(thief, spot) {
    if (thief.coins <= 0 || !spot) return;
    context.save();
    context.setLineDash([4, 8]);
    context.beginPath();
    context.moveTo(thief.x, thief.y);
    context.lineTo(spot.x, spot.y);
    context.strokeStyle = 'rgba(255,210,74,0.34)';
    context.lineWidth = 1.2;
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.arc(spot.x, spot.y, 9, 0, TAU);
    context.strokeStyle = 'rgba(255,210,74,0.7)';
    context.lineWidth = 1.4;
    context.stroke();
    context.beginPath();
    context.arc(spot.x, spot.y, 2, 0, TAU);
    context.fillStyle = PALETTE.gold;
    context.fill();
    context.restore();
  }

  function drawPrompt(target, time) {
    if (!target) return;
    const bob = Math.sin(time * 4) * 1.6;
    context.save();
    context.font = font(12, MONO, '700');
    const label = `[E] ${target.label}`;
    const width = context.measureText(label).width + 20;
    const x = target.x - width / 2;
    const y = target.y - 56 + bob;
    context.fillStyle = 'rgba(6,12,22,0.88)';
    roundRect(context, x, y, width, 24, 4);
    context.fill();
    context.strokeStyle = 'rgba(255,171,46,0.6)';
    context.lineWidth = 1;
    context.stroke();
    text(label, target.x, y + 16, 12, PALETTE.amberBright, 'center', MONO, '700');
    context.restore();
  }

  // ---------------------------------------------------------------- HUD

  function drawAlarmMeter(alarm, time) {
    const x = 300;
    const y = 40;
    const width = 470;
    const height = 26;
    const value = alarm.value;
    const danger = value > 96;
    const pulse = 0.6 + Math.sin(time * (danger ? 18 : 6)) * 0.4;

    context.fillStyle = 'rgba(6,11,20,0.96)';
    roundRect(context, x - 5, y - 5, width + 10, height + 10, 6);
    context.fill();
    context.strokeStyle = danger ? PALETTE.alarmRed : 'rgba(255,171,46,0.5)';
    context.lineWidth = danger ? 2 : 1;
    roundRect(context, x - 5, y - 5, width + 10, height + 10, 6);
    context.stroke();

    // An empty track you can actually see: cool, dark, and clearly not part of the fill.
    context.fillStyle = 'rgba(16,26,44,0.95)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = 'rgba(92,142,205,0.20)';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    const fill = (width * Math.min(100, value)) / 100;
    if (fill > 0) {
      const grad = context.createLinearGradient(x, 0, x + width, 0);
      grad.addColorStop(0, '#b8791a');
      grad.addColorStop(0.5, PALETTE.amber);
      grad.addColorStop(0.82, '#ff7f36');
      grad.addColorStop(1, '#ff4a25');
      context.fillStyle = grad;
      context.fillRect(x, y, fill, height);
      // A hard bright cap on the leading edge: the fill boundary is the number, at a glance.
      context.fillStyle = '#ffe6b0';
      context.fillRect(x + fill - 2, y, 2, height);
    }

    // Tick marks over the whole track, so the scale reads as a scale, filled or not.
    context.strokeStyle = 'rgba(255,255,255,0.22)';
    context.lineWidth = 1;
    context.beginPath();
    for (let step = 1; step < 10; step += 1) {
      const tx = x + (width * step) / 10;
      context.moveTo(tx, y + height - (step === 5 ? 12 : 7));
      context.lineTo(tx, y + height);
    }
    context.stroke();

    const word = alarm.mode === 'caught' ? 'CAUGHT' : alarm.mode === 'grace' ? 'BREAK SIGHT' : value > 60 ? 'SPOTTED' : value > 6 ? 'WATCHED' : 'QUIET';
    const color = alarm.mode === 'grace' || alarm.mode === 'caught' ? PALETTE.alarmRed : value > 6 ? PALETTE.amberBright : PALETTE.muted;
    spaced('ALARM', x, y - 15, 12, color, 'left', 3.2, MONO, '700');
    text(`${Math.round(value)}%`, x + width, y - 14, 14, color, 'right', MONO, '700');

    if (danger) {
      context.save();
      context.globalAlpha = 0.10 * pulse;
      context.fillStyle = PALETTE.alarmRed;
      context.fillRect(0, 0, 1280, 720);
      context.restore();
    }

    context.fillStyle = alarm.mode === 'grace' || alarm.mode === 'caught' ? 'rgba(255,95,52,0.20)' : 'rgba(255,171,46,0.13)';
    roundRect(context, x + width + 16, y, 96, height, 4);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 1;
    roundRect(context, x + width + 16, y, 96, height, 4);
    context.stroke();
    text(word, x + width + 64, y + 18, 12, color, 'center', MONO, '700');
  }

  function drawClock(clock) {
    const x = 1088;
    const y = 16;
    const left = Math.max(0, clock.remaining);
    const urgent = left < 30;
    spaced('CLOCK', x, y + 2, 11, PALETTE.muted, 'left', 2.6, MONO);
    const mm = Math.floor(left / 60);
    const ss = Math.floor(left % 60);
    text(`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, x, y + 34, 30, urgent ? PALETTE.alarmRed : PALETTE.text, 'left', MONO, '700');
    if (clock.getaway !== null) {
      spaced(`GETAWAY ${Math.max(0, Math.ceil(clock.getaway))}s`, x, y + 52, 11, PALETTE.gold, 'left', 2.2, MONO);
    } else {
      spaced('QUIET HOUR', x, y + 52, 11, 'rgba(130,150,178,0.7)', 'left', 2.2, MONO);
    }
  }

  function drawObjective(level, thief) {
    const steps = [
      { label: 'REACH THE CASE', done: level.loot.taken, live: !level.loot.taken },
      { label: 'LIFT THE HALCYON', done: level.loot.taken, live: false },
      { label: 'ESCAPE THE DOCK', done: false, live: level.loot.taken },
    ];
    const x = 60;
    let y = 24;
    spaced('THE JOB', x, y, 11, PALETTE.muted, 'left', 3, MONO);
    y += 22;
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const color = step.done ? PALETTE.thief : step.live ? PALETTE.amberBright : 'rgba(130,150,178,0.5)';
      context.beginPath();
      context.arc(x + 4, y - 4, 3.4, 0, TAU);
      context.fillStyle = color;
      context.fill();
      if (step.done) {
        context.beginPath();
        context.moveTo(x + 1.6, y - 4);
        context.lineTo(x + 3.4, y - 2.2);
        context.lineTo(x + 6.6, y - 6);
        context.strokeStyle = '#062b29';
        context.lineWidth = 1.4;
        context.stroke();
      }
      text(step.label, x + 16, y, 12, color, 'left', FONT, step.live ? '700' : '500');
      y += 17;
    }

    const cy = 682;
    spaced('COINS', x, cy, 11, PALETTE.muted, 'left', 3, MONO);
    for (let index = 0; index < THIEF.coins; index += 1) {
      const cx = x + 64 + index * 20;
      context.beginPath();
      context.arc(cx, cy - 4, 6, 0, TAU);
      context.fillStyle = index < thief.coins ? PALETTE.gold : 'rgba(255,210,74,0.16)';
      context.fill();
      context.strokeStyle = index < thief.coins ? '#fff3c4' : 'rgba(255,210,74,0.3)';
      context.lineWidth = 1;
      context.stroke();
    }

    const stanceX = 430;
    spaced('STANCE', stanceX, cy, 11, PALETTE.muted, 'left', 3, MONO);
    const stanceWord = thief.stance === 'sprint' ? 'SPRINT' : thief.stance === 'crouch' ? (thief.inVent ? 'CRAWL' : 'CROUCH') : 'WALK';
    const stanceColor = thief.stance === 'sprint' ? PALETTE.alarmRed : PALETTE.thief;
    text(stanceWord, stanceX + 62, cy, 13, stanceColor, 'left', MONO, '700');

    // Noise: the one thing the thief's own speed costs, drawn as a bar with its own label under it,
    // so nothing in this band can ever run into anything else in it.
    const noiseX = 640;
    spaced('NOISE', noiseX, cy - 1, 10, PALETTE.muted, 'left', 2.4, MONO);
    const noiseWidth = 132;
    context.fillStyle = 'rgba(255,171,46,0.12)';
    context.fillRect(noiseX + 52, cy - 10, noiseWidth, 9);
    const noiseColor = thief.noise > 0.6 ? PALETTE.alarmRed : thief.noise > 0.2 ? PALETTE.amber : PALETTE.thief;
    context.fillStyle = noiseColor;
    context.fillRect(noiseX + 52, cy - 10, noiseWidth * clamp01(thief.noise), 9);
    context.strokeStyle = 'rgba(255,255,255,0.12)';
    context.lineWidth = 1;
    context.strokeRect(noiseX + 52.5, cy - 9.5, noiseWidth - 1, 8);

    // The control legend, in its own right-hand column, clear of the noise bar.
    spaced('WASD  SHIFT SPRINT  CTRL CROUCH  E USE  CLICK THROW', 1220, cy, 10, 'rgba(130,150,178,0.72)', 'right', 1.2, MONO, '600');
  }

  function drawFrame() {
    context.fillStyle = PALETTE.panel;
    context.fillRect(0, 0, 1280, HUD.top);
    context.fillRect(0, 720 - 42, 1280, 42);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, HUD.top - 0.5);
    context.lineTo(1280, HUD.top - 0.5);
    context.moveTo(0, 720 - 42.5);
    context.lineTo(1280, 720 - 42.5);
    context.stroke();

    // The identity sits in the bottom strip, clear of the objectives, the meter and the clock.
    spaced('THE QUIET HOUR', 1244, 720 - 15, 11, 'rgba(233,240,249,0.5)', 'right', 3.4, FONT, '700');
    spaced('MERIDIAN DEPOSIT · THIRD FLOOR', 640, 720 - 15, 10, 'rgba(130,150,178,0.5)', 'center', 2.2, MONO);

    const vignette = context.createRadialGradient(640, 380, 240, 640, 380, 760);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.62, 'rgba(0,0,0,0.30)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.78)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, 1280, 720);
  }

  // ---------------------------------------------------------------- panels

  function drawPanel(title, accent, lines, prompt, footer) {
    context.fillStyle = 'rgba(3,7,13,0.72)';
    context.fillRect(0, 0, 1280, 720);
    const width = 640;
    const height = 300 + lines.length * 26;
    const x = (1280 - width) / 2;
    const y = (720 - height) / 2;
    context.fillStyle = 'rgba(9,16,28,0.97)';
    roundRect(context, x, y, width, height, 10);
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 2;
    roundRect(context, x, y, width, height, 10);
    context.stroke();

    spaced(title, 640, y + 62, 34, accent, 'center', 6, FONT, '800');
    context.beginPath();
    context.moveTo(x + 70, y + 84);
    context.lineTo(x + width - 70, y + 84);
    context.strokeStyle = 'rgba(255,255,255,0.14)';
    context.lineWidth = 1;
    context.stroke();

    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], 640, y + 122 + index * 26, 15, PALETTE.muted, 'center', FONT, '500');
    }
    spaced(prompt, 640, y + height - 42, 15, accent, 'center', 3, MONO, '700');
    if (footer) text(footer, 640, y + height - 16, 11, 'rgba(130,150,178,0.7)', 'center', MONO, '500');
  }

  function drawTitle() {
    context.fillStyle = 'rgba(3,7,13,0.55)';
    context.fillRect(0, 0, 1280, 720);
    const x = 214;
    const y = 168;
    const width = 852;
    const height = 392;
    context.fillStyle = 'rgba(9,16,28,0.95)';
    roundRect(context, x, y, width, height, 12);
    context.fill();
    context.strokeStyle = 'rgba(255,171,46,0.5)';
    context.lineWidth = 2;
    roundRect(context, x, y, width, height, 12);
    context.stroke();

    spaced('THE QUIET HOUR', 640, y + 82, 52, PALETTE.text, 'center', 9, FONT, '800');
    spaced('A MERIDIAN DEPOSIT HEIST', 640, y + 112, 12, PALETTE.amber, 'center', 5.5, MONO, '600');

    const lines = [
      'One room. One stone. Three ways through it.',
      '',
      'WASD move   ·   SHIFT sprint, loud   ·   CTRL crouch, quiet',
      'E hold: doors, the power box, the display case',
      'CLICK or SPACE throws a coin where you aim, and guards go to look',
      '',
      'Vent along the top · hall through the middle · corridor along the bottom',
      'Three coins, two hundred seconds, and a diamond worth four point two million.',
    ];
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], 640, y + 166 + index * 26, 15, index === 0 ? PALETTE.gold : PALETTE.muted, 'center', FONT, index === 0 ? '600' : '500');
    }
    spaced('PRESS SPACE TO BEGIN', 640, y + height - 44, 17, PALETTE.thief, 'center', 4, MONO, '700');
  }

  // ---------------------------------------------------------------- the one draw call

  function draw(state) {
    const level = state.level;
    const thief = state.thief;
    const guards = state.guards;
    const cameras = state.cameras;
    const alarm = state.alarm;
    const clock = state.clock;
    const screen = state.screen;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    const time = clock.elapsed;
    const rects = state.rects;

    drawFloor(level, time);

    if (screen !== SCREEN_TITLE || state.showRoom) {
      // Cones go down before the walls, cover and shut doors, so every one of those reads as a hard
      // cut across the amber rather than something the light passes straight through.
      for (let index = 0; index < guards.length; index += 1) {
        const guard = guards[index];
        const hot = guard.state === 'chase';
        drawCone(guard.eye.x, guard.eye.y, guard.eye.angle, guard.eye.half, guard.eye.range, rects, hot);
      }
      for (let index = 0; index < cameras.length; index += 1) drawCameraCone(cameras[index], rects);
    }

    drawWalls(level);
    drawCover(level);
    drawDoors(level);

    if (screen !== SCREEN_TITLE || state.showRoom) {
      for (let index = 0; index < guards.length; index += 1) {
        const guard = guards[index];
        drawConeEdges(guard.eye.x, guard.eye.y, guard.eye.angle, guard.eye.half, guard.eye.range, rects, guard.state === 'chase');
      }
      for (let index = 0; index < cameras.length; index += 1) drawCameraBody(cameras[index], time);

      drawTerminal(level, time);
      drawVaultCase(level, time);
      drawCoins(state.coins);
      if (state.aim && screen === SCREEN_PLAY) drawAim(thief, state.aim);
      drawNoise(thief);

      for (let index = 0; index < guards.length; index += 1) drawGuardBody(guards[index], guards[index].state !== 'patrol', time);
      drawThief(thief);
      for (let index = 0; index < guards.length; index += 1) {
        drawGuardCurious(guards[index], time);
        drawChaseMark(guards[index]);
      }
      if (state.prompt && screen === SCREEN_PLAY) drawPrompt(state.prompt, time);
    }

    drawFrame();

    if (screen === SCREEN_TITLE) {
      drawTitle();
    } else if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawAlarmMeter(alarm, time);
      drawClock(clock);
      drawObjective(level, thief);
      if (screen === SCREEN_PAUSED) {
        drawPanel('PAUSED', PALETTE.cyan, ['The room waits. Nothing moves while you think.'], 'PRESS P TO RESUME', 'THE QUIET HOUR');
      }
    } else if (screen === SCREEN_WON) {
      drawAlarmMeter(alarm, time);
      drawClock(clock);
      drawObjective(level, thief);
      drawPanel('CLEAN GETAWAY', PALETTE.gold, [
        `${clock.grade} · ${clock.score} POINTS`,
        '',
        `Getaway time   ${clock.scoreTime}`,
        `Quiet on the way out   ${clock.scoreQuiet}`,
        `Cameras cut   ${clock.scoreTools}`,
        '',
        `The Halcyon left by the dock door with ${clock.scoreSeconds}s on the clock.`,
      ], 'PRESS SPACE TO RUN IT AGAIN', `BEST THIS BROWSER  ${state.best ?? clock.score}`);
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('CAUGHT', PALETTE.alarmRed, [
        state.caughtReason ?? 'The alarm held, and a hand closed on your shoulder.',
        '',
        'You had the moment to break the sight line:',
        'a wall, a crate, a shut door, or the dark.',
        '',
        'It was the seconds, not the luck.',
      ], 'PRESS SPACE TO TRY AGAIN', 'THE QUIET HOUR');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}
