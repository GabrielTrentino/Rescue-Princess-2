// Objetivo da partida: resgatar a própria princesa, presa no castelo inimigo, e levá-la para casa.
// Coxinhas de frango espalhadas pelo mapa engordam a princesa prisioneira (mais pesada, mais lenta
// de carregar); seringas Jonmaros emagrecem a própria princesa em um nível.
// Lógica pura: não conhece Three.js nem DOM.
import { dist } from '../core/math.js';
import { TEAMS, otherTeam } from '../config.js';

export const PRINCESS_MAX_LEVEL = 5;
export const COXINHAS_PER_LEVEL = 4;
export const CARRY_RANGE = 60;      // distância para pegar a princesa (F)
export const FEED_RANGE = 80;       // distância para entregar coxinha ou seringa
export const ITEM_RADIUS = 30;      // distância para apanhar um item do chão
export const RETURN_TIME = 20;      // princesa largada no chão volta à prisão depois disso
export const COXINHA_RESPAWN = 22;
export const SYRINGE_RESPAWN = 30;
export const RESCUE_SPEED = [0.85, 0.75, 0.65, 0.55, 0.47, 0.4]; // multiplicador de velocidade por nível

let nextItemId = 1;

export class PrincessObjective {
  constructor(world) {
    this.world = world;
    const map = world.map;
    this.princesses = {};
    for (const team of [TEAMS.BLUE, TEAMS.RED]) {
      const prison = map.prisons?.[team] ?? map.bases[otherTeam(team)];
      this.princesses[team] = {
        team, prison: { x: prison.x, y: prison.y }, pos: { x: prison.x, y: prison.y },
        carrierId: null, level: 0, satiety: 0, dropTimer: 0, state: 'captive',
      };
    }
    this.items = [];
    this.spots = [
      ...(map.coxinhaSpots ?? []).map((p) => ({ ...p, kind: 'coxinha', item: null, timer: 2 })),
      ...(map.syringeSpots ?? []).map((p) => ({ ...p, kind: 'syringe', item: null, timer: 10 })),
    ];
    this.winner = null;
    world.princess = this;
  }

  // ---------- Consultas usadas pela IA, pela interface e pelo mundo ----------
  carrierOf(team) {
    const id = this.princesses[team].carrierId;
    return id ? this.world.getCharacter(id) : null;
  }

  carrying(c) {
    return Object.values(this.princesses).find((p) => p.carrierId === c.id) ?? null;
  }

  speedMultiplier(c) {
    const p = this.carrying(c);
    return p ? RESCUE_SPEED[p.level] : 1;
  }

  // ---------- Ações dos personagens ----------

  /** F perto da própria princesa: pega ou larga. Retorna true se a tecla foi usada aqui. */
  interact(c) {
    const held = this.carrying(c);
    if (held) {
      this.drop(held);
      return true;
    }
    const p = this.princesses[c.team];
    if (p.carrierId || dist(c.pos, p.pos) > CARRY_RANGE || c.arming) return false;
    p.carrierId = c.id;
    p.state = 'carried';
    this.world.events.emit('princess', { type: 'pickedUp', team: p.team, carrierId: c.id, x: c.pos.x, y: c.pos.y });
    return true;
  }

  drop(p, { returned = false } = {}) {
    const carrier = p.carrierId ? this.world.getCharacter(p.carrierId) : null;
    p.carrierId = null;
    if (returned) {
      p.pos = { ...p.prison };
      p.state = 'captive';
      this.world.events.emit('princess', { type: 'returned', team: p.team, x: p.pos.x, y: p.pos.y });
      return;
    }
    if (carrier) p.pos = { x: carrier.pos.x, y: carrier.pos.y };
    p.state = 'dropped';
    p.dropTimer = RETURN_TIME;
    this.world.events.emit('princess', { type: 'dropped', team: p.team, x: p.pos.x, y: p.pos.y });
  }

  feed(p, c) {
    if (c.stats) c.stats.coxinhas++;
    p.satiety += 1 / COXINHAS_PER_LEVEL;
    if (p.satiety >= 1 - 1e-6) {
      if (p.level < PRINCESS_MAX_LEVEL) {
        p.level++;
        p.satiety = 0;
        this.world.events.emit('princess', { type: 'levelUp', team: p.team, level: p.level, byId: c.id, x: p.pos.x, y: p.pos.y });
      } else p.satiety = 1;
    }
    this.world.events.emit('princess', { type: 'fed', team: p.team, byId: c.id, x: p.pos.x, y: p.pos.y });
  }

