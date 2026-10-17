// Construções do mapa (fabricam armas, recebem upgrades e podem ser destruídas) e defesas
// erguidas pelo Engenheiro (barricada, torre de flechas, catapulta, armadilha).
// Tudo aqui é lógica pura: não conhece Three.js nem DOM.
import { dist, angleTo } from '../core/math.js';
import { circleIntersectsRect, pointBlocked } from './CollisionSystem.js';
import { dealDamage } from '../combat/DamageSystem.js';
import { applyStun, fireProjectile } from '../combat/CombatSystem.js';
import { spawnWeaponDrop } from './Weapons.js';

// Efeitos de estado não se aplicam a construções.
const NO_EFFECTS = Object.freeze({
  multiplier: () => 1,
  has: () => false,
  add: () => {},
  clear: () => {},
  list: [],
});

// Tipos de construção. classId = classe cuja arma a construção fabrica (null = não fabrica).
export const BUILDING_TYPES = Object.freeze({
  castle: { name: 'Castelo', classId: null, hp: 3200, armor: 45 },
  barracks: { name: 'Quartel', classId: 'warrior', hp: 1400, armor: 30 },
  lumbermill: { name: 'Serraria', classId: 'barbarian', hp: 1300, armor: 25 },
  magetower: { name: 'Torre do Mago', classId: 'mage', hp: 1200, armor: 20 },
  archeryrange: { name: 'Campo de Tiro', classId: 'archer', hp: 1200, armor: 20 },
  tavern: { name: 'Taverna', classId: 'mercenary', hp: 1200, armor: 20 },
  blacksmith: { name: 'Ferraria', classId: 'halberdier', hp: 1400, armor: 30 },
  mine: { name: 'Mina', classId: 'engineer', hp: 1300, armor: 30 },
  market: { name: 'Mercado', classId: null, hp: 1000, armor: 15, goldPerSecond: 3 },
  // Ponto fraco da muralha do castelo: derrubado, abre passagem; só a própria equipe o reconstrói.
  wallGate: { name: 'Muralha', classId: null, hp: 900, armor: 35, maxLevel: 1, ownTeamOnly: true },
  // Torre principal: muita vida e muito dano, menos contra Guerreiros e Bárbaros (que sabem enfrentá-la).
  tower: {
    name: 'Torre principal', classId: null, hp: 3000, armor: 40, ownTeamOnly: true,
    attack: { range: 430, interval: 1.0, damage: 42, resisted: ['warrior', 'barbarian'], resistMult: 0.3 },
  },
});

export const MAX_LEVEL = 3;
export const UPGRADE_COST = Object.freeze({ 2: 150, 3: 300 });
// Segundos para fabricar uma nova arma, por nível.
export const PRODUCTION_TIME = Object.freeze({ 1: 14, 2: 10, 3: 7 });
// Quantas armas cabem no suporte de cada construção.
export const RACK_CAPACITY = 2;
export const REBUILD_FRACTION = 0.35;

export const DEFENSE_TYPES = Object.freeze({
  barricade: { name: 'Barricada', hp: 420, armor: 40, radius: 26 },
  // A torre do Engenheiro evolui quando a segunda barra (enchida por reparos) completa:
  // Torre de Flechas → Torre de Canhão → Torre Real.
  arrowTower: { name: 'Torre de Flechas', hp: 320, armor: 25, radius: 24, range: 400, interval: 1.1, damage: 16, evolvesTo: 'catapult', level: 1 },
  catapult: { name: 'Torre de Canhão', hp: 420, armor: 30, radius: 26, range: 620, minRange: 120, interval: 3.2, damage: 46, splash: 95, evolvesTo: 'royalTower', level: 2 },
  royalTower: { name: 'Torre Real', hp: 560, armor: 40, radius: 28, range: 480, interval: 0.6, damage: 24, level: 3 },
  trap: { name: 'Armadilha', hp: 70, armor: 0, radius: 18, trigger: 34, damage: 40, stun: 1 },
});
export const MAX_DEFENSES_PER_ENGINEER = 10;

