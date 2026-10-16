// Efeitos temporários: modificadores multiplicativos de atributos e marcações de controle.
// Os atributos-base da classe nunca são alterados; o valor final é base × modificadores.
//
// Modificadores conhecidos:
//   damageMult, basicDamageMult, damageTakenMult, speedMult, attackSpeedMult
// Marcações (flags): stunned
export class StatusEffects {
  constructor() {
    this.list = [];
  }

  // Um efeito com o mesmo id e a mesma origem é renovado em vez de acumulado.
  add({ id, duration, modifiers = {}, flags = {}, sourceId = null, kind = 'buff', visual = null }) {
    const existing = this.list.find((e) => e.id === id && e.sourceId === sourceId);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, duration);
      existing.duration = Math.max(existing.duration, duration);
      return existing;
    }
    const effect = { id, duration, remaining: duration, modifiers, flags, sourceId, kind, visual };
    this.list.push(effect);
    return effect;
  }

  update(dt) {
    for (const e of this.list) e.remaining -= dt;
    this.list = this.list.filter((e) => e.remaining > 0);
  }

  multiplier(name) {
    let m = 1;
    for (const e of this.list) {
      const v = e.modifiers[name];
      if (v !== undefined) m *= v;
    }
    return m;
  }

  has(flag) {
    return this.list.some((e) => e.flags[flag]);
  }

  hasId(id) {
    return this.list.some((e) => e.id === id);
  }

  clear() {
    this.list = [];
  }
}
