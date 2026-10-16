// Cooldowns independentes por identificador (habilidade ou ataque básico).
export class Cooldowns {
  constructor() {
    this.timers = new Map();
  }

  start(id, duration) {
    this.timers.set(id, { remaining: duration, duration });
  }

  remaining(id) {
    return this.timers.get(id)?.remaining ?? 0;
  }

  // 0 = pronto, 1 = recém-iniciado.
  fraction(id) {
    const t = this.timers.get(id);
    return t && t.duration > 0 ? t.remaining / t.duration : 0;
  }

  isReady(id) {
    return this.remaining(id) <= 0;
  }

  update(dt) {
    for (const [id, t] of this.timers) {
      t.remaining -= dt;
      if (t.remaining <= 0) this.timers.delete(id);
    }
  }

  reset() {
    this.timers.clear();
  }
}
