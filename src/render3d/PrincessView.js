// Visual 3D do objetivo: as duas princesas (engordam com as coxinhas), as jaulas das prisões,
// as coxinhas e seringas Jonmaros no chão e os itens carregados sobre a cabeça de quem os leva.
// Só lê o estado do jogo; nunca o altera.
import * as THREE from 'three';
import { toVec3 } from './CameraRig.js';
import { makeCage, makeCoxinha, makeCrown, makeSyringe } from './props.js';

const DRESS = { blue: 0xff8fc8, red: 0xff8fc8 };
const CAPE = { blue: 0x5a8fff, red: 0xff5a5a };
const SCALE = 0.8;

function itemMesh(kind) {
  return kind === 'coxinha' ? makeCoxinha() : makeSyringe();
}

class PrincessFigure {
  constructor(assets, team, parent) {
    this.assets = assets;
    this.group = new THREE.Group();
    parent.add(this.group);
    const model = assets.character('Rogue');
    this.model = model;
    this.state = null;
    if (!model) return;
    let head = null;
    model.traverse((o) => {
      if (o.name === 'head') head = o;
      if (!o.isMesh && !o.isSkinnedMesh) return;
      if (/Crossbow|Knife|Throwable/.test(o.name)) o.visible = false;
      // Vestido rosa liso no corpo, braços e pernas; capa na cor da equipe.
      if (/Body|Leg|Arm/.test(o.name)) o.material = new THREE.MeshStandardMaterial({ color: DRESS[team], roughness: 0.75 });
      else if (o.name === 'Rogue_Cape') o.material = new THREE.MeshStandardMaterial({ color: CAPE[team], roughness: 0.8 });
      o.castShadow = true;
    });
    if (head) {
      const crown = makeCrown();
      crown.position.set(0, 0.95, 0);
      crown.scale.setScalar(1.6);
      head.add(crown);
    }
    this.group.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = new Map();
  }

  play(name) {
    if (!this.mixer || this.currentName === name) return;
    const clip = this.assets.clip(name);
    if (!clip) return;
    let a = this.actions.get(name);
    if (!a) {
      a = this.mixer.clipAction(clip);
      this.actions.set(name, a);
    }
    a.reset().play();
    if (this.current) this.current.crossFadeTo(a, 0.2, false);
    this.current = a;
    this.currentName = name;
  }

  update(p, world, dt, time) {
    if (!this.model) return;
    const carrier = p.carrierId ? world.getCharacter(p.carrierId) : null;
    // Mais coxinhas = princesa mais larga.
    const wide = 1 + 0.18 * p.level;
    this.model.scale.set(SCALE * wide, SCALE, SCALE * wide);
    if (carrier) {
      // Nos ombros de quem a carrega.
      toVec3(carrier.pos.x, carrier.pos.y, 1.55, this.group.position);
      this.group.rotation.y = Math.PI / 2 - carrier.facing;
      this.play('Cheer');
    } else {
      toVec3(p.pos.x, p.pos.y, 0, this.group.position);
      this.group.rotation.y = Math.sin(time * 0.4) * 0.6;
      this.play(p.state === 'dropped' ? 'Unarmed_Idle' : p.state === 'rescued' ? 'Cheer' : 'Idle');
    }
    this.mixer.update(dt);
  }
}

export class PrincessLayer {
  constructor(assets, parent, world) {
    this.assets = assets;
    this.parent = parent;
    this.root = new THREE.Group();
    parent.add(this.root);
    this.figures = {};
    this.cages = [];
    const objective = world.princess;
    if (!objective) return;
    for (const p of Object.values(objective.princesses)) {
      this.figures[p.team] = new PrincessFigure(assets, p.team, this.root);
      const cage = makeCage();
      toVec3(p.prison.x, p.prison.y, 0, cage.position);
      this.root.add(cage);
      this.cages.push(cage);
    }
    this.items = new Map();
    this.held = new Map();
  }

  update(world, dt, time) {
    const objective = world.princess;
    if (!objective) return;
    for (const p of Object.values(objective.princesses)) this.figures[p.team]?.update(p, world, dt, time);

    // Itens no chão: flutuam e giram.
    const seen = new Set();
    for (const item of objective.items) {
      seen.add(item.id);
      let g = this.items.get(item.id);
      if (!g) {
        g = new THREE.Group();
        const m = itemMesh(item.kind);
        m.scale.setScalar(item.kind === 'coxinha' ? 2.2 : 2.0);
        g.add(m);
        const glow = new THREE.Mesh(
          new THREE.CircleGeometry(0.6, 20),
          new THREE.MeshBasicMaterial({ color: item.kind === 'coxinha' ? 0xffc35a : 0x6af07a, transparent: true, opacity: 0.4, depthWrite: false }),
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.04;
        g.add(glow);
        g.userData.mesh = m;
        this.items.set(item.id, g);
        this.root.add(g);
      }
      toVec3(item.pos.x, item.pos.y, 0, g.position);
      const m = g.userData.mesh;
      m.position.y = 0.35 + Math.sin(time * 2.6 + item.id) * 0.12;
      m.rotation.y = time * 1.8 + item.id;
    }
    for (const [id, g] of this.items) {
      if (!seen.has(id)) {
        this.root.remove(g);
        this.items.delete(id);
      }
    }

    // Itens carregados sobre a cabeça.
    const holders = new Set();
    for (const c of world.characters) {
      if (!c.alive || !c.heldItem) continue;
      holders.add(c.id);
      let h = this.held.get(c.id);
      if (!h || h.kind !== c.heldItem) {
        if (h) this.root.remove(h.group);
        const group = itemMesh(c.heldItem);
        group.scale.setScalar(1.1);
        h = { kind: c.heldItem, group };
        this.held.set(c.id, h);
        this.root.add(group);
      }
      toVec3(c.pos.x, c.pos.y, 2.0 + Math.sin(time * 4) * 0.05, h.group.position);
      h.group.rotation.y = time * 2;
    }
    for (const [id, h] of this.held) {
      if (!holders.has(id)) {
        this.root.remove(h.group);
        this.held.delete(id);
      }
    }
  }

  dispose() {
    this.parent.remove(this.root);
    for (const f of Object.values(this.figures)) f.mixer?.stopAllAction();
  }
}
