// Fórmulas de dano centralizadas. Nenhuma habilidade calcula dano por conta própria.

// Armadura reduz dano físico com retorno decrescente: 100 de armadura = metade do dano.
export function armorReduction(armor) {
  return 100 / (100 + Math.max(0, armor));
}

/**
 * Calcula o dano final de um golpe, sem aplicá-lo.
 * @param {object} p
 * @param {number} p.base            dano-base do golpe (já multiplicado pelo coeficiente da habilidade)
 * @param {'physical'|'magic'} p.type
 * @param {object} p.attacker        precisa de getStat(name) e effects.multiplier(name)
 * @param {object} p.defender        idem
 * @param {boolean} [p.canCrit=true]
 * @param {number} [p.critBonus=0]   chance crítica adicional deste golpe
 * @param {boolean} [p.basic=false]  ataque básico (recebe basicDamageMult)
 * @param {() => number} [p.rng]
 */
export function computeDamage({ base, type = 'physical', attacker, defender, canCrit = true, critBonus = 0, basic = false, rng = Math.random }) {
  let amount = base;
  if (attacker) {
    amount *= attacker.effects.multiplier('damageMult');
    if (basic) amount *= attacker.effects.multiplier('basicDamageMult');
    amount *= attacker.outgoingDamageMult ?? 1;
    if (type === 'magic') amount *= 1 + attacker.getStat('magicPower') / 100;
  }
  if (type === 'physical') amount *= armorReduction(defender.getStat('armor'));
  let crit = false;
  if (canCrit && attacker) {
    const chance = attacker.getStat('critChance') + critBonus;
    if (rng() < chance) {
      crit = true;
      amount *= attacker.getStat('critMult');
    }
  }
  amount *= defender.effects.multiplier('damageTakenMult');
  return { amount: Math.max(1, Math.round(amount)), crit };
}

/**
 * Aplica dano a um alvo dentro de um mundo. Retorna o dano aplicado (0 se o golpe foi inválido).
 * Garante que personagens mortos não recebem dano nem causam dano.
 */
export function dealDamage(world, attacker, defender, params) {
  if (!defender.alive) return 0;
  if (attacker && attacker.team === defender.team) return 0;
  const { amount, crit } = computeDamage({ ...params, attacker, defender, rng: world.rng });
  const applied = Math.min(amount, defender.hp);
  defender.hp -= applied;
  defender.lastHitBy = attacker?.id ?? null;
  defender.hurtTimer = 0.25;
  if (attacker) attacker.stats.damageDealt += applied;
  world.events.emit('damage', {
    sourceId: attacker?.id ?? null,
    targetId: defender.id,
    amount: applied,
    crit,
    type: params.type ?? 'physical',
    x: defender.pos.x,
    y: defender.pos.y,
  });
  if (defender.hp <= 0) world.killCharacter(defender, attacker);
  return applied;
}

export function heal(world, target, amount, { silent = false } = {}) {
  if (!target.alive) return 0;
  const healed = Math.min(amount, target.maxHp - target.hp);
  if (healed <= 0) return 0;
  target.hp += healed;
  if (!silent) world.events.emit('heal', { targetId: target.id, amount: healed, x: target.pos.x, y: target.pos.y });
  return healed;
}
