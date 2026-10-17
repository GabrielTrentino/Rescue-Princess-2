// Coordena ataques básicos e golpes reutilizados pelas habilidades:
// golpes corpo a corpo em arco, projéteis, empurrões, atordoamentos e lentidão.
import { angleDiff, angleTo, dist, fromAngle, normalize } from '../core/math.js';
import { hasLineOfSight } from '../world/CollisionSystem.js';
import { Projectile } from '../entities/Projectile.js';
import { dealDamage } from './DamageSystem.js';
import { edgeDistance, closestPoint } from '../world/Structures.js';

const DEG = Math.PI / 180;

// Alvo está vulnerável? (isolado, atordoado, lento ou com menos de metade da vida)
export function isVulnerable(world, target) {
  if (target.isStructure) return false;
  if (target.stunned || target.effects.multiplier('speedMult') < 0.95 || target.hpFraction < 0.5) return true;
  return !world.characters.some((c) => c !== target && c.alive && c.team === target.team && dist(c.pos, target.pos) < 200);
}

export function applyStun(world, target, duration, sourceId) {
  if (!target.alive || target.isStructure || duration <= 0) return;
  const d = duration * (1 - target.getStat('ccResist'));
  target.effects.add({ id: 'stun', duration: d, flags: { stunned: true }, sourceId: null, kind: 'control' });
  // Interrompe investidas do alvo, mas não empurrões/puxões que ele esteja sofrendo.
  if (target.motion && !target.motion.forced) target.motion = null;
  world.events.emit('status', { targetId: target.id, status: 'stun', duration: d, sourceId });
}

export function applySlow(world, target, mult, duration, sourceId, id = 'slow') {
  if (!target.alive || target.isStructure) return;
  const resist = target.getStat('ccResist');
  const effective = 1 - (1 - mult) * (1 - resist);
  target.effects.add({ id, duration, modifiers: { speedMult: effective }, sourceId, kind: 'control' });
}

// Empurra/puxa um alvo respeitando colisões. Resistência a controle reduz a distância.
export function applyForcedMove(target, dir, distance, kind = 'knockback') {
  if (!target.alive || target.isStructure || distance <= 0) return;
  const d = distance * (1 - target.getStat('ccResist') * 0.5);
  const n = normalize(dir.x, dir.y);
  target.motion = { dir: n, speed: kind === 'pull' ? 900 : 650, remaining: d, kind, forced: true };
}

/**
 * Golpe corpo a corpo em arco à frente do personagem.
 * Retorna a lista de alvos atingidos.
 */
export function meleeStrike(world, attacker, opts) {
  const { range, arc = 90, dmg = 1, maxTargets = Infinity, knockback = 0, stun = 0, slow = null,
    execute = null, vulnerableMult = 1, basic = false } = opts;
  const damageType = opts.damageType ?? attacker.classDef.attack.damageType;
  const half = (arc * DEG) / 2;
  const candidates = [];
  for (const target of world.enemyTargets(attacker.team)) {
    const gap = edgeDistance(target, attacker.pos);
    if (gap > range) continue;
    const point = closestPoint(target, attacker.pos);
    const close = gap < attacker.radius + 4;
    if (!close && Math.abs(angleDiff(attacker.facing, angleTo(attacker.pos, point))) > half) continue;
    // Construções bloqueiam a própria linha de visão; para elas basta estar encostado.
    if (!target.rect && !hasLineOfSight(world.map, attacker.pos, target.pos)) continue;
    candidates.push({ target, d: gap });
  }
  candidates.sort((a, b) => a.d - b.d);
  const hits = candidates.slice(0, maxTargets).map((c) => c.target);
  for (const target of hits) {
    let coef = dmg;
    if (execute && !target.isStructure && target.hpFraction < execute.threshold) coef = execute.dmg;
    if (vulnerableMult !== 1 && isVulnerable(world, target)) coef *= vulnerableMult;
    dealDamage(world, attacker, target, { base: attacker.attrs.damage * coef, type: damageType, basic });
    if (knockback) applyForcedMove(target, { x: target.pos.x - attacker.pos.x, y: target.pos.y - attacker.pos.y }, knockback);
    if (stun) applyStun(world, target, stun, attacker.id);
    if (slow) applySlow(world, target, slow.mult, slow.duration, attacker.id);
  }
  return hits;
}

export function fireProjectile(world, owner, opts) {
  const dir = fromAngle(opts.angle ?? owner.facing);
  const start = {
    x: owner.pos.x + dir.x * (owner.radius + 4),
    y: owner.pos.y + dir.y * (owner.radius + 4),
  };
  const p = new Projectile({
    ownerId: owner.id,
    team: owner.team,
    pos: start,
    dir,
    speed: opts.speed,
    radius: opts.radius ?? 6,
    range: opts.range,
    base: opts.base ?? owner.attrs.damage * (opts.dmg ?? 1),
    damageType: opts.damageType ?? owner.classDef.attack.damageType,
    pierce: opts.pierce ?? 0,
    knockback: opts.knockback ?? 0,
    pull: opts.pull ?? false,
    stun: opts.stun ?? 0,
    critBonus: opts.critBonus ?? 0,
    basic: opts.basic ?? false,
    visual: opts.visual ?? owner.classDef.attack.visual ?? 'arrow',
    fromTower: opts.fromTower ?? false,
  });
  world.projectiles.push(p);
  world.events.emit('fx', { kind: 'shoot', x: start.x, y: start.y, visual: p.visual, ownerId: owner.id });
  return p;
}

export function onProjectileHit(world, p, target) {
  const owner = world.getEntity(p.ownerId);
  dealDamage(world, owner, target, { base: p.base, type: p.damageType, critBonus: p.critBonus, basic: p.basic });
  if (p.knockback) applyForcedMove(target, p.dir, p.knockback);
  if (p.pull && owner && owner.alive && !owner.isStructure) {
    const gap = dist(owner.pos, target.pos) - (owner.radius + target.radius + 14);
    if (gap > 0) applyForcedMove(target, { x: owner.pos.x - target.pos.x, y: owner.pos.y - target.pos.y }, gap / (1 - target.getStat('ccResist') * 0.5), 'pull');
  }
  if (p.stun) applyStun(world, target, p.stun, p.ownerId);
  world.events.emit('fx', { kind: 'hit', x: target.pos.x, y: target.pos.y, visual: p.visual });
}

// Ataque básico: respeita estado, alcance, direção e intervalo entre ataques.
export function tryBasicAttack(world, attacker) {
  if (!attacker.canAct || !attacker.cooldowns.isReady('basic')) return false;
  const atk = attacker.classDef.attack;
  if (atk.kind === 'melee') {
    meleeStrike(world, attacker, { range: attacker.attrs.range, arc: atk.arc, dmg: 1, basic: true });
    world.events.emit('fx', {
      kind: 'slash', x: attacker.pos.x, y: attacker.pos.y, angle: attacker.facing,
      range: attacker.attrs.range, arc: atk.arc, team: attacker.team, ownerId: attacker.id,
    });
  } else {
    fireProjectile(world, attacker, {
      speed: atk.projectileSpeed, range: attacker.attrs.range, dmg: 1, radius: atk.projectileRadius, basic: true,
    });
  }
  attacker.cooldowns.start('basic', attacker.getStat('attackInterval'));
  attacker.actionTimer = 0.12;
  attacker.lastAction = 'attack';
  attacker.attackAnim = 0.25;
  world.events.emit('attack', { attackerId: attacker.id });
  return true;
}
