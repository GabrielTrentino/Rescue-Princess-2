// Peças 3D feitas por código no mesmo estilo low-poly dos modelos KayKit:
// alabarda, martelo e bacamarte do engenheiro, barricada, armadilha de espinhos, coroa da princesa,
// coxinha, seringa Jonmaros, jaula da prisão e os pontos fracos da muralha.
import * as THREE from 'three';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, flatShading: true, ...opts });
const WOOD = mat(0x9a6334);
const WOOD_DARK = mat(0x6e4524);
const METAL = mat(0xc9ced6, { metalness: 0.3, roughness: 0.4 });
const METAL_DARK = mat(0x7d838c, { metalness: 0.3, roughness: 0.5 });
const GOLD = mat(0xe8b84a, { metalness: 0.4, roughness: 0.4 });

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Alabarda: cabo longo, lâmina de machado e ponta de lança. Origem na empunhadura, ao longo de +y.
export function makeHalberd() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.7, 6), WOOD, 0, 0.75, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 6), GOLD, 0, 1.9, 0));
  const blade = new THREE.Shape();
  blade.moveTo(0, 0);
  blade.quadraticCurveTo(0.42, 0.05, 0.5, 0.32);
  blade.quadraticCurveTo(0.35, 0.36, 0, 0.42);
  blade.lineTo(0, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.04, bevelEnabled: false });
  bladeGeo.translate(0.03, 1.8, -0.02);
  g.add(mesh(bladeGeo, METAL));
  g.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 0.04), METAL_DARK, -0.12, 2.0, 0));
  g.add(mesh(new THREE.ConeGeometry(0.07, 0.4, 6), METAL, 0, 2.3, 0));
  return g;
}

// Martelo de engenheiro com cabeça grande.
export function makeHammer() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 6), WOOD, 0, 0.35, 0));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.26, 0.26), METAL_DARK, 0, 0.92, 0));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.3, 0.3), METAL, 0.28, 0.92, 0));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.3, 0.3), METAL, -0.28, 0.92, 0));
  return g;
}

// Barricada de troncos pontudos (unidades 3D; raio ~0.65).
export function makeBarricade() {
  const g = new THREE.Group();
  for (let i = -2; i <= 2; i++) {
    const h = 0.9 + (i % 2 === 0 ? 0.15 : 0);
    const log = mesh(new THREE.CylinderGeometry(0.11, 0.12, h, 6), i % 2 ? WOOD_DARK : WOOD, i * 0.24, h / 2, 0);
    log.rotation.z = i * 0.04;
    g.add(log);
    g.add(mesh(new THREE.ConeGeometry(0.12, 0.25, 6), WOOD, i * 0.24, h + 0.12, 0));
  }
  for (const y of [0.3, 0.65]) {
    const beam = mesh(new THREE.BoxGeometry(1.35, 0.1, 0.08), WOOD_DARK, 0, y, 0.14);
    g.add(beam);
  }
  // Escoras
  for (const x of [-0.45, 0.45]) {
    const s = mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), WOOD_DARK, x, 0.32, -0.25);
    s.rotation.x = 0.6;
    g.add(s);
  }
  return g;
}

// Armadilha de espinhos no chão.
export function makeTrap() {
  const g = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.06, 10), WOOD_DARK, 0, 0.03, 0);
  base.receiveShadow = true;
  g.add(base);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = i === 0 ? 0 : 0.25;
    g.add(mesh(new THREE.ConeGeometry(0.06, 0.28, 5), METAL, Math.cos(a) * r, 0.18, Math.sin(a) * r));
  }
  return g;
}

// Bacamarte (arma de pederneira com boca larga). Origem na empunhadura, cano ao longo de +y.
export function makeBlunderbuss() {
  const g = new THREE.Group();
  const stock = mesh(new THREE.BoxGeometry(0.1, 0.42, 0.16), WOOD_DARK, 0, -0.08, -0.03);
  stock.rotation.x = -0.25;
  g.add(stock);
  g.add(mesh(new THREE.BoxGeometry(0.09, 0.5, 0.11), WOOD, 0, 0.32, 0.02));
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.75, 8), METAL_DARK, 0, 0.7, 0.07));
  // Boca em forma de sino
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.16, 10, 1, true), METAL, 0, 1.12, 0.07));
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.12, 0.08), GOLD, 0.05, 0.22, 0.06));
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.1, 0.03), METAL, 0.05, 0.3, 0.1));
  for (const y of [0.45, 0.85]) g.add(mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 8), GOLD, 0, y, 0.07));
  return g;
}

// Coroa da princesa (unidades 3D, base com raio ~0.2).
export function makeCrown() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.1, 12, 1, true), GOLD, 0, 0.05, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(mesh(new THREE.ConeGeometry(0.05, 0.14, 4), GOLD, Math.cos(a) * 0.19, 0.16, Math.sin(a) * 0.19));
    g.add(mesh(new THREE.SphereGeometry(0.025, 6, 4), i % 2 ? mat(0xff4f8a) : mat(0x52c6ff), Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2));
  }
  return g;
}