let nextStructureId = 100000;

class Structure {
  constructor({ team, x, y, hp, armor }) {
    this.id = nextStructureId++;
    this.team = team;
    this.pos = { x, y };
    this.maxHp = hp;
    this.hp = hp;
    this.armorValue = armor;
    this.effects = NO_EFFECTS;
    this.lastHitBy = null;
    this.hurtTimer = 0;
    this.stats = { damageDealt: 0 };
  }

  get isStructure() {
    return true;
  }

  get hpFraction() {
    return this.hp / this.maxHp;
  }

  getStat(name) {
    return name === 'armor' ? this.armorValue : 0;
  }
}

export class Building extends Structure {
  constructor({ kind, team, rect, level = 1, destroyed = false, rackSide = 1 }) {
    const type = BUILDING_TYPES[kind];
    super({ team, x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, hp: type.hp, armor: type.armor });
    this.kind = kind;
    this.type = type;
    this.rect = rect;
    this.level = level;
    this.baseHp = type.hp;
    this.classId = type.classId;
    this.destroyed = destroyed;
    // Torres atiram de fora do próprio retângulo.
    this.radius = type.attack ? Math.hypot(rect.w, rect.h) / 2 + 4 : Math.min(rect.w, rect.h) / 2;
    // Suporte de armas em frente à construção (voltado para o centro do mapa).
    this.rack = { x: this.pos.x + rackSide * (rect.w / 2 + 46), y: this.pos.y };
    this.produceTimer = 0;
    this.originalTeam = team;
    this.attackTimer = 0;
    this.facing = rackSide > 0 ? 0 : Math.PI;
    this.obstacle = null; // retângulo de colisão ligado a esta construção (definido pela partida)
    this.applyLevel();
    if (destroyed) this.hp = 0;
  }

  get alive() {
    return !this.destroyed;
  }

  applyLevel() {
    const frac = this.maxHp ? this.hp / this.maxHp : 1;
    this.maxHp = Math.round(this.baseHp * (1 + 0.3 * (this.level - 1)));
    this.hp = Math.round(this.maxHp * frac);
  }

  get upgradeCost() {
    return this.level < (this.type.maxLevel ?? MAX_LEVEL) ? UPGRADE_COST[this.level + 1] : null;
  }
}

export class Defense extends Structure {
  constructor({ kind, team, x, y, ownerId }) {
    const type = DEFENSE_TYPES[kind];
    super({ team, x, y, hp: type.hp, armor: type.armor });
    this.kind = kind;
    this.type = type;
    this.ownerId = ownerId;
    this.radius = type.radius;
    this.alive = true;
    this.timer = type.interval ? type.interval * 0.5 : 0;
    this.facing = 0;
    this.fireAnim = 0;
    this.evolve = 0; // segunda barra: ao encher, a torre evolui
  }
}

