// Castelo da base principal (handoff do castelo): construído por código em módulos reutilizáveis
// (corpo de pedra, torres redondas com telhado cônico, portão em arco, bandeiras, estandartes e tochas).
// A estrutura é a mesma para as duas equipes; só mudam as cores dos telhados, bandeiras e símbolos.
// Também monta o portão principal da muralha do pátio. Unidades 3D; a frente olha para +x.
import * as THREE from 'three';

const TEAM = {
  blue: { roof: 0x3f7fe6, roofDark: 0x2a5bb3, cloth: 0x3d7be0, trim: 0xffd65a },
  red: { roof: 0xe0483d, roofDark: 0xa83128, cloth: 0xde4a3f, trim: 0xffd65a },
};

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...opts });
const WOOD = mat(0x8a5530);
const WOOD_DARK = mat(0x5e3a20);
const IRON = mat(0x4d4f55, { roughness: 0.6 });
const DARK = mat(0x2a2430, { roughness: 1 });
const GOLD = mat(0xffd65a, { metalness: 0.3, roughness: 0.5 });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffb340 });

let stoneCache = null;

// Pedra estilizada: blocos grandes em cinza, bege e marrom claro, com juntas visíveis.
function stoneMaterials() {
  if (stoneCache) return stoneCache;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  let seed = 9;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#8c8376';
  g.fillRect(0, 0, 256, 256);
  const tones = [[196, 188, 172], [182, 176, 166], [204, 190, 160], [176, 164, 146]];
  for (let row = 0; row < 6; row++) {
    let x = row % 2 ? -30 : 0;
    const h = 256 / 6;
    while (x < 256) {
      const w = 52 + r() * 30;
      const [cr, cg, cb] = tones[Math.floor(r() * tones.length)];
      const d = Math.floor(r() * 14) - 7;
      g.fillStyle = `rgb(${cr + d},${cg + d},${cb + d})`;
      g.beginPath();
      g.roundRect(x + 3, row * h + 3, w - 6, h - 6, 7);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(x + 6, row * h + 5, w - 12, 4);
      x += w;
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const make = (rx, ry) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  };
  stoneCache = {
    wall: make(1.4, 1.2),
    tower: make(2.2, 1.4),
    plain: mat(0xc9bfa9),
    dark: mat(0x9a907f),
  };
  return stoneCache;
}

function add(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Bandeira que tremula (o renderizador anima os vértices de quem tem userData.wave).
export function makeFlag(color, { w = 0.9, h = 0.55, pole = 1.1 } = {}) {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.035, 0.04, pole, 6), IRON, 0, pole / 2, 0);
  add(g, new THREE.SphereGeometry(0.07, 8, 6), GOLD, 0, pole + 0.04, 0);
  const geo = new THREE.PlaneGeometry(w, h, 8, 2);
  geo.translate(w / 2, 0, 0);
  const cloth = add(g, geo, mat(color, { side: THREE.DoubleSide, flatShading: false }), 0.02, pole - h / 2 - 0.05, 0);
  cloth.userData.wave = { base: Float32Array.from(geo.attributes.position.array), w, phase: Math.random() * 6 };
  return g;
}

// Lista as bandeiras e tochas de um grupo, para animar sem percorrer a cena toda a cada quadro.
export function collectAnimated(root) {
  const list = [];
  root.traverse((o) => {
    if (o.userData?.wave || o.userData?.flicker) list.push(o);
  });
  return list;
}

// Bandeiras tremulam e tochas oscilam.
export function animateCastleParts(list, time) {
  for (const o of list) {
    const wave = o.userData.wave;
    if (!wave) {
      const k = 1 + Math.sin(time * 17 + o.id) * 0.12 + Math.sin(time * 29 + o.id * 3) * 0.08;
      o.scale.set(k, k * 1.1, k);
      continue;
    }
    const pos = o.geometry.attributes.position;
    const base = wave.base;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const k = x / wave.w;
      pos.setZ(i, Math.sin(time * 5 + wave.phase - x * 5) * 0.09 * k);
      pos.setY(i, base[i * 3 + 1] - k * k * 0.06);
    }
    pos.needsUpdate = true;
  }
}

// Anel de ameias no topo de uma torre redonda.
function crenellate(parent, radius, y, material, count = 10) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const m = add(parent, new THREE.BoxGeometry(0.26, 0.32, 0.24), material, Math.cos(a) * radius, y, Math.sin(a) * radius);
    m.rotation.y = -a;
  }
}

