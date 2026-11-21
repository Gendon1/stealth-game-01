// Shadow Archive: every tuning number, colour and the level map in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };
export const TILE = 64;
export const COLS = 20;
export const ROWS = 11;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 180,
  sneakSpeed: 95,
  startTile: { x: 1, y: 5 },
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 74,
  investigateSpeed: 108,
  chaseSpeed: 170,
  viewRange: 270,
  viewHalfAngle: 0.62, // ~35 degrees each side
  turnSpeed: 2.8,
  hearRange: 120, // footsteps carry this far when the player is not sneaking
};

export const DETECTION = {
  fillPerSecond: 60, // at point blank, walking, in the open
  farMultiplier: 0.55, // past 60% of view range
  sneakMultiplier: 0.45,
  decayPerSecond: 28,
  suspiciousAt: 40,
  alertedAt: 100,
  calmAfterSeconds: 6,
};

export const LIVES = 3;

/**
 * The archive floor, one character per tile:
 *   # wall (blocks movement and sight)   C crate (blocks sight, waist-high cover)
 *   S shelf (blocks movement and sight)  . open floor
 *   P player start  E exit  a relic  G guard patrol start
 * Guard waypoints are listed below, not in the map.
 */
export const LEVEL_MAP = [
  '####################',
  '#P....C......C...a.#',
  '#..................#',
  '#.##....a....##.C..#',
  '#..................#',
  '#.PC.....##.....C..#',
  '#..................#',
  '#..a...##....a.....#',
  '#..................#',
  '#....C......C.....E#',
  '####################',
];

export const GUARD_PATROLS = [
  // Each guard walks its waypoints in order (tile centres), then back again.
  // Every leg runs along an open corridor: no wall, shelf or crate on the way.
  { start: { x: 11, y: 1 }, waypoints: [{ x: 11, y: 1 }, { x: 11, y: 8 }, { x: 15, y: 8 }, { x: 15, y: 1 }] },
  { start: { x: 1, y: 8 }, waypoints: [{ x: 1, y: 8 }, { x: 1, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 8 }] },
  { start: { x: 17, y: 1 }, waypoints: [{ x: 17, y: 1 }, { x: 17, y: 9 }] },
  { start: { x: 13, y: 4 }, waypoints: [{ x: 13, y: 4 }, { x: 7, y: 4 }, { x: 7, y: 6 }, { x: 13, y: 6 }] },
];

export const RELIC_NAMES = ['Amber Seal', 'Cobalt Lens', 'Ivory Key', 'Jade Compass'];

export const PALETTE = {
  backdrop: '#0b0d12',
  floorA: '#2c3242',
  floorB: '#282d3b',
  floorLine: '#3a4152',
  wall: '#454e63',
  wallTop: '#5a657d',
  crate: '#7d6138',
  crateTop: '#9a7d4c',
  shelf: '#5f4a30',
  shelfTop: '#7d6242',
  shadow: '#12141b',
  player: '#7fd4ff',
  playerSneak: '#5aa8d8',
  guard: '#e8b23a',
  guardAlert: '#e5534b',
  coneCalm: 'rgba(232, 178, 58, 0.28)',
  coneSuspicious: 'rgba(232, 120, 58, 0.40)',
  coneAlert: 'rgba(229, 83, 75, 0.44)',
  relic: '#ffd75e',
  exitLocked: '#5a6478',
  exitOpen: '#58d68d',
  text: '#eef1f5',
  muted: '#9aa3b5',
  panel: '#171b24',
  danger: '#e5534b',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best (fastest) clear is kept between visits (this browser only). */
export const BEST_KEY = 'shadow-archive.best-seconds';
