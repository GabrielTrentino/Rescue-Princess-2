// Pontos de surgimento ao redor da base de cada equipe e reaparecimento após a morte.
import { pointBlocked } from '../world/CollisionSystem.js';
import { becomeVillager } from '../world/Weapons.js';

export function spawnPoint(map, team, index, radius = 20) {
  const base = map.bases[team];
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = (index * 2.39996 + attempt * 0.7) % (Math.PI * 2);
    const r = 30 + ((index + attempt) % 3) * 30;
    const x = base.x + Math.cos(angle) * r;
    const y = base.y + Math.sin(angle) * r;
    if (!pointBlocked(map, x, y, radius)) return { x, y };
  }
  return { x: base.x, y: base.y };
}

export function updateRespawns(world, dt) {
  let i = 0;
  for (const c of world.characters) {
    i++;
    if (c.alive) continue;
    c.respawnTimer -= dt;
    if (c.respawnTimer > 0) continue;
    const p = spawnPoint(world.map, c.team, i + Math.floor(world.time), c.radius);
    // Renasce sem arma: a arma ficou no chão onde caiu.
    becomeVillager(c);
    c.resetForSpawn(p.x, p.y);
    c.controller?.onRespawn?.();
    world.events.emit('respawn', { id: c.id, x: p.x, y: p.y });
  }
}
