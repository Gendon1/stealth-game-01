// Canvas drawing for Shadow Archive: the vivid archive, raycast vision
// cones, the HUD and the five screens. Everything is drawn with canvas
// shapes and gradients — no images, no network. The renderer only paints:
// the rules live in world.js, the loop in main.js.
//
// The look follows the heist style reference: teal and violet floor tiles,
// crimson rugs, gold relics that glow, cyan guards, bright amber cones,
// neon magenta edges, warm lamp pools. The HUD is drawn on every screen —
// the title, the play, the pause, the win and the lose screens all show
// the relic count, the SEEN meter, the lives, the timer and the alarms —
// so the alert screenshot can never lose its HUD again.

import { COLS, FIELD_HEIGHT, FIELD_WIDTH, GUARD, PALETTE, ROWS, TILE } from './settings.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

const HUD_H = 56;
const VIEW_W = 1280;
const VIEW_H = 720;
const FIELD_SCALE = (VIEW_H - HUD_H) / FIELD_HEIGHT;
const FIELD_X = (VIEW_W - FIELD_WIDTH * FIELD_SCALE) / 2;
const FIELD_Y = HUD_H;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// A stable pseudo-random number in 0..1 for one tile: the floor decor,
// the speckles and the lamp flicker never jump between frames.
function hash2(col, row) {
  let h = (col * 73856093) ^ (row * 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amount, 0, 255);
  const g = clamp(((n >> 8) & 255) + amount, 0, 255);
  const b = clamp((n & 255) + amount, 0, 255);
  return 'rgb(' + r + ', ' + g + ', ' + b + ')';
}

function fmtTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes + ':' + (rest < 10 ? '0' : '') + rest;
}

function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || VIEW_W;
    const cssH = canvas.clientHeight || VIEW_H;
    const unit = Math.min(cssW / VIEW_W, cssH / VIEW_H);
    const originX = (cssW - VIEW_W * unit) / 2;
    const originY = (cssH - VIEW_H * unit) / 2;
    const wantW = Math.round(cssW * dpr);
    const wantH = Math.round(cssH * dpr);
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width = wantW;
      canvas.height = wantH;
    }
    return { dpr, unit, originX, originY };
  }

  function screenSpace(l) {
    ctx.setTransform(l.dpr * l.unit, 0, 0, l.dpr * l.unit, l.dpr * l.originX, l.dpr * l.originY);
  }

  function fieldSpace(l) {
    ctx.setTransform(
      l.dpr * l.unit * FIELD_SCALE, 0, 0, l.dpr * l.unit * FIELD_SCALE,
      l.dpr * (l.originX + l.unit * FIELD_X),
      l.dpr * (l.originY + l.unit * FIELD_Y),
    );
  }

  // Pointer coordinates back into field coordinates, for click-to-move.
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const l = layout();
    const x = (clientX - rect.left - l.originX) / l.unit;
    const y = (clientY - rect.top - l.originY) / l.unit;
    return { x: (x - FIELD_X) / FIELD_SCALE, y: (y - FIELD_Y) / FIELD_SCALE };
  }

  function draw(level, world, screen, info, frameTime) {
    const l = layout();
    const state = world.state;
    screenSpace(l);
    ctx.fillStyle = '#0d0a1f';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    fieldSpace(l);
    drawFloor(ctx, level, frameTime);
    drawRugs(ctx);
    drawLamps(ctx, frameTime);
    drawExit(ctx, level, state, frameTime);
    drawRelics(ctx, state, frameTime);
    drawProps(ctx, level);
    drawCones(ctx, level, state);
    drawLastSeen(ctx, state, frameTime);
    drawGuards(ctx, state);
    drawPlayer(ctx, state, frameTime);
    drawTarget(ctx, state, frameTime);
    drawAlarmTint(ctx, state, frameTime);
    screenSpace(l);
    drawHud(ctx, state, info);
    if (screen === SCREEN_TITLE) drawTitlePanel(ctx);
    if (screen === SCREEN_WIN) drawWinPanel(ctx, state, info);
    if (screen === SCREEN_LOSE) drawLosePanel(ctx);
    if (screen === SCREEN_PAUSE) drawPausePanel(ctx);
  }

  return { draw, toField };
}

// --- field painting (all in field coordinates: 1280 x 704) ---