// Distância até a borda de um alvo (personagem, construção ou defesa).
export function edgeDistance(target, p) {
  if (target.rect) {
    const r = target.rect;
    const cx = Math.max(r.x, Math.min(p.x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(p.y, r.y + r.h));
    return Math.hypot(p.x - cx, p.y - cy);
  }
  return Math.max(0, dist(p, target.pos) - target.radius);
}

// Ponto do alvo mais próximo de p (para mirar em construções grandes).
export function closestPoint(target, p) {
  if (target.rect) {
    const r = target.rect;
    return { x: Math.max(r.x, Math.min(p.x, r.x + r.w)), y: Math.max(r.y, Math.min(p.y, r.y + r.h)) };
  }
  return target.pos;
}

// ---------- Construções ----------

export function updateBuildings(world, dt) {
  for (const b of world.buildings) {
    b.hurtTimer = Math.max(0, b.hurtTimer - dt);
    if (b.destroyed) continue;
    if (b.type.goldPerSecond) world.addGold(b.team, b.type.goldPerSecond * dt);
    if (b.type.attack) updateTowerAttack(world, b, dt);
    if (!b.classId) continue;
    // Fabrica armas enquanto houver espaço no suporte.
    const onRack = world.drops.filter((d) => d.buildingId === b.id).length;
    if (onRack >= RACK_CAPACITY) {
      b.produceTimer = 0;
      continue;
    }
    b.produceTimer += dt;
    if (b.produceTimer >= PRODUCTION_TIME[b.level]) {
      b.produceTimer = 0;
      const slot = onRack === 0 ? -1 : 1;
      spawnWeaponDrop(world, { classId: b.classId, tier: b.level, x: b.rack.x, y: b.rack.y + slot * 22, buildingId: b.id });
    }
  }
}

// Torre principal: atira na pessoa inimiga mais próxima; o dano cresce com o nível da torre.
function updateTowerAttack(world, b, dt) {
  const atk = b.type.attack;
  b.attackTimer -= dt;
  if (b.attackTimer > 0) return;
  const target = nearestEnemy(world, b, atk.range + b.radius);
  if (!target) {
    b.attackTimer = 0.3;
    return;
  }
  b.attackTimer = atk.interval;
  b.facing = angleTo(b.pos, target.pos);
  const mult = (atk.resisted.includes(target.classId) ? atk.resistMult : 1) * (1 + 0.25 * (b.level - 1));
  fireProjectile(world, b, {
    speed: 760, range: atk.range + b.radius + 40, radius: 7, visual: 'arrowBig', base: atk.damage * mult,
    damageType: 'physical', fromTower: true,
  });
}

/** Melhora uma construção da própria equipe, pagando com o ouro da equipe. */
export function upgradeBuilding(world, building, team) {
  if (!building || building.destroyed || building.team !== team) return { ok: false, reason: 'indisponível' };
  const cost = building.upgradeCost;
  if (cost === null) return { ok: false, reason: 'nível máximo' };
  if (world.gold[team] < cost) return { ok: false, reason: 'ouro insuficiente' };
  world.gold[team] -= cost;
  building.level++;
  building.applyLevel();
  building.hp = Math.min(building.maxHp, building.hp + building.maxHp * 0.3);
  world.events.emit('buildingUpgraded', { buildingId: building.id, team, level: building.level, x: building.pos.x, y: building.pos.y });
  return { ok: true };
}

export function destroyBuilding(world, building, attacker) {
  if (building.destroyed) return;
  building.destroyed = true;
  building.hp = 0;
  const loser = building.team;
  // A arma no suporte cai junto com a construção, e qualquer um pode pegá-la.
  for (const d of world.drops) if (d.buildingId === building.id) d.buildingId = null;
  // Trecho de muralha derrubado deixa de bloquear a passagem.
  if (building.kind === 'wallGate') world.setObstacleEnabled?.(building.obstacle, false);
  if (attacker) world.addGold(attacker.team, 60);
  world.events.emit('buildingDestroyed', {
    buildingId: building.id, kind: building.kind, team: loser, byTeam: attacker?.team ?? null, x: building.pos.x, y: building.pos.y,
  });
}

/** Reconstrói ruínas para a equipe de quem reconstrói. */
export function rebuildBuilding(world, building, team) {
  if (!building.destroyed) return false;
  if (building.type.ownTeamOnly && building.originalTeam !== team) return false;
  building.destroyed = false;
  if (building.kind === 'wallGate') world.setObstacleEnabled?.(building.obstacle, true);
  building.team = team;
  building.level = 1;
  building.maxHp = building.baseHp;
  building.hp = Math.round(building.maxHp * (building.kind === 'wallGate' ? 0.6 : REBUILD_FRACTION));
  building.produceTimer = 0;
  world.events.emit('buildingRebuilt', { buildingId: building.id, team, x: building.pos.x, y: building.pos.y });
  return true;
}

// ---------- Defesas do Engenheiro ----------

export function canPlaceDefense(world, kind, x, y) {
  const r = DEFENSE_TYPES[kind].radius;
  if (pointBlocked(world.map, x, y, r + 4)) return false;
  if (world.defenses.some((d) => d.alive && dist(d.pos, { x, y }) < d.radius + r + 6)) return false;
  if (world.characters.some((c) => c.alive && dist(c.pos, { x, y }) < c.radius + r)) return false;
  // Não bloqueia a praça das bases nem os suportes de armas.
  if (world.buildings.some((b) => b.rack && dist(b.rack, { x, y }) < r + 30)) return false;
  return true;
}

export function placeDefense(world, engineer, kind, point) {
  const own = world.defenses.filter((d) => d.alive && d.ownerId === engineer.id);
  if (own.length >= MAX_DEFENSES_PER_ENGINEER) return { ok: false, reason: 'limite de defesas' };
  // Procura um lugar livre perto do ponto pedido.
  const candidates = [point];
  for (let ring = 1; ring <= 3; ring++) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      candidates.push({ x: point.x + Math.cos(a) * ring * 22, y: point.y + Math.sin(a) * ring * 22 });
    }
  }
  const spot = candidates.find((p) => canPlaceDefense(world, kind, p.x, p.y));
  if (!spot) return { ok: false, reason: 'local inválido' };
  const d = new Defense({ kind, team: engineer.team, x: spot.x, y: spot.y, ownerId: engineer.id });
  d.facing = engineer.facing;
  world.defenses.push(d);
  world.events.emit('defenseBuilt', { defenseId: d.id, kind, team: d.team, x: d.pos.x, y: d.pos.y, ownerId: engineer.id });
  return { ok: true, defense: d };
}

