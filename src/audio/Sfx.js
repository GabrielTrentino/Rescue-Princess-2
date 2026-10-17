// Efeitos sonoros sintetizados com Web Audio (sem arquivos externos).
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.18;
  }

  // O navegador só libera áudio após um gesto do usuário.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.ctx = new AC();
  }

  tone({ freq = 440, to = null, dur = 0.12, type = 'square', vol = 1, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(this.volume * vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.08, vol = 1, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = this.volume * vol;
    src.buffer = buffer;
    src.connect(gain).connect(ctx.destination);
    src.start(ctx.currentTime + delay);
  }

  swing() { this.noise({ dur: 0.06, vol: 0.35 }); }
  hit() { this.tone({ freq: 180, to: 80, dur: 0.08, type: 'square', vol: 0.5 }); }
  hurt() { this.tone({ freq: 140, to: 60, dur: 0.15, type: 'sawtooth', vol: 0.6 }); }
  ability() { this.tone({ freq: 520, to: 880, dur: 0.12, type: 'triangle', vol: 0.6 }); }
  denied() { this.tone({ freq: 160, dur: 0.08, type: 'square', vol: 0.35 }); }
  kill() { this.tone({ freq: 660, dur: 0.08, type: 'triangle' }); this.tone({ freq: 990, dur: 0.12, type: 'triangle', delay: 0.08 }); }
  death() { this.tone({ freq: 300, to: 70, dur: 0.5, type: 'sawtooth', vol: 0.6 }); }
  alert() { this.tone({ freq: 700, dur: 0.1, type: 'square', vol: 0.5 }); this.tone({ freq: 700, dur: 0.1, type: 'square', vol: 0.5, delay: 0.18 }); }
  victory() { [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'triangle', delay: i * 0.14 })); }
  defeat() { [392, 330, 262].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'triangle', delay: i * 0.2 })); }
}
