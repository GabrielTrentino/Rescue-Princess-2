// Câmera isométrica em perspectiva que acompanha o jogador e pode girar em torno dele.
// A lógica do jogo usa o plano (x, y) em pixels; na cena 3D isso vira (x, 0, y) * S.
import * as THREE from 'three';

export const S = 1 / 40; // 40 px do jogo = 1 unidade 3D

// Altura do relevo no ponto do jogo (definida pelo renderizador conforme o mapa da partida).
let terrain = () => 0;
export function setTerrain(fn) {
  terrain = fn ?? (() => 0);
}
export function groundAt(x, y) {
  return terrain(x, y);
}

// Converte um ponto do jogo para a cena; h é a altura acima do chão naquele ponto.
export function toVec3(x, y, h = 0, out = new THREE.Vector3()) {
  return out.set(x * S, h + terrain(x, y), y * S);
}

const PITCH = THREE.MathUtils.degToRad(52);

export class CameraRig {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.camera = new THREE.PerspectiveCamera(38, viewW / viewH, 0.5, 400);
    this.target = new THREE.Vector3();
    this.yaw = THREE.MathUtils.degToRad(-45);
    this.yawGoal = this.yaw;
    this.distance = 22;
    this.distanceGoal = this.distance;
    this.shake = 0;
    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmp = new THREE.Vector3();
    this.ndc = new THREE.Vector2();
  }

  // Giro contínuo (radianos) e aproximação (positivo = aproxima).
  rotate(delta) {
    this.yawGoal += delta;
  }

  zoom(delta) {
    this.distanceGoal = THREE.MathUtils.clamp(this.distanceGoal - delta, 12, 40);
  }

  addShake(amount) {
    this.shake = Math.min(0.6, this.shake + amount * 0.04);
  }

  follow(pos, dt, snap = false) {
    const goal = toVec3(pos.x, pos.y, 0, this.tmp);
    const k = snap ? 1 : 1 - Math.exp(-dt * 7);
    this.target.lerp(goal, k);
    const ky = snap ? 1 : 1 - Math.exp(-dt * 10);
    this.yaw += (this.yawGoal - this.yaw) * ky;
    this.distance += (this.distanceGoal - this.distance) * (snap ? 1 : 1 - Math.exp(-dt * 8));
    this.shake = Math.max(0, this.shake - dt * 1.5);
    this.update();
  }

  update() {
    const d = this.distance;
    const c = this.camera;
    c.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(PITCH) * d,
      this.target.y + Math.sin(PITCH) * d,
      this.target.z + Math.cos(this.yaw) * Math.cos(PITCH) * d,
    );
    if (this.shake > 0) {
      c.position.x += (Math.random() - 0.5) * this.shake;
      c.position.y += (Math.random() - 0.5) * this.shake;
    }
    c.lookAt(this.target.x, this.target.y + 0.8, this.target.z);
    c.updateMatrixWorld();
  }

  setAspect(w, h) {
    this.viewW = w;
    this.viewH = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Direções da tela no plano do jogo: "direita" e "para cima" (longe da câmera).
  screenAxes() {
    return {
      right: { x: Math.cos(this.yaw), y: -Math.sin(this.yaw) },
      up: { x: -Math.sin(this.yaw), y: -Math.cos(this.yaw) },
    };
  }

  // Ponto do chão (em pixels do jogo) sob uma posição da tela (coordenadas lógicas).
  screenToWorld(sx, sy) {
    this.ndc.set((sx / this.viewW) * 2 - 1, -(sy / this.viewH) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    // O chão tem relevo: acerta o plano na altura do terreno e refina algumas vezes.
    this.ground.constant = -terrain(this.target.x / S, this.target.z / S);
    let hit = null;
    for (let i = 0; i < 3; i++) {
      hit = this.raycaster.ray.intersectPlane(this.ground, this.tmp);
      if (!hit) return null;
      this.ground.constant = -terrain(hit.x / S, hit.z / S);
    }
    return { x: hit.x / S, y: hit.z / S };
  }

  // Posição na tela (coordenadas lógicas) de um ponto do jogo a uma altura h (unidades 3D).
  project(x, y, h = 0) {
    const v = toVec3(x, y, h, this.tmp).project(this.camera);
    return { x: (v.x + 1) * 0.5 * this.viewW, y: (1 - v.y) * 0.5 * this.viewH, visible: v.z < 1 && v.z > -1 };
  }
}