// Janela escura de topo arredondado, colada numa parede voltada para (nx, nz).
function windowAt(parent, x, y, z, ry, s = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.11, 0);
  shape.lineTo(-0.11, 0.22);
  shape.absarc(0, 0.22, 0.11, Math.PI, 0, true);
  shape.lineTo(0.11, 0);
  shape.lineTo(-0.11, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
  const m = add(parent, geo, DARK, x, y, z);
  m.rotation.y = ry;
  m.scale.setScalar(s);
  return m;
}

// Torre redonda: base larga, ameias, telhado cônico da equipe, janelas e bandeira no topo.
function makeTower(colors, { radius = 0.85, height = 3.4, roof = true, flag = true, broken = false }) {
  const s = stoneMaterials();
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(radius, radius * 1.15, height, 14), s.tower, 0, height / 2, 0);
  add(g, new THREE.CylinderGeometry(radius * 1.2, radius * 1.24, 0.35, 14), s.dark, 0, 0.17, 0);
  if (broken) {
    // Topo desmoronado: blocos tortos no lugar das ameias e do telhado.
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      const b = add(g, new THREE.BoxGeometry(0.4, 0.3 + (i % 3) * 0.12, 0.34), s.plain, Math.cos(a) * radius * 0.8, height + 0.1, Math.sin(a) * radius * 0.8);
      b.rotation.set(i * 0.4, a, i * 0.25);
    }
    return g;
  }
  add(g, new THREE.CylinderGeometry(radius * 1.12, radius * 1.05, 0.22, 14), s.plain, 0, height + 0.06, 0);
  if (roof) {
    add(g, new THREE.ConeGeometry(radius * 1.3, radius * 1.9, 14), mat(colors.roof), 0, height + 0.17 + radius * 0.95, 0);
    add(g, new THREE.CylinderGeometry(radius * 1.3, radius * 1.3, 0.1, 14), mat(colors.roofDark), 0, height + 0.2, 0);
    if (flag) {
      const f = makeFlag(colors.cloth, { pole: 0.9 });
      f.position.y = height + 0.15 + radius * 1.9;
      g.add(f);
    }
  } else {
    crenellate(g, radius * 1.0, height + 0.32, s.plain);
  }
  for (let i = 0; i < 3; i++) {
    const a = 0.4 + i * 2.1;
    windowAt(g, Math.cos(a) * radius * 1.02, height * 0.55, Math.sin(a) * radius * 1.02, Math.PI / 2 - a);
  }
  return g;
}

// Portão em arco: moldura de pedra saliente, recuo escuro e duas folhas de madeira com ferragens.
function makeArchGate(width, height, depth, { open = 0, rise = null } = {}) {
  const s = stoneMaterials();
  const g = new THREE.Group();
  const outer = new THREE.Shape();
  const ow = width / 2 + 0.3;
  const iw = width / 2;
  // Altura da curva do arco (rise menor = arco mais achatado).
  const ry = rise ?? iw;
  outer.moveTo(-ow, 0);
  outer.lineTo(-ow, height);
  outer.absellipse(0, height, ow, ry + 0.3, Math.PI, 0, true);
  outer.lineTo(ow, 0);
  outer.lineTo(-ow, 0);
  const hole = new THREE.Path();
  hole.moveTo(-iw, 0);
  hole.lineTo(iw, 0);
  hole.lineTo(iw, height);
  hole.absellipse(0, height, iw, ry, 0, Math.PI, false);
  hole.lineTo(-iw, 0);
  outer.holes.push(hole);
  const frame = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1, curveSegments: 10 });
  add(g, frame, s.plain, 0, 0, -depth / 2);
  // Pedra-chave dourada no alto do arco.
  add(g, new THREE.BoxGeometry(0.26, 0.34, depth + 0.1), GOLD, 0, height + ry + 0.18, 0);
  // Recuo escuro atrás das folhas.
  const back = new THREE.Shape();
  back.moveTo(-iw, 0);
  back.lineTo(-iw, height);
  back.absellipse(0, height, iw, ry, Math.PI, 0, true);
  back.lineTo(iw, 0);
  back.lineTo(-iw, 0);
  add(g, new THREE.ShapeGeometry(back, 10), DARK, 0, 0, -depth / 2 + 0.02);
  // Folhas do portão (abrem girando nas dobradiças).
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * iw, 0, -depth / 2 + 0.1);
    const leaf = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      add(leaf, new THREE.BoxGeometry(iw / 3 - 0.02, height + ry * 0.55, 0.1), i % 2 ? WOOD : WOOD_DARK, -side * (iw / 3) * (i + 0.5), (height + ry * 0.55) / 2, 0);
    }
    for (const y of [0.35, height * 0.85]) add(leaf, new THREE.BoxGeometry(iw * 0.95, 0.09, 0.14), IRON, -side * iw / 2, y, 0.02);
    add(leaf, new THREE.TorusGeometry(0.07, 0.02, 4, 8), IRON, -side * iw * 0.8, height * 0.5, 0.08);
    hinge.add(leaf);
    hinge.rotation.y = side * open * 1.35;
    g.add(hinge);
  }
  return g;
}

