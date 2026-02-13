class SoundSystem {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.getCtx();
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Short tap feedback — sine 600Hz, 40ms */
  tap() {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch { /* noop */ }
  }

  /** Success chime — C5 (523Hz) then E5 (659Hz), 150ms each, slight overlap */
  success() {
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 523;
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.16);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 659;
      gain2.gain.setValueAtTime(0.08, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.31);
    } catch { /* noop */ }
  }

  /** Dismiss — low tone 280Hz, 80ms, gain fades from 0.05 to 0.001 */
  dismiss() {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 280;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.09);
    } catch { /* noop */ }
  }

  /** Typewriter key — filtered noise burst 30ms, bandpass 2000-5000Hz, gain 0.03 */
  typeKey() {
    try {
      const ctx = this.getCtx();
      const buffer = this.createNoiseBuffer(0.03);
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 3500;
      bandpass.Q.value = 0.8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      source.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);
      source.start(ctx.currentTime);
      source.stop(ctx.currentTime + 0.04);
    } catch { /* noop */ }
  }

  /** Reveal — warm chord C4(262)+E4(330)+G4(392) played together, 400ms, slow exponential fade */
  reveal() {
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;
      const freqs = [262, 330, 392];

      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.42);
      }
    } catch { /* noop */ }
  }

  /** Scratch tick — 3 layers: gritty noise + metallic scrape + crackle pops */
  scratchTick() {
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;

      // Layer 1: gritty noise burst
      const noiseBuffer = this.createNoiseBuffer(0.025);
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseBP = ctx.createBiquadFilter();
      noiseBP.type = 'bandpass';
      noiseBP.frequency.value = 4000;
      noiseBP.Q.value = 1.2;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.025, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      noise.connect(noiseBP);
      noiseBP.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.03);

      // Layer 2: metallic scrape — high sine with fast vibrato
      const scrape = ctx.createOscillator();
      const scrapeGain = ctx.createGain();
      scrape.type = 'sawtooth';
      scrape.frequency.value = 2200 + Math.random() * 800;
      scrapeGain.gain.setValueAtTime(0.012, now);
      scrapeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      scrape.connect(scrapeGain);
      scrapeGain.connect(ctx.destination);
      scrape.start(now);
      scrape.stop(now + 0.025);

      // Layer 3: crackle pop — very short noise burst
      const popBuffer = this.createNoiseBuffer(0.008);
      const pop = ctx.createBufferSource();
      pop.buffer = popBuffer;
      const popHP = ctx.createBiquadFilter();
      popHP.type = 'highpass';
      popHP.frequency.value = 6000;
      const popGain = ctx.createGain();
      popGain.gain.setValueAtTime(0.02, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
      pop.connect(popHP);
      popHP.connect(popGain);
      popGain.connect(ctx.destination);
      pop.start(now);
      pop.stop(now + 0.01);
    } catch { /* noop */ }
  }

  /** Progress tick — sine at given frequency, 30ms, gain 0.04 */
  progressTick(frequency: number) {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    } catch { /* noop */ }
  }

  /** Blip — sine at given frequency, 60ms, gain 0.06 */
  blip(frequency: number) {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.07);
    } catch { /* noop */ }
  }

  /** Cleanup */
  destroy() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

/** Singleton sound system instance */
export const soundSystem = new SoundSystem();

/** Haptic feedback patterns */
export const haptics = {
  lightTap: () => { try { navigator.vibrate(1); } catch { /* noop */ } },
  confirm: () => { try { navigator.vibrate([30, 20, 50]); } catch { /* noop */ } },
  reveal: () => { try { navigator.vibrate([50, 30, 100]); } catch { /* noop */ } },
  dismiss: () => { try { navigator.vibrate(10); } catch { /* noop */ } },
  typeKey: () => { try { navigator.vibrate(1); } catch { /* noop */ } },
};
