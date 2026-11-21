// The level: a tile grid parsed from the map, with movement collision and the
// line-of-sight test the guards' vision cones use. Walls, shelves and crates all
// block both sight and movement: a crate is a chest-high stack you must walk
// around, and a guard cannot see over it either.
import { COLS, LEVEL_MAP, ROWS, TILE } from './settings.js';

export const TILE_WALL = '#';
export const TILE_CRATE = 'C';
export const TILE_SHELF = 'S';
export const TILE_EXIT = 'E';
export const TILE_RELIC = 'a';
export const TILE_START = 'P';

function tileAt(grid, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return TILE_WALL;
  return grid[row][col];
}

export function createLevel() {
  const grid = LEVEL_MAP.map((row) => row.split(''));
  const relics = [];
  let start = { x: 1.5 * TILE, y: 5.5 * TILE };
  let exit = { x: 18.5 * TILE, y: 9.5 * TILE };
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = grid[row][col];
      if (cell === TILE_START) start = { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
      if (cell === TILE_EXIT) exit = { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
      if (cell === TILE_RELIC) relics.push({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE, taken: false });
    }
  }

  function blocksSight(col, row) {
    const cell = tileAt(grid, col, row);
    return cell === TILE_WALL || cell === TILE_CRATE || cell === TILE_SHELF;
  }

  function blocksMovement(col, row) {
    const cell = tileAt(grid, col, row);
    return cell === TILE_WALL || cell === TILE_SHELF || cell === TILE_CRATE;
  }

  function circleHitsWall(x, y, radius) {
    const left = Math.floor((x - radius) / TILE);
    const right = Math.floor((x + radius) / TILE);
    const top = Math.floor((y - radius) / TILE);
    const bottom = Math.floor((y + radius) / TILE);
    for (let row = top; row <= bottom; row += 1) {
      for (let col = left; col <= right; col += 1) {
        if (!blocksMovement(col, row)) continue;
        const nearestX = Math.max(col * TILE, Math.min(x, (col + 1) * TILE));
        const nearestY = Math.max(row * TILE, Math.min(y, (row + 1) * TILE));
        const dx = x - nearestX;
        const dy = y - nearestY;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
    return false;
  }

  /** True when nothing sight-blocking stands between the two points. */
  function hasLineOfSight(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / 8));
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const col = Math.floor((ax + dx * t) / TILE);
      const row = Math.floor((ay + dy * t) / TILE);
      if (blocksSight(col, row)) return false;
    }
    return true;
  }

  /** Every open tile reachable on foot from the player's start (flood fill). */
  function reachableTiles() {
    const seen = new Set();
    const startCol = Math.floor(start.x / TILE);
    const startRow = Math.floor(start.y / TILE);
    const queue = [[startCol, startRow]];
    seen.add(`${startCol},${startRow}`);
    while (queue.length > 0) {
      const [col, row] = queue.pop();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = [col + dc, row + dr];
        const key = `${next[0]},${next[1]}`;
        if (seen.has(key) || blocksMovement(next[0], next[1])) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    return seen;
  }

  return { grid, relics, start, exit, blocksSight, blocksMovement, circleHitsWall, hasLineOfSight, reachableTiles };
}