// Coxinha de frango: gota dourada empanada com base achatada.
export function makeCoxinha() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    pts.push(new THREE.Vector2(Math.max(0.002, 0.25 * Math.sin(Math.PI * Math.sqrt(t))), t * 0.55));
  }
  const body = new THREE.LatheGeometry(pts, 14);
  g.add(mesh(body, mat(0xd98a2b, { roughness: 0.95 })));
  // Farelos de empanado
  const crumb = mat(0xf0b45a);
  for (let i = 0; i < 10; i++) {
    const a = i * 2.4;
    const y = 0.08 + (i / 10) * 0.32;
    const r = 0.25 * Math.sin(Math.PI * Math.sqrt(y / 0.55)) + 0.01;
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), crumb, Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return g;
}

// Seringa Jonmaros: corpo transparente com líquido verde, êmbolo e agulha.
export function makeSyringe() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), mat(0xe8f6ff, { transparent: true, opacity: 0.5, roughness: 0.1 }), 0, 0.35, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 10), mat(0x5cf06a, { emissive: 0x2a9a30, emissiveIntensity: 0.6 }), 0, 0.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), METAL, 0, 0.7, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 10), METAL_DARK, 0, 0.82, 0));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.03, 0.06), METAL_DARK, 0, 0.6, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.06, 8), METAL, 0, 0.08, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.22, 4), METAL, 0, -0.06, 0));
  return g;
}

// Jaula da prisão (raio ~0.75): grades e um aro no topo, aberta em cima para a princesa aparecer.
export function makeCage() {
  const g = new THREE.Group();
  const iron = METAL_DARK;
  g.add(mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.12, 14), mat(0x6f6a62), 0, 0.06, 0));
  const ring = mesh(new THREE.TorusGeometry(0.78, 0.04, 6, 20), iron, 0, 1.7, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (i === 3 || i === 4) continue; // porta aberta para a princesa sair
    g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.6, 5), iron, Math.cos(a) * 0.78, 0.9, Math.sin(a) * 0.78));
    g.add(mesh(new THREE.ConeGeometry(0.04, 0.14, 4), iron, Math.cos(a) * 0.78, 1.78, Math.sin(a) * 0.78));
  }
  return g;
}

// Ponto fraco da muralha: portão de madeira reforçado entre duas colunas de pedra.
// w e d em unidades 3D; altura igual à da muralha.
export function makeWallGate(w, d, height, stone) {
  const g = new THREE.Group();
  const horizontal = w >= d;
  const long = Math.max(w, d);
  const thick = Math.min(w, d);
  const pillarW = 0.45;
  for (const s of [-1, 1]) {
    const p = mesh(new THREE.BoxGeometry(pillarW, height + 0.7, thick * 1.15), stone, 0, (height + 0.7) / 2, 0);
    const off = s * (long / 2 - pillarW / 2);
    if (horizontal) p.position.x = off;
    else {
      p.position.z = off;
      p.rotation.y = Math.PI / 2;
    }
    g.add(p);
  }
  const doorLen = long - pillarW * 2;
  const door = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const plank = mesh(new THREE.BoxGeometry(doorLen / 5 - 0.02, height * 0.92, 0.14), i % 2 ? WOOD : WOOD_DARK, -doorLen / 2 + (i + 0.5) * (doorLen / 5), height * 0.46, 0);
    door.add(plank);
  }
  for (const y of [0.3, height * 0.75]) door.add(mesh(new THREE.BoxGeometry(doorLen, 0.12, 0.18), METAL_DARK, 0, y, 0));
  door.add(mesh(new THREE.BoxGeometry(doorLen * 0.98, 0.16, thick * 0.9), stone, 0, height + 0.08, 0));
  if (!horizontal) door.rotation.y = Math.PI / 2;
  g.add(door);
  g.userData.door = door;
  return g;
}

// Escombros de muralha derrubada.
export function makeRubble(w, d, stone) {
  const g = new THREE.Group();
  const long = Math.max(w, d);
  const horizontal = w >= d;
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9; i++) {
    const s = 0.22 + r() * 0.3;
    const m = mesh(new THREE.DodecahedronGeometry(s), stone, 0, s * 0.5, 0);
    const along = (r() - 0.5) * long;
    const across = (r() - 0.5) * 0.9;
    m.position.x = horizontal ? along : across;
    m.position.z = horizontal ? across : along;
    m.rotation.set(r() * 3, r() * 3, 0);
    g.add(m);
  }
  for (const s of [-1, 1]) {
    const p = mesh(new THREE.BoxGeometry(0.45, 0.9 + r() * 0.5, Math.min(w, d) * 1.1), stone, 0, 0.6, 0);
    if (horizontal) p.position.x = s * (long / 2 - 0.22);
    else {
      p.position.z = s * (long / 2 - 0.22);
      p.rotation.y = Math.PI / 2;
    }
    g.add(p);
  }
  return g;
}

export { mat };
