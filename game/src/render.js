// Canvas drawing: the archive, the guards' raycast vision cones, the HUD
// and the five screens. The renderer owns the canvas transform (the 1280x704
// field letterboxed into whatever window it gets) and nothing else owns
// drawing, so the game loop only ever calls draw() once a frame. Vision
// cones are raycast, not painted circles: each ray marches out until a wall,
// shelf or crate stops it, which is why what you see is what the guard can
// see — a crate really does cut a cone short.

import { COLS, FIELD_HEIGHT, FIELD_WIDTH, GUARD, PALETTE, ROWS, TILE } from './settings.js';
import { GUARD_ALERT, GUARD_SUSPICIOUS } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

const RAY_STEP = 8;
const RAY_ANGLE_STEP = 0.055;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    scale = Math.min(canvas.width / FIELD_WIDTH, canvas.height / FIELD_HEIGHT) * 0.999;
    offsetX = (canvas.width - FIELD_WIDTH * scale) / 2;
    offsetY = (canvas.height - FIELD_HEIGHT * scale) / 2;
  }

  /** Client (pointer) coordinates back into field coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
  }

  function fit() {
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  }

  function drawFloor(level) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt;
        ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
      }
    }
    ctx.strokeStyle = PALETTE.floorEdge;
    ctx.lineWidth = 1;
    for (let col = 0; col <= COLS; col += 1) {
      ctx.beginPath();
      ctx.moveTo(col * TILE, 0);
      ctx.lineTo(col * TILE, FIELD_HEIGHT);
      ctx.stroke();
    }
    for (let row = 0; row <= ROWS; row += 1) {
      ctx.beginPath();
      ctx.moveTo(0, row * TILE);
      ctx.lineTo(FIELD_WIDTH, row * TILE);
      ctx.stroke();
    }
  }

  function drawProps(level) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cell = level.grid[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (cell === '#') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(x, y, TILE, 5);
        } else if (cell === 'S') {
          ctx.fillStyle = PALETTE.shelf;
          ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
          ctx.strokeStyle = PALETTE.shelfEdge;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
          ctx.beginPath();
          ctx.moveTo(x + 5, y + TILE / 2);
          ctx.lineTo(x + TILE - 5, y + TILE / 2);
          ctx.stroke();
        } else if (cell === 'C') {
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
          ctx.strokeStyle = PALETTE.crateEdge;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 8, y + 8, TILE - 16, TILE - 16);
          ctx.beginPath();
          ctx.moveTo(x + 8, y + 8);
          ctx.lineTo(x + TILE - 8, y + TILE - 8);
          ctx.moveTo(x + TILE - 8, y + 8);
          ctx.lineTo(x + 8, y + TILE - 8);
          ctx.stroke();
        }
      }
    }
  }

  function drawExit(level, world) {
    const open = world.state.relicsTaken === level.relics.length;
    const x = level.exit.x;
    const y = level.exit.y;
    ctx.save();
    if (open) {
      ctx.shadowColor = PALETTE.exit;
      ctx.shadowBlur = 26;
      ctx.fillStyle = PALETTE.exitGlow;
      ctx.beginPath();
      ctx.arc(x, y, 42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b0d12';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#0b0d12';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : 'LOCK', x, y);
    ctx.restore();
  }

  function drawRelics(level, world, time) {
    for (const relic of level.relics) {
      if (relic.taken) continue;
      const bob = Math.sin(time * 2 + relic.x) * 3;
      ctx.save();
      ctx.shadowColor = PALETTE.relic;
      ctx.shadowBlur = 18;
      ctx.fillStyle = PALETTE.relicGlow;
      ctx.beginPath();
      ctx.arc(relic.x, relic.y + bob, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = PALETTE.relic;
      ctx.beginPath();
      ctx.moveTo(relic.x, relic.y + bob - 12);
      ctx.lineTo(relic.x + 9, relic.y + bob);
      ctx.lineTo(relic.x, relic.y + bob + 12);
      ctx.lineTo(relic.x - 9, relic.y + bob);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // One vision cone, raycast: from the guard, a fan of rays out to the view
  // range, each stopping at the first sight-blocking tile it meets.
  function drawCone(level, guard) {
    const half = GUARD.viewHalfAngle;
    const fill = guard.state === GUARD_ALERT
      ? PALETTE.coneAlert
      : guard.state === GUARD_SUSPICIOUS
        ? PALETTE.coneSuspicious
        : PALETTE.cone;
    const edge = guard.state === GUARD_ALERT ? PALETTE.coneAlertEdge : PALETTE.coneEdge;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (let angle = guard.facing - half; angle <= guard.facing + half + 0.001; angle += RAY_ANGLE_STEP) {
      let distance = 0;
      let endX = guard.x;
      let endY = guard.y;
      while (distance < GUARD.viewRange) {
        distance += RAY_STEP;
        const px = guard.x + Math.cos(angle) * distance;
        const py = guard.y + Math.sin(angle) * distance;
        const col = Math.floor(px / TILE);
        const row = Math.floor(py / TILE);
        if (level.blocksSight(col, row)) break;
        endX = px;
        endY = py;
      }
      ctx.lineTo(endX, endY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawGuards(world, level) {
    for (const guard of world.state.guards) {
      drawCone(level, guard);
    }
    for (const guard of world.state.guards) {
      const color = guard.state === GUARD_ALERT
        ? PALETTE.guardAlert
        : guard.state === GUARD_SUSPICIOUS
          ? PALETTE.guardSuspicious
          : PALETTE.guard;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(guard.x, guard.y + 12, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b0d12';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Visor: a short bar showing which way the guard is looking.
      ctx.strokeStyle = '#0b0d12';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(guard.x + Math.cos(guard.facing) * 4, guard.y + Math.sin(guard.facing) * 4);
      ctx.lineTo(guard.x + Math.cos(guard.facing) * 13, guard.y + Math.sin(guard.facing) * 13);
      ctx.stroke();
      if (guard.state === GUARD_ALERT || guard.state === GUARD_SUSPICIOUS) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(guard.state === GUARD_ALERT ? '!' : '?', guard.x, guard.y - GUARD.radius - 4);
      }
      ctx.restore();
      if (guard.lastSeen && guard.state !== GUARD_PATROL) {
        ctx.save();
        ctx.strokeStyle = PALETTE.lastSeen;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(guard.lastSeen.x, guard.lastSeen.y - 10);
        ctx.lineTo(guard.lastSeen.x + 10, guard.lastSeen.y);
        ctx.lineTo(guard.lastSeen.x, guard.lastSeen.y + 10);
        ctx.lineTo(guard.lastSeen.x - 10, guard.lastSeen.y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawPlayer(world) {
    const player = world.state.player;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 11, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = player.sneaking ? PALETTE.playerSneak : PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b0d12';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (player.sneaking) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = PALETTE.playerSneak;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    const target = world.state.moveTarget;
    if (target) {
      ctx.save();
      ctx.strokeStyle = PALETTE.moveTarget;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(target.x - 5, target.y - 5);
      ctx.lineTo(target.x + 5, target.y + 5);
      ctx.moveTo(target.x + 5, target.y - 5);
      ctx.lineTo(target.x - 5, target.y + 5);
      ctx.stroke();
      ctx.restore();
    }
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function drawHud(world, level, ui) {
    const state = world.state;
    ctx.save();
    ctx.fillStyle = PALETTE.hudBack;
    ctx.fillRect(0, 0, FIELD_WIDTH, 44);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // Relics: gold diamonds, filled when recovered.
    let x = 16;
    ctx.fillText('RELICS', x, 23);
    x += 62;
    for (let index = 0; index < level.relics.length; index += 1) {
      const taken = index < state.relicsTaken;
      ctx.fillStyle = taken ? PALETTE.relic : '#3a4152';
      ctx.beginPath();
      ctx.moveTo(x, 14);
      ctx.lineTo(x + 8, 22);
      ctx.lineTo(x, 30);
      ctx.lineTo(x - 8, 22);
      ctx.closePath();
      ctx.fill();
      x += 22;
    }
    // The eye meter: the heart of the HUD.
    const meterX = 330;
    const meterWidth = 260;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('SEEN', meterX - 48, 23);
    ctx.fillStyle = PALETTE.meterBack;
    ctx.fillRect(meterX, 13, meterWidth, 18);
    const fraction = clamp(state.detection / 100, 0, 1);
    ctx.fillStyle = state.detection >= 100 ? PALETTE.meterDanger : PALETTE.meterFill;
    ctx.fillRect(meterX, 13, meterWidth * fraction, 18);
    ctx.strokeStyle = PALETTE.hudDim;
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX, 13, meterWidth, 18);
    // Lives, time, alarms on the right.
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    let hearts = '';
    for (let index = 0; index < state.lives; index += 1) hearts += '♥';
    ctx.fillStyle = PALETTE.danger;
    ctx.fillText(hearts || '—', FIELD_WIDTH - 300, 23);
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(formatTime(state.elapsed), FIELD_WIDTH - 170, 23);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`alarms ${state.alerts}${ui.muted ? '  ·  muted' : ''}`, FIELD_WIDTH - 16, 23);
    ctx.restore();
  }

  function drawPanel(title, lines, footnote) {
    ctx.save();
    ctx.fillStyle = PALETTE.panelBack;
    const width = 640;
    const height = 150 + lines.length * 30;
    const x = (FIELD_WIDTH - width) / 2;
    const y = (FIELD_HEIGHT - height) / 2;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.title;
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, FIELD_WIDTH / 2, y + 52);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '17px system-ui, sans-serif';
    lines.forEach((line, index) => {
      ctx.fillText(line, FIELD_WIDTH / 2, y + 104 + index * 30);
    });
    if (footnote) {
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(footnote, FIELD_WIDTH / 2, y + height - 26);
    }
    ctx.restore();
  }

  function draw(level, world, screen, ui, time) {
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    fit();
    drawFloor(level);
    drawExit(level, world);
    drawRelics(level, world, time);
    drawGuards(world, level);
    drawProps(level);
    drawPlayer(world);
    drawHud(world, level, ui);
    if (screen === SCREEN_TITLE) {
      drawPanel('SHADOW ARCHIVE', [
        'Night in the museum archive. Recover the four relics,',
        'then reach the EXIT unseen. Four guards walk the halls.',
        'WASD / arrows to move · Shift to sneak · click to walk there',
      ], ui.best != null ? `Best clear: ${formatTime(ui.best)} — press Space or click to start` : 'Press Space or click to start');
    } else if (screen === SCREEN_PAUSE) {
      drawPanel('PAUSED', ['The archive waits.'], 'P or Esc to resume · M to mute');
    } else if (screen === SCREEN_WIN) {
      drawPanel('ARCHIVE SECURED', [
        `Cleared in ${formatTime(world.state.elapsed)} with ${world.state.alerts} alarm${world.state.alerts === 1 ? '' : 's'}.`,
        `Rating: ${ui.rating ?? '—'}${ui.best != null ? `  ·  Best: ${formatTime(ui.best)}` : ''}`,
      ], 'Press Space to play again');
    } else if (screen === SCREEN_LOSE) {
      drawPanel('CAUGHT', ['Out of lives — the archive keeps its secrets.'], 'Press Space to try again');
    }
  }

  return { draw, toField };
}
