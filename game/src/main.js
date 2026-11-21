// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// paused, caught and win. Click-to-move steers the player toward the clicked
// spot (Shift-click sneaks); any held movement key takes over from the click.
//
// ?seed=N fixes the random seed. ?shot=start|play|alert|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './settings.js';
import { createSeededRandom } from './random.js';
import { createLevel } from './level.js';
import { GUARD_PATROLS } from './settings.js';
import { createWorld, EVENT_ALERT, EVENT_CAUGHT, EVENT_RELIC, EVENT_SUSPICIOUS, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const FOOTSTEP_EVERY = 0.42;
const HEARTBEAT_EVERY = 0.55;
const HEARTBEAT_RANGE = 190;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const level = createLevel();
const world = createWorld(level, GUARD_PATROLS);
const renderer = createRenderer(canvas, level);
const audio = createAudio();
void createSeededRandom(seed);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stepTimer = 0;
  let heartbeatTimer = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    stepTimer = 0;
    heartbeatTimer = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Recover the 4 relics and reach the exit unseen.');
  }

  function endGame(won) {
    if (won) {
      screen = SCREEN_WIN;
      audio.win();
      if (best === 0 || world.state.elapsed < best) {
        best = Math.round(world.state.elapsed);
        saveBest(best);
      }
      announce(`All relics safe. Cleared in ${renderer.formatTime(world.state.elapsed)}.`);
    } else {
      screen = SCREEN_CAUGHT;
      audio.caught();
      announce(`Caught. ${world.state.lives} lives left.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_CAUGHT || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    // A click during play is a walk order; a key press cancels it below.
    const pointer = input.takePointer();
    if (pointer && screen === SCREEN_PLAY) {
      const field = renderer.screenToField(pointer.clientX, pointer.clientY);
      world.state.moveTarget = { x: field.x, y: field.y, sneak: pointer.sneak };
    }
  }

  function react(events) {
    if (events & EVENT_RELIC) audio.relic();
    if (events & EVENT_SUSPICIOUS) audio.suspicious();
    if (events & EVENT_ALERT) audio.alarm();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_CAUGHT) endGame(false);
  }

  /** The steering vector for this step: keys first, else the click target. */
  function steerVector() {
    const keys = input.moveVector();
    if (keys.x !== 0 || keys.y !== 0) {
      world.state.moveTarget = null;
      return { move: keys, sneak: input.sneaking() };
    }
    const target = world.state.moveTarget;
    if (!target) return { move: { x: 0, y: 0 }, sneak: false };
    const dx = target.x - world.state.player.x;
    const dy = target.y - world.state.player.y;
    if (Math.hypot(dx, dy) < 12) {
      world.state.moveTarget = null;
      return { move: { x: 0, y: 0 }, sneak: false };
    }
    return { move: { x: dx, y: dy }, sneak: target.sneak };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The archive lives behind the title: guards patrol, nothing scores.
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    const { move, sneak } = steerVector();
    const events = world.step(STEP, move, sneak);
    react(events);
    if (world.state.player.moving) {
      stepTimer += STEP;
      if (stepTimer >= FOOTSTEP_EVERY) {
        stepTimer = 0;
        audio.footstep(world.state.player.sneaking);
      }
    }
    // A chasing guard close behind makes the heartbeat sound.
    heartbeatTimer += STEP;
    if (heartbeatTimer >= HEARTBEAT_EVERY) {
      heartbeatTimer = 0;
      const player = world.state.player;
      for (const guard of world.state.guards) {
        if (guard.state === 'alert' && Math.hypot(player.x - guard.x, player.y - guard.y) < HEARTBEAT_RANGE) {
          audio.heartbeat();
          break;
        }
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Shadow Archive. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
