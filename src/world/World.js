// Estado da simulação: personagens, projéteis, zonas e ações agendadas.
// Não conhece DOM nem Canvas, então roda igualmente no navegador e nos testes (Node).
import { dist, normalize } from '../core/math.js';
import { moveCircle, resolveStatic } from './CollisionSystem.js';
import { NavGrid } from './Pathfinding.js';
import { tryBasicAttack, applyStun, onProjectileHit } from '../combat/CombatSystem.js';
import { tryUseAbility, updateZones, FAIL } from '../combat/AbilitySystem.js';
import { dealDamage, heal } from '../combat/DamageSystem.js';

const navCache = new Map();

export class World {
  constructor({ map, config, rng, events }) {
    this.map = map;
    this.config = config;
    this.rng = rng;
    this.events = events;
    if (!navCache.has(map.id)) navCache.set(map.id, new NavGrid(map));
    this.nav = navCache.get(map.id);
    this.characters = [];
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
    if (killer && killer !== victim) killer.stats.kills++;
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
    this.runTasks();
  }

  updateCharacter(c, dt) {
    c.effects.update(dt);
    c.cooldowns.update(dt);
    c.actionTimer = Math.max(0, c.actionTimer - dt);
    c.attackAnim = Math.max(0, c.attackAnim - dt);
    c.hurtTimer = Math.max(0, c.hurtTimer - dt);
    if (c.taunt && (this.time > c.taunt.until || !this.getCharacter(c.taunt.sourceId)?.alive)) c.taunt = null;

    const intent = c.intent;
    const stunned = c.stunned;
    c.moving = false;

    if (c.motion) {
      this.updateMotion(c, dt);
    } else if (!stunned) {
      const m = intent.move;
      const len = Math.hypot(m.x, m.y);
      if (len > 0.05) {
        // Normaliza para que a diagonal não seja mais rápida que o movimento reto.
        const n = len > 1 ? { x: m.x / len, y: m.y / len } : m;
        const speed = c.getStat('speed') * (c.actionTimer > 0 ? 0.4 : 1);
        moveCircle(this.map, c.pos, c.radius, n.x * speed * dt, n.y * speed * dt);
        c.moving = true;
      }
    }

    if (!stunned && !c.motion && intent.aim) {
      const dx = intent.aim.x - c.pos.x;
      const dy = intent.aim.y - c.pos.y;
      if (dx * dx + dy * dy > 4) c.facing = Math.atan2(dy, dx);
    }

    if (!stunned && !c.motion) {
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