  slim(p, c) {
    if (c.stats) c.stats.syringes++;
    if (p.level > 0) p.level--;
    p.satiety = 0;
    this.world.events.emit('princess', { type: 'slimmed', team: p.team, level: p.level, byId: c.id, x: p.pos.x, y: p.pos.y });
  }

  // ---------- Atualização ----------
  update(dt) {
    const world = this.world;
    this.updateItems(dt);
    for (const p of Object.values(this.princesses)) {
      if (p.carrierId) {
        const carrier = world.getCharacter(p.carrierId);
        if (!carrier || !carrier.alive || carrier.stunned) {
          this.drop(p);
        } else {
          p.pos = { x: carrier.pos.x, y: carrier.pos.y };
          carrier.stats.carryTime += dt;
          const home = world.map.bases[p.team];
          if (dist(p.pos, home) <= home.radius && !this.winner) {
            this.winner = p.team;
            p.state = 'rescued';
            world.events.emit('objective', { type: 'rescued', team: p.team, x: p.pos.x, y: p.pos.y });
          }
        }
      } else if (p.state === 'dropped') {
        p.dropTimer -= dt;
        // A equipe que a mantinha presa a devolve à prisão só de encostar nela.
        const captor = world.characters.some((c) => c.alive && c.team !== p.team && dist(c.pos, p.pos) <= CARRY_RANGE);
        if (captor || p.dropTimer <= 0) this.drop(p, { returned: true });
      }
    }
    // Entregas: coxinha na princesa prisioneira do próprio castelo; seringa na própria princesa.
    for (const c of world.characters) {
      if (!c.alive || !c.heldItem) continue;
      if (c.heldItem === 'coxinha') {
        const captive = this.princesses[otherTeam(c.team)];
        if (!captive.carrierId && dist(c.pos, captive.pos) <= FEED_RANGE) {
          c.heldItem = null;
          this.feed(captive, c);
        }
      } else if (c.heldItem === 'syringe') {
        const own = this.princesses[c.team];
        if (dist(c.pos, own.pos) <= FEED_RANGE && own.level > 0) {
          c.heldItem = null;
          this.slim(own, c);
        }
      }
    }
    return this.winner;
  }

  updateItems(dt) {
    const world = this.world;
    for (const spot of this.spots) {
      if (spot.item) continue;
      spot.timer -= dt;
      if (spot.timer > 0) continue;
      spot.item = { id: nextItemId++, kind: spot.kind, pos: { x: spot.x, y: spot.y }, spot };
      this.items.push(spot.item);
    }
    for (const item of this.items) {
      const taker = world.characters.find((c) => c.alive && !c.heldItem && !this.carrying(c) && dist(c.pos, item.pos) <= ITEM_RADIUS + c.radius);
      if (!taker) continue;
      taker.heldItem = item.kind;
      item.taken = true;
      item.spot.item = null;
      item.spot.timer = item.kind === 'coxinha' ? COXINHA_RESPAWN : SYRINGE_RESPAWN;
      world.events.emit('itemPicked', { kind: item.kind, characterId: taker.id, x: item.pos.x, y: item.pos.y });
    }
    this.items = this.items.filter((i) => !i.taken);
  }

  /** Quem morre deixa cair o item que carregava. */
  dropItem(c) {
    if (!c.heldItem) return;
    const item = { id: nextItemId++, kind: c.heldItem, pos: { x: c.pos.x, y: c.pos.y }, spot: { item: null, timer: 0, loose: true } };
    c.heldItem = null;
    this.items.push(item);
  }

  // Ao fim do tempo, nenhuma princesa resgatada: decide quem chegou mais perto de levá-la para casa.
  decideOnTimeout() {
    const b = this.progress(TEAMS.BLUE);
    const r = this.progress(TEAMS.RED);
    if (Math.abs(b - r) < 0.05) return null;
    return b > r ? TEAMS.BLUE : TEAMS.RED;
  }

  /** Quanto falta (0 a 1) para a princesa da equipe chegar em casa desde a prisão. */
  progress(team) {
    const p = this.princesses[team];
    const home = this.world.map.bases[team];
    const total = dist(p.prison, home);
    return total > 0 ? Math.max(0, Math.min(1, 1 - dist(p.pos, home) / total)) : 0;
  }

  status() {
    return this.princesses;
  }
}
