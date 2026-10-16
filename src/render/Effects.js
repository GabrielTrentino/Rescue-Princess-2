// Efeitos puramente visuais (partículas, números de dano, rastros de golpes).
// Assina eventos do jogo; nunca altera o estado da simulação.
import { FX_COLORS, TEAM_COLORS } from './palette.js';

export class Effects {
  constructor(events, { getCharacter, onShake, settings }) {
    this.items = [];
    this.getCharacter = getCharacter;
    this.onShake = onShake;
    this.settings = settings;
    this.unsubs = [
      events.on('damage', (e) => this.onDamage(e)),
      events.on('heal', (e) => this.floatText(e.x, e.y, `+${Math.round(e.amount)}`, '#6fe37a', 14)),
      events.on('death', (e) => this.onDeath(e)),
      events.on('status', (e) => {
        const t = this.getCharacter(e.targetId);
        if (t && e.status === 'stun') this.floatText(t.pos.x, t.pos.y, 'Atordoado!', '#ffe27a', 13, 0.9);
      }),
      events.on('fx', (e) => this.onFx(e)),
      events.on('respawn', (e) => this.ring(e.x, e.y, 40, '#ffffff', 0.5)),
    ];
  }

  dispose() {
    this.unsubs.forEach((u) => u());
  }

  clear() {
    this.items = [];
  }

  add(item) {
    this.items.push({ age: 0, ...item });
  }

  floatText(x, y, text, color, size = 15, life = 0.8) {
    this.add({ type: 'text', x, y, text, color, size, life, rise: 50 });
  }

  ring(x, y, radius, color, life = 0.35, width = 3) {
    this.add({ type: 'ring', x, y, radius, color, life, width });
  }

  sparks(x, y, color, count = 8, speed = 160, life = 0.35) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: life * (0.6 + Math.random() * 0.6), size: 2 + Math.random() * 2 });
    }
  }

  onDamage(e) {
    const target = this.getCharacter(e.targetId);
    const source = this.getCharacter(e.sourceId);
    if (this.settings.showDamageNumbers) {
      const color = e.crit ? '#ffd23f' : e.type === 'magic' ? '#d2b6ff' : '#ffffff';
      this.floatText(e.x + (Math.random() - 0.5) * 16, e.y, e.crit ? `${e.amount}!` : `${e.amount}`, color, e.crit ? 20 : 15);
    }
    this.sparks(e.x, e.y, e.crit ? '#ffd23f' : '#ffffff', e.crit ? 12 : 6, 140);
    if (target?.isPlayer) this.onShake(e.crit ? 6 : 3);
    else if (source?.isPlayer && e.crit) this.onShake(2);
  }

  onDeath(e) {
    const color = TEAM_COLORS[e.team].main;
    this.sparks(e.x, e.y, color, 22, 220, 0.6);
    this.sparks(e.x, e.y, '#ffffff', 10, 120, 0.5);
    this.ring(e.x, e.y, 50, color, 0.5, 4);
    this.add({ type: 'grave', x: e.x, y: e.y, life: 4, team: e.team });
  }

  onFx(e) {
    switch (e.kind) {
      case 'slash':
        this.add({ type: 'slash', x: e.x, y: e.y, angle: e.angle, range: e.range, arc: e.arc, life: e.ability ? 0.25 : 0.16, color: e.ability ? '#fff0b0' : '#ffffff', ownerId: e.ownerId });
        break;
      case 'impact':
      case 'hit':
        this.sparks(e.x, e.y, FX_COLORS[e.visual] ?? '#ffffff', 6, 120, 0.25);
        break;
      case 'aoe':
        this.add({ type: 'blast', x: e.x, y: e.y, radius: e.radius, color: FX_COLORS[e.visual] ?? '#ffffff', life: 0.35 });
        this.sparks(e.x, e.y, FX_COLORS[e.visual] ?? '#ffffff', 10, e.radius * 2, 0.35);
        break;
      case 'telegraph':
        this.add({ type: 'telegraph', x: e.x, y: e.y, radius: e.radius, life: e.duration, color: TEAM_COLORS[e.team].light });
        break;
      case 'buff':
        this.add({ type: 'rise', x: e.x, y: e.y, radius: e.radius || 30, color: e.visual === 'fury' || e.visual === 'berserk' ? '#ff6a3d' : '#8fd3ff', life: 0.5 });
        break;
      case 'taunt':
        this.ring(e.x, e.y, e.radius, '#ff5a5a', 0.5, 4);
        this.floatText(e.x, e.y - 30, 'Aqui!', '#ff8a8a', 16, 0.8);
        break;
      case 'dash':
        this.sparks(e.x, e.y, '#d8c8a8', 10, 90, 0.4);
        break;
      default:
        break;
    }
  }

  update(dt) {
    for (const it of this.items) {
      it.age += dt;
      if (it.type === 'spark') {
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.vx *= 0.9;
        it.vy *= 0.9;
      }
    }
    this.items = this.items.filter((it) => it.age < it.life);
  }
}