function makeTorch() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), WOOD_DARK, 0, 0.25, 0);
  add(g, new THREE.CylinderGeometry(0.09, 0.06, 0.12, 6), IRON, 0, 0.52, 0);
  const flame = add(g, new THREE.ConeGeometry(0.08, 0.24, 6), FLAME, 0, 0.68, 0);
  flame.castShadow = false;
  flame.userData.flicker = true;
  return g;
}

// Estandarte vertical da equipe com o símbolo da coroa.
function makeBanner(colors, h = 1.3) {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(0.7, 0.06, 0.06), WOOD_DARK, 0, h, 0);
  const cloth = new THREE.Shape();
  cloth.moveTo(-0.3, 0);
  cloth.lineTo(-0.3, -h + 0.25);
  cloth.lineTo(0, -h);
  cloth.lineTo(0.3, -h + 0.25);
  cloth.lineTo(0.3, 0);
  cloth.lineTo(-0.3, 0);
  add(g, new THREE.ExtrudeGeometry(cloth, { depth: 0.03, bevelEnabled: false }), mat(colors.cloth), 0, h - 0.03, 0);
  add(g, new THREE.CircleGeometry(0.17, 12), mat(colors.trim), 0, h - 0.45, 0.04);
  const crown = new THREE.Shape();
  crown.moveTo(-0.1, -0.06);
  crown.lineTo(-0.1, 0.05);
  crown.lineTo(-0.05, 0);
  crown.lineTo(0, 0.07);
  crown.lineTo(0.05, 0);
  crown.lineTo(0.1, 0.05);
  crown.lineTo(0.1, -0.06);
  crown.lineTo(-0.1, -0.06);
  add(g, new THREE.ShapeGeometry(crown), mat(colors.roofDark), 0, h - 0.45, 0.05);
  return g;
}

/**
 * Castelo principal. Pegada aproximada de `w` (x, frente) por `d` (z) unidades.
 * state: 'intact' ou 'damaged' (vida baixa: uma torre desmorona e aparecem escombros).
 */
