// Executor único de habilidades. Toda habilidade passa pela mesma validação
// e é composta por efeitos genéricos descritos em abilityDefinitions.js.
import { angleTo, dist, fromAngle } from '../core/math.js';
import { applySlow, applyStun, fireProjectile, meleeStrike } from './CombatSystem.js';
import { dealDamage } from './DamageSystem.js';
import { edgeDistance, placeDefense, repairNear, chargeEvolution } from '../world/Structures.js';

export const FAIL = Object.freeze({
  DEAD: 'morto',
  INVALID: 'habilidade inexistente',
  STUNNED: 'atordoado',
  BUSY: 'ocupado',
  RESOURCE: 'sem recurso',
});

/**
 * Tenta usar a habilidade de índice `index` (0–4). Não há recarga: cada uso gasta `cost` da barra de ação.
 * Uma tentativa inválida não gasta nada.
 * @returns {{ok: boolean, reason?: string}}
 */
export function tryUseAbility(world, caster, index, aimPoint) {
  const def = caster.classDef.abilities[index];
  if (!caster.alive) return fail(world, caster, def, FAIL.DEAD);
  if (!def) return fail(world, caster, def, FAIL.INVALID);
  if (caster.stunned) return fail(world, caster, def, FAIL.STUNNED);
  if (caster.motion || caster.arming || caster.actionTimer > 0) return fail(world, caster, def, FAIL.BUSY);
  if (caster.resource < def.cost) return fail(world, caster, def, FAIL.RESOURCE);

  const aim = aimPoint ?? {
    x: caster.pos.x + Math.cos(caster.facing) * 100,
    y: caster.pos.y + Math.sin(caster.facing) * 100,
  };
  if (dist(aim, caster.pos) > 1) caster.facing = angleTo(caster.pos, aim);

  for (const effect of def.effects) {
    const run = EFFECTS[effect.type];
    if (!run) throw new Error(`Efeito desconhecido: ${effect.type}`);
    // Efeitos de construção podem recusar (local inválido, nada para reparar) sem gastar recurso.
    const result = run(world, caster, effect, { def, aim });
    if (result && result.ok === false) return fail(world, caster, def, result.reason);
  }

  caster.resource -= def.cost;
  caster.actionTimer = def.castLock ?? 0.18;
  caster.lastAction = 'ability';
  caster.attackAnim = 0.3;
  world.events.emit('ability', { casterId: caster.id, abilityId: def.id, name: def.name, x: caster.pos.x, y: caster.pos.y });
  return { ok: true };
}

function fail(world, caster, def, reason) {
  world.events.emit('abilityFailed', { casterId: caster.id, abilityId: def?.id ?? null, reason });
  return { ok: false, reason };
}

function clampAim(caster, aim, maxRange) {
  const d = dist(caster.pos, aim);
  if (!maxRange || d <= maxRange) return { x: aim.x, y: aim.y };
  const a = angleTo(caster.pos, aim);
  return { x: caster.pos.x + Math.cos(a) * maxRange, y: caster.pos.y + Math.sin(a) * maxRange };
}

// Um passo agendado de uma habilidade só ocorre se o personagem continuar apto.
function casterStillAble(caster) {
  return caster.alive && !caster.stunned;
}

