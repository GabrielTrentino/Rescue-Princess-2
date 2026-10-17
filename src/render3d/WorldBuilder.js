// Cenário estático em 3D: chão pintado, muralhas, rochas, árvores, caixas e a moldura de montanhas.
import * as THREE from 'three';
import { S } from './CameraRig.js';
import { heightAt } from '../world/Terrain.js';

const TEX_SCALE = 0.5; // pixels de textura por pixel do jogo

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Caminhos entre as bases: faixa do meio e duas laterais.
function lanePath(map) {
  const W = map.width;
  const H = map.height;
  const b = map.bases;
  const p = new Path2D();
  p.moveTo(b.blue.x, b.blue.y);
  p.lineTo(W * 0.27, b.blue.y);
  p.lineTo(W * 0.73, b.red.y);
  p.lineTo(b.red.x, b.red.y);
  for (const yy of [H * 0.27, H * 0.73]) {
    p.moveTo(W * 0.2, b.blue.y);
    p.bezierCurveTo(W * 0.3, yy, W * 0.38, yy, W / 2, yy);
    p.bezierCurveTo(W * 0.62, yy, W * 0.7, yy, W * 0.8, b.red.y);
  }
  return p;
}

export function makeGroundTexture(map) {
  const W = Math.round(map.width * TEX_SCALE);
  const H = Math.round(map.height * TEX_SCALE);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.scale(TEX_SCALE, TEX_SCALE);
  const rand = rng(11);
  const MW = map.width;
  const MH = map.height;
  ctx.fillStyle = '#79b84f';
  ctx.fillRect(0, 0, MW, MH);
  for (let i = 0; i < 2600; i++) {
    const t = rand();
    ctx.fillStyle = t < 0.4 ? 'rgba(84,150,58,0.5)' : t < 0.8 ? 'rgba(150,206,98,0.42)' : 'rgba(186,204,92,0.35)';
    ctx.beginPath();
    ctx.ellipse(rand() * MW, rand() * MH, 20 + rand() * 60, 14 + rand() * 40, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const path = lanePath(map);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(80,120,45,0.45)';
  ctx.lineWidth = 120;
  ctx.stroke(path);
  ctx.strokeStyle = '#c2a676';
  ctx.lineWidth = 104;
  ctx.stroke(path);
  ctx.strokeStyle = '#d3bb8a';
  ctx.lineWidth = 80;
  ctx.stroke(path);
  // Pedrinhas no caminho
  for (let i = 0; i < 2600; i++) {
    const x = rand() * MW;
    const y = rand() * MH;
    if (!ctx.isPointInStroke(path, x * TEX_SCALE, y * TEX_SCALE)) continue;
    const shade = 170 + Math.floor(rand() * 40);
    ctx.fillStyle = `rgb(${shade},${shade - 18},${shade - 50})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 + rand() * 6, 4 + rand() * 4, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 2;
  // Terra batida sob as construções
  for (const b of map.buildings) {
    ctx.fillStyle = 'rgba(150,118,70,0.55)';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.75, b.h * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pátio de pedra dentro de cada castelo
  for (const r of Object.values(map.castleAreas ?? {})) {
    ctx.fillStyle = '#b3a68e';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let y = r.y; y < r.y + r.h; y += 40) {
      for (let x = r.x + ((y / 40) % 2) * 20; x < r.x + r.w; x += 40) {
        const shade = 168 + Math.floor(rand() * 30);
        ctx.fillStyle = `rgb(${shade},${shade - 10},${shade - 30})`;
        ctx.fillRect(x + 2, y + 2, 36, 36);
      }
    }
  }
  // Tufos e flores
  const flowers = ['#fff6e0', '#ffd65a', '#ff9db8', '#b8a6ff'];
  for (let i = 0; i < 5000; i++) {
    const x = rand() * MW;
    const y = rand() * MH;
    if (ctx.isPointInStroke(path, x * TEX_SCALE, y * TEX_SCALE)) continue;
    if (Object.values(map.castleAreas ?? {}).some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h)) continue;
    if (rand() < 0.85) {
      ctx.strokeStyle = rand() < 0.5 ? '#4f9a3c' : '#62b046';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 10);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 2, y - 13);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 7, y - 9);
      ctx.stroke();
    } else {
      ctx.fillStyle = flowers[Math.floor(rand() * flowers.length)];
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 30, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Praças de pedra das bases
  for (const team of ['blue', 'red']) {
    const base = map.bases[team];
    ctx.save();
    ctx.beginPath();
    ctx.arc(base.x, base.y, base.radius + 30, 0, Math.PI * 2);
    ctx.fillStyle = '#a99c86';
    ctx.fill();
    ctx.clip();
    for (let r = base.radius + 30; r > 20; r -= 30) {
      const n = Math.max(6, Math.round((r * Math.PI * 2) / 44));
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2 + r * 0.01;
        const a1 = ((k + 1) / n) * Math.PI * 2 + r * 0.01;
        const shade = 176 + Math.floor(rand() * 28);
        ctx.fillStyle = `rgb(${shade},${shade - 10},${shade - 28})`;
        ctx.beginPath();
        ctx.arc(base.x, base.y, r - 3, a0 + 0.02, a1 - 0.02);
        ctx.arc(base.x, base.y, Math.max(0, r - 27), a1 - 0.02, a0 + 0.02, true);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(base.x, base.y, base.radius + 30, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = team === 'blue' ? '#2f5fb8' : '#a8332b';
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function stoneTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const rand = rng(5);
  g.fillStyle = '#7d7466';
  g.fillRect(0, 0, 256, 128);
  for (let row = 0; row < 4; row++) {
    let x = row % 2 ? -24 : 0;
    while (x < 256) {
      const w = 40 + rand() * 24;
      const shade = 150 + Math.floor(rand() * 40);
      g.fillStyle = `rgb(${shade + 10},${shade + 2},${shade - 14})`;
      g.beginPath();
      g.roundRect(x + 2, row * 32 + 2, w - 4, 28, 5);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(x + 4, row * 32 + 4, w - 8, 4);
      x += w;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

const WALL_H = 1.5;

function makeWall(o, tex) {
  const g = new THREE.Group();
  const w = o.w * S;
  const d = o.h * S;
  const geo = new THREE.BoxGeometry(w, WALL_H + 1.2, d);
  const long = Math.max(w, d);
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(long / 2.2, 1);
  const side = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  const top = new THREE.MeshStandardMaterial({ color: 0xc9bfa9, roughness: 0.9 });
  const box = new THREE.Mesh(geo, [side, side, top, top, side, side]);
  box.position.y = (WALL_H - 1.2) / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);
  // Ameias
  const merlon = new THREE.BoxGeometry(0.42, 0.4, 0.42);
  const horizontal = w >= d;
  const n = Math.floor(long / 0.75);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(merlon, top);
    const off = -long / 2 + 0.38 + i * 0.75;
    m.position.set(horizontal ? off : 0, WALL_H + 0.2, horizontal ? 0 : off);
    m.castShadow = true;
    g.add(m);
  }
  g.position.set((o.x + o.w / 2) * S, 0, (o.y + o.h / 2) * S);
  g.userData.span = { w: o.w, d: o.h };
  return g;
}

function placeModel(assets, name, x, y, scale, rotY = 0, sy = 1) {
  const m = assets.instance(name);
  if (!m) return null;
  m.scale.set(scale, scale * sy, scale);
  m.position.set(x * S, 0, y * S);
  m.rotation.y = rotY;
  return m;
}

export function buildStaticWorld(map, assets) {
  const root = new THREE.Group();
  const rand = rng(23);

  // Chão principal com relevo (platôs, rampas e vales) e o entorno plano em volta do mapa.
  const segX = Math.round(map.width / 24);
  const segY = Math.round(map.height / 24);
  const geo = new THREE.PlaneGeometry(map.width * S, map.height * S, segX, segY);
  geo.rotateX(-Math.PI / 2);
  geo.translate((map.width * S) / 2, 0, (map.height * S) / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(map, pos.getX(i) / S, pos.getZ(i) / S));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: makeGroundTexture(map), roughness: 1 }));
  ground.receiveShadow = true;
  root.add(ground);
  const outer = new THREE.Group();
  const W3 = map.width * S;
  const H3 = map.height * S;
  const M = Math.max(W3, H3) * 1.5;
  const outerMat = new THREE.MeshStandardMaterial({ color: 0x5f9a42, roughness: 1 });
  for (const [x, z, w, d] of [
    [W3 / 2, -M / 2, W3 + 2 * M, M], [W3 / 2, H3 + M / 2, W3 + 2 * M, M],
    [-M / 2, H3 / 2, M, H3], [W3 + M / 2, H3 / 2, M, H3],
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), outerMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, -0.01, z);
    m.receiveShadow = true;
    outer.add(m);
  }
  root.add(outer);

  const tex = stoneTexture();
  for (const o of map.obstacles) {
    if (o.kind === 'wall') root.add(makeWall(o, tex));
    else if (o.kind === 'tree') {
      const m = placeModel(assets, rand() < 0.5 ? 'tree_single_A' : 'tree_single_B', o.x + o.w / 2, o.y + o.h / 2, 2.7 + rand() * 0.6, rand() * 6.28);
      if (m) root.add(m);
    } else if (o.kind === 'crate') {
      const a = placeModel(assets, 'crate_A_big', o.x + o.w * 0.35, o.y + o.h * 0.55, 5.5, rand());
      const b = placeModel(assets, 'barrel', o.x + o.w * 0.8, o.y + o.h * 0.35, 5);
      if (a) root.add(a);
      if (b) root.add(b);
    } else if (o.kind === 'rock') {
      const big = o.w > 150 && o.h > 150;
      if (big) {
        const b = assets.bounds('mountain_A');
        const sx = (o.w * S) / (b ? b.max.x - b.min.x : 1.8);
        const sz = (o.h * S) / (b ? b.max.z - b.min.z : 1.8);
        const m = assets.instance(rand() < 0.5 ? 'mountain_A' : 'mountain_B');
        if (m) {
          m.scale.set(sx * 1.05, Math.min(sx, sz) * 0.75, sz * 1.05);
          m.position.set((o.x + o.w / 2) * S, 0, (o.y + o.h / 2) * S);
          root.add(m);
        }
      } else {
        // Aglomerado de pedras cobrindo a área.
        const step = 55;
        const cols = Math.max(1, Math.round(o.w / step));
        const rows = Math.max(1, Math.round(o.h / step));
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const x = o.x + ((i + 0.5) / cols) * o.w + (rand() - 0.5) * 12;
            const y = o.y + ((j + 0.5) / rows) * o.h + (rand() - 0.5) * 12;
            const m = placeModel(assets, rand() < 0.5 ? 'rock_single_A' : 'rock_single_B', x, y, 6.5 + rand() * 2.5, rand() * 6.28, 2.2);
            if (m) root.add(m);
          }
        }
      }
    }
  }

  // Moldura: montanhas e bosques fora da área jogável.
  const W = map.width;
  const H = map.height;
  const ring = [];
  for (let x = -200; x <= W + 200; x += 260) ring.push([x, -260 - rand() * 120], [x, H + 260 + rand() * 120]);
  for (let y = 0; y <= H; y += 260) ring.push([-260 - rand() * 120, y], [W + 260 + rand() * 120, y]);
  for (const [x, y] of ring) {
    const m = placeModel(assets, rand() < 0.5 ? 'mountain_A' : 'mountain_B', x, y, 3.5 + rand() * 2.5, rand() * 6.28);
    if (m) root.add(m);
  }
  for (let i = 0; i < 90; i++) {
    const side = Math.floor(rand() * 4);
    const t = rand();
    const off = 60 + rand() * 120;
    const x = side === 0 ? t * W : side === 1 ? t * W : side === 2 ? -off : W + off;
    const y = side === 0 ? -off : side === 1 ? H + off : t * H;
    const names = ['trees_A_large', 'trees_A_medium', 'trees_B_large', 'trees_A_small'];
    const m = placeModel(assets, names[Math.floor(rand() * names.length)], x, y, 2.2 + rand(), rand() * 6.28);
    if (m) root.add(m);
  }
  // Vilarejos de cada equipe do lado de fora do mapa e pequenos objetos junto às construções.
  for (const team of ['blue', 'red']) {
    const side = team === 'blue' ? -1 : 1;
    const x0 = team === 'blue' ? -170 : W + 170;
    const spots = [
      ['home_A', 0, 700], ['home_B', 60, 950], ['windmill', -40, 1250], ['well', 40, 1500],
      ['home_A', -20, 1750], ['home_B', 50, 2050], ['home_A', 0, 2300], ['tower_A', 30, 450],
    ];
    for (const [name, dx, y] of spots) {
      const m = placeModel(assets, `building_${name}_${team}`, x0 + side * dx, y, 2.6, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      if (m) root.add(m);
    }
  }
  const PROPS_BY_KIND = {
    lumbermill: ['resource_lumber', 'resource_lumber'], archeryrange: ['target', 'target'], mine: ['resource_stone', 'wheelbarrow'],
    tavern: ['barrel', 'sack'], blacksmith: ['resource_stone', 'barrel'], barracks: ['tent'], magetower: ['sack'], castle: ['tent', 'barrel'],
  };
  for (const b of map.buildings) {
    const names = PROPS_BY_KIND[b.kind];
    if (!names) continue;
    const back = b.team === 'red' ? 1 : -1; // lado oposto ao suporte de armas
    names.forEach((name, i) => {
      const x = b.x + b.w / 2 + back * (b.w / 2 + 20) * 0.6 + (i - (names.length - 1) / 2) * 10;
      const y = b.y + b.h + 24 + i * 10;
      const m = placeModel(assets, name, x, y, name === 'tent' ? 2.4 : 4, rand() * 6.28);
      if (m) root.add(m);
    });
  }

  // Tudo o que foi posto em y = 0 sobe para a altura do relevo (muralhas usam o ponto mais baixo).
  for (const o of root.children) {
    if (o === ground || o === outer) continue;
    const x = o.position.x / S;
    const y = o.position.z / S;
    let h = heightAt(map, x, y);
    if (o.userData.span) {
      const { w, d } = o.userData.span;
      for (const [dx, dy] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0, -0.5], [0, 0.5], [-0.5, 0], [0.5, 0]]) {
        h = Math.min(h, heightAt(map, x + dx * w, y + dy * d));
      }
    }
    o.position.y += h;
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.matrixAutoUpdate = true;
    }
  });
  ground.castShadow = false;
  outer.castShadow = false;
  return root;
}
