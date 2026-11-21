// Guard AI: three states, one set of senses. A guard patrols its beat, gets
// suspicious when the eye meter climbs and walks over to look at the last
// place it saw you, and gives chase on the alarm until it loses you for
// long enough to fall back to looking around. Sight is a cone cut short by
// walls, hearing is footsteps close by. The world drives this: it asks how
// strongly each guard senses the player, then steps each guard with that
// strength, so the senses and the movement never disagree.

import { GUARD, TILE } from './settings.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function waypointPixels(waypoints) {
  return waypoints.map(([col, row]) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE }));
}

export function createGuards(level, patrols) {
  const guards = patrols.map((waypoints) => {
    const points = waypointPixels(waypoints);
    const first = points[0];
    const second = points[1] ?? first;
    return {
      x: first.x,
      y: first.y,
      facing: Math.atan2(second.y - first.y, second.x - first.x),
      state: GUARD_PATROL,
      waypoints: points,
      wp: 1 % points.length,
      lastSeen: null,
      lostTimer: 0,
      scanTimer: 0,
      scanBase: 0,
    };
  });

  function reset() {
    for (const guard of guards) {
      const first = guard.waypoints[0];
      const second = guard.waypoints[1] ?? first;
      guard.x = first.x;
      guard.y = first.y;
      guard.facing = Math.atan2(second.y - first.y, second.x - first.x);
      guard.state = GUARD_PATROL;
      guard.wp = 1 % guard.waypoints.length;
      guard.lastSeen = null;
      guard.lostTimer = 0;
      guard.scanTimer = 0;
    }
  }

  /** How strongly the guard sees the player, 0 when it cannot. */
  function visibility(guard, player) {
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance > GUARD.viewRange) return 0;
    const angle = Math.atan2(dy, dx);
    if (Math.abs(angleDifference(angle, guard.facing)) > GUARD.viewHalfAngle) return 0;
    if (!level.hasLineOfSight(guard.x, guard.y, player.x, player.y)) return 0;
    // Close is unmistakable, the far edge of the cone is a glimpse.
    return clamp(1.15 - distance / GUARD.viewRange, 0.25, 1);
  }

  /** How strongly the guard hears the player, 0 when it cannot. */
  function hears(guard, player) {
    if (!player.moving || player.sneaking) return 0;
    const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (distance >= GUARD.hearRange) return 0;
    return (1 - distance / GUARD.hearRange) * 0.6;
  }

  // Walk toward a point without clipping through a wall: try each axis on
  // its own, exactly like the player moves, so a chasing guard slides along
  // a wall instead of passing through it.
  function walkToward(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return true;
    const stepX = (dx / distance) * speed * dt;
    const stepY = (dy / distance) * speed * dt;
    if (!level.circleHitsWall(guard.x + stepX, guard.y, GUARD.radius)) guard.x += stepX;
    if (!level.circleHitsWall(guard.x, guard.y + stepY, GUARD.radius)) guard.y += stepY;
    guard.facing = Math.atan2(dy, dx);
    return distance < speed * dt + 2;
  }

  function nearestWaypointIndex(guard) {
    let best = 0;
    let bestDistance = Infinity;
    guard.waypoints.forEach((point, index) => {
      const distance = Math.hypot(point.x - guard.x, point.y - guard.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  function stepGuard(guard, dt, player, seen) {
    if (guard.state === GUARD_ALERT) {
      if (seen > 0) {
        guard.lastSeen = { x: player.x, y: player.y };
        guard.lostTimer = 0;
      } else {
        guard.lostTimer += dt;
        if (guard.lostTimer > GUARD.loseSightSeconds) {
          // Lost you: fall back to searching the last place you were.
          guard.state = GUARD_SUSPICIOUS;
          guard.scanTimer = 0;
          guard.scanBase = guard.facing;
          return;
        }
      }
      const target = guard.lastSeen ?? { x: player.x, y: player.y };
      walkToward(guard, target.x, target.y, GUARD.chaseSpeed, dt);
      return;
    }

    if (guard.state === GUARD_SUSPICIOUS) {
      if (seen > 0) {
        // Spotted again while searching: keep the new position in mind.
        guard.lastSeen = { x: player.x, y: player.y };
        guard.scanTimer = 0;
      }
      if (guard.lastSeen) {
        const arrived = walkToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.investigateSpeed, dt);
        if (arrived) {
          // On the spot: look around for a while, then give up and patrol.
          guard.scanTimer += dt;
          guard.facing = guard.scanBase + Math.sin(guard.scanTimer * 2.2) * 1.1;
          if (guard.scanTimer > GUARD.lookAroundSeconds) {
            guard.lastSeen = null;
            guard.state = GUARD_PATROL;
            guard.wp = nearestWaypointIndex(guard);
          }
        }
      } else {
        guard.state = GUARD_PATROL;
        guard.wp = nearestWaypointIndex(guard);
      }
      return;
    }

    // Patrol: walk the beat, turning at each waypoint, forever.
    const target = guard.waypoints[guard.wp];
    const arrived = walkToward(guard, target.x, target.y, GUARD.patrolSpeed, dt);
    if (arrived) guard.wp = (guard.wp + 1) % guard.waypoints.length;
  }

  return { guards, reset, visibility, hears, stepGuard };
}
