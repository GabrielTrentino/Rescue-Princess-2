// Desenha a partida em 3D (Three.js): cenário, construções, defesas, armas no chão, personagens,
// projéteis, zonas e efeitos. Só lê o estado do jogo; a simulação continua toda em 2D (pixels).
import * as THREE from 'three';
import { S, toVec3 } from './CameraRig.js';
import { CharacterView } from './CharacterView.js';
import { buildStaticWorld } from './WorldBuilder.js';
import { makeHalberd, makeHammer, makeBarricade, makeTrap } from './props.js';
import { FX_COLORS, TEAM_COLORS } from '../render/palette.js';

const BUILDING_MODEL = {
  castle: 'castle', barracks: 'barracks', lumbermill: 'lumbermill', magetower: 'tower_B', archeryrange: 'archeryrange',
  tavern: 'tavern', blacksmith: 'blacksmith', mine: 'mine', market: 'market',
};
const TIER_GLOW = { 1: 0xfff6dc, 2: 0x7fd0ff, 3: 0xffc93a };
const HAND_HEIGHT = 1.0;

const basic = (color, opacity = 1, extra = {}) => new THREE.MeshBasicMaterial({
  color, transparent: opacity < 1, opacity, depthWrite: false, ...extra,
});

function flatOnGround(mesh, y = 0.04) {
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

export class Renderer3D {
  constructor(canvas, rig, assets) {
    this.canvas = canvas;
    this.rig = rig;
    this.assets = assets;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa8d8f0);
    this.scene.fog = new THREE.Fog(0xa8d8f0, 45, 110);
    const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x5c7a3a, 1.35);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.dynamic = new THREE.Group();
    this.scene.add(this.dynamic);
    this.mapId = null;
    this.reset();
  }

  setSize(w, h, pixelRatio) {
    this.gl.setPixelRatio(pixelRatio);
    this.gl.setSize(w, h, false);
  }

  // Limpa tudo o que pertence à partida anterior (o cenário estático é reaproveitado se o mapa for o mesmo).
  reset() {
    for (const v of this.characters?.values() ?? []) v.dispose();
    this.dynamic.clear();
    this.characters = new Map();
    this.buildings = new Map();
    this.drops = new Map();
    this.defenses = new Map();
    this.projectiles = new Map();
    this.zones = new Map();
    this.fx = new Map();
    this.match = null;
  }

  ensureStatic(map) {
    if (this.mapId === map.id) return;
    if (this.staticWorld) this.scene.remove(this.staticWorld);
    this.staticWorld = buildStaticWorld(map, this.assets);
    this.scene.add(this.staticWorld);
    this.mapId = map.id;
  }

  // ---------- Construções ----------
  fitModel(name, footprint, heightCap = Infinity) {
    const m = this.assets.instance(name);
    if (!m) return null;
    const b = this.assets.bounds(name);
    const size = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    let k = footprint / size;
    const h = (b.max.y - b.min.y) * k;
    if (h > heightCap) k *= heightCap / h;
    m.scale.setScalar(k);
    m.position.set(-(b.min.x + b.max.x) / 2 * k, -b.min.y * k, -(b.min.z + b.max.z) / 2 * k);
    const wrap = new THREE.Group();
    wrap.add(m);
    return wrap;
  }

  buildingKey(b) {
    return `${b.kind}|${b.team}|${b.destroyed ? 1 : 0}|${b.level}`;
  }

  makeBuilding(b) {
    const g = new THREE.Group();
    const foot = Math.min(b.rect.w, b.rect.h) * S;
    const team = b.team === 'red' ? 'red' : 'blue';
    const name = b.destroyed ? 'building_destroyed' : `building_${BUILDING_MODEL[b.kind]}_${team}`;
    const model = this.fitModel(name, foot * (b.destroyed ? 1.05 : 1.12), b.kind === 'castle' ? 7 : 5);
    if (model) {
      // A frente da construção olha para o centro do mapa.
      model.rotation.y = b.team === 'red' ? -Math.PI / 2 : Math.PI / 2;
      g.add(model);
    }
    if (!b.destroyed && b.team !== 'neutral') {
      // Uma bandeira por nível na frente da construção.
      for (let i = 0; i < b.level; i++) {
        const f = this.assets.instance(`flag_${team}`);
        if (!f) break;
        f.scale.setScalar(5);
        const side = b.team === 'red' ? -1 : 1;
        f.position.set(side * (b.rect.w * S) / 2 * 0.95, 0, ((i - (b.level - 1) / 2) * 0.9));
        g.add(f);
      }
    }
    if (b.classId) {
      const rack = this.assets.instance('weaponrack');
      if (rack) {
        rack.scale.setScalar(5);
        rack.position.set((b.rack.x - b.pos.x) * S, 0, (b.rack.y - b.pos.y + 11) * S);
        rack.rotation.y = Math.PI / 2;
        g.add(rack);
      }
    }
    toVec3(b.pos.x, b.pos.y, 0, g.position);
    g.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      // Material próprio para poder ficar translúcido quando esconde o jogador.
      o.material = o.material.clone();
      o.material.transparent = true;
      g.userData.materials = (g.userData.materials ?? []).concat(o.material);
    });
    g.userData.opacity = 1;
    return g;
  }

  // Construção entre a câmera e o foco fica translúcida para não esconder os personagens.
  occludes(b, focus) {
    if (!focus) return false;
    const dx = (b.pos.x - focus.x) * S;
    const dz = (b.pos.y - focus.y) * S;
    const yaw = this.rig.yaw;
    const along = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const side = Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw));
    const half = (Math.max(b.rect.w, b.rect.h) * S) / 2;
    return along > -half * 0.6 && along < 12 && side < half + 0.9;
  }

  syncBuildings(world, focus, dt) {
    for (const b of world.buildings) {
      const key = this.buildingKey(b);
      let entry = this.buildings.get(b.id);
      if (!entry || entry.key !== key) {
        if (entry) this.dynamic.remove(entry.group);
        entry = { key, group: this.makeBuilding(b) };
        this.buildings.set(b.id, entry);
        this.dynamic.add(entry.group);
      }
      // Tremida ao receber dano.
      const shake = b.hurtTimer > 0 ? Math.sin(this.time * 60) * 0.04 : 0;
      entry.group.position.x = b.pos.x * S + shake;
      const u = entry.group.userData;
      const goal = !b.destroyed && this.occludes(b, focus) ? 0.3 : 1;
      if (u.materials && Math.abs(u.opacity - goal) > 0.001) {
        u.opacity += (goal - u.opacity) * Math.min(1, dt * 8);
        if (Math.abs(u.opacity - goal) < 0.01) u.opacity = goal;
        for (const m of u.materials) {
          m.opacity = u.opacity;
          m.depthWrite = u.opacity > 0.99;
        }
      }
    }
  }

  // ---------- Armas no chão ----------
  weaponModel(classId) {
    const g = new THREE.Group();
    const add = (name, x = 0, rz = 0, s = 0.75) => {
      const m = this.assets.instance(name);
      if (!m) return;
      m.scale.setScalar(s);
      m.position.x = x;
      m.rotation.z = rz;
      g.add(m);
    };
    switch (classId) {
      case 'warrior':
        add('sword_1handed', -0.15, 0.15);
        add('shield_round', 0.25, 0, 0.6);
        break;
      case 'barbarian': add('axe_2handed', 0, 0, 0.7); break;
      case 'mage': add('staff', 0, 0, 0.7); break;
      case 'archer': {
        add('crossbow_2handed', 0, 0, 0.8);
        g.children[0]?.rotation.set(-Math.PI / 2, 0, 0);
        break;
      }
      case 'mercenary':
        add('dagger', -0.12, 0.3);
        add('dagger', 0.12, -0.3);
        break;
      case 'halberdier': {
        const h = makeHalberd();
        h.scale.setScalar(0.55);
        h.position.y = -0.4;
        g.add(h);
        break;
      }
      case 'engineer': {
        const h = makeHammer();
        h.scale.setScalar(0.9);
        h.position.y = -0.3;
        g.add(h);
        break;
      }
      default: break;
    }
    return g;
  }

  makeDrop(d) {
    const g = new THREE.Group();
    const glowColor = TIER_GLOW[d.tier] ?? TIER_GLOW[1];
    const disc = flatOnGround(new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), basic(glowColor, 0.35)));
    const ring = flatOnGround(new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 24), basic(glowColor, 0.85)), 0.05);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 2.2, 12, 1, true),
      basic(glowColor, 0.16, { side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    beam.position.y = 1.1;
    const weapon = this.weaponModel(d.classId);
    weapon.position.y = 0.9;
    g.add(disc, ring, beam, weapon);
    g.userData = { weapon, ring, beam, born: this.time };
    toVec3(d.pos.x, d.pos.y, 0, g.position);
    return g;
  }

  syncDrops(world) {
    const seen = new Set();
    for (const d of world.drops) {
      seen.add(d.id);
      let g = this.drops.get(d.id);
      if (!g) {
        g = this.makeDrop(d);
        this.drops.set(d.id, g);
        this.dynamic.add(g);
      }
      const u = g.userData;
      const t = this.time + d.id;
      u.weapon.rotation.y = t * 1.6;
      u.weapon.position.y = 0.9 + Math.sin(t * 2.4) * 0.12;
      const grow = Math.min(1, (this.time - u.born) * 3);
      g.scale.setScalar(grow);
      u.beam.material.opacity = d.claimedBy ? 0.4 : 0.16;
      // Pisca antes de sumir.
      g.visible = !(d.buildingId === null && d.age > 80 && Math.sin(this.time * 18) > 0);
    }
    for (const [id, g] of this.drops) {
      if (!seen.has(id)) {
        this.dynamic.remove(g);
        this.drops.delete(id);
      }
    }
  }

  // ---------- Defesas do Engenheiro ----------
  makeDefense(d) {
    const team = d.team === 'red' ? 'red' : 'blue';
    let g;
    if (d.kind === 'arrowTower') g = this.fitModel(`building_tower_A_${team}`, 1.5);
    else if (d.kind === 'catapult') g = this.fitModel(`building_tower_catapult_${team}`, 1.9);
    else if (d.kind === 'barricade') {
      g = new THREE.Group();
      const b = makeBarricade();
      b.rotation.y = Math.PI / 2;
      g.add(b);
    } else {
      g = new THREE.Group();
      g.add(makeTrap());
    }
    g = g ?? new THREE.Group();
    const ring = flatOnGround(new THREE.Mesh(new THREE.RingGeometry(d.radius * S * 1.05, d.radius * S * 1.25, 24), basic(TEAM_COLORS[team].main, 0.7)), 0.03);
    g.add(ring);
    g.traverse((o) => {
      if (o.isMesh && o !== ring) o.castShadow = true;
    });
    toVec3(d.pos.x, d.pos.y, 0, g.position);
    g.userData = { born: this.time };
    return g;
  }

  syncDefenses(world) {
    const seen = new Set();
    for (const d of world.defenses) {
      seen.add(d.id);
      let g = this.defenses.get(d.id);
      if (!g) {
        g = this.makeDefense(d);
        this.defenses.set(d.id, g);
        this.dynamic.add(g);
      }
      // Sobe do chão ao ser construída.
      const k = Math.min(1, (this.time - g.userData.born) * 2.5);
      g.scale.set(1, 0.2 + 0.8 * k, 1);
    }
    for (const [id, g] of this.defenses) {
      if (!seen.has(id)) {
        this.dynamic.remove(g);
        this.defenses.delete(id);
      }
    }
  }

  // ---------- Personagens ----------
  syncCharacters(world, dt) {
    for (const c of world.characters) {
      let v = this.characters.get(c.id);
      if (!v) {
        v = new CharacterView(this.assets, c, this.dynamic);
        this.characters.set(c.id, v);
      }
      v.update(c, dt, this.time);
    }
  }

  onAbility(casterId, index) {
    this.characters.get(casterId)?.onAbility(index);
  }

  // ---------- Projéteis ----------
  makeProjectile(p) {
    const color = new THREE.Color(FX_COLORS[p.visual] ?? '#ffffff');
    const g = new THREE.Group();
    if (p.visual === 'arrow' || p.visual === 'arrowBig' || p.visual === 'arrows') {
      const a = this.assets.instance('arrow');
      if (a) {
        a.scale.setScalar(p.visual === 'arrowBig' ? 1.4 : 1);
        a.rotation.x = Math.PI / 2; // o modelo aponta para +y; o grupo aponta para +z
        g.add(a);
      }
    } else if (p.visual === 'boulder') {
      g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), new THREE.MeshStandardMaterial({ color: 0x8a8278, flatShading: true })));
    } else if (p.visual === 'lightning') {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), basic(color, 1, { blending: THREE.AdditiveBlending })));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.4), basic(color, 0.4, { blending: THREE.AdditiveBlending })));
    } else if (p.visual === 'stone') {
      g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.12), new THREE.MeshStandardMaterial({ color: 0x9a948a, flatShading: true })));
    } else {
      const r = Math.max(0.14, p.radius * S);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 12, 8), basic(0xffffff)));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), basic(color, 0.75, { blending: THREE.AdditiveBlending })));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.8, 14, 10), basic(color, 0.22, { blending: THREE.AdditiveBlending })));
    }
    if (p.visual === 'hook') {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x9a9aa5 }));
      line.frustumCulled = false;
      g.userData.line = line;
      this.dynamic.add(line);
    }
    return g;
  }

  syncProjectiles(world) {
    const seen = new Set();
    const look = new THREE.Vector3();
    for (const p of world.projectiles) {
      seen.add(p.id);
      let g = this.projectiles.get(p.id);
      if (!g) {
        g = this.makeProjectile(p);
        this.projectiles.set(p.id, g);
        this.dynamic.add(g);
      }
      toVec3(p.pos.x, p.pos.y, HAND_HEIGHT, g.position);
      look.set(g.position.x + p.dir.x, HAND_HEIGHT, g.position.z + p.dir.y);
      g.lookAt(look);
      if (p.visual === 'boulder' || p.visual === 'stone') g.rotation.x += this.time * 8;
      const line = g.userData.line;
      if (line) {
        const owner = world.getCharacter(p.ownerId);
        if (owner) {
          const pos = line.geometry.attributes.position;
          pos.setXYZ(0, owner.pos.x * S, HAND_HEIGHT, owner.pos.y * S);
          pos.setXYZ(1, g.position.x, HAND_HEIGHT, g.position.z);
          pos.needsUpdate = true;
        }
      }
    }
    for (const [id, g] of this.projectiles) {
      if (!seen.has(id)) {
        this.dynamic.remove(g);
        if (g.userData.line) this.dynamic.remove(g.userData.line);
        this.projectiles.delete(id);
      }
    }
  }

  // ---------- Zonas persistentes (nevasca, fumaça, tempestade...) ----------
  syncZones(world) {
    const seen = new Set();
    for (const z of world.zones) {
      seen.add(z);
      let g = this.zones.get(z);
      if (!g) {
        const color = new THREE.Color(FX_COLORS[z.visual] ?? '#ffffff');
        g = new THREE.Group();
        const r = z.radius * S;
        const fill = flatOnGround(new THREE.Mesh(new THREE.CircleGeometry(r, 40), basic(color, 0.3)), 0.05);
        const edge = flatOnGround(new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 48), basic(color, 0.85)), 0.06);
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          basic(color, z.visual === 'smoke' ? 0.45 : 0.12, { side: THREE.DoubleSide }),
        );
        dome.scale.y = z.visual === 'smoke' ? 0.45 : 0.3;
        g.add(fill, edge, dome);
        g.userData = { fill, edge, dome };
        toVec3(z.x, z.y, 0, g.position);
        this.zones.set(z, g);
        this.dynamic.add(g);
      }
      const fade = Math.max(0, Math.min(1, z.remaining / 0.4, (z.duration - z.remaining) / 0.2 + 0.3));
      const u = g.userData;
      u.fill.material.opacity = 0.3 * fade;
      u.edge.material.opacity = 0.85 * fade;
      u.dome.material.opacity = (z.visual === 'smoke' ? 0.5 : 0.12) * fade;
      u.dome.rotation.y = this.time * 0.6;
      if (z.visual === 'storm') u.edge.material.color.setHSL(0.15, 1, 0.55 + 0.3 * Math.random());
    }
    for (const [z, g] of this.zones) {
      if (!seen.has(z)) {
        this.dynamic.remove(g);
        this.zones.delete(z);
      }
    }
  }

  // ---------- Efeitos de chão (anéis, explosões, avisos, golpes, colunas de luz) ----------
  makeFx(it) {
    const color = new THREE.Color(it.color ?? '#ffffff');
    const g = new THREE.Group();
    const r = (it.radius ?? 40) * S;
    switch (it.type) {
      case 'ring': {
        g.add(flatOnGround(new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r, 40), basic(color, 0.9)), 0.07));
        break;
      }
      case 'blast': {
        g.add(flatOnGround(new THREE.Mesh(new THREE.CircleGeometry(r, 40), basic(color, 0.45, { blending: THREE.AdditiveBlending })), 0.07));
        const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), basic(color, 0.35, { blending: THREE.AdditiveBlending }));
        dome.scale.y = 0.6;
        g.add(dome);
        break;
      }
      case 'telegraph': {
        g.add(flatOnGround(new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r, 48), basic(color, 0.9)), 0.07));
        const fill = flatOnGround(new THREE.Mesh(new THREE.CircleGeometry(r, 40), basic(color, 0.25)), 0.06);
        g.add(fill);
        g.userData.fill = fill;
        break;
      }
      case 'rise': {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2, 24, 1, true), basic(color, 0.35, { side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        cyl.position.y = 1;
        g.add(cyl);
        break;
      }
      case 'beam': {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 6, 20, 1, true), basic(color, 0.5, { side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        cyl.position.y = 3;
        g.add(cyl);
        g.add(flatOnGround(new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 32), basic(color, 0.9, { blending: THREE.AdditiveBlending })), 0.07));
        break;
      }
      case 'slash': {
        const inner = Math.max(0.2, r * 0.35);
        const geo = new THREE.RingGeometry(inner, r, 24, 1, -it.arc / 2, it.arc);
        const m = new THREE.Mesh(geo, basic(color, 0.65, { side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = -it.angle;
        m.position.y = 0.8;
        g.add(m);
        break;
      }
      case 'boulder': {
        g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.45), new THREE.MeshStandardMaterial({ color: 0x8a8278, flatShading: true })));
        break;
      }
      default:
        return null;
    }
    toVec3(it.x, it.y, 0, g.position);
    return g;
  }

  syncFx(effects, world) {
    const seen = new Set();
    for (const it of effects.items) {
      if (it.type === 'spark' || it.type === 'text' || it.type === 'grave') continue;
      seen.add(it);
      let g = this.fx.get(it);
      if (g === undefined) {
        g = this.makeFx(it);
        this.fx.set(it, g);
        if (g) this.dynamic.add(g);
      }
      if (!g) continue;
      const k = Math.min(1, it.age / it.life);
      switch (it.type) {
        case 'ring':
          g.scale.setScalar(0.6 + 0.6 * k);
          g.children[0].material.opacity = 0.9 * (1 - k);
          break;
        case 'blast':
          g.scale.setScalar(0.5 + 0.6 * Math.sqrt(k));
          for (const ch of g.children) ch.material.opacity = 0.5 * (1 - k);
          break;
        case 'telegraph':
          g.userData.fill.scale.setScalar(Math.max(0.01, k));
          break;
        case 'rise':
          g.position.y = k * 0.8;
          g.children[0].material.opacity = 0.4 * (1 - k);
          break;
        case 'beam': {
          const c = world.getCharacter(it.characterId);
          if (c) toVec3(c.pos.x, c.pos.y, 0, g.position);
          const pulse = Math.sin(k * Math.PI);
          g.scale.set(0.6 + pulse * 0.6, 1, 0.6 + pulse * 0.6);
          g.children.forEach((ch, i) => (ch.material.opacity = (i === 0 ? 0.55 : 0.9) * pulse));
          g.children[0].rotation.y = this.time * 4;
          break;
        }
        case 'slash':
          g.children[0].material.opacity = 0.65 * (1 - k);
          g.children[0].rotation.z = -it.angle + (k - 0.5) * 0.6;
          break;
        case 'boulder': {
          const x = it.x + (it.tx - it.x) * k;
          const y = it.y + (it.ty - it.y) * k;
          toVec3(x, y, 1.6 + Math.sin(k * Math.PI) * 6, g.position);
          g.rotation.x = this.time * 6;
          break;
        }
        default:
          break;
      }
    }
    for (const [it, g] of this.fx) {
      if (!seen.has(it)) {
        if (g) this.dynamic.remove(g);
        this.fx.delete(it);
      }
    }
  }

  render(match, effects, dt, focus = null) {
    this.time = (this.time ?? 0) + dt;
    if (this.match !== match) {
      this.reset();
      this.match = match;
    }
    const world = match.world;
    this.ensureStatic(world.map);
    this.syncBuildings(world, focus, dt);
    this.syncDefenses(world);
    this.syncDrops(world);
    this.syncCharacters(world, dt);
    this.syncProjectiles(world);
    this.syncZones(world);
    this.syncFx(effects, world);
    // O sol acompanha a câmera para a sombra ficar nítida perto do jogador.
    const t = this.rig.target;
    this.sun.position.set(t.x - 14, 30, t.z + 10);
    this.sun.target.position.copy(t);
    this.gl.render(this.scene, this.rig.camera);
  }
}
