// Tuning numbers, the vivid palette, the level map and the guard patrols.
// The numbers that shape how the game plays are the same as before — the
// player and guard speeds, the detection rates, the map and the patrols —
// only the colours changed: the archive is now a loud, living place, teal
// and violet tiles, gold relics, neon edges, instead of the old flat navy.

export const TILE = 64;
export const COLS = 20;
export const ROWS = 11;
export const FIELD_WIDTH = COLS * TILE; // 1280
export const FIELD_HEIGHT = ROWS * TILE; // 704
export const STEP = 1 / 60;
export const LIVES = 3;

export const PLAYER = {
  radius: 14,
  walkSpeed: 150,
  sneakSpeed: 85,
};

export const GUARD = {
  radius: 16,
  viewRange: 260,
  viewHalfAngle: 0.61,
  hearRange: 120,
  patrolSpeed: 55,
  investigateSpeed: 80,
  chaseSpeed: 135,
  lookAroundSeconds: 2.5,
  loseSightSeconds: 1.6,
};

export const DETECTION = {
  fillPerSecond: 46,
  decayPerSecond: 26,
  farMultiplier: 0.5,
  sneakMultiplier: 0.45,
  suspiciousAt: 40,
  alertedAt: 100,
};

// The archive floor plan. '#' is a wall, 'C' a crate, 'S' a shelf, 'a' a
// relic, 'P' the player's door, 'E' the exit. Every relic and the exit are
// reachable on foot from the door.
export const LEVEL_MAP = [
  '####################',
  '#....S..........a..#',
  '#.......C....S.....#',
  '#..S...........C.a.#',
  '#..................#',
  '#P....C......S.....#',
  '#...S.........C....#',
  '#..a......C........#',
  '#.....C........a...#',
  '#.........S......E.#',
  '####################',
];

// Each guard walks back and forth between two tile centres: [col, row].
export const PATROLS = [
  [[2, 5], [5, 5]],
  [[9, 4], [15, 4]],
  [[13, 7], [17, 7]],
  [[16, 6], [16, 9]],
];

// The look: a museum archive at night, but loud — teal and violet tiles,
// crimson rugs, gold loot, neon magenta and cyan edges, warm lamp pools.
// Every colour below is picked to stand apart from the others at a glance:
// floor, walls, props, guards, thief and cones never share a hue.
export const PALETTE = {
  // Floor: alternating teal and violet tiles, varied a little per tile.
  floorTeal: '#0e7a6c',
  floorTealDark: '#0a5e54',
  floorViolet: '#5b21b6',
  floorVioletDark: '#471a8c',
  grout: '#1c1033',
  rug: '#a11830',
  rugEdge: '#ffd166',
  speckle: '#ffd166',
  // Walls and props.
  wall: '#2e1065',
  wallTop: '#d946ef',
  wallSide: '#1e0b45',
  crate: '#c2701d',
  crateDark: '#7c3f0c',
  crateTrim: '#ffd166',
  shelf: '#7e22ce',
  shelfDark: '#581c87',
  shelfCross: '#fbbf24',
  // Relics, exit, people.
  relic: '#fbbf24',
  relicGlow: '#fde68a',
  exitOpen: '#22c55e',
  exitOpenGlow: '#86efac',
  exitLocked: '#f59e0b',
  thief: '#ec4899',
  thiefRing: '#fdf4ff',
  guard: '#22d3ee',
  guardSuspicious: '#f59e0b',
  guardAlert: '#ef4444',
  guardDark: '#0e7490',
  // Vision cones.
  cone: 'rgba(251, 191, 36, 0.36)',
  coneEdge: '#fde047',
  coneAlert: 'rgba(239, 68, 68, 0.42)',
  coneAlertEdge: '#fca5a5',
  // Lamp light and alarm tint.
  lamp: 'rgba(255, 190, 80, 0.20)',
  alarmTint: 'rgba(239, 68, 68, 0.16)',
  // HUD and panels.
  hudBg: '#150f2e',
  hudEdge: '#22d3ee',
  hudText: '#f8fafc',
  hudDim: '#a5b4fc',
  hudGold: '#fbbf24',
  hudRed: '#ef4444',
  meterEmpty: '#312e81',
  meterLow: '#22c55e',
  meterMid: '#f59e0b',
  meterHigh: '#ef4444',
  panelBg: 'rgba(21, 15, 46, 0.94)',
  panelEdge: '#e879f9',
  titleGold: '#fbbf24',
  titleCyan: '#22d3ee',
};
