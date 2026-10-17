// Camada 2D desenhada sobre a cena 3D: nomes e vida, barras das construções, números de dano,
// faíscas, avisos de interação, minimapa e mira. As posições vêm da projeção da câmera 3D.
import { getClass } from '../classes/classDefinitions.js';
import { BUILDING_TYPES } from '../world/Structures.js';
import { nearestDrop } from '../world/Weapons.js';
import { TEAM_COLORS, OUTLINE } from '../render/palette.js';

const HEAD = 2.25; // altura (unidades 3D) acima da cabeça dos personagens
const FONT = '"Trebuchet MS", sans-serif';

export class Overlay {
  constructor(canvas, rig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rig = rig;
    this.pixelScale = 1;
  }

  resize(w, h, scale) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.pixelScale = scale;
  }

  render(match, effects, { aim, showPlayerUi }) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
    const world = match.world;
    for (const b of world.buildings) this.drawBuildingBar(ctx, b);
    for (const d of world.defenses) this.drawDefenseBar(ctx, d);
    for (const c of world.characters) if (c.alive) this.drawOverhead(ctx, c);
    this.drawAirEffects(ctx, effects);
    if (showPlayerUi) {
      this.drawPrompt(ctx, match);
      this.drawMinimap(ctx, match);
      if (aim) this.drawReticle(ctx, aim);
    }
  }

  bar(ctx, x, y, w, h, frac, color) {
    ctx.fillStyle = 'rgba(20,18,30,0.78)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), h);
  }

  label(ctx, text, x, y, color = '#ffffff', size = 11, bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,18,30,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  onScreen(p, margin = 60) {
    return p.visible && p.x > -margin && p.y > -margin && p.x < this.rig.viewW + margin && p.y < this.rig.viewH + margin;
  }

  drawOverhead(ctx, c) {
    const p = this.rig.project(c.pos.x, c.pos.y, c.classId === 'mage' ? HEAD + 0.35 : HEAD);
    if (!this.onScreen(p)) return;
    const col = TEAM_COLORS[c.team];
    const w = 46;
    this.bar(ctx, p.x, p.y, w, 5, c.hpFraction, c.isPlayer ? '#5fe36a' : col.main);
    if (c.isPlayer || c.resourceMax) {
      const res = c.classDef.resource;
      if (c.isPlayer) this.bar(ctx, p.x, p.y + 7, w, 3, c.resource / c.resourceMax, res.color);
    }
    const tier = c.tier > 1 ? ' ' + '★'.repeat(c.tier - 1) : '';
    const text = `${c.name} · ${getClass(c.classId).name}${tier}`;
    this.label(ctx, text, p.x, p.y - 5, c.isPlayer ? '#ffe27a' : '#ffffff', c.isPlayer ? 12 : 11, c.isPlayer);
    if (c.isPlayer) {
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y - 27);
      ctx.lineTo(p.x + 7, p.y - 27);
      ctx.lineTo(p.x, p.y - 18);
      ctx.closePath();
      ctx.fillStyle = '#ffe27a';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
    if (c.arming) {
      const k = 1 - c.arming.remaining / 1.1;
      this.bar(ctx, p.x, p.y + 13, 36, 4, k, '#ffe27a');
    }
    if (c.stunned) {
      ctx.fillStyle = '#ffe27a';
      ctx.font = `bold 13px ${FONT}`;
      for (let i = 0; i < 3; i++) {
        const a = performance.now() / 250 + (i * Math.PI * 2) / 3;
        ctx.fillText('★', p.x + Math.cos(a) * 14, p.y - 22 + Math.sin(a) * 4);
      }
    }
    if (c.taunt) this.label(ctx, '!', p.x + w / 2 + 7, p.y + 6, '#ff6a6a', 14, true);
  }

  drawBuildingBar(ctx, b) {
    const tall = b.destroyed ? 1.6 : b.kind === 'castle' ? 8.6 : 5.2;
    const p = this.rig.project(b.pos.x, b.pos.y, tall);
    if (!this.onScreen(p, 100)) return;
    const name = BUILDING_TYPES[b.kind].name;
    if (b.destroyed) {
      this.label(ctx, `${name} (ruínas)`, p.x, p.y, '#d8cbb0', 11);
      return;
    }
    const col = TEAM_COLORS[b.team] ?? TEAM_COLORS.neutral;
    this.bar(ctx, p.x, p.y, 80, 6, b.hpFraction, col.main);
    this.label(ctx, `${name} · Nv ${b.level}`, p.x, p.y - 5, '#fff3d1', 12, true);
  }

  drawDefenseBar(ctx, d) {
    if (d.hp >= d.maxHp) return;
    const p = this.rig.project(d.pos.x, d.pos.y, d.kind === 'trap' ? 0.6 : d.kind === 'barricade' ? 1.5 : 3.6);
    if (!this.onScreen(p)) return;
    this.bar(ctx, p.x, p.y, 40, 4, d.hpFraction, TEAM_COLORS[d.team].main);
  }

  drawAirEffects(ctx, effects) {
    for (const it of effects.items) {
      const k = it.age / it.life;
      if (it.type === 'spark') {
        const p = this.rig.project(it.x, it.y, 0.9 + k * 0.5);
        if (!p.visible) continue;
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.fillStyle = it.color;
        ctx.fillRect(p.x - it.size / 2, p.y - it.size / 2, it.size, it.size);
        ctx.globalAlpha = 1;
      } else if (it.type === 'text') {
        const p = this.rig.project(it.x, it.y, 2.4);
        if (!p.visible) continue;
        ctx.globalAlpha = Math.max(0, 1 - k * k);
        this.label(ctx, it.text, p.x, p.y - it.rise * k, it.color, it.size, true);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Dica do que dá para fazer perto do jogador: pegar arma (F) ou melhorar construção (G).
  drawPrompt(ctx, match) {
    const player = match.player;
    if (!player.alive || player.arming) return;
    const world = match.world;
    const lines = [];
    const drop = nearestDrop(world, player);
    if (drop) {
      const stars = drop.tier > 1 ? ' ' + '★'.repeat(drop.tier - 1) : '';
      lines.push(`F: pegar arma de ${getClass(drop.classId).name}${stars}`);
    }
    const b = world.nearestOwnBuilding(player);
    if (b) {
      const cost = b.upgradeCost;
      lines.push(cost === null ? `${BUILDING_TYPES[b.kind].name}: nível máximo` : `G: melhorar ${BUILDING_TYPES[b.kind].name} (${cost} de ouro)`);
    }
    if (!lines.length) return;
    const p = this.rig.project(player.pos.x, player.pos.y, 0);
    lines.forEach((t, i) => {
      ctx.font = `bold 13px ${FONT}`;
      const w = ctx.measureText(t).width + 16;
      const y = p.y + 34 + i * 24;
      ctx.fillStyle = 'rgba(20,18,30,0.75)';
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, y - 15, w, 21, 7);
      ctx.fill();
      ctx.fillStyle = '#fff3d1';
      ctx.textAlign = 'center';
      ctx.fillText(t, p.x, y);
    });
  }

  drawMinimap(ctx, match) {
    const world = match.world;
    const map = world.map;
    const w = 230;
    const h = (map.height / map.width) * w;
    const x0 = this.rig.viewW - w - 14;
    const y0 = this.rig.viewH - h - 14;
    const s = w / map.width;
    ctx.fillStyle = 'rgba(20,30,20,0.75)';
    ctx.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
    ctx.fillStyle = '#4f8a3c';
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#2f3a2c';
    for (const o of map.obstacles) if (o.kind !== 'building') ctx.fillRect(x0 + o.x * s, y0 + o.y * s, Math.max(2, o.w * s), Math.max(2, o.h * s));
    for (const b of world.buildings) {
      ctx.fillStyle = b.destroyed ? '#6e6858' : (TEAM_COLORS[b.team] ?? TEAM_COLORS.neutral).dark;
      ctx.fillRect(x0 + b.rect.x * s, y0 + b.rect.y * s, b.rect.w * s, b.rect.h * s);
    }
    for (const base of Object.values(match.objective.status())) {
      ctx.beginPath();
      ctx.arc(x0 + base.x * s, y0 + base.y * s, base.radius * s, 0, Math.PI * 2);
      ctx.strokeStyle = TEAM_COLORS[base.team].light;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const d of world.drops) {
      ctx.fillStyle = '#fff2b0';
      ctx.fillRect(x0 + d.pos.x * s - 1, y0 + d.pos.y * s - 1, 2, 2);
    }
    for (const c of world.characters) {
      if (!c.alive) continue;
      ctx.beginPath();
      ctx.arc(x0 + c.pos.x * s, y0 + c.pos.y * s, c.isPlayer ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fillStyle = c.isPlayer ? '#ffe27a' : TEAM_COLORS[c.team].main;
      ctx.fill();
      if (c.isPlayer) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // Direção da câmera.
    const t = this.rig.target;
    const cx = x0 + (t.x / (1 / 40)) * s;
    const cy = y0 + (t.z / (1 / 40)) * s;
    const up = this.rig.screenAxes().up;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + up.x * 16, cy + up.y * 16);
    ctx.stroke();
  }

  drawReticle(ctx, aim) {
    const p = this.rig.project(aim.x, aim.y, 0.02);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 10, 6, 0, 0, Math.PI * 2);
    ctx.moveTo(p.x - 15, p.y);
    ctx.lineTo(p.x - 6, p.y);
    ctx.moveTo(p.x + 6, p.y);
    ctx.lineTo(p.x + 15, p.y);
    ctx.stroke();
  }
}