export function buildCastle(team, w, d, state = 'intact') {
  const colors = TEAM[team] ?? TEAM.blue;
  const s = stoneMaterials();
  const g = new THREE.Group();
  const damaged = state === 'damaged';
  // Nível 1: base de pedra e degraus até o portão.
  add(g, new THREE.BoxGeometry(w * 0.98, 0.4, d * 0.98), s.dark, 0, 0.2, 0);
  for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.3, 0.13 * (3 - i), 1.7), s.plain, w * 0.49 + 0.15 + i * 0.3 - 0.3, 0.065 * (3 - i), 0);
  // Nível 2: corpo central com ameias.
  const kw = w * 0.62;
  const kd = d * 0.6;
  const kh = 2.6;
  const kx = -w * 0.04;
  add(g, new THREE.BoxGeometry(kw, kh, kd), s.wall, kx, 0.4 + kh / 2, 0);
  add(g, new THREE.BoxGeometry(kw + 0.16, 0.18, kd + 0.16), s.plain, kx, 0.4 + kh, 0);
  const merlonGeo = new THREE.BoxGeometry(0.3, 0.32, 0.3);
  for (let i = 0; i < 5; i++) {
    const t = -kw / 2 + 0.2 + (i / 4) * (kw - 0.4);
    add(g, merlonGeo, s.plain, kx + t, 0.4 + kh + 0.25, kd / 2);
    add(g, merlonGeo, s.plain, kx + t, 0.4 + kh + 0.25, -kd / 2);
    const u = -kd / 2 + 0.2 + (i / 4) * (kd - 0.4);
    add(g, merlonGeo, s.plain, kx + kw / 2, 0.4 + kh + 0.25, u);
    add(g, merlonGeo, s.plain, kx - kw / 2, 0.4 + kh + 0.25, u);
  }
  // Janelas do corpo central.
  for (const z of [-kd * 0.3, kd * 0.3]) windowAt(g, kx + kw / 2 + 0.01, 0.4 + kh * 0.62, z, Math.PI / 2, 1.2);
  for (const x of [kx - kw * 0.25, kx + kw * 0.25]) {
    windowAt(g, x, 0.4 + kh * 0.55, kd / 2 + 0.01, 0, 1.2);
    windowAt(g, x, 0.4 + kh * 0.55, -kd / 2 - 0.01, Math.PI, 1.2);
  }
  // Portão principal na frente, com estandartes e tochas.
  const gate = makeArchGate(1.25, 1.15, 0.5, { open: 0.15 });
  gate.rotation.y = Math.PI / 2;
  gate.position.set(kx + kw / 2 + 0.05, 0.4, 0);
  g.add(gate);
  for (const z of [-1, 1]) {
    const b = makeBanner(colors);
    b.rotation.y = Math.PI / 2;
    b.position.set(kx + kw / 2 + 0.03, 0.4 + kh - 1.35, z * 1.15);
    g.add(b);
    const t = makeTorch();
    t.position.set(kx + kw / 2 + 0.35, 0.4, z * 0.95);
    g.add(t);
  }
  // Nível 3: torre central (donjon) e quatro torres de canto com alturas diferentes.
  const keepTop = 0.4 + kh;
  const donjon = makeTower(colors, { radius: 0.95, height: 2.0 });
  donjon.position.set(kx - 0.25, keepTop, 0);
  g.add(donjon);
  const corners = [
    [w * 0.36, d * 0.36, 3.0], [w * 0.36, -d * 0.36, 3.0],
    [-w * 0.38, d * 0.36, 3.6], [-w * 0.38, -d * 0.36, 3.9],
  ];
  corners.forEach(([x, z, h], i) => {
    const t = makeTower(colors, { radius: 0.78, height: h, roof: i !== 1 || !damaged, broken: damaged && i === 1, flag: i >= 2 });
    t.position.set(x, 0.4, z);
    g.add(t);
  });
  // Ameias e plataforma na torre da frente que não tem telhado.
  if (damaged) {
    for (let i = 0; i < 8; i++) {
      const r = add(g, new THREE.DodecahedronGeometry(0.18 + (i % 3) * 0.08), s.plain, w * 0.45 + (i % 3) * 0.2, 0.55, -d * 0.2 - i * 0.18);
      r.rotation.set(i, i * 2, 0);
    }
  }
  // Barris e caixas junto à base, fora do caminho do portão.
  add(g, new THREE.CylinderGeometry(0.18, 0.16, 0.36, 8), WOOD, -w * 0.47, 0.58, d * 0.05);
  add(g, new THREE.BoxGeometry(0.34, 0.34, 0.34), WOOD_DARK, -w * 0.47, 0.57, -d * 0.12);
  return g;
}

/**
 * Portão principal da muralha do pátio: duas torres redondas e um arco com portão de madeira aberto.
 * `span` é a largura da passagem (unidades 3D); a frente olha para +x.
 */
export function buildGatehouse(team, span, wallHeight, wallThick) {
  const colors = TEAM[team] ?? TEAM.blue;
  const s = stoneMaterials();
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const t = makeTower(colors, { radius: 0.62, height: wallHeight + 1.2, flag: true });
    t.position.set(0, 0, side * (span / 2 + 0.25));
    g.add(t);
  }
  // Arco achatado, alto o bastante para os personagens passarem por baixo sem sumir.
  const archH = 1.7;
  const rise = 0.6;
  const arch = makeArchGate(span - 0.4, archH, wallThick * 1.3, { open: 1, rise });
  arch.rotation.y = Math.PI / 2;
  g.add(arch);
  const top = archH + rise + 0.35;
  add(g, new THREE.BoxGeometry(wallThick * 1.4, 0.3, span + 0.6), s.plain, 0, top, 0);
  for (let i = 0; i < 5; i++) add(g, new THREE.BoxGeometry(0.28, 0.3, 0.28), s.plain, 0, top + 0.3, -span / 2 + (i + 0.5) * (span / 5));
  const b = makeBanner(colors, 1.0);
  b.rotation.y = Math.PI / 2;
  b.position.set(wallThick * 0.7, top - 1.05, 0);
  g.add(b);
  for (const side of [-1, 1]) {
    const t = makeTorch();
    t.position.set(wallThick * 0.9, 0, side * (span / 2 - 0.2));
    g.add(t);
  }
  return g;
}
