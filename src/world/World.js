// Estado da simulação: personagens, construções, defesas, armas no chão, projéteis, zonas e ações agendadas.
// Não conhece DOM nem Canvas, então roda igualmente no navegador e nos testes (Node).
import { dist, normalize } from '../core/math.js';
import { moveCircle, resolveStatic } from './CollisionSystem.js';
import { NavGrid } from './Pathfinding.js';
import { tryBasicAttack, applyStun, onProjectileHit } from '../combat/CombatSystem.js';
import { tryUseAbility, updateZones, FAIL } from '../combat/AbilitySystem.js';
import { dealDamage, heal } from '../combat/DamageSystem.js';
import { updateBuildings, updateDefenses, destroyBuilding, destroyDefense, upgradeBuilding, edgeDistance } from './Structures.js';
import { updatePickup, startPickup, dropOnDeath, updateDrops } from './Weapons.js';
import { insideCastle } from './Terrain.js';

const navCache = new Map();

export class World {
  constructor({ map, config, rng, events }) {
    // Cópia própria dos obstáculos: trechos de muralha podem ser derrubados durante a partida.
    this.map = { ...map, obstacles: map.obstacles.map((o) => ({ ...o })) };
    this.config = config;
    this.rng = rng;
    this.events = events;
    if (!navCache.has(map.id)) navCache.set(map.id, new NavGrid(map));
    this.nav = navCache.get(map.id).cloneFor(this.map);
    this.characters = [];
    this.buildings = [];
    this.defenses = [];
    this.drops = [];
    this.gold = { blue: 0, red: 0 };
    this.projectiles = [];
    this.zones = [];
    this.tasks = [];
    this.time = 0;
    this.nextId = 1;
  }

  addCharacter(c) {
    this.characters.push(c);
    return c;
  }

  getCharacter(id) {
    return this.characters.find((c) => c.id === id) ?? null;
  }

  // Personagem, construção ou defesa com esse id.
  getEntity(id) {
    return this.getCharacter(id) ?? this.buildings.find((b) => b.id === id) ?? this.defenses.find((d) => d.id === id) ?? null;
  }

  // Liga ou desliga um obstáculo (muralha derrubada ou reconstruída) e atualiza a grade de navegação.
  setObstacleEnabled(rect, enabled) {
    if (!rect || rect.disabled === !enabled) return;
    rect.disabled = !enabled;
    this.nav.refreshRect(rect);
    if (enabled) for (const c of this.characters) if (c.alive) resolveStatic(c.pos, c.radius, this.map);
  }

  addGold(team, amount) {
    if (team in this.gold) this.gold[team] += amount;
  }

  // Tudo que a equipe `team` pode atacar: personagens, construções e defesas inimigas de pé.
  enemyTargets(team) {
    const list = [];
    for (const c of this.characters) if (c.alive && c.team !== team) list.push(c);
    for (const b of this.buildings) if (!b.destroyed && b.team !== team && b.team !== 'neutral') list.push(b);
    for (const d of this.defenses) if (d.alive && d.team !== team) list.push(d);
    return list;
  }

