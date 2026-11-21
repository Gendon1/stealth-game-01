// Shadow Archive tuning: every number the game balances on, the palette the
// renderer paints with, the archive's floor plan and the guards' patrols.
// One file, so a balance change never has to hunt through the game code.

export const TILE = 64;
export const COLS = 20;
export const ROWS = 11;
export const FIELD_WIDTH = COLS * TILE; // 1280
export const FIELD_HEIGHT = ROWS * TILE; // 704

// Fixed simulation step, in seconds: the loop always advances the world by
// this much, so the game plays the same on a fast screen and a slow one.
export const STEP = 1 / 60;

// The player: quick on foot, slow and quiet while sneaking.
export const PLAYER = {
  radius: 14,
  walkSpeed: 150,
  sneakSpeed: 85,
};

export const LIVES = 3;

// A guard's senses. viewRange is how far a cone reaches, viewHalfAngle how
// wide it opens, hearRange how close a walking footstep gives the player
// away. chaseSpeed is slower than the player's walk, so a spotted player who
// keeps moving can still break away around a corner.
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

// The eye meter: it fills while any guard senses the player and drains while
// none does. Suspicion starts at 40 (a guard comes to look), the alarm at
// 100 (a guard that saw you gives chase). Far away and sneaking both slow
// the fill, so distance and patience are real defenses.
export const DETECTION = {
  fillPerSecond: 46,
  decayPerSecond: 26,
  farMultiplier: 0.5,
  sneakMultiplier: 0.45,
  suspiciousAt: 40,
  alertedAt: 100,
};

// The archive floor plan, one character per tile, 20 columns by 11 rows:
//   # wall   S shelf   C crate   P player start   E exit   a relic   . floor
// Walls, shelves and crates all block movement and sight; a crate is a
// chest-high stack, so it cuts a vision cone exactly like a wall does.
// The long open lane on row 4 is the guards' main beat, and the relics sit
// one per wing so the player has to cross the whole archive.
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

// Guard patrols, as tile waypoints [column, row]: each guard walks its loop
// and turns at each waypoint. The four beats cover the west wing, the long
// north lane, the east wing and the corridor by the exit, so no corner of
// the archive is ever unwatched for long.
export const PATROLS = [
  [[2, 5], [5, 5]],
  [[9, 4], [15, 4]],
  [[13, 7], [17, 7]],
  [[16, 6], [16, 9]],
];

// The palette, kept in one place so the night stays one night: cold stone
// and lamplight, gold for the things that matter, red only for danger.
export const PALETTE = {
  floor: '#232833',
  floorAlt: '#20242e',
  floorEdge: '#2b3040',
  wall: '#12141b',
  wallTop: '#3a4152',
  shelf: '#4a3421',
  shelfEdge: '#6b4c2f',
  crate: '#5c4a2a',
  crateEdge: '#8a6f3e',
  exit: '#2fd47a',
  exitLocked: '#3d5a48',
  exitGlow: 'rgba(47, 212, 122, 0.25)',
  relic: '#ffd34d',
  relicGlow: 'rgba(255, 211, 77, 0.30)',
  player: '#e8ecf4',
  playerSneak: '#9fb4d8',
  guard: '#ff5a5a',
  guardSuspicious: '#ffb02e',
  guardAlert: '#ff2e2e',
  cone: 'rgba(255, 214, 90, 0.20)',
  coneEdge: 'rgba(255, 214, 90, 0.45)',
  coneSuspicious: 'rgba(255, 176, 46, 0.26)',
  coneAlert: 'rgba(255, 46, 46, 0.30)',
  coneAlertEdge: 'rgba(255, 46, 46, 0.55)',
  lastSeen: '#ffd34d',
  moveTarget: 'rgba(232, 236, 244, 0.8)',
  hudBack: 'rgba(10, 12, 18, 0.72)',
  hudText: '#e8ecf4',
  hudDim: '#9aa3b5',
  meterBack: '#1a1e28',
  meterFill: '#ffd34d',
  meterDanger: '#ff2e2e',
  panelBack: 'rgba(8, 10, 16, 0.82)',
  panelEdge: '#3a4152',
  title: '#ffd34d',
  danger: '#ff5a5a',
};
