// Entrada por ações configuráveis. As teclas são identificadas por KeyboardEvent.code,
// então o layout do teclado (ABNT2, US...) não muda a posição dos controles.
export const DEFAULT_BINDINGS = Object.freeze({
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['Mouse0', 'KeyJ'],
  ability1: ['Digit1', 'Numpad1'],
  ability2: ['Digit2', 'Numpad2'],
  ability3: ['Digit3', 'Numpad3'],
  ability4: ['Digit4', 'Numpad4'],
  ability5: ['Digit5', 'Numpad5'],
  interact: ['KeyF'],
  upgrade: ['KeyG'],
  rotateLeft: ['KeyQ'],
  rotateRight: ['KeyE'],
  pause: ['Escape', 'KeyP'],
  restart: ['Backspace'],
});

const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace']);

export class InputManager {
  constructor(target, canvas, bindings = DEFAULT_BINDINGS, logicalSize = { width: canvas.width, height: canvas.height }) {
    this.bindings = bindings;
    this.canvas = canvas;
    this.logical = logicalSize;
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: logicalSize.width / 2, y: logicalSize.height / 2, inside: false, dragX: 0, wheel: 0 };
    this.enabled = true;

    target.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    // Ao perder o foco, solta tudo para os controles não ficarem "presos".
    target.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });

    // A posição é lida na janela inteira para que elementos sobrepostos (HUD) não "congelem" a mira.
    target.addEventListener('mousemove', (e) => {
      // Arrastar com o botão do meio gira a câmera.
      if (this.down.has('Mouse1')) this.mouse.dragX += e.movementX || 0;
      this.updateMouse(e);
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.mouse.wheel += Math.sign(e.deltaY);
    }, { passive: false });
    document.addEventListener('mouseleave', () => (this.mouse.inside = false));
    canvas.addEventListener('mousedown', (e) => {
      this.updateMouse(e);
      if (e.button === 1) e.preventDefault();
      const code = `Mouse${e.button}`;
      if (!this.down.has(code)) this.pressed.add(code);
      this.down.add(code);
    });
    target.addEventListener('mouseup', (e) => this.down.delete(`Mouse${e.button}`));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  updateMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    // Coordenadas lógicas (independentes da resolução real do canvas).
    const x = ((e.clientX - rect.left) / rect.width) * this.logical.width;
    const y = ((e.clientY - rect.top) / rect.height) * this.logical.height;
    this.mouse.inside = x >= 0 && y >= 0 && x <= this.logical.width && y <= this.logical.height;
    this.mouse.x = Math.min(Math.max(x, 0), this.logical.width);
    this.mouse.y = Math.min(Math.max(y, 0), this.logical.height);
  }

  releaseAll() {
    this.down.clear();
    this.pressed.clear();
    this.mouse.dragX = 0;
    this.mouse.wheel = 0;
  }

  // Giro e zoom acumulados desde a última leitura.
  takeCameraInput() {
    const out = { dragX: this.mouse.dragX, wheel: this.mouse.wheel };
    this.mouse.dragX = 0;
    this.mouse.wheel = 0;
    return out;
  }

  isDown(action) {
    return this.enabled && (this.bindings[action] || []).some((code) => this.down.has(code));
  }

  wasPressed(action) {
    return this.enabled && (this.bindings[action] || []).some((code) => this.pressed.has(code));
  }

  // Chamado depois de cada passo de simulação que consumiu as teclas pressionadas.
  consumePressed() {
    this.pressed.clear();
  }

  keyLabel(action) {
    const code = (this.bindings[action] || [])[0] || '';
    return keyLabel(code);
  }
}

export function keyLabel(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return code.slice(6);
  if (code === 'Space') return 'Espaço';
  if (code === 'Mouse0') return 'Clique';
  if (code === 'Escape') return 'Esc';
  return code;
}