const EFFECTS = {
  melee(world, caster, e) {
    meleeStrike(world, caster, {
      ...e,
      slow: e.slow ? { mult: e.slow, duration: e.slowDuration ?? 1.5 } : null,
    });
    world.events.emit('fx', {
      kind: 'slash', x: caster.pos.x, y: caster.pos.y, angle: caster.facing, range: e.range,
      arc: e.arc ?? 90, team: caster.team, ability: true, ownerId: caster.id,
    });
  },

  dash(world, caster, e) {
    let dir = fromAngle(caster.facing);
    if (e.direction === 'back') dir = { x: -dir.x, y: -dir.y };
    caster.motion = {
      dir, speed: e.speed, remaining: e.distance, kind: 'dash', forced: false,
      hit: e.hitDamage ? { dmg: e.hitDamage, stun: e.stun ?? 0 } : null,
      stopOnHit: e.stopOnHit ?? false, hitIds: new Set(),
    };
    world.events.emit('fx', { kind: 'dash', x: caster.pos.x, y: caster.pos.y, ownerId: caster.id });
  },

  buff(world, caster, e, { def }) {
    const targets = e.target === 'allies'
      ? world.characters.filter((c) => c.alive && c !== caster && c.team === caster.team && dist(c.pos, caster.pos) <= e.radius)
      : [caster];
    for (const t of targets) {
      t.effects.add({ id: `${def.id}:${e.target ?? 'self'}`, duration: e.duration, modifiers: e.modifiers, sourceId: caster.id, kind: 'buff', visual: e.visual });
    }
    world.events.emit('fx', { kind: 'buff', x: caster.pos.x, y: caster.pos.y, visual: e.visual, radius: e.radius ?? 0, ownerId: caster.id });
  },

  taunt(world, caster, e) {
    for (const c of world.characters) {
      if (!c.alive || c.team === caster.team || dist(c.pos, caster.pos) > e.radius) continue;
      c.taunt = { sourceId: caster.id, until: world.time + e.duration * (1 - c.getStat('ccResist') * 0.5) };
    }
    world.events.emit('fx', { kind: 'taunt', x: caster.pos.x, y: caster.pos.y, radius: e.radius, ownerId: caster.id });
  },

  projectile(world, caster, e) {
    const count = e.count ?? 1;
    const shoot = () => {
      const spread = e.spread ? ((world.rng() - 0.5) * e.spread * Math.PI) / 180 : 0;
      fireProjectile(world, caster, { ...e, angle: caster.facing + spread });
    };
    shoot();
    for (let i = 1; i < count; i++) {
      world.schedule(i * e.interval, () => {
        if (casterStillAble(caster)) shoot();
      }, caster.id);
    }
  },

  aoe(world, caster, e, { aim }) {
    const fixed = e.at === 'aim' ? clampAim(caster, aim, e.maxRange) : null;
    const waves = e.waves ?? 1;
    const delay = e.delay ?? 0;
    const center = () => fixed ?? { x: caster.pos.x, y: caster.pos.y };
    if (delay > 0 && fixed) {
      world.events.emit('fx', { kind: 'telegraph', x: fixed.x, y: fixed.y, radius: e.radius, duration: delay, team: caster.team, visual: e.visual });
    }
    const wave = () => {
      // Golpes centrados no personagem exigem que ele siga apto; áreas já lançadas caem de qualquer forma.
      if (!fixed && !casterStillAble(caster)) return;
      const c = center();
      for (const t of world.enemyTargets(caster.team)) {
        if (edgeDistance(t, c) > e.radius) continue;
        dealDamage(world, caster, t, { base: caster.attrs.damage * e.dmg, type: e.damageType ?? caster.classDef.attack.damageType });
        if (e.stun) applyStun(world, t, e.stun, caster.id);
        if (e.slow) applySlow(world, t, e.slow, e.slowDuration ?? 1, caster.id);
      }
      world.events.emit('fx', { kind: 'aoe', x: c.x, y: c.y, radius: e.radius, visual: e.visual, team: caster.team, ownerId: caster.id });
    };
    for (let i = 0; i < waves; i++) {
      const t = delay + i * (e.interval ?? 0);
      if (t <= 0) wave();
      else world.schedule(t, wave, fixed ? null : caster.id);
    }
  },

  build(world, caster, e, { aim }) {
    const at = clampAim(caster, aim, e.maxRange);
    // Mirando uma torre própria que pode evoluir: em vez de outra torre, enche a barra dela.
    if (e.charge) {
      const own = world.defenses.find((d) => d.alive && d.team === caster.team && d.type.evolvesTo && dist(d.pos, at) <= d.radius + 50);
      if (own) {
        chargeEvolution(world, own, own.maxHp * e.charge);
        world.events.emit('fx', { kind: 'repair', x: own.pos.x, y: own.pos.y, team: caster.team, ownerId: caster.id });
        return { ok: true, defense: own };
      }
    }
    const result = placeDefense(world, caster, e.structure, at);
    if (result.ok) world.events.emit('fx', { kind: 'build', x: result.defense.pos.x, y: result.defense.pos.y, team: caster.team, ownerId: caster.id });
    return result;
  },

  repair(world, caster, e) {
    const result = repairNear(world, caster, e.radius, e.amount);
    if (result.ok) world.events.emit('fx', { kind: 'repair', x: result.target.pos.x, y: result.target.pos.y, team: caster.team, ownerId: caster.id });
    return result;
  },

  zone(world, caster, e, { aim }) {
    const c = e.at === 'aim' ? clampAim(caster, aim, e.maxRange) : { x: caster.pos.x, y: caster.pos.y };
    world.zones.push({
      x: c.x, y: c.y, radius: e.radius, duration: e.duration, remaining: e.duration,
      tickInterval: e.tickInterval ?? 0, tickTimer: 0, base: caster.attrs.damage * (e.dmg ?? 0),
      damageType: e.damageType ?? caster.classDef.attack.damageType,
      slow: e.slow ?? null, smoke: e.smoke ?? false, team: caster.team, ownerId: caster.id, visual: e.visual,
    });
  },
};

// Atualização das zonas persistentes (gelo, tempestade, fumaça).
export function updateZones(world, dt) {
  for (const z of world.zones) {
    z.remaining -= dt;
    z.tickTimer -= dt;
    const tick = z.base > 0 && z.tickTimer <= 0;
    if (tick) z.tickTimer += z.tickInterval;
    const owner = world.getCharacter(z.ownerId);
    for (const t of world.enemyTargets(z.team)) {
      if (edgeDistance(t, z) > z.radius) continue;
      if (z.slow) applySlow(world, t, z.slow, 0.25, z.ownerId, `zone-slow-${z.visual}`);
      if (tick) dealDamage(world, owner, t, { base: z.base, type: z.damageType, canCrit: false });
    }
  }
  world.zones = world.zones.filter((z) => z.remaining > 0);
}
