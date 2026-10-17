// Armas no chão. Construções fabricam armas nos seus suportes e personagens derrotados derrubam a sua.
// Qualquer personagem (de qualquer equipe) pode pegar uma arma: leva um instante (animação de
// transformação) e o personagem vira a classe daquela arma. Quem já tem arma deixa a antiga no chão.
import { dist } from '../core/math.js';
import { getClass, VILLAGER } from '../classes/classDefinitions.js';

export const PICKUP_RANGE = 46;
export const PICKUP_TIME = 1.1;     // segundos da animação de transformação
export const DROP_LIFETIME = 90;    // armas derrubadas somem depois de um tempo (as dos suportes não)

let nextDropId = 1;

export function spawnWeaponDrop(world, { classId, tier = 1, x, y, buildingId = null }) {
  const drop = { id: nextDropId++, classId, tier, pos: { x, y }, buildingId, age: 0, claimedBy: null };
  world.drops.push(drop);
  world.events.emit('weaponSpawned', { dropId: drop.id, classId, tier, x, y, buildingId });
  return drop;
}

export function nearestDrop(world, c, range = PICKUP_RANGE) {
  let best = null;
  let bestD = range;
  for (const d of world.drops) {
    if (d.claimedBy && d.claimedBy !== c.id) continue;
    const dd = dist(d.pos, c.pos);
    if (dd <= bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

/** Começa a pegar a arma mais próxima. Retorna true se começou. */
export function startPickup(world, c) {
  if (!c.alive || c.arming || c.stunned || c.motion) return false;
  const drop = nearestDrop(world, c);
  if (!drop) return false;
  drop.claimedBy = c.id;
  c.arming = { dropId: drop.id, remaining: PICKUP_TIME, classId: drop.classId };
  c.actionTimer = 0;
  world.events.emit('pickupStart', { characterId: c.id, dropId: drop.id, classId: drop.classId });
  return true;
}

export function cancelPickup(world, c) {
  if (!c.arming) return;
  const drop = world.drops.find((d) => d.id === c.arming.dropId);
  if (drop) drop.claimedBy = null;
  c.arming = null;
}

export function updatePickup(world, c, dt) {
  if (!c.arming) return;
  if (c.stunned) {
    cancelPickup(world, c);
    return;
  }
  c.arming.remaining -= dt;
  if (c.arming.remaining > 0) return;
  const drop = world.drops.find((d) => d.id === c.arming.dropId);
  c.arming = null;
  if (!drop) return;
  world.drops = world.drops.filter((d) => d !== drop);
  // Quem já estava armado deixa a arma antiga no lugar.
  if (c.isArmed) spawnWeaponDrop(world, { classId: c.classId, tier: c.tier, x: c.pos.x, y: c.pos.y + 10 });
  const from = c.classId;
  c.setClass(getClass(drop.classId), drop.tier);
  world.events.emit('transform', { characterId: c.id, from, to: c.classId, tier: c.tier, x: c.pos.x, y: c.pos.y });
}

/** Ao morrer, o personagem derruba a arma (se tiver) e volta a ser aldeão ao renascer. */
export function dropOnDeath(world, c) {
  cancelPickup(world, c);
  if (!c.isArmed) return null;
  return spawnWeaponDrop(world, { classId: c.classId, tier: c.tier, x: c.pos.x, y: c.pos.y });
}

export function becomeVillager(c) {
  c.setClass(getClass(VILLAGER), 1);
  c.hp = c.maxHp;
}

export function updateDrops(world, dt) {
  for (const d of world.drops) if (!d.buildingId) d.age += dt;
  const before = world.drops.length;
  world.drops = world.drops.filter((d) => d.buildingId || d.age < DROP_LIFETIME || d.claimedBy);
  if (world.drops.length !== before) world.events.emit('dropsExpired', {});
}
