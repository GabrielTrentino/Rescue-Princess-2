// Renderização em Canvas 2D. Lê o estado do mundo, nunca o modifica.
import { TILT } from './Camera.js';
import { drawPlaceholderCharacter } from './PlaceholderArt.js';
import { FX_COLORS, OUTLINE, TEAM_COLORS, CLASS_LOOK } from './palette.js';

const OBSTACLE_STYLE = {
  wall: { height: 46, top: '#b9b2a5', front: '#8a8275', edge: '#5f584d' },
  rock: { height: 40, top: '#9a948c', front: '#726c64', edge: '#4d4842' },
  crate: { height: 30, top: '#c9935a', front: '#9c6b39', edge: '#6b4520' },
  tree: { height: 18, top: '#6b4a2b', front: '#553821', edge: '#3a2716' },
};

const WALL_HEIGHT = 46; // altura visual das muralhas, em pixels do mundo
const CORPSE_TIME = 1.6; // segundos que o corpo fica visível depois da queda

function hash(x, y) {
  let h = Math.imul(Math.round(x) * 73856093 ^ Math.round(y) * 19349663, 2654435761) >>> 0;
  return h % 2147483646 + 1;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, Math.max(0, w), Math.max(0, h), r);
}

export class Renderer {
  constructor(canvas, camera, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = camera;
    this.sprites = sprites;
    this.ground = null;
    this.groundMapId = null;
    this.animState = new Map();
    this.time = 0;
    this.pixelScale = 1; // pixels reais por pixel lógico (tela de 1280×720 lógicos)
    this.rockCache = new Map();
    this.wallCache = new Map();
    this.flashCanvas = null;
  }

  resetTransform(ctx) {
    ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
  }