  // Construção aliada mais próxima de um personagem (para melhorar ou mostrar dicas).
  nearestOwnBuilding(c, range = 90) {
    let best = null;
    let bestD = range;
    for (const b of this.buildings) {
      if (b.destroyed || b.team !== c.team) continue;
      const d = edgeDistance(b, c.pos);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  destroyStructure(structure, attacker) {
    if (structure.rect) destroyBuilding(this, structure, attacker);
    else destroyDefense(this, structure, attacker);
  }

  // Agenda uma ação. Se ownerId for informado, a ação é cancelada se o dono morrer antes.
  schedule(delay, fn, ownerId = null) {
    this.tasks.push({ at: this.time + delay, fn, ownerId });
  }

  killCharacter(victim, killer) {
    if (!victim.alive) return;
    victim.alive = false;
    victim.hp = 0;
    victim.motion = null;
    victim.taunt = null;
    victim.effects.clear();
    victim.respawnTimer = this.config.respawnTime;
    victim.stats.deaths++;
    victim.arming = null;
    if (killer && killer !== victim && killer.stats.kills !== undefined && !killer.isStructure) killer.stats.kills++;
    if (killer && killer.team !== victim.team) this.addGold(killer.team, 20);
    dropOnDeath(this, victim);
    this.princess?.dropItem(victim);
    this.tasks = this.tasks.filter((t) => t.ownerId !== victim.id);
    victim.controller?.onDeath?.();
    this.events.emit('death', {
      victimId: victim.id, killerId: killer?.id ?? null, x: victim.pos.x, y: victim.pos.y, team: victim.team,
    });
  }

  update(dt) {
    this.time += dt;
    for (const c of this.characters) {
      if (c.alive && c.controller) c.controller.update(this, c, dt);
    }
    for (const c of this.characters) {
      if (c.alive) this.updateCharacter(c, dt);
    }
    this.separateCharacters();
    for (const p of this.projectiles) p.update(this, dt, (proj, target) => onProjectileHit(this, proj, target));
    this.projectiles = this.projectiles.filter((p) => p.alive);
    updateZones(this, dt);
    updateBuildings(this, dt);
    updateDefenses(this, dt);
    updateDrops(this, dt);
    this.addGold('blue', this.config.goldPerSecond * dt);
    this.addGold('red', this.config.goldPerSecond * dt);
    this.runTasks();
  }

  updateCharacter(c, dt) {
    c.effects.update(dt);
    c.cooldowns.update(dt);
    c.actionTimer = Math.max(0, c.actionTimer - dt);
    c.attackAnim = Math.max(0, c.attackAnim - dt);
    c.hurtTimer = Math.max(0, c.hurtTimer - dt);
    const res = c.classDef.resource;
    c.gainResource(res.regen * dt);
    if (c.taunt && (this.time > c.taunt.until || !this.getCharacter(c.taunt.sourceId)?.alive)) c.taunt = null;

    const intent = c.intent;
    const stunned = c.stunned;
    c.moving = false;

    // F: a princesa tem prioridade sobre as armas do chão.
    const carrying = this.princess?.carrying(c) ?? null;
    if (c.arming) {
      updatePickup(this, c, dt);
    } else if (intent.interact && !stunned && !c.motion) {
      if (!this.princess?.interact(c)) startPickup(this, c);
    }
    intent.interact = false;
    if (intent.upgrade) {
      const b = this.nearestOwnBuilding(c);
      const result = b ? upgradeBuilding(this, b, c.team) : { ok: false, reason: 'nenhuma construção perto' };
      if (!result.ok) this.events.emit('upgradeFailed', { characterId: c.id, reason: result.reason });
      intent.upgrade = false;
    }

    if (c.motion) {
      this.updateMotion(c, dt);
    } else if (!stunned && !c.arming) {
      const m = intent.move;
      const len = Math.hypot(m.x, m.y);
      if (len > 0.05) {
        // Normaliza para que a diagonal não seja mais rápida que o movimento reto.
        const n = len > 1 ? { x: m.x / len, y: m.y / len } : m;
        let speed = c.getStat('speed') * (c.actionTimer > 0 ? 0.4 : 1);
        // Aldeões correm 80% mais dentro do próprio castelo; carregar a princesa pesa.
        if (c.classId === 'villager' && insideCastle(this.map, c.team, c.pos.x, c.pos.y)) speed *= 1.8;
        if (carrying) speed *= this.princess.speedMultiplier(c);
        moveCircle(this.map, c.pos, c.radius, n.x * speed * dt, n.y * speed * dt);
        this.pushOutOfDefenses(c);
        c.moving = true;
        c.moveDir = n;
      }
    }

    if (!stunned && !c.motion && !c.arming) {
      // Olha para a mira; sem mira (ou carregando a princesa), olha para onde anda.
      const aim = carrying ? null : intent.aim;
      if (aim) {
        const dx = aim.x - c.pos.x;
        const dy = aim.y - c.pos.y;
        if (dx * dx + dy * dy > 4) c.facing = Math.atan2(dy, dx);
      } else if (c.moving && c.moveDir) {
        c.facing = Math.atan2(c.moveDir.y, c.moveDir.x);
      }
    }

    if (!stunned && !c.motion && !c.arming && !carrying) {
      // Habilidades pressionadas durante a trava curta ficam em espera por um instante.
      if (c.bufferedAbility && this.time > c.bufferedAbility.until) c.bufferedAbility = null;
      const requested = [...intent.abilities];
      if (c.bufferedAbility && requested.length === 0) requested.push(c.bufferedAbility.index);
      for (const index of requested) {
        const result = tryUseAbility(this, c, index, intent.aim);
        if (result.ok) {
          c.bufferedAbility = null;
          break;
        }
        if (result.reason === FAIL.BUSY) c.bufferedAbility = { index, until: this.time + 0.3 };
        else if (c.bufferedAbility?.index === index) c.bufferedAbility = null;
      }
      if (intent.attack) tryBasicAttack(this, c);
    }
    intent.abilities.length = 0;

    // Cura na própria base, desde que nenhum inimigo esteja dentro dela.
    const base = this.map.bases[c.team];
    if (base && c.hp < c.maxHp && dist(c.pos, base) < base.radius &&
        !this.characters.some((o) => o.alive && o.team !== c.team && dist(o.pos, base) < base.radius)) {
      heal(this, c, c.maxHp * this.config.baseHealPerSecond * dt, { silent: true });
    }
  }

  updateMotion(c, dt) {
    const m = c.motion;
    const step = Math.min(m.speed * dt, m.remaining);
    const moved = moveCircle(this.map, c.pos, c.radius, m.dir.x * step, m.dir.y * step);
    this.pushOutOfDefenses(c);
    m.remaining -= step;
    c.moving = true;
    if (m.hit) {
      for (const t of this.characters) {
        if (!t.alive || t.team === c.team || m.hitIds.has(t.id)) continue;
        if (dist(t.pos, c.pos) > c.radius + t.radius + 6) continue;
        m.hitIds.add(t.id);
        dealDamage(this, c, t, { base: c.attrs.damage * m.hit.dmg, type: c.classDef.attack.damageType });
        if (m.hit.stun) applyStun(this, t, m.hit.stun, c.id);
        this.events.emit('fx', { kind: 'hit', x: t.pos.x, y: t.pos.y, visual: 'impact' });
        if (m.stopOnHit) {
          c.motion = null;
          return;
        }
      }
    }
    if (m.remaining <= 0 || moved < step * 0.3) c.motion = null;
  }

  // Defesas (barricadas, torres...) são obstáculos circulares que podem surgir e sumir.
  pushOutOfDefenses(c) {
    for (const d of this.defenses) {
      if (!d.alive || d.kind === 'trap') continue;
      const dx = c.pos.x - d.pos.x;
      const dy = c.pos.y - d.pos.y;
      const min = c.radius + d.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const len = Math.sqrt(d2) || 1;
      c.pos.x = d.pos.x + (dx / len) * min;
      c.pos.y = d.pos.y + (dy / len) * min;
      resolveStatic(c.pos, c.radius, this.map);
    }
  }

  // Personagens não se sobrepõem: separação simples par a par.
  separateCharacters() {
    const list = this.characters.filter((c) => c.alive);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const min = a.radius + b.radius;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        const n = d > 1e-6 ? { x: dx / d, y: dy / d } : normalize(this.rng() - 0.5, this.rng() - 0.5);
        const push = (min - d) / 2;
        a.pos.x -= n.x * push;
        a.pos.y -= n.y * push;
        b.pos.x += n.x * push;
        b.pos.y += n.y * push;
        resolveStatic(a.pos, a.radius, this.map);
        resolveStatic(b.pos, b.radius, this.map);
        this.pushOutOfDefenses(a);
        this.pushOutOfDefenses(b);
      }
    }
  }

  runTasks() {
    if (this.tasks.length === 0) return;
    const due = this.tasks.filter((t) => t.at <= this.time);
    if (due.length === 0) return;
    this.tasks = this.tasks.filter((t) => t.at > this.time);
    for (const t of due) t.fn(this);
  }
}