function drawFloor(ctx, level, frameTime) {
  ctx.fillStyle = PALETTE.grout;
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = level.grid[row][col];
      if (cell === '#') continue;
      const teal = (col + row) % 2 === 0;
      const base = teal ? PALETTE.floorTeal : PALETTE.floorViolet;
      const dark = teal ? PALETTE.floorTealDark : PALETTE.floorVioletDark;
      const h = hash2(col, row);
      ctx.fillStyle = h > 0.5 ? base : dark;
      ctx.fillRect(col * TILE + 1, row * TILE + 1, TILE - 2, TILE - 2);
      // A gold speckle on some tiles, and a faint motif on others: the
      // floor reads as a place, not a grid.
      if (h > 0.88) {
        diamond(ctx, col * TILE + 32, row * TILE + 32, 4);
        ctx.fillStyle = PALETTE.speckle;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (h < 0.08) {
        ctx.strokeStyle = teal ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(col * TILE + 12, row * TILE + 12, TILE - 24, TILE - 24);
      }
    }
  }
}

function drawRug(ctx, col, row, span) {
  const x = col * TILE;
  const y = row * TILE;
  const w = span * TILE;
  ctx.fillStyle = PALETTE.rug;
  ctx.fillRect(x + 3, y + 4, w - 6, TILE - 8);
  ctx.strokeStyle = PALETTE.rugEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 7, y + 8, w - 14, TILE - 16);
  ctx.fillStyle = PALETTE.rugEdge;
  for (let i = 0; i < span; i += 1) {
    diamond(ctx, x + (i + 0.5) * TILE, y + TILE / 2, 6);
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawRugs(ctx) {
  drawRug(ctx, 7, 5, 5);
  drawRug(ctx, 2, 2, 3);
}

function drawLamps(ctx, frameTime) {
  // Warm pools of light spilling from lamps on the top and bottom walls.
  const lamps = [
    [10, 0, 70],
    [4, 10, FIELD_HEIGHT - 70],
    [17, 10, FIELD_HEIGHT - 70],
  ];
  for (const [col, , cy] of lamps) {
    const cx = col * TILE + 32;
    const flicker = 0.85 + 0.15 * Math.sin(frameTime * 2.2 + col);
    const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 120);
    glow.addColorStop(0, 'rgba(255, 190, 80, ' + (0.22 * flicker).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(255, 190, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 120, cy - 120, 240, 240);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(cx, cy < 100 ? 10 : FIELD_HEIGHT - 10, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, level, state, frameTime) {
  const open = state.relicsTaken === level.relics.length;
  const x = level.exit.x;
  const y = level.exit.y;
  if (open) {
    const pulse = 0.5 + 0.2 * Math.sin(frameTime * 3);
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 52);
    glow.addColorStop(0, 'rgba(134, 239, 172, ' + pulse.toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(134, 239, 172, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 52, y - 52, 104, 104);
  }
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fillStyle = open ? PALETTE.exitOpen : '#3f3f46';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = open ? PALETTE.exitOpenGlow : PALETTE.exitLocked;
  ctx.stroke();
  ctx.fillStyle = open ? '#052e16' : '#fef3c7';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'EXIT' : 'LOCK', x, y + 1);
}

function drawRelics(ctx, state, frameTime) {
  state.relics.forEach((relic, index) => {
    if (relic.taken) return;
    const pulse = 1 + 0.12 * Math.sin(frameTime * 2.5 + index * 1.7);
    const glow = ctx.createRadialGradient(relic.x, relic.y, 2, relic.x, relic.y, 40);
    glow.addColorStop(0, 'rgba(253, 230, 138, 0.55)');
    glow.addColorStop(1, 'rgba(253, 230, 138, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(relic.x - 40, relic.y - 40, 80, 80);
    diamond(ctx, relic.x, relic.y, 12 * pulse);
    ctx.fillStyle = PALETTE.relic;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff7cc';
    ctx.stroke();
    // Sparkles that twinkle on their own clock.
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(frameTime * 3 + index * 2.1));
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + tw.toFixed(3) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(relic.x + 18, relic.y - 14);
    ctx.lineTo(relic.x + 26, relic.y - 14);
    ctx.moveTo(relic.x + 22, relic.y - 18);
    ctx.lineTo(relic.x + 22, relic.y - 10);
    ctx.stroke();
  });
}

function drawProps(ctx, level) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = level.grid[row][col];
      const x = col * TILE;
      const y = row * TILE;
      if (cell === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x, y, TILE, TILE);
        // Neon trim on every edge that faces open floor.
        ctx.fillStyle = PALETTE.wallTop;
        if (!level.blocksSight(col, row + 1)) ctx.fillRect(x, y + TILE - 4, TILE, 4);
        if (!level.blocksSight(col, row - 1)) ctx.fillRect(x, y, TILE, 4);
        if (!level.blocksSight(col + 1, row)) ctx.fillRect(x + TILE - 4, y, 4, TILE);
        if (!level.blocksSight(col - 1, row)) ctx.fillRect(x, y, 4, TILE);
      } else if (cell === 'C') {
        ctx.fillStyle = PALETTE.crateDark;
        ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
        ctx.fillStyle = PALETTE.crate;
        ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
        ctx.strokeStyle = PALETTE.crateDark;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 8);
        ctx.lineTo(x + TILE - 8, y + TILE - 8);
        ctx.moveTo(x + TILE - 8, y + 8);
        ctx.lineTo(x + 8, y + TILE - 8);
        ctx.stroke();
        ctx.fillStyle = PALETTE.crateTrim;
        for (const [dx, dy] of [[10, 10], [TILE - 10, 10], [10, TILE - 10], [TILE - 10, TILE - 10]]) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (cell === 'S') {
        ctx.fillStyle = PALETTE.shelfDark;
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = PALETTE.shelf;
        ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
        ctx.strokeStyle = PALETTE.shelfCross;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 12);
        ctx.lineTo(x + TILE - 12, y + TILE - 12);
        ctx.moveTo(x + TILE - 12, y + 12);
        ctx.lineTo(x + 12, y + TILE - 12);
        ctx.stroke();
      }
    }
  }
}

