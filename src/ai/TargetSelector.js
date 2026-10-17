// Escolha de alvos para bots: respeita provocação, fumaça, linha de visão e prioriza alvos próximos e feridos.
import { dist } from '../core/math.js';
import { hasLineOfSight } from '../world/CollisionSystem.js';
import { edgeDistance } from '../world/Structures.js';

// Um personagem dentro de uma fumaça da própria equipe não pode ser mirado por bots (exceto muito de perto).
export function isHiddenFrom(world, target, observer) {
  if (dist(target.pos, observer.pos) < 70) return false;
  return world.zones.some((z) => z.smoke && z.team === target.team && dist(target.pos, z) <= z.radius);
}

export function isValidTarget(world, bot, target, range) {
  return target && target.alive && target.team !== bot.team &&
    dist(bot.pos, target.pos) <= range && !isHiddenFrom(world, target, bot);
}

export function selectTarget(world, bot, { range, current = null, anchor = null, leash = Infinity }) {
  // Provocação: bots provocados priorizam o provocador enquanto o efeito durar.
  if (bot.taunt) {
    const src = world.getCharacter(bot.taunt.sourceId);
    if (src && src.alive && dist(src.pos, bot.pos) < 600) return src;
  }
  let best = null;
  let bestScore = Infinity;
  for (const c of world.characters) {
    if (!isValidTarget(world, bot, c, c === current ? range * 1.3 : range)) continue;
    if (anchor && dist(c.pos, anchor) > leash) continue;
    const d = dist(bot.pos, c.pos);
    if (c !== current && !hasLineOfSight(world.map, bot.pos, c.pos)) continue;
    let score = d + c.hpFraction * 120;
    if (c === current) score -= 80;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export function countEnemiesNear(world, bot, radius) {
  let n = 0;
  for (const c of world.characters) {
    if (c.alive && c.team !== bot.team && dist(c.pos, bot.pos) <= radius) n++;
  }
  return n;
}

export function countAlliesNear(world, bot, radius) {
  let n = 0;
  for (const c of world.characters) {
    if (c !== bot && c.alive && c.team === bot.team && dist(c.pos, bot.pos) <= radius) n++;
  }
  return n;
}

// Construção ou defesa inimiga mais próxima dentro do alcance (alvo quando não há personagens).
export function selectStructureTarget(world, bot, { range, current = null }) {
  if (current && current.isStructure && current.alive && edgeDistance(current, bot.pos) <= range * 1.3) return current;
  let best = null;
  let bestD = range;
  for (const b of world.buildings) {
    if (b.destroyed || b.team === bot.team || b.team === 'neutral') continue;
    const d = edgeDistance(b, bot.pos) + (b.kind === 'castle' ? -150 : 0);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  for (const s of world.defenses) {
    if (!s.alive || s.team === bot.team || s.kind === 'trap') continue;
    const d = edgeDistance(s, bot.pos) - 80; // defesas atrapalham mais: prioridade maior
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
