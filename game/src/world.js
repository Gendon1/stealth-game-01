// The game's rules and state, with no drawing and no browser in it: the player,
// the detection meter, the relics, the exit, lives and the win. step() advances
// one fixed step and returns what happened as bit flags, so the caller can react
// (sounds, screens) without the world knowing about them. Nothing here allocates
// after createWorld returns, except the small event flag itself.
import { DETECTION, GUARD, LIVES, PLAYER, STEP } from './settings.js';
import { createGuards, GUARD_ALERT, GUARD_PATROL, GUARD_SUSPICIOUS } from './guards.js';

export const EVENT_RELIC = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_WIN = 4;
export const EVENT_ALERT = 8;
export const EVENT_SUSPICIOUS = 16;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createWorld(level, patrols) {
  const guards = createGuards(level, patrols);
  const player = {
    x: level.start.x,
    y: level.start.y,
    radius: PLAYER.radius,
    sneaking: false,
    moving: false,
  };
  const state = {
    player,
    guards: guards.guards,
    relics: level.relics,
    exit: level.exit,
    detection: 0,
    relicsTaken: 0,
    lives: LIVES,
    elapsed: 0,
    alerts: 0,
    won: false,
    caught: false,
    moveTarget: null, // {x, y, sneak} in field coords, set by click-to-move
  };

  function reset() {
    player.x = level.start.x;
    player.y = level.start.y;
    player.sneaking = false;
    player.moving = false;
    for (const relic of level.relics) relic.taken = false;
    guards.reset();
    state.detection = 0;
    state.relicsTaken = 0;
    state.lives = LIVES;
    state.elapsed = 0;
    state.alerts = 0;
    state.won = false;
    state.caught = false;
    state.moveTarget = null;
  }

  function movePlayer(dx, dy, sneaking, dt) {
    player.sneaking = sneaking;
    const length = Math.hypot(dx, dy);
    player.moving = length > 0;
    if (length === 0) return;
    const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const stepX = (dx / length) * speed * dt;
    const stepY = (dy / length) * speed * dt;
    if (!level.circleHitsWall(player.x + stepX, player.y, player.radius)) player.x += stepX;
    if (!level.circleHitsWall(player.x, player.y + stepY, player.radius)) player.y += stepY;
    player.x = clamp(player.x, PLAYER.radius, 1280 - PLAYER.radius);
    player.y = clamp(player.y, PLAYER.radius, 704 - PLAYER.radius);
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1, `sneaking` is the Shift key.
   * The detection meter follows the closest guard that can sense the player:
   * it fills while any guard can see (or hear) the player and drains while
   * none can, slower at long range and slower still while sneaking. Catching
   * happens on touch by an alerted guard; a merely suspicious guard only
   * investigates. With `harmless` set (the title screen's backdrop) the guards
   * patrol but nothing is seen, taken or lost.
   */
  function step(dt, move, sneaking, harmless = false) {
    let events = 0;
    if (state.won) return events;
    state.elapsed += dt;
    movePlayer(move.x, move.y, sneaking, dt);

    let bestSeen = 0;
    let bestDistance = Infinity;
    const sawNow = new Set();
    for (const guard of guards.guards) {
      const seen = Math.max(guards.visibility(guard, player), guards.hears(guard, player));
      if (seen > 0) {
        sawNow.add(guard);
        const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
        if (seen > bestSeen || (seen === bestSeen && distance < bestDistance)) {
          bestSeen = seen;
          bestDistance = distance;
        }
      }
      guards.stepGuard(guard, dt, player, harmless ? 0 : seen);
    }
    if (harmless) return events;

    if (bestSeen > 0) {
      let rate = DETECTION.fillPerSecond * bestSeen;
      if (bestDistance > GUARD.viewRange * 0.6) rate *= DETECTION.farMultiplier;
      if (sneaking) rate *= DETECTION.sneakMultiplier;
      state.detection = clamp(state.detection + rate * dt, 0, 100);
    } else {
      state.detection = clamp(state.detection - DETECTION.decayPerSecond * dt, 0, 100);
    }

    for (const guard of guards.guards) {
      const saw = sawNow.has(guard);
      if (state.detection >= DETECTION.alertedAt) {
        if (guard.state !== GUARD_ALERT && (saw || guard.lastSeen)) {
          // Only a guard that saw you (or knows where you were) gives chase.
          guard.state = GUARD_ALERT;
          if (saw) guard.lastSeen = { x: player.x, y: player.y };
          state.alerts += 1;
          events |= EVENT_ALERT;
        } else if (guard.state === GUARD_PATROL) {
          // The rest hear the alarm but have no idea where you are.
          guard.state = GUARD_SUSPICIOUS;
          events |= EVENT_SUSPICIOUS;
        }
      } else if (state.detection >= DETECTION.suspiciousAt && guard.state === GUARD_PATROL && saw) {
        guard.state = GUARD_SUSPICIOUS;
        guard.lastSeen = { x: player.x, y: player.y };
        events |= EVENT_SUSPICIOUS;
      }
      if (guard.state === GUARD_ALERT && Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.radius + player.radius + 2) {
        state.lives -= 1;
        state.detection = 0;
        state.moveTarget = null;
        events |= EVENT_CAUGHT;
        if (state.lives <= 0) {
          state.caught = true;
        } else {
          player.x = level.start.x;
          player.y = level.start.y;
          guards.reset();
        }
        break;
      }
    }
    if (state.detection < DETECTION.suspiciousAt) {
      for (const guard of guards.guards) if (guard.state === GUARD_ALERT) guard.state = GUARD_SUSPICIOUS;
    }

    for (const relic of level.relics) {
      if (relic.taken) continue;
      if (Math.hypot(player.x - relic.x, player.y - relic.y) < player.radius + 16) {
        relic.taken = true;
        state.relicsTaken += 1;
        events |= EVENT_RELIC;
      }
    }

    const exitOpen = state.relicsTaken === level.relics.length;
    if (exitOpen && Math.hypot(player.x - level.exit.x, player.y - level.exit.y) < 26) {
      state.won = true;
      events |= EVENT_WIN;
    }
    return events;
  }

  return { state, reset, step, movePlayer };
}
