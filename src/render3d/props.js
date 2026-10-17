// Peças 3D feitas por código no mesmo estilo low-poly dos modelos KayKit:
// alabarda, martelo do engenheiro, barricada e armadilha de espinhos.
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

export { mat };
