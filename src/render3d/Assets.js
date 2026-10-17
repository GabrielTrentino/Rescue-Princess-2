// Carrega e guarda os modelos 3D (glTF) do jogo. Personagens e animações vêm da KayKit (CC0);
// cada instância é um clone (os esqueletos são clonados com SkeletonUtils).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import { CHARACTER_MODELS, WEAPON_MODELS, WORLD_MODELS } from './modelList.js';

export { CHARACTER_MODELS, WEAPON_MODELS, WORLD_MODELS };

export class Assets {
  constructor(base = 'assets/models/') {
    this.base = base;
    this.loader = new GLTFLoader();
    this.models = new Map();   // nome -> { scene, bounds }
    this.clips = [];
    this.ready = false;
  }

  async loadOne(key, url) {
    const gltf = await this.loader.loadAsync(url);
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    this.models.set(key, { scene: gltf.scene, bounds, animations: gltf.animations });
    return gltf;
  }

  async load(onProgress = () => {}) {
    const jobs = [
      ...CHARACTER_MODELS.map((n) => [n, `${this.base}characters/${n}.glb`]),
      ...WEAPON_MODELS.map((n) => [n, `${this.base}weapons/${n}.glb`]),
      ...WORLD_MODELS.map((n) => [n, `${this.base}world/${n}.glb`]),
    ];
    let done = 0;
    const total = jobs.length + 1;
    const anims = this.loader.loadAsync(`${this.base}characters/anims.glb`).then((g) => {
      this.clips = g.animations;
      onProgress(++done / total);
    });
    await Promise.all([anims, ...jobs.map(([k, url]) => this.loadOne(k, url)
      .catch((err) => console.warn(`[modelos] ${k}: ${err.message}`))
      .finally(() => onProgress(++done / total)))]);
    this.ready = true;
  }

  has(name) {
    return this.models.has(name);
  }

  // Cópia de um modelo estático (compartilha geometria e materiais).
  instance(name) {
    const m = this.models.get(name);
    if (!m) return null;
    return m.scene.clone(true);
  }

  // Cópia de um personagem com esqueleto próprio.
  character(name) {
    const m = this.models.get(name);
    if (!m) return null;
    return SkeletonUtils.clone(m.scene);
  }

  bounds(name) {
    return this.models.get(name)?.bounds ?? null;
  }

  clip(name) {
    return this.clips.find((c) => c.name === name) ?? null;
  }
}
