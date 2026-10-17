// Visual 3D de um personagem: modelo KayKit da classe, acessórios, arma, cor da equipe e animações.
// Lê o estado do personagem a cada quadro; nunca o altera.
import * as THREE from 'three';
import { toVec3 } from './CameraRig.js';
import { makeHalberd, makeBlunderbuss } from './props.js';
import { CLASS_LOOKS } from './looks.js';

const TEAM_HEX = { blue: 0x3d7be0, red: 0xde4a3f, neutral: 0xb0a890 };
const WEAPON_NODES = /Sword|Shield|Axe|Mug|Knife|Crossbow|Throwable|Wand|Staff|Spellbook/;

export { CLASS_LOOKS };

const CHAR_SCALE = 0.8;

export class CharacterView {
  constructor(assets, c, scene) {
    this.assets = assets;
    this.scene = scene;
    this.id = c.id;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 32),
      new THREE.MeshBasicMaterial({ color: TEAM_HEX[c.team], transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.renderOrder = 1;
    this.group.add(this.ring);
    if (c.isPlayer) {
      this.ring.material.color.set(0xffe27a);
      this.ring.scale.setScalar(1.15);
    }
    this.aura = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = 0.02;
    this.group.add(this.aura);
    this.classId = null;
    this.team = c.team;
    this.lastAttackAnim = 0;
    this.current = null;
    this.deadTime = 0;
    this.build(c);
  }

  build(c) {
    if (this.model) {
      this.group.remove(this.model);
      this.mixer?.stopAllAction();
    }
    const look = CLASS_LOOKS[c.classId] ?? CLASS_LOOKS.villager;
    this.look = look;
    this.classId = c.classId;
    const model = this.assets.character(look.model);
    if (!model) return;
    model.scale.setScalar(CHAR_SCALE);
    const teamColor = new THREE.Color(TEAM_HEX[c.team]);
    let handR = null;
    model.traverse((o) => {
      if (o.name === 'handslotr' || o.name === 'handslot.r') handR = o; // o GLTFLoader tira o ponto do nome
      if (!o.isMesh && !o.isSkinnedMesh) return;
      const accessory = WEAPON_NODES.test(o.name) || /Helmet|Hat|Cape|Head_Hooded/.test(o.name);
      if (accessory) o.visible = look.show.includes(o.name);
      if (o.name === look.cape) {
        o.material = o.material.clone();
        o.material.color = teamColor.clone().multiplyScalar(1.6);
      } else if (look.tint) {
        o.material = o.material.clone();
        o.material.color = new THREE.Color(look.tint);
      }
      o.castShadow = true;
    });
    // O capuz do Rogue_Hooded é a própria cabeça: fica sempre visível.
    model.traverse((o) => {
      if (o.name === 'Rogue_Head_Hooded') o.visible = true;
    });
    if (look.extra && handR) {
      if (look.extra === 'halberd') handR.add(makeHalberd());
      else {
        // Mesma pega da besta do pacote: cano para a frente (+z) a partir da mão.
        const grip = new THREE.Group();
        grip.position.set(-0.105, -0.01, 0);
        grip.rotation.y = Math.PI / 2;
        const gun = makeBlunderbuss();
        gun.rotation.x = Math.PI / 2;
        gun.position.z = -0.2;
        gun.scale.setScalar(1.4);
        grip.add(gun);
        handR.add(grip);
      }
    }
    this.model = model;
    this.group.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = new Map();
    this.current = null;
  }

  action(name, { once = false } = {}) {
    let a = this.actions.get(name);
    if (!a) {
      const clip = this.assets.clip(name);
      if (!clip) return null;
      a = this.mixer.clipAction(clip);
      this.actions.set(name, a);
    }
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    return a;
  }

  play(name, { once = false, restart = false, fade = 0.15, speed = 1 } = {}) {
    const a = this.action(name, { once });
    if (!a) return;
    a.timeScale = speed;
    if (this.current === a && !restart) return;
    if (restart || this.current !== a) a.reset();
    a.play();
    if (this.current && this.current !== a) this.current.crossFadeTo(a, fade, false);
    a.setEffectiveWeight(1);
    this.current = a;
    this.currentName = name;
  }

  update(c, dt, time) {
    if (c.classId !== this.classId) {
      this.build(c);
      this.transformFlash = 1;
    }
    if (c.team !== this.team) {
      this.team = c.team;
      this.build(c);
    }
    if (!this.model) return;
    toVec3(c.pos.x, c.pos.y, 0, this.group.position);
    this.model.rotation.y = Math.PI / 2 - c.facing;

    // Escolha da animação a partir do estado.
    const look = this.look;
    if (!c.alive) {
      if (this.currentName !== 'Death_A') this.play('Death_A', { once: true, fade: 0.1 });
      this.deadTime += dt;
    } else {
      this.deadTime = 0;
      if (c.arming) {
        if (this.currentName !== 'PickUp') this.play('PickUp', { once: true, fade: 0.1, speed: 1.2 });
      } else if (c.attackAnim > this.lastAttackAnim + 0.05) {
        // Novo golpe ou habilidade: reinicia a animação de ataque.
        let name;
        if (c.lastAction === 'ability' && this.lastAbility) name = this.lastAbility;
        else name = look.attack[Math.floor(time * 3) % look.attack.length];
        this.play(name, { once: true, restart: true, fade: 0.06, speed: 1.5 });
        this.attackUntil = time + 0.45;
      } else if (time < (this.attackUntil ?? 0)) {
        // Deixa o golpe terminar.
      } else if (c.hurtTimer > 0.2 && this.currentName !== 'Hit_A' && !c.moving) {
        this.play('Hit_A', { once: true, restart: true, fade: 0.05, speed: 1.4 });
        this.attackUntil = time + 0.3;
      } else if (c.moving) {
        this.play(look.run, { speed: c.getStat('speed') / 150 });
      } else {
        this.play(look.idle);
      }
    }
    this.lastAttackAnim = c.attackAnim;
    this.lastAbility = null;
    this.mixer.update(dt);

    // Corpo some depois de um tempo caído.
    this.group.visible = c.alive || this.deadTime < 3;
    this.ring.visible = c.alive;

    // Auras de estado sob os pés.
    const auraEffect = c.effects.list.find((e) => e.visual);
    let auraColor = null;
    if (c.effects.multiplier('speedMult') < 0.95) auraColor = 0x8fdcff;
    if (auraEffect) {
      auraColor = {
        fury: 0xff5a28, berserk: 0xff3a20, shield: 0x8cc8ff, goldShield: 0xffd75a, shieldSmall: 0x8cc8ff, speed: 0xc6f06a,
      }[auraEffect.visual] ?? auraColor;
    }
    if (auraColor) {
      this.aura.material.color.set(auraColor);
      this.aura.material.opacity = 0.35 + 0.1 * Math.sin(time * 8);
    } else {
      this.aura.material.opacity = 0;
    }
    this.aura.visible = c.alive;
    if (this.transformFlash > 0) this.transformFlash = Math.max(0, this.transformFlash - dt);
  }

  // Habilidade usada: escolhe a animação dela para o próximo golpe.
  onAbility(index) {
    const list = this.look.ability ?? this.look.attack;
    this.lastAbility = list[index % list.length];
  }

  dispose() {
    this.scene.remove(this.group);
    this.mixer?.stopAllAction();
  }
}
