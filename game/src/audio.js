// Synthesised sound only: no audio files, no network. A tiny WebAudio helper
// that blips footsteps, chimes a relic, stings an alarm, thumps a heartbeat
// when a chasing guard closes in, and hums the archive. Everything is guarded
// so the game still runs where audio is unavailable.
export function createAudio() {
  let context = null;
  let muted = false;
  let humNodes = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function blip(frequency, seconds, type, gainValue, when = 0) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(gainValue, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + seconds);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime + when);
      oscillator.stop(ctx.currentTime + when + seconds + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function startHum() {
    const ctx = ensure();
    if (!ctx || humNodes) return;
    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 55;
      gain.gain.value = 0.018;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      humNodes = { oscillator, gain };
    } catch {
      humNodes = null;
    }
  }

  return {
    unlock() {
      ensure();
      startHum();
    },
    toggleMute() {
      muted = !muted;
      if (humNodes) humNodes.gain.gain.value = muted ? 0 : 0.018;
      return muted;
    },
    get muted() {
      return muted;
    },
    footstep(sneaking) {
      blip(sneaking ? 140 : 190, 0.06, 'triangle', sneaking ? 0.02 : 0.045);
    },
    relic() {
      blip(660, 0.14, 'sine', 0.09);
      blip(990, 0.22, 'sine', 0.09, 0.09);
    },
    suspicious() {
      blip(330, 0.18, 'square', 0.05);
    },
    alarm() {
      blip(220, 0.28, 'sawtooth', 0.09);
      blip(165, 0.34, 'sawtooth', 0.09, 0.22);
    },
    caught() {
      blip(110, 0.5, 'sawtooth', 0.1);
    },
    heartbeat() {
      blip(70, 0.12, 'sine', 0.12);
      blip(60, 0.14, 'sine', 0.1, 0.16);
    },
    win() {
      blip(523, 0.16, 'sine', 0.09);
      blip(659, 0.16, 'sine', 0.09, 0.12);
      blip(784, 0.3, 'sine', 0.09, 0.24);
    },
  };
}
