// The guards: patrol, suspicion, investigation and chase. A guard only ever
// knows what its own eyes and ears tell it: it turns toward movement it can
// see, walks to the last place it saw the player, and gives up after a while
// with nothing to find. It also hears loud footsteps nearby — walking close
// past a guard is a risk even outside its cone. All of it is pure simulation,
// no drawing here.
import { DETECTION, GUARD, TILE } from './settings.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function turnToward(current, target, maxStep) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

function moveToward(guard, tx, ty, speed, dt, level) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return true;
  const step = Math.min(distance, speed * dt);
  const nx = guard.x + (dx / distance) * step;
  const ny = guard.y + (dy / distance) * step;
  if (!level.circleHitsWall(nx, guard.y, GUARD.radius)) guard.x = nx;
  if (!level.circleHitsWall(guard.x, ny, GUARD.radius)) guard.y = ny;
  guard.facing = angleTo(guard.x, guard.y, tx, ty);
  return Math.hypot(tx - guard.x, ty - guard.y) < 4;
}

export function createGuards(level, patrols) {
  const guards = patrols.map((patrol) => ({
    x: (patrol.start.x + 0.5) * TILE,
    y: (patrol.start.y + 0.5) * TILE,
    facing: 0,
    state: GUARD_PATROL,
    waypointIndex: 1,
    waypointForward: true,
    waypoints: patrol.waypoints.map((w) => ({ x: (w.x + 0.5) * TILE, y: (w.y + 0.5) * TILE })),
    lastSeen: null,
    unseenSeconds: 0,
    pauseSeconds: 0,
    scanSeconds: 0,
  }));

  /** Can this guard see the player right now, and how clearly (0..1)? */
  function visibility(guard, player) {
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance > GUARD.viewRange) return 0;
    const angle = Math.atan2(dy, dx);
    let diff = angle - guard.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > GUARD.viewHalfAngle) return 0;
    if (!level.hasLineOfSight(guard.x, guard.y, player.x, player.y)) return 0;
    const closeness = 1 - (distance / GUARD.viewRange) * 0.45;
    return Math.max(0.15, closeness);
  }

  /** How strongly this guard hears the player's footsteps (0..1): only when the player walks. */
  function hears(guard, player) {
    if (!player.moving || player.sneaking) return 0;
    const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (distance > GUARD.hearRange) return 0;
    return 0.1 + 0.3 * (1 - distance / GUARD.hearRange);
  }

  function stepGuard(guard, dt, player, seen) {
    if (guard.pauseSeconds > 0) {
      guard.pauseSeconds -= dt;
      return;
    }
    if (seen > 0) {
      guard.lastSeen = { x: player.x, y: player.y };
      guard.unseenSeconds = 0;
      guard.facing = turnToward(guard.facing, angleTo(guard.x, guard.y, player.x, player.y), GUARD.turnSpeed * dt);
      if (guard.state !== GUARD_ALERT) {
        // Walk toward a glimpse while still only suspicious; chase once alerted.
        moveToward(guard, player.x, player.y, GUARD.investigateSpeed, dt, level);
      } else {
        moveToward(guard, player.x, player.y, GUARD.chaseSpeed, dt, level);
      }
      return;
    }
    guard.unseenSeconds += dt;
    if (guard.state === GUARD_ALERT) {
      if (guard.lastSeen) {
        // Chase the last known position; give up on arriving and finding nothing.
        const arrived = moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.chaseSpeed, dt, level);
        if (arrived) guard.lastSeen = null;
        return;
      }
      if (guard.unseenSeconds > DETECTION.calmAfterSeconds) {
        guard.state = GUARD_PATROL;
        guard.lastSeen = null;
      }
      return;
    }
    if (guard.state === GUARD_SUSPICIOUS) {
      if (guard.lastSeen) {
        const arrived = moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.investigateSpeed, dt, level);
        if (arrived) {
          guard.lastSeen = null;
          guard.pauseSeconds = 1.6; // look around, find nothing, head back
          guard.state = GUARD_PATROL;
        }
      } else {
        // Heard the alarm but never saw where: look around, then give up.
        guard.scanSeconds += dt;
        guard.facing += GUARD.turnSpeed * 0.35 * dt;
        if (guard.scanSeconds > 1.5) {
          guard.scanSeconds = 0;
          guard.state = GUARD_PATROL;
        }
      }
      return;
    }
    // Patrol: walk the waypoints there and back, pausing briefly at each end.
    const target = guard.waypoints[guard.waypointIndex];
    const arrived = moveToward(guard, target.x, target.y, GUARD.patrolSpeed, dt, level);
    if (arrived) {
      guard.pauseSeconds = 0.7;
      if (guard.waypointForward) {
        guard.waypointIndex += 1;
        if (guard.waypointIndex >= guard.waypoints.length) {
          guard.waypointIndex = guard.waypoints.length - 2;
          guard.waypointForward = false;
        }
      } else {
        guard.waypointIndex -= 1;
        if (guard.waypointIndex < 0) {
          guard.waypointIndex = 1;
          guard.waypointForward = true;
        }
      }
    }
  }

  function reset() {
    guards.forEach((guard, index) => {
      const patrol = patrols[index];
      guard.x = (patrol.start.x + 0.5) * TILE;
      guard.y = (patrol.start.y + 0.5) * TILE;
      guard.facing = 0;
      guard.state = GUARD_PATROL;
      guard.waypointIndex = 1;
      guard.waypointForward = true;
      guard.lastSeen = null;
      guard.unseenSeconds = 0;
      guard.pauseSeconds = 0;
      guard.scanSeconds = 0;
    });
  }

  return { guards, visibility, hears, stepGuard, reset };
}
