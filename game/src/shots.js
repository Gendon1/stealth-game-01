// The screenshot scenes behind ?shot=start|play|alert|end. Each one is a real
// render of the game's own rules: the play scene steers the player with a
// scripted route through the archive (the same step() the game loop calls), and
// the alert and end scenes stage the world into a state the rules can really
// reach — a guard mid-chase, and the win moment at the open exit — then paint
// it. The same seed always gives the same frame.
import { STEP } from './settings.js';
import { GUARD_ALERT } from './guards.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Run the world forward with a scripted route: [dx, dy, sneak, seconds]. */
function runRoute(world, route, harmless = false) {
  for (const [dx, dy, sneak, seconds] of route) {
    const steps = Math.round(seconds / STEP);
    for (let index = 0; index < steps; index += 1) {
      world.step(STEP, { x: dx, y: dy }, sneak, harmless);
    }
  }
}

export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    // Sneak down to the Ivory Key relic on row 7, pick it up, then slip up
    // into guard four's patrol lane: the route crosses a cone and the meter climbs.
    runRoute(world, [
      [0, 1, true, 1.4],
      [1, 0, true, 1.4],
      [0, -1, true, 1.6],
      [1, 0, false, 1.2],
    ]);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'alert') {
    // Walk straight into guard four's cone in the open lane: spotted, chase on.
    world.reset();
    state.player.x = 7.5 * 64;
    state.player.y = 4.5 * 64;
    const guard = state.guards[3];
    guard.x = 10.5 * 64;
    guard.y = 4.5 * 64;
    guard.facing = Math.PI;
    guard.state = GUARD_ALERT;
    state.detection = 100;
    state.alerts = 1;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    // The win moment: every relic recovered, the player at the open exit.
    world.reset();
    for (const relic of state.relics) relic.taken = true;
    state.relicsTaken = state.relics.length;
    state.player.x = state.exit.x - 30;
    state.player.y = state.exit.y;
    state.elapsed = 187;
    state.alerts = 0;
    state.won = true;
    return { screen: SCREEN_WIN, best: 187 };
  }
  // start: the title over a live archive, guards already on patrol.
  world.reset();
  runRoute(world, [[0, 0, false, 4]], true);
  return { screen: SCREEN_TITLE, best: 0 };
}