export function destroyDefense(world, defense, attacker) {
  if (!defense.alive) return;
  defense.alive = false;
  defense.hp = 0;
  if (attacker) world.addGold(attacker.team, 10);
  world.events.emit('defenseDestroyed', { defenseId: defense.id, kind: defense.kind, team: defense.team, x: defense.pos.x, y: defense.pos.y });
}

function nearestEnemy(world, d, range, minRange = 0) {
  let best = null;
  let bestD = Infinity;
  for (const c of world.characters) {
    if (!c.alive || c.team === d.team) continue;
    const dd = dist(c.pos, d.pos);
    if (dd > range || dd < minRange || dd >= bestD) continue;
    bestD = dd;
    best = c;
  }
  return best;
}

export function updateDefenses(world, dt) {
  for (const d of world.defenses) {
    if (!d.alive) continue;
    d.hurtTimer = Math.max(0, d.hurtTimer - dt);
    d.fireAnim = Math.max(0, d.fireAnim - dt);
    const type = d.type;
    if (d.kind === 'trap') {
      const victim = world.characters.find((c) => c.alive && c.team !== d.team && dist(c.pos, d.pos) < type.trigger + c.radius);
      if (victim) {
        dealDamage(world, d, victim, { base: type.damage, type: 'physical', canCrit: false });
        applyStun(world, victim, type.stun, d.id);
        world.events.emit('fx', { kind: 'aoe', x: d.pos.x, y: d.pos.y, radius: 40, visual: 'spikes', team: d.team });
        destroyDefense(world, d, null);
      }
      continue;
    }
    if (!type.interval) continue;
    d.timer -= dt;
    if (d.timer > 0) continue;
    const target = nearestEnemy(world, d, type.range, type.minRange ?? 0);
    if (!target) {
      d.timer = 0.3;
      continue;
    }
    d.timer = type.interval;
    d.facing = angleTo(d.pos, target.pos);
    d.fireAnim = 0.4;
    if (d.kind === 'arrowTower' || d.kind === 'royalTower') {
      const royal = d.kind === 'royalTower';
      fireProjectile(world, d, {
        speed: royal ? 820 : 700, range: type.range + 20, radius: royal ? 7 : 5, visual: royal ? 'arrowBig' : 'arrow',
        base: type.damage, damageType: 'physical', fromTower: true, pierce: royal ? 1 : 0,
      });
    } else if (d.kind === 'catapult') {
      // Mira onde o alvo vai estar e cai depois de um tempo de voo.
      const at = { x: target.pos.x, y: target.pos.y };
      const flight = 1.1;
      world.events.emit('fx', { kind: 'boulder', x: d.pos.x, y: d.pos.y, tx: at.x, ty: at.y, duration: flight, team: d.team });
      world.events.emit('fx', { kind: 'telegraph', x: at.x, y: at.y, radius: type.splash, duration: flight, team: d.team, visual: 'boulder' });
      world.schedule(flight, () => {
        for (const t of world.enemyTargets(d.team)) {
          if (edgeDistance(t, at) > type.splash) continue;
          dealDamage(world, d, t, { base: type.damage, type: 'physical', canCrit: false });
        }
        world.events.emit('fx', { kind: 'aoe', x: at.x, y: at.y, radius: type.splash, visual: 'boulder', team: d.team });
      });
    }
  }
  world.defenses = world.defenses.filter((d) => d.alive);
}

