// Boot and the game loop: five screens, a fixed-step simulation, and the
// wiring between input, world, sound and renderer. The loop never trusts
// the frame rate — it always advances the world in STEP-sized slices — and
// the world never knows about the screen, the sound or the canvas: this file
// is the only place those meet.

import { createLevel } from './level.js';
import { createWorld, EVENT_ALERT, EVENT_CAUGHT, EVENT_RELIC, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_LOSE, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { PATROLS, STEP } from './settings.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'shadow-archive-best';

function ratingFor(alerts) {
  if (alerts === 0) return 'GHOST';
  if (alerts === 1) return 'SHADOW';
  return 'LOUD';
}

function loadBest() {
  try {
    const stored = window.localStorage.getItem(BEST_KEY);
    return stored == null ? null : Number(stored);
  } catch {
    return null;
  }
}

function saveBest(seconds) {
  try {
    window.localStorage.setItem(BEST_KEY, String(seconds));
  } catch {
    // A private window is fine: the best time is a nicety, not the game.
  }
}

export function boot() {
  const canvas = document.getElementById('game');
  const status = document.getElementById('status');
  const level = createLevel();
  const world = createWorld(level, PATROLS);
  const input = createInput(canvas);
  const audio = createAudio();
  const renderer = createRenderer(canvas);

  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  let screen = SCREEN_TITLE;
  let best = loadBest();
  let rating = null;
  let announced = '';
  let frameTime = 0;
  let accumulator = 0;
  let lastNow = performance.now();
  let shotReady = false;

  if (shotName) {
    // A deterministic screenshot scene: stage the world, then paint it.
    const staged = stageShot(shotName, world);
    screen = staged.screen;
    best = staged.best || best;
    if (screen === SCREEN_WIN) rating = ratingFor(world.state.alerts);
  }

  function announce(text) {
    if (text === announced || !status) return;
    announced = text;
    status.textContent = text;
  }

  function startGame() {
    world.reset();
    screen = SCREEN_PLAY;
    rating = null;
    audio.resume();
    audio.click();
    announce(`Playing. ${world.state.lives} lives, ${level.relics.length} relics to recover.`);
  }

  function finishRun() {
    const seconds = world.state.elapsed;
    rating = ratingFor(world.state.alerts);
    if (best == null || seconds < best) {
      best = seconds;
      saveBest(seconds);
    }
    announce(`Archive secured in ${Math.round(seconds)} seconds, rating ${rating}.`);
  }

  function stepOnce() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSE;
      announce('Paused.');
      return;
    }
    if (screen === SCREEN_PAUSE && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return;
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) {
        startGame();
        return;
      }
      if (screen === SCREEN_WIN || screen === SCREEN_LOSE) {
        startGame();
        return;
      }
      if (screen === SCREEN_PAUSE) {
        screen = SCREEN_PLAY;
        return;
      }
    }
    if (screen !== SCREEN_PLAY) return;

    const pointer = input.takePointer();
    if (pointer) {
      const field = renderer.toField(pointer.clientX, pointer.clientY);
      world.state.moveTarget = { x: field.x, y: field.y, sneak: pointer.sneak };
    }
    let move = input.moveVector();
    const sneaking = input.sneaking();
    if (move.x !== 0 || move.y !== 0) {
      // Keys take over from a click-to-move target the moment they move.
      world.state.moveTarget = null;
    } else if (world.state.moveTarget) {
      const target = world.state.moveTarget;
      const dx = target.x - world.state.player.x;
      const dy = target.y - world.state.player.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 10) {
        world.state.moveTarget = null;
      } else {
        move = { x: dx / distance, y: dy / distance };
      }
    }
    const sneak = sneaking || (world.state.moveTarget?.sneak ?? false);
    const events = world.step(STEP, move, sneak);
    if (events & EVENT_RELIC) {
      audio.pickup();
      announce(`${world.state.relicsTaken} of ${level.relics.length} relics recovered.`);
    }
    if (events & EVENT_ALERT) audio.alarm();
    if (events & EVENT_CAUGHT) {
      audio.caught();
      if (world.state.caught) {
        screen = SCREEN_LOSE;
        audio.lose();
        announce('Caught. Out of lives.');
      } else {
        announce(`Caught. ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left.`);
      }
    }
    if (events & EVENT_WIN) {
      screen = SCREEN_WIN;
      audio.win();
      finishRun();
    }
    // The heartbeat follows the nearest chasing guard.
    let chase = 0;
    for (const guard of world.state.guards) {
      if (guard.state !== 'alert') continue;
      const distance = Math.hypot(guard.x - world.state.player.x, guard.y - world.state.player.y);
      chase = Math.max(chase, Math.max(0, 1 - distance / 260));
    }
    audio.update(STEP, { moving: world.state.player.moving, sneaking: sneak, chase });
  }

  function frame(now) {
    const dt = Math.min((now - lastNow) / 1000, 0.25);
    lastNow = now;
    frameTime += dt;
    if (screen === SCREEN_TITLE) {
      // The title plays over a live archive: guards patrol, nothing is lost.
      accumulator += dt;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        world.step(STEP, { x: 0, y: 0 }, false, true);
      }
    } else if (screen === SCREEN_PLAY) {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < 5) {
        accumulator -= STEP;
        steps += 1;
        stepOnce();
      }
      if (steps === 5) accumulator = 0;
    } else {
      // Pause, win and lose freeze the world; the frame still paints.
      accumulator = 0;
    }
    renderer.draw(level, world, screen, { best, muted: audio.isMuted(), rating }, frameTime);
    if (shotName && !shotReady) {
      shotReady = true;
      document.title = 'shot-ready';
      document.documentElement.dataset.shotReady = '1';
    }
    requestAnimationFrame(frame);
  }

  // A hidden tab never sends keyup: pause instead of letting the player
  // walk into a guard while they are looking at another tab.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSE;
  });

  requestAnimationFrame(frame);
}

boot();