// The guard's vision cone, raycast so walls, crates and shelves cut it
// short — what you see is what the guard can see.
function conePoints(guard, level) {
  const points = [[guard.x, guard.y]];
  const rays = 26;
  for (let i = 0; i <= rays; i += 1) {
    const angle = guard.facing - GUARD.viewHalfAngle + (2 * GUARD.viewHalfAngle * i) / rays;
    let reach = GUARD.viewRange;
    for (let d = 8; d <= GUARD.viewRange; d += 8) {
      const px = guard.x + Math.cos(angle) * d;
      const py = guard.y + Math.sin(angle) * d;
      if (level.blocksSight(Math.floor(px / TILE), Math.floor(py / TILE))) {
        reach = d;
        break;
      }
    }
    points.push([guard.x + Math.cos(angle) * reach, guard.y + Math.sin(angle) * reach]);
  }
  return points;
}

function drawCones(ctx, level, state) {
  for (const guard of state.guards) {
    const alerted = guard.state === 'alert';
    const points = conePoints(guard, level);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fillStyle = alerted ? PALETTE.coneAlert : PALETTE.cone;
    ctx.fill();
    ctx.setLineDash([10, 7]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = alerted ? PALETTE.coneAlertEdge : PALETTE.coneEdge;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawLastSeen(ctx, state, frameTime) {
  for (const guard of state.guards) {
    if (guard.state !== 'suspicious' || !guard.lastSeen) continue;
    const pulse = 8 + 2 * Math.sin(frameTime * 4);
    diamond(ctx, guard.lastSeen.x, guard.lastSeen.y, pulse);
    ctx.fillStyle = PALETTE.hudGold;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawGuards(ctx, state) {
  for (const guard of state.guards) {
    const color = guard.state === 'alert'
      ? PALETTE.guardAlert
      : guard.state === 'suspicious' ? PALETTE.guardSuspicious : PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#082f49';
    ctx.stroke();
    // Facing tick and visor dot, so the direction reads at a glance.
    ctx.strokeStyle = '#082f49';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * GUARD.radius, guard.y + Math.sin(guard.facing) * GUARD.radius);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.facing) * 6, guard.y + Math.sin(guard.facing) * 6, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f9ff';
    ctx.fill();
    if (guard.state === 'suspicious') {
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('?', guard.x, guard.y - GUARD.radius - 4);
    } else if (guard.state === 'alert') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('!', guard.x, guard.y - GUARD.radius - 4);
    }
  }
}

function drawPlayer(ctx, state, frameTime) {
  const player = state.player;
  const glow = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 34);
  glow.addColorStop(0, 'rgba(236, 72, 153, 0.45)');
  glow.addColorStop(1, 'rgba(236, 72, 153, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(player.x - 34, player.y - 34, 68, 68);
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.thief;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = PALETTE.thiefRing;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(player.x - 4, player.y - 4, 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();
  if (player.sneaking) {
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(253, 244, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawTarget(ctx, state, frameTime) {
  const target = state.moveTarget;
  if (!target) return;
  const pulse = 6 + 2 * Math.sin(frameTime * 5);
  ctx.strokeStyle = PALETTE.titleCyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(target.x, target.y, pulse + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(target.x - 6, target.y);
  ctx.lineTo(target.x + 6, target.y);
  ctx.moveTo(target.x, target.y - 6);
  ctx.lineTo(target.x, target.y + 6);
  ctx.stroke();
}

function drawAlarmTint(ctx, state, frameTime) {
  const alarmed = state.detection >= 100 || state.guards.some((g) => g.state === 'alert');
  if (!alarmed) return;
  const alpha = 0.10 + 0.05 * Math.sin(frameTime * 6);
  ctx.fillStyle = 'rgba(239, 68, 68, ' + alpha.toFixed(3) + ')';
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
}

// --- HUD and panels (screen coordinates: 1280 x 720) ---

function drawHud(ctx, state, info) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = PALETTE.hudEdge;
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('RELICS', 18, 29);
  for (let i = 0; i < state.relics.length; i += 1) {
    const cx = 100 + i * 26;
    diamond(ctx, cx, 28, 9);
    if (i < state.relicsTaken) {
      ctx.shadowColor = PALETTE.hudGold;
      ctx.shadowBlur = 8;
      ctx.fillStyle = PALETTE.hudGold;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#241d4d';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#4c4585';
      ctx.stroke();
    }
  }
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('SEEN', 300, 29);
  const meterX = 356;
  const meterW = 220;
  rrect(ctx, meterX, 15, meterW, 26, 6);
  ctx.fillStyle = PALETTE.meterEmpty;
  ctx.fill();
  const fillColor = state.detection >= 100 ? PALETTE.meterHigh : state.detection >= 40 ? PALETTE.meterMid : PALETTE.meterLow;
  const fillW = Math.max(0, (meterW - 4) * clamp(state.detection, 0, 100) / 100);
  if (fillW > 0) {
    rrect(ctx, meterX + 2, 17, fillW, 22, 4);
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = PALETTE.hudEdge;
  rrect(ctx, meterX, 15, meterW, 26, 6);
  ctx.stroke();
  if (info.muted) {
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('MUTED', 596, 29);
  }
  ctx.font = '22px system-ui, sans-serif';
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i < state.lives ? PALETTE.hudRed : '#3f3a5e';
    ctx.textAlign = 'center';
    ctx.fillText('♥', 992 + i * 30, 29);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(fmtTime(state.elapsed), 1122, 29);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('alarms ' + state.alerts, 1262, 29);
}

function drawPanel(ctx, title, lines, hint, accent) {
  const w = 800;
  const h = 170 + lines.length * 32;
  const x = (VIEW_W - w) / 2;
  const y = 200;
  rrect(ctx, x, y, w, h, 14);
  ctx.fillStyle = PALETTE.panelBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.font = 'bold 46px system-ui, sans-serif';
  ctx.fillText(title, VIEW_W / 2, y + 58);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '19px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, y + 118 + i * 32);
  });
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(hint, VIEW_W / 2, y + h - 34);
}

function drawTitlePanel(ctx) {
  drawPanel(ctx, 'SHADOW ARCHIVE', [
    'Night in the museum archive. Recover the four relics,',
    'then reach the EXIT unseen. Four guards walk the halls.',
    'WASD / arrows to move · Shift to sneak · click to walk there',
  ], 'Press Space or click to start', PALETTE.titleGold);
}

function drawWinPanel(ctx, state, info) {
  const best = info.best == null ? state.elapsed : info.best;
  drawPanel(ctx, 'ARCHIVE SECURED', [
    'Cleared in ' + fmtTime(state.elapsed) + ' with ' + state.alerts + (state.alerts === 1 ? ' alarm.' : ' alarms.'),
    'Rating: ' + (info.rating || 'GHOST') + ' · Best: ' + fmtTime(best),
  ], 'Press Space to play again', PALETTE.titleGold);
}

function drawLosePanel(ctx) {
  drawPanel(ctx, 'CAUGHT', [
    'The guards found you. Out of lives.',
  ], 'Press Space to try again', PALETTE.hudRed);
}

function drawPausePanel(ctx) {
  drawPanel(ctx, 'PAUSED', [], 'Press P or Esc to continue', PALETTE.titleCyan);
}