/** Reparo do Engenheiro: conserta a construção/defesa aliada mais danificada perto, ou reconstrói ruínas. */
export function repairNear(world, engineer, radius, amount) {
  const near = (s) => edgeDistance(s, engineer.pos) <= radius;
  const ruin = world.buildings.find((b) => b.destroyed && near(b) && (!b.type.ownTeamOnly || b.originalTeam === engineer.team));
  if (ruin) {
    rebuildBuilding(world, ruin, engineer.team);
    return { ok: true, target: ruin, rebuilt: true };
  }
  const damaged = [...world.buildings.filter((b) => !b.destroyed), ...world.defenses]
    .filter((s) => s.team === engineer.team && s.hp < s.maxHp && near(s))
    .sort((a, b) => a.hpFraction - b.hpFraction)[0];
  // Nada danificado: o reparo vai para a segunda barra de uma torre que pode evoluir.
  const evolvable = world.defenses.find((d) => d.team === engineer.team && d.type.evolvesTo && near(d));
  const target = damaged ?? evolvable;
  if (!target) return { ok: false, reason: 'nada para reparar' };
  const healed = Math.min(amount, target.maxHp - target.hp);
  target.hp += healed;
  if (healed > 0) world.events.emit('heal', { targetId: target.id, amount: healed, x: target.pos.x, y: target.pos.y });
  // O que sobra do reparo enche a barra de evolução da torre.
  if (target.type?.evolvesTo && amount > healed) chargeEvolution(world, target, amount - healed);
  return { ok: true, target };
}

/** Enche a segunda barra de uma torre do Engenheiro; cheia, a torre vira o próximo tipo. */
export function chargeEvolution(world, d, amount) {
  if (!d.alive || !d.type.evolvesTo) return false;
  d.evolve = Math.min(d.maxHp, d.evolve + amount);
  if (d.evolve < d.maxHp) return false;
  const kind = d.type.evolvesTo;
  const type = DEFENSE_TYPES[kind];
  d.kind = kind;
  d.type = type;
  d.maxHp = type.hp;
  d.hp = type.hp;
  d.armorValue = type.armor;
  d.radius = type.radius;
  d.evolve = 0;
  d.timer = Math.min(d.timer, 0.5);
  world.events.emit('defenseEvolved', { defenseId: d.id, kind, name: d.type.name, team: d.team, x: d.pos.x, y: d.pos.y });
  return true;
}

// Um ponto está dentro de alguma construção? (para projéteis)
export function buildingAt(world, x, y, r) {
  return world.buildings.find((b) => circleIntersectsRect(x, y, r, b.rect)) ?? null;
}

