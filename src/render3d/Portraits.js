// Retratos 3D das classes para as telas de menu: cada classe é renderizada uma vez num canvas pequeno.
import * as THREE from 'three';
import { CharacterView } from './CharacterView.js';

export function renderPortraits(assets, targets) {
  const size = 240;
  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  gl.setSize(size, size, false);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7a50, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.6, 5.4);
  camera.lookAt(0, 0.95, 0);
  for (const [classId, canvas] of targets) {
    const fake = {
      id: 0, team: 'blue', classId, pos: { x: 0, y: 0 }, facing: Math.PI / 2 - 0.45, alive: true, arming: null,
      attackAnim: 0, hurtTimer: 0, moving: false, effects: { list: [], multiplier: () => 1 }, getStat: () => 150,
    };
    const view = new CharacterView(assets, fake, scene);
    view.ring.visible = false;
    view.update(fake, 0.4, 0);
    gl.render(scene, camera);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(gl.domElement, 0, 0, canvas.width, canvas.height);
    view.dispose();
  }
  gl.dispose();
  gl.forceContextLoss();
}
