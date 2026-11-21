// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Vision cones are raycast against the level, so a
// wall or a crate really does cut a cone short — what you see is what the
// guards can see. Flat canvas shapes and gradients only; no images.
import { COLS, FIELD, FONT, GUARD, PALETTE, ROWS, TILE } from './settings.js';
import { GUARD_ALERT, GUARD_SUSPICIOUS } from './guards.js';
import { TILE_CRATE, TILE_SHELF, TILE_WALL } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 32, bottom: 78 };

function coneColour(guard) {
  if (guard.state === GUARD_ALERT) return PALETTE.coneAlert;
  if (guard.state === GUARD_SUSPICIOUS) return PALETTE.coneSuspicious;
  return PALETTE.coneCalm;
}

export function createRenderer(canvas, level) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** Map a pointer's client coordinates onto the 1280x720 playfield. */
  function screenToField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  /** How far a ray from (x, y) at `angle` travels before a sight-blocking tile. */
  function rayLength(x, y, angle, maxLength) {
    const step = 8;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let distance = step; distance <= maxLength; distance += step) {
      const col = Math.floor((x + cos * distance) / TILE);
      const row = Math.floor((y + sin * distance) / TILE);
      if (level.blocksSight(col, row)) return distance;
    }
    return maxLength;
  }

  function drawCone(guard) {
    const rays = 14;
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    for (let i = 0; i <= rays; i += 1) {
      const angle = guard.facing - GUARD.viewHalfAngle + (2 * GUARD.viewHalfAngle * i) / rays;
      const length = rayLength(guard.x, guard.y, angle, GUARD.viewRange);
      context.lineTo(guard.x + Math.cos(angle) * length, guard.y + Math.sin(angle) * length);
    }
    context.closePath();
    context.fillStyle = coneColour(guard);
    context.fill();
  }

  function drawFloor() {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cell = level.grid[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (cell === TILE_WALL) {
          context.fillStyle = PALETTE.wall;
          context.fillRect(x, y, TILE, TILE);
          context.fillStyle = PALETTE.wallTop;
          context.fillRect(x, y, TILE, 8);
          continue;
        }
        context.fillStyle = (col + row) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(x, y, TILE, TILE);
        context.strokeStyle = PALETTE.floorLine;
        context.lineWidth = 1;
        context.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (cell === TILE_CRATE) {
          context.fillStyle = PALETTE.crate;
          context.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
          context.fillStyle = PALETTE.crateTop;
          context.fillRect(x + 8, y + 8, TILE - 16, 7);
          context.strokeStyle = '#4a3a22';
          context.strokeRect(x + 8.5, y + 8.5, TILE - 17, TILE - 17);
        } else if (cell === TILE_SHELF) {
          context.fillStyle = PALETTE.shelf;
          context.fillRect(x + 4, y + 6, TILE - 8, TILE - 12);
          context.fillStyle = PALETTE.shelfTop;
          context.fillRect(x + 4, y + 6, TILE - 8, 6);
          context.fillStyle = '#3a2c1c';
          context.fillRect(x + 10, y + 22, TILE - 20, 5);
          context.fillRect(x + 10, y + 36, TILE - 20, 5);
        }
      }
    }
  }

  function drawExit(exit, open) {
    const pulse = open ? 0.6 + 0.4 * Math.sin(Date.now() / 240) : 0;
    context.save();
    context.shadowColor = open ? PALETTE.exitOpen : PALETTE.exitLocked;
    context.shadowBlur = open ? 26 + pulse * 14 : 8;
    context.fillStyle = open ? PALETTE.exitOpen : PALETTE.exitLocked;
    context.beginPath();
    context.arc(exit.x, exit.y, 24, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.fillStyle = '#0b0d12';
    context.font = `bold 22px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('EXIT', exit.x, exit.y);
    text(open ? 'OPEN — GO!' : 'LOCKED', exit.x, exit.y + 42, 15, open ? PALETTE.exitOpen : PALETTE.muted, 'center');
  }

  function drawRelics(relics) {
    for (const relic of relics) {
      if (relic.taken) continue;
      const bob = Math.sin(Date.now() / 300 + relic.x) * 3;
      context.save();
      context.shadowColor = PALETTE.relic;
      context.shadowBlur = 18;
      context.fillStyle = PALETTE.relic;
      context.beginPath();
      context.moveTo(relic.x, relic.y - 14 + bob);
      context.lineTo(relic.x + 11, relic.y + bob);
      context.lineTo(relic.x, relic.y + 14 + bob);
      context.lineTo(relic.x - 11, relic.y + bob);
      context.closePath();
      context.fill();
      context.restore();
      context.fillStyle = '#7a5c00';
      context.beginPath();
      context.arc(relic.x, relic.y + bob, 3.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPlayer(player) {
    context.save();
    context.shadowColor = PALETTE.player;
    context.shadowBlur = 14;
    context.fillStyle = player.sneaking ? PALETTE.playerSneak : PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // A small hood mark so the player reads at a glance, even shrunk.
    context.fillStyle = '#0b0d12';
    context.beginPath();
    context.arc(player.x, player.y, 5, 0, Math.PI * 2);
    context.fill();
    if (player.sneaking) {
      context.fillStyle = PALETTE.muted;
      context.font = `11px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'alphabetic';
      context.fillText('sneak', player.x, player.y + 26);
    }
  }

  function drawMoveTarget(target) {
    if (!target) return;
    const pulse = 6 + 2 * Math.sin(Date.now() / 180);
    context.strokeStyle = PALETTE.player;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(target.x, target.y, pulse + 4, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(target.x, target.y, 2.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawGuards(guards) {
    for (const guard of guards) drawCone(guard);
    // Where a suspicious guard is heading: the last place it saw you.
    for (const guard of guards) {
      if (guard.state !== GUARD_SUSPICIOUS || !guard.lastSeen) continue;
      context.save();
      context.globalAlpha = 0.7 + 0.3 * Math.sin(Date.now() / 200);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(guard.lastSeen.x, guard.lastSeen.y - 9);
      context.lineTo(guard.lastSeen.x + 8, guard.lastSeen.y);
      context.lineTo(guard.lastSeen.x, guard.lastSeen.y + 9);
      context.lineTo(guard.lastSeen.x - 8, guard.lastSeen.y);
      context.closePath();
      context.fill();
      context.restore();
    }
    for (const guard of guards) {
      context.save();
      context.shadowColor = guard.state === GUARD_ALERT ? PALETTE.guardAlert : PALETTE.guard;
      context.shadowBlur = 12;
      context.fillStyle = guard.state === GUARD_ALERT ? PALETTE.guardAlert : PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
      // Facing tick.
      context.strokeStyle = '#0b0d12';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.facing) * 12, guard.y + Math.sin(guard.facing) * 12);
      context.stroke();
      if (guard.state === GUARD_SUSPICIOUS) {
        text('?', guard.x, guard.y - 22, 22, PALETTE.gold, 'center');
      } else if (guard.state === GUARD_ALERT) {
        text('!', guard.x, guard.y - 22, 24, PALETTE.danger, 'center');
      }
    }
  }

  function drawHud(state) {
    context.fillStyle = 'rgba(11, 13, 18, 0.82)';
    context.fillRect(0, 0, FIELD.width, 40);
    text(`Relics  ${state.relicsTaken} / ${state.relics.length}`, 18, 27, 20, PALETTE.text, 'left');
    text(`Lives  ${'●'.repeat(Math.max(0, state.lives))}${'○'.repeat(Math.max(0, 3 - state.lives))}`, 250, 27, 20, PALETTE.text, 'left');
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60);
    text(`${minutes}:${String(seconds).padStart(2, '0')}`, FIELD.width / 2, 27, 20, PALETTE.text, 'center');
    // The detection eye: a bar that fills red as the guards notice you.
    const eyeX = FIELD.width - 300;
    context.fillStyle = '#2a3040';
    context.fillRect(eyeX, 12, 150, 16);
    context.fillStyle = state.detection > 66 ? PALETTE.danger : state.detection > 33 ? PALETTE.gold : PALETTE.player;
    context.fillRect(eyeX, 12, 150 * (state.detection / 100), 16);
    context.strokeStyle = PALETTE.muted;
    context.strokeRect(eyeX + 0.5, 12.5, 150, 16);
    text(state.detection >= 100 ? 'SPOTTED!' : state.detection >= 40 ? 'Suspicious…' : state.detection > 0 ? 'Noticed…' : 'Unseen', FIELD.width - 14, 27, 18, PALETTE.text, 'right');
    if (state.player.sneaking) text('SNEAK', FIELD.width - 340, 27, 16, PALETTE.player, 'right');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 13, 18, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.wallTop;
    context.lineWidth = 2;
    context.strokeRect(x + 1, y + 1, PANEL.width - 2, height - 2);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.gold, 'center');
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  /** Paint one frame: the floor, the exit, relics, cones, guards, player, HUD or a panel. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    const exitOpen = state.relicsTaken === state.relics.length;
    drawExit(state.exit, exitOpen);
    drawRelics(state.relics);
    drawGuards(state.guards);
    drawPlayer(state.player);
    if (screen === SCREEN_PLAY) drawMoveTarget(state.moveTarget);
    // A soft pool of light follows the player; the rest of the archive stays dark.
    const light = context.createRadialGradient(state.player.x, state.player.y, 60, state.player.x, state.player.y, 340);
    light.addColorStop(0, 'rgba(0,0,0,0)');
    light.addColorStop(1, 'rgba(5,6,10,0.28)');
    context.fillStyle = light;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    if (screen === SCREEN_TITLE) {
      drawPanel('SHADOW ARCHIVE', [
        'Night in the museum archive. Recover the 4 relics,',
        'slip past the guards, and reach the EXIT unseen.',
        'WASD / arrows to move — hold Shift to sneak. Click to walk there.',
        'Crates and shelves block a guard’s sight. Stay out of the cones.',
        'Loud footsteps carry: a guard nearby hears you walk.',
        best > 0 ? `Fastest clear: ${formatTime(best)}` : '',
      ], 'Press Space or click to begin');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards wait for no one — except now.'], 'Press P to resume');
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('CAUGHT!', [
        `A guard grabbed you. ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.`,
        'Sneak behind crates. Watch the cones turn red.',
      ], 'Press Space to try again from the door');
    } else if (screen === SCREEN_WIN) {
      const rating = state.alerts === 0 ? 'GHOST — never spotted' : state.alerts <= 1 ? 'SHADOW — one alarm' : 'LOUD — the archive woke up';
      drawPanel('ALL RELICS SAFE', [
        `Cleared in ${formatTime(state.elapsed)} — ${rating}.`,
        `Alarms raised: ${state.alerts}.  Best: ${best > 0 ? formatTime(best) : '—'}.`,
      ], 'Press Space to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, formatTime, screenToField };
}