  buildGround(map) {
    const W = map.width;
    const H = map.height;
    const g = document.createElement('canvas');
    g.width = W;
    g.height = H;
    const ctx = g.getContext('2d');
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // Grama: base com manchas suaves de tons quentes e frios.
    ctx.fillStyle = '#74b84f';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 1600; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const t = rand();
      ctx.fillStyle = t < 0.4 ? 'rgba(78,148,56,0.5)' : t < 0.8 ? 'rgba(146,204,96,0.42)' : 'rgba(180,200,90,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y, 12 + rand() * 34, 8 + rand() * 22, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Caminho ligando as bases pelo meio e pelas passagens.
    const b = map.bases;
    const path = new Path2D();
    path.moveTo(b.blue.x, b.blue.y);
    path.lineTo(W * 0.25, b.blue.y);
    path.quadraticCurveTo(W * 0.42, 200, W / 2, 200);
    path.quadraticCurveTo(W * 0.58, 200, W * 0.75, b.red.y);
    path.lineTo(b.red.x, b.red.y);
    path.moveTo(W * 0.25, b.blue.y);
    path.quadraticCurveTo(W * 0.42, H - 200, W / 2, H - 200);
    path.quadraticCurveTo(W * 0.58, H - 200, W * 0.75, b.red.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(70,110,40,0.45)';
    ctx.lineWidth = 84;
    ctx.stroke(path);
    ctx.strokeStyle = '#b89f74';
    ctx.lineWidth = 72;
    ctx.stroke(path);
    // Pedras do calçamento, recortadas no formato do caminho.
    const stones = document.createElement('canvas');
    stones.width = W;
    stones.height = H;
    const sg = stones.getContext('2d');
    sg.fillStyle = '#c4ac80';
    sg.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 20) {
      for (let x = (y / 20) % 2 ? -12 : 0; x < W; x += 24) {
        const shade = 200 + Math.floor(rand() * 30);
        sg.fillStyle = `rgb(${shade},${shade - 22},${shade - 60})`;
        sg.beginPath();
        sg.roundRect(x + 2 + rand() * 2, y + 2 + rand() * 2, 18 + rand() * 3, 14 + rand() * 3, 5);
        sg.fill();
      }
    }
    sg.globalCompositeOperation = 'destination-in';
    sg.lineCap = 'round';
    sg.lineJoin = 'round';
    sg.lineWidth = 58;
    sg.stroke(path);
    ctx.drawImage(stones, 0, 0);
    // Tufos de grama e flores.
    for (let i = 0; i < 2600; i++) {
      const x = rand() * W;
      const y = rand() * H;
      if (sg.isPointInStroke(path, x, y)) continue;
      ctx.strokeStyle = rand() < 0.5 ? '#4f9a3c' : '#5fae45';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 7);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 1, y - 9);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 5, y - 6);
      ctx.stroke();
    }
    const flowerColors = ['#fff6e0', '#ffd65a', '#ff9db8', '#b8a6ff'];
    for (let i = 0; i < 420; i++) {
      const cx = rand() * W;
      const cy = rand() * H;
      if (sg.isPointInStroke(path, cx, cy)) continue;
      const col = flowerColors[Math.floor(rand() * flowerColors.length)];
      for (let k = 0; k < 3 + Math.floor(rand() * 4); k++) {
        const x = cx + (rand() - 0.5) * 30;
        const y = cy + (rand() - 0.5) * 22;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8a33a';
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    // Praças de pedra das bases, com a cor da equipe.
    for (const team of ['blue', 'red']) {
      const base = map.bases[team];
      const col = TEAM_COLORS[team];
      ctx.save();
      ctx.beginPath();
      ctx.arc(base.x, base.y, base.radius + 26, 0, Math.PI * 2);
      ctx.fillStyle = '#a99c86';
      ctx.fill();
      ctx.clip();
      for (let r = base.radius + 26; r > 20; r -= 26) {
        const n = Math.max(6, Math.round((r * Math.PI * 2) / 34));
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2 + r * 0.01;
          const a1 = ((k + 1) / n) * Math.PI * 2 + r * 0.01;
          const shade = 178 + Math.floor(rand() * 26);
          ctx.fillStyle = `rgb(${shade},${shade - 10},${shade - 28})`;
          ctx.beginPath();
          ctx.arc(base.x, base.y, r - 2, a0 + 0.02, a1 - 0.02);
          ctx.arc(base.x, base.y, Math.max(0, r - 24), a1 - 0.02, a0 + 0.02, true);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(base.x, base.y, base.radius + 26, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = col.dark;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(base.x, base.y, 46, 0, Math.PI * 2);
      ctx.fillStyle = col.main;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    this.ground = g;
    this.groundMapId = map.id;
  }

  animFor(c) {
    let name = 'idle';
    if (c.hurtTimer > 0.12) name = 'hurt';
    if (c.attackAnim > 0) name = 'attack';
    else if (c.moving) name = 'run';
    if (!c.alive) name = 'death';
    let st = this.animState.get(c.id);
    if (!st || st.name !== name) {
      st = { name, start: this.time };
      this.animState.set(c.id, st);
    }
    const progress = name === 'attack' ? 1 - c.attackAnim / 0.3 : 0;
    // Animações que não repetem começam do primeiro quadro; as cíclicas ficam defasadas por personagem.
    const offset = name === 'idle' || name === 'run' ? c.id * 0.37 : 0;
    return { name, time: this.time - st.start + offset, since: this.time - st.start, progress: Math.min(1, Math.max(0, progress)) };
  }

  render(match, effects, { aim, dt, settings }) {
    const ctx = this.ctx;
    const cam = this.camera;
    const world = match.world;
    const map = world.map;
    this.time += dt;
    if (this.groundMapId !== map.id) this.buildGround(map);

    this.resetTransform(ctx);
    ctx.fillStyle = '#2d4a2a';
    ctx.fillRect(0, 0, this.camera.viewW, this.camera.viewH);

    // ---- Chão (com inclinação) ----
    cam.applyGround(ctx, this.pixelScale);
    ctx.drawImage(this.ground, 0, 0);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, map.width, map.height);
    this.drawBases(ctx, match);
    this.drawZones(ctx, world.zones);
    this.drawGroundEffects(ctx, effects);
    this.drawAimHint(ctx, match, aim);

    // ---- Objetos em pé, ordenados por profundidade ----
    this.resetTransform(ctx);
    const drawables = [];
    const player = world.characters.find((c) => c.isPlayer);
    for (const o of map.obstacles) {
      if (o.kind === 'rock' && this.sprites.prop('rock_a')) {
        // Rochas viram um aglomerado de pedras, cada uma ordenada pela própria profundidade.
        for (const r of this.rockCluster(o)) drawables.push({ y: r.y, draw: () => this.drawProp(ctx, r.kind, r.x, r.y, r.scale, r.flip) });
      } else {
        drawables.push({ y: o.y + o.h, draw: () => this.drawObstacle(ctx, o, player) });
      }
    }
    for (const base of Object.values(map.bases)) {
      const team = base === map.bases.blue ? 'blue' : 'red';
      // Estandarte no fundo da praça, longe do ponto de renascimento.
      const bx = base.x + (team === 'blue' ? -1 : 1) * base.radius * 0.62;
      const by = base.y - base.radius * 0.35;
      drawables.push({ y: by, draw: () => this.drawBanner(ctx, team, bx, by) });
    }
    for (const c of world.characters) {
      if (c.alive || this.showsCorpse(c)) drawables.push({ y: c.pos.y - (c.alive ? 0 : 1000), draw: () => this.drawCharacter(ctx, c) });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();
    if (!this.sprites.prop('tree_a')) for (const o of map.obstacles) if (o.kind === 'tree') this.drawCanopy(ctx, o);

    this.drawProjectiles(ctx, world);
    this.drawAirEffects(ctx, effects);
    for (const c of world.characters) if (c.alive) this.drawOverhead(ctx, c);
    this.drawMinimap(ctx, match);
    if (aim && settings.showReticle !== false) this.drawReticle(ctx, aim);
  }

  drawBases(ctx, match) {
    const bases = match.objective.status();
    for (const base of Object.values(bases)) {
      const col = TEAM_COLORS[base.team];
      ctx.beginPath();
      ctx.arc(base.x, base.y, base.radius, 0, Math.PI * 2);
      ctx.fillStyle = base.progress > 0 ? 'rgba(255,220,120,0.12)' : 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.setLineDash([14, 10]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = col.main;
      ctx.stroke();
      ctx.setLineDash([]);
      if (base.progress > 0) {
        const enemy = TEAM_COLORS[base.team === 'blue' ? 'red' : 'blue'];
        ctx.beginPath();
        ctx.arc(base.x, base.y, base.radius - 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * base.progress);
        ctx.lineWidth = 10;
        ctx.strokeStyle = enemy.main;
        ctx.stroke();
      }
      if (!this.sprites.prop(`banner_${base.team}`)) {
        // Estandarte central provisório
        ctx.beginPath();
        ctx.arc(base.x, base.y, 22, 0, Math.PI * 2);
        ctx.fillStyle = col.dark;
        ctx.fill();
      }
    }
  }

  drawZones(ctx, zones) {
    for (const z of zones) {
      const color = FX_COLORS[z.visual] ?? '#ffffff';
      const fade = Math.min(1, z.remaining / 0.4, (z.duration - z.remaining) / 0.2 + 0.3);
      ctx.save();
      ctx.globalAlpha = 0.35 * fade;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 0.8 * fade;
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.stroke();
      if (z.visual === 'storm') {
        ctx.strokeStyle = '#fff27a';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * z.radius * 0.8;
          ctx.beginPath();
          ctx.moveTo(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r);
          ctx.lineTo(z.x + Math.cos(a) * r + (Math.random() - 0.5) * 30, z.y + Math.sin(a) * r + 30);
          ctx.stroke();
        }
      } else if (z.visual === 'smoke') {
        ctx.globalAlpha = 0.55 * fade;
        ctx.fillStyle = '#c5c9cf';
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + this.time * 0.3;
          ctx.beginPath();
          ctx.arc(z.x + Math.cos(a) * z.radius * 0.55, z.y + Math.sin(a) * z.radius * 0.55, z.radius * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (z.visual === 'frost') {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 10; i++) {
          const a = i * 2.4;
          const r = ((i * 37) % 100) / 100 * z.radius * 0.9;
          ctx.fillRect(z.x + Math.cos(a) * r - 2, z.y + Math.sin(a) * r - 2, 4, 4);
        }
      }
      ctx.restore();
    }
  }

  drawGroundEffects(ctx, effects) {
    for (const it of effects.items) {
      const k = it.age / it.life;
      if (it.type === 'telegraph') {
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,120,60,${0.12 + 0.18 * k})`;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,90,40,0.9)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.radius * k, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,220,120,0.9)';
        ctx.stroke();
      } else if (it.type === 'blast') {
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.radius * (0.6 + 0.4 * k), 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(it.color, 0.45 * (1 - k));
        ctx.fill();
      } else if (it.type === 'ring') {
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.radius * (0.3 + 0.7 * k), 0, Math.PI * 2);
        ctx.lineWidth = it.width;
        ctx.strokeStyle = hexAlpha(it.color, 1 - k);
        ctx.stroke();
      } else if (it.type === 'slash') {
        const half = ((it.arc ?? 90) * Math.PI) / 360;
        ctx.beginPath();
        ctx.moveTo(it.x, it.y);
        ctx.arc(it.x, it.y, it.range + 10, it.angle - half, it.angle + half);
        ctx.closePath();
        ctx.fillStyle = hexAlpha(it.color, 0.4 * (1 - k));
        ctx.fill();
      } else if (it.type === 'rise') {
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.radius * (0.5 + k), 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = hexAlpha(it.color, 1 - k);
        ctx.stroke();
      } else if (it.type === 'grave') {
        ctx.beginPath();
        ctx.ellipse(it.x, it.y, 16, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(40,30,30,${0.35 * (1 - k)})`;
        ctx.fill();
      }
    }
  }

  drawAimHint(ctx, match, aim) {
    const p = match.player;
    if (!p || !p.alive || !aim) return;
    const a = Math.atan2(aim.y - p.pos.y, aim.x - p.pos.x);
    ctx.beginPath();
    ctx.moveTo(p.pos.x + Math.cos(a) * (p.radius + 8), p.pos.y + Math.sin(a) * (p.radius + 8));
    ctx.lineTo(p.pos.x + Math.cos(a) * (p.radius + 26), p.pos.y + Math.sin(a) * (p.radius + 26));
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
  }

  drawObstacle(ctx, o, player) {
    const s = OBSTACLE_STYLE[o.kind] ?? OBSTACLE_STYLE.rock;
    const cam = this.camera;
    const h = s.height * cam.zoom;
    const tl = cam.toScreen(o.x, o.y);
    const br = cam.toScreen(o.x + o.w, o.y + o.h);
    if (br.x < -150 || tl.x > this.camera.viewW + 150 || br.y < -80 || tl.y > this.camera.viewH + 260) return;
    const seed = hash(o.x, o.y);
    if (o.kind === 'tree' && this.sprites.prop('tree_a')) {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h * 0.75;
      // Copa semitransparente quando o jogador está escondido atrás dela.
      const behind = player && player.alive && player.pos.y < cy && player.pos.y > cy - 220 && Math.abs(player.pos.x - cx) < 90;
      this.drawProp(ctx, seed % 2 ? 'tree_a' : 'tree_b', cx, cy, (o.w / 70) * (0.95 + (seed % 7) * 0.02), seed % 3 === 0, behind ? 0.5 : 1);
      return;
    }
    if (o.kind === 'crate' && this.sprites.prop('crate')) {
      const cy = o.y + o.h * 0.6;
      this.drawProp(ctx, 'barrel', o.x + o.w * 0.78, o.y + o.h * 0.35, 0.95, false);
      this.drawProp(ctx, 'crate', o.x + o.w * 0.38, cy, 1.05, seed % 2 === 0);
      return;
    }
    if (o.kind === 'wall') {
      const tex = this.wallTexture(o);
      ctx.drawImage(tex, tl.x - 3 * cam.zoom, tl.y - (WALL_HEIGHT + 12) * cam.zoom, tex.width * cam.zoom, tex.height * cam.zoom);
      return;
    }
    if (o.kind === 'tree') {
      ctx.beginPath();
      ctx.ellipse((tl.x + br.x) / 2, br.y - 4, (br.x - tl.x) * 0.7, (br.y - tl.y) * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
      const cx = (tl.x + br.x) / 2;
      ctx.fillStyle = s.front;
      ctx.fillRect(cx - 8, br.y - h - 30, 16, h + 30);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 8, br.y - h - 30, 16, h + 30);
      return;
    }
    // Face frontal
    ctx.fillStyle = s.front;
    ctx.fillRect(tl.x, br.y - h, br.x - tl.x, h);
    // Face superior
    ctx.fillStyle = s.top;
    ctx.fillRect(tl.x, tl.y - h, br.x - tl.x, br.y - tl.y);
    ctx.lineWidth = 2;
    ctx.strokeStyle = s.edge;
    ctx.strokeRect(tl.x, tl.y - h, br.x - tl.x, br.y - tl.y + h);
    ctx.beginPath();
    ctx.moveTo(tl.x, br.y - h);
    ctx.lineTo(br.x, br.y - h);
    ctx.stroke();
    if (o.kind === 'wall') {
      // Ameias
      ctx.fillStyle = s.top;
      const step = 22;
      for (let x = tl.x; x < br.x - 8; x += step) {
        ctx.fillRect(x + 3, tl.y - h - 8, 10, 8);
        ctx.strokeRect(x + 3, tl.y - h - 8, 10, 8);
      }
    } else if (o.kind === 'crate') {
      ctx.beginPath();
      ctx.moveTo(tl.x, br.y - h);
      ctx.lineTo(br.x, br.y);
      ctx.moveTo(br.x, br.y - h);
      ctx.lineTo(tl.x, br.y);
      ctx.stroke();
    }
  }

  drawCanopy(ctx, o) {
    const cam = this.camera;
    const tl = cam.toScreen(o.x, o.y);
    const br = cam.toScreen(o.x + o.w, o.y + o.h);
    const cx = (tl.x + br.x) / 2;
    const r = (br.x - tl.x) * 0.75;
    const cy = br.y - 18 * cam.zoom - 30 - r * 0.6;
    if (cx < -100 || cx > this.camera.viewW + 100 || cy < -100 || cy > this.camera.viewH + 100) return;
    ctx.save();
    ctx.globalAlpha = 0.92;
    for (const [dx, dy, rr, col] of [[0, 0, 1, '#3f8a3a'], [-0.4, 0.15, 0.7, '#357a31'], [0.4, 0.2, 0.7, '#4a9c42'], [0, -0.35, 0.65, '#5bb04f']]) {
      ctx.beginPath();
      ctx.arc(cx + dx * r, cy + dy * r, r * rr, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCharacter(ctx, c) {
    const p = this.camera.toScreen(c.pos.x, c.pos.y);
    if (p.x < -80 || p.x > this.camera.viewW + 80 || p.y < -100 || p.y > this.camera.viewH + 60) return;
    const anim = this.animFor(c);
    const frame = this.sprites.frame(c.classId, c.team, anim.name, anim.time, c.facing);
    if (!c.alive && !frame) return;
    // Efeitos de estado sob os pés
    if (c.alive && c.effects.multiplier('speedMult') < 0.95) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, c.radius * 1.4, c.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(143,220,255,0.45)';
      ctx.fill();
    }
    const aura = c.effects.list.find((e) => e.visual === 'fury' || e.visual === 'berserk');
    if (aura && c.alive) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - c.radius, c.radius * 1.6, c.radius * 1.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,90,40,${0.18 + 0.08 * Math.sin(this.time * 10)})`;
      ctx.fill();
    }

    ctx.save();
    if (frame) {
      const scale = frame.scale * this.camera.zoom;
      if (!c.alive) ctx.globalAlpha = Math.max(0, Math.min(1, (CORPSE_TIME - anim.since) / 0.5));
      // Sombra de contato (os renders têm fundo transparente).
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, c.radius * 1.25 * this.camera.zoom, c.radius * 0.5 * this.camera.zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,30,20,0.28)';
      ctx.fill();
      ctx.translate(p.x, p.y);
      if (frame.flip) ctx.scale(-1, 1);
      const flash = c.alive && c.hurtTimer > 0.12;
      const img = flash ? this.flashFrame(frame) : frame.img;
      const sx = flash ? 0 : frame.sx;
      const sy = flash ? 0 : frame.sy;
      ctx.drawImage(img, sx, sy, frame.sw, frame.sh, -frame.ox * scale, -frame.oy * scale, frame.sw * scale, frame.sh * scale);
    } else {
      if (c.hurtTimer > 0.1) ctx.globalAlpha = 0.75;
      drawPlaceholderCharacter(ctx, c, p.x, p.y, this.camera.zoom, anim);
    }
    ctx.restore();

    const shield = c.effects.list.find((e) => e.visual === 'shield' || e.visual === 'goldShield' || e.visual === 'shieldSmall');
    if (shield && c.alive) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - c.radius * 1.4, c.radius * 1.7, c.radius * 2.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = shield.visual === 'goldShield' ? 'rgba(255,215,90,0.22)' : 'rgba(140,200,255,0.18)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = shield.visual === 'goldShield' ? 'rgba(255,215,90,0.8)' : 'rgba(140,200,255,0.7)';
      ctx.stroke();
    }
    if (c.stunned && c.alive) {
      for (let i = 0; i < 3; i++) {
        const a = this.time * 6 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = '#ffe27a';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', p.x + Math.cos(a) * 16, p.y - c.radius * 3.4 + Math.sin(a) * 5);
      }
    }
  }

  // Mostra o corpo (animação de derrota) por alguns instantes depois da queda.
  showsCorpse(c) {
    if (!this.sprites.hasSprites(c.classId)) return false;
    const st = this.animState.get(c.id);
    return !st || st.name !== 'death' || this.time - st.start < CORPSE_TIME;
  }

  // Desenha um objeto de cenário renderizado (pé do objeto em x, y do mundo).
  drawProp(ctx, name, x, y, size = 1, flip = false, alpha = 1) {
    const prop = this.sprites.prop(name);
    if (!prop) return;
    const p = this.camera.toScreen(x, y);
    const { img, spec } = prop;
    const scale = spec.scale * size * this.camera.zoom;
    const w = img.width * scale;
    const h = img.height * scale;
    if (p.x + w < 0 || p.x - w > this.camera.viewW || p.y - h > this.camera.viewH || p.y + h < 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -spec.originX * scale, -spec.originY * scale, w, h);
    ctx.restore();
  }

  drawBanner(ctx, team, x, y) {
    if (!this.sprites.prop(`banner_${team}`)) return;
    this.drawProp(ctx, `banner_${team}`, x, y, 0.85, team === 'red');
  }

  // Aglomerado determinístico de pedras que cobre a área de colisão da rocha.
  rockCluster(o) {
    const key = `${o.x},${o.y}`;
    if (this.rockCache.has(key)) return this.rockCache.get(key);
    let seed = hash(o.x, o.y) || 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const kinds = ['rock_a', 'rock_b', 'rock_c'];
    const step = 66;
    const cols = Math.max(1, Math.round(o.w / step));
    const rows = Math.max(1, Math.round(o.h / (step * 0.8)));
    const list = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = o.x + ((i + 0.5) / cols) * o.w + (rand() - 0.5) * 14;
        const y = o.y + ((j + 0.62) / rows) * o.h + (rand() - 0.5) * 10;
        list.push({ kind: kinds[Math.floor(rand() * 3)], x, y, scale: 0.85 + rand() * 0.35, flip: rand() < 0.5 });
      }
    }
    this.rockCache.set(key, list);
    return list;
  }

  // Textura de muralha de pedra (face de cima + face da frente), gerada uma vez por muro.
  wallTexture(o) {
    const key = `${o.x},${o.y},${o.w},${o.h}`;
    let tex = this.wallCache.get(key);
    if (tex) return tex;
    const pad = 3;
    const topH = o.h * TILT;
    const W = Math.ceil(o.w + pad * 2);
    const H = Math.ceil(topH + WALL_HEIGHT + 12 + pad);
    tex = document.createElement('canvas');
    tex.width = W;
    tex.height = H;
    const g = tex.getContext('2d');
    let seed = hash(o.x, o.y) || 3;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const top = 12;
    const front = top + topH;
    const x0 = pad;
    // Face da frente: fiadas de blocos com variação de tom.
    g.fillStyle = '#8b8172';
    g.fillRect(x0, front, o.w, WALL_HEIGHT);
    const rowsH = WALL_HEIGHT / 3;
    for (let r = 0; r < 3; r++) {
      let x = x0 - (r % 2) * 12;
      while (x < x0 + o.w) {
        const bw = 20 + rand() * 12;
        const sx = Math.max(x, x0);
        const ex = Math.min(x + bw, x0 + o.w);
        const shade = 118 + Math.floor(rand() * 26) - r * 8;
        g.fillStyle = `rgb(${shade + 14},${shade + 6},${shade - 8})`;
        roundRect(g, sx + 1, front + r * rowsH + 1, ex - sx - 2, rowsH - 2, 3);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.14)';
        g.fillRect(sx + 2, front + r * rowsH + 2, ex - sx - 4, 2);
        x += bw;
      }
    }
    // Sombra na base e musgo.
    const grad = g.createLinearGradient(0, front, 0, front + WALL_HEIGHT);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(20,16,30,0.35)');
    g.fillStyle = grad;
    g.fillRect(x0, front, o.w, WALL_HEIGHT);
    for (let i = 0; i < o.w / 18; i++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(92,140,60,0.75)' : 'rgba(120,170,70,0.7)';
      g.beginPath();
      g.ellipse(x0 + rand() * o.w, front + WALL_HEIGHT - 2 - rand() * 4, 4 + rand() * 6, 2 + rand() * 2, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Face de cima: lajes claras.
    g.fillStyle = '#cfc6b3';
    g.fillRect(x0, top, o.w, topH);
    const tile = 26;
    for (let y = 0; y < o.h; y += tile) {
      for (let x = (y / tile) % 2 ? -tile / 2 : 0; x < o.w; x += tile) {
        const sx = Math.max(0, x);
        const ex = Math.min(o.w, x + tile);
        const ey = Math.min(o.h, y + tile);
        const shade = 196 + Math.floor(rand() * 22);
        g.fillStyle = `rgb(${shade},${shade - 8},${shade - 24})`;
        roundRect(g, x0 + sx + 1, top + y * TILT + 1, ex - sx - 2, (ey - y) * TILT - 2, 3);
        g.fill();
      }
    }
    // Ameias ao longo da borda da frente (muros horizontais) ou do lado (verticais).
    g.fillStyle = '#d8cfbb';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 2;
    if (o.w >= o.h) {
      for (let x = x0 + 4; x < x0 + o.w - 12; x += 24) {
        roundRect(g, x, front - 10, 13, 10, 2);
        g.fill();
        g.stroke();
      }
    }
    // Contorno grosso no estilo cartoon.
    g.lineWidth = 3;
    g.strokeStyle = OUTLINE;
    roundRect(g, x0, top, o.w, topH + WALL_HEIGHT, 4);
    g.stroke();
    g.beginPath();
    g.moveTo(x0, front);
    g.lineTo(x0 + o.w, front);
    g.lineWidth = 2;
    g.stroke();
    this.wallCache.set(key, tex);
    return tex;
  }

  // Versão clareada do quadro atual (lampejo de dano).
  flashFrame(frame) {
    if (!this.flashCanvas) {
      this.flashCanvas = document.createElement('canvas');
      this.flashCanvas.width = frame.sw;
      this.flashCanvas.height = frame.sh;
    }
    const g = this.flashCanvas.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, frame.sw, frame.sh);
    g.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.sw, frame.sh);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255,255,255,0.65)';
    g.fillRect(0, 0, frame.sw, frame.sh);
    return this.flashCanvas;
  }

  drawOverhead(ctx, c) {
    const p = this.camera.toScreen(c.pos.x, c.pos.y);
    if (p.x < -60 || p.x > this.camera.viewW + 60 || p.y < -100 || p.y > this.camera.viewH + 60) return;
    const top = p.y - c.radius * 3.6 * this.camera.zoom;
    const w = 44;
    const col = TEAM_COLORS[c.team];
    ctx.fillStyle = 'rgba(20,18,30,0.75)';
    ctx.fillRect(p.x - w / 2 - 1, top - 1, w + 2, 7);
    ctx.fillStyle = c.isPlayer ? '#5fe36a' : col.main;
    ctx.fillRect(p.x - w / 2, top, w * c.hpFraction, 5);
    ctx.font = c.isPlayer ? 'bold 12px "Trebuchet MS", sans-serif' : '11px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,18,30,0.8)';
    const label = `${c.name} · ${CLASS_LOOK[c.classId].label}`;
    ctx.strokeText(label, p.x, top - 4);
    ctx.fillStyle = c.isPlayer ? '#ffe27a' : '#ffffff';
    ctx.fillText(label, p.x, top - 4);
    if (c.isPlayer) {
      ctx.beginPath();
      ctx.moveTo(p.x - 7, top - 26);
      ctx.lineTo(p.x + 7, top - 26);
      ctx.lineTo(p.x, top - 17);
      ctx.closePath();
      ctx.fillStyle = '#ffe27a';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
    if (c.taunt) {
      ctx.fillStyle = '#ff6a6a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('!', p.x + w / 2 + 6, top + 6);
    }
  }

  drawProjectiles(ctx, world) {
    const cam = this.camera;
    for (const pr of world.projectiles) {
      const p = cam.toScreen(pr.pos.x, pr.pos.y);
      const lift = 22 * cam.zoom; // projéteis viajam na altura das mãos
      const color = FX_COLORS[pr.visual] ?? '#ffffff';
      const angle = Math.atan2(pr.dir.y * TILT, pr.dir.x);
      ctx.save();
      ctx.translate(p.x, p.y - lift);
      ctx.rotate(angle);
      if (pr.visual === 'arrow' || pr.visual === 'arrowBig') {
        const len = pr.visual === 'arrowBig' ? 26 : 20;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fillStyle = '#e8eef5';
        ctx.fill();
      } else if (pr.visual === 'lightning') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        for (let i = -30; i <= 0; i += 10) ctx.lineTo(i, (Math.random() - 0.5) * 8);
        ctx.stroke();
      } else if (pr.visual === 'hook') {
        ctx.restore();
        const owner = world.getCharacter(pr.ownerId);
        if (owner) {
          const o = cam.toScreen(owner.pos.x, owner.pos.y);
          ctx.strokeStyle = '#9a9aa5';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(o.x, o.y - lift);
          ctx.lineTo(p.x, p.y - lift);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y - lift, 7, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
        continue;
      } else {
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.restore();
      // sombra no chão
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 5, 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
    }
  }

  drawAirEffects(ctx, effects) {
    const cam = this.camera;
    ctx.textAlign = 'center';
    for (const it of effects.items) {
      const k = it.age / it.life;
      if (it.type === 'spark') {
        const p = cam.toScreen(it.x, it.y);
        ctx.fillStyle = hexAlpha(it.color, 1 - k);
        ctx.fillRect(p.x - it.size / 2, p.y - 20 - it.size / 2, it.size, it.size);
      } else if (it.type === 'text') {
        const p = cam.toScreen(it.x, it.y);
        const y = p.y - 50 - it.rise * k;
        ctx.font = `bold ${it.size}px "Trebuchet MS", sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(20,18,30,${1 - k})`;
        ctx.strokeText(it.text, p.x, y);
        ctx.fillStyle = hexAlpha(it.color, 1 - k * k);
        ctx.fillText(it.text, p.x, y);
      }
    }
  }

  drawMinimap(ctx, match) {
    const world = match.world;
    const map = world.map;
    const w = 210;
    const h = (map.height / map.width) * w;
    const x0 = this.camera.viewW - w - 14;
    const y0 = this.camera.viewH - h - 14;
    const s = w / map.width;
    ctx.fillStyle = 'rgba(20,30,20,0.75)';
    ctx.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
    ctx.fillStyle = '#4f8a3c';
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#2f3a2c';
    for (const o of map.obstacles) ctx.fillRect(x0 + o.x * s, y0 + o.y * s, Math.max(2, o.w * s), Math.max(2, o.h * s));
    for (const base of Object.values(match.objective.status())) {
      ctx.beginPath();
      ctx.arc(x0 + base.x * s, y0 + base.y * s, base.radius * s, 0, Math.PI * 2);
      ctx.strokeStyle = TEAM_COLORS[base.team].light;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const c of world.characters) {
      if (!c.alive) continue;
      ctx.beginPath();
      ctx.arc(x0 + c.pos.x * s, y0 + c.pos.y * s, c.isPlayer ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = c.isPlayer ? '#ffe27a' : TEAM_COLORS[c.team].main;
      ctx.fill();
      if (c.isPlayer) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    const cam = this.camera;
    const vw = this.camera.viewW / cam.zoom;
    const vh = this.camera.viewH / cam.zoom / TILT;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + (cam.x - vw / 2) * s, y0 + (cam.y - vh / 2) * s, vw * s, vh * s);
  }

  drawReticle(ctx, aim) {
    const p = this.camera.toScreen(aim.x, aim.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 9, 9 * TILT, 0, 0, Math.PI * 2);
    ctx.moveTo(p.x - 14, p.y);
    ctx.lineTo(p.x - 5, p.y);
    ctx.moveTo(p.x + 5, p.y);
    ctx.lineTo(p.x + 14, p.y);
    ctx.stroke();
  }
}

function hexAlpha(hex, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
