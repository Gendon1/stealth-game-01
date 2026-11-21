// Synthesised sound, no audio files: every effect is an oscillator (or two)
// shaped by a gain envelope, straight from the WebAudio API. The context is
// created lazily on the first user gesture, because a browser will not let
// a page start one before that. Footsteps and the heartbeat run through
// update(), everything else is a one-shot call from the game loop.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let stepTimer = 0;
  let stepAlternate = false;
  let heartTimer = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return false;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    return true;
  }

  // One note: an oscillator that slides from `from` to `to` Hz over
  // `seconds`, fading out, then stops itself. Returns nothing; silence when
  // there is no context yet is the caller's problem, not this one's.
  function tone(from, to, seconds, type, volume, delay = 0) {
    if (!context || !master) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, from), start);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  function thump(volume, delay = 0) {
    tone(95, 48, 0.12, 'sine', volume, delay);
  }

  return {
    resume() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },

    /** A soft two-note chime when a relic is recovered. */
    pickup() {
      if (!ensure()) return;
      tone(660, 660, 0.16, 'sine', 0.22);
      tone(990, 990, 0.24, 'sine', 0.2, 0.09);
    },
    /** The alarm: two rising sawtooth blasts. */
    alarm() {
      if (!ensure()) return;
      tone(220, 440, 0.22, 'sawtooth', 0.16);
      tone(220, 440, 0.22, 'sawtooth', 0.16, 0.24);
    },
    /** Caught: a low thud and a falling tone. */
    caught() {
      if (!ensure()) return;
      thump(0.5);
      tone(320, 90, 0.4, 'triangle', 0.25, 0.05);
    },
    /** The win: a small rising arpeggio, major and unhurried. */
    win() {
      if (!ensure()) return;
      [523, 659, 784, 1047].forEach((freq, index) => {
        tone(freq, freq, 0.3, 'sine', 0.2, index * 0.12);
      });
    },
    /** Out of lives: three slow descending notes. */
    lose() {
      if (!ensure()) return;
      [392, 330, 262].forEach((freq, index) => {
        tone(freq, freq * 0.94, 0.34, 'triangle', 0.2, index * 0.2);
      });
    },
    /** A quiet UI tick for menu presses. */
    click() {
      if (!ensure()) return;
      tone(880, 880, 0.05, 'square', 0.06);
    },

    /**
     * Per-frame sound. `fx` is { moving, sneaking, chase }: footsteps tick
     * while the player walks (never while sneaking, which is the point of
     * sneaking), and a heartbeat thumps faster the closer a chasing guard
     * is, from a slow dread at the edge of hearing to a gallop up close.
     */
    update(dt, fx) {
      if (!context || !master || muted) return;
      if (fx.moving && !fx.sneaking) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
          stepTimer = 0.34;
          stepAlternate = !stepAlternate;
          tone(stepAlternate ? 82 : 74, 55, 0.08, 'sine', 0.12);
        }
      } else {
        stepTimer = 0;
      }
      if (fx.chase > 0) {
        heartTimer -= dt;
        if (heartTimer <= 0) {
          // Chase 0..1 maps to a beat every 0.9s down to every 0.38s.
          heartTimer = 0.9 - fx.chase * 0.52;
          thump(0.3 + fx.chase * 0.25);
          thump(0.2 + fx.chase * 0.2, 0.16);
        }
      } else {
        heartTimer = 0;
      }
    },
  };
}
