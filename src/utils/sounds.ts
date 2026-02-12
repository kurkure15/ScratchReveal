let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export class ScratchSoundEngine {
  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  playTick() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Layer 1: Gritty friction — filtered white noise, 80ms
    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2000 + Math.random() * 2000;
    bandpass.Q.value = 0.8;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1500;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05;
    noiseSource.connect(bandpass).connect(highpass).connect(noiseGain).connect(ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + 0.08);

    // Layer 2: Metallic scrape — sawtooth frequency sweep, 60ms
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.06);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.015, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);

    // Layer 3: Crackle pops — short buffer with random spikes, 10ms
    const crackleBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.01), ctx.sampleRate);
    const crackleData = crackleBuffer.getChannelData(0);
    for (let i = 0; i < crackleData.length; i++) {
      crackleData[i] = Math.random() < 0.08 ? (Math.random() * 1.6 - 0.8) : 0;
    }
    const crackleSource = ctx.createBufferSource();
    crackleSource.buffer = crackleBuffer;
    const crackleHighpass = ctx.createBiquadFilter();
    crackleHighpass.type = 'highpass';
    crackleHighpass.frequency.value = 4000;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.03;
    crackleSource.connect(crackleHighpass).connect(crackleGain).connect(ctx.destination);
    crackleSource.start(now);
    crackleSource.stop(now + 0.01);
  }
}

export function initAudio() {
  getAudioContext();
}

export function playCardTick() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 800;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  } catch {
    // ignore audio errors
  }
}

export function playRevealChime() {
  try {
    const ctx = getAudioContext();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.value = 523;
    osc2.type = "sine";
    osc2.frequency.value = 659;

    gain.gain.value = 0.1;

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.15);
  } catch {
    // ignore audio errors
  }
}
