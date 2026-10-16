// Loop com passo fixo: a simulação sempre avança em incrementos de FIXED_DT,
// independentemente da taxa de quadros do monitor. A renderização roda a cada quadro.
export class GameLoop {
  constructor({ step, update, render, maxFrameTime = 0.25 }) {
    this.step = step;
    this.update = update;
    this.render = render;
    this.maxFrameTime = maxFrameTime;
    this.accumulator = 0;
    this.last = 0;
    this.running = false;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
  }

  frame(now) {
    if (!this.running) return;
    const elapsed = Math.min((now - this.last) / 1000, this.maxFrameTime);
    this.last = now;
    this.accumulator += elapsed;
    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
    }
    this.render(this.accumulator / this.step, elapsed);
    requestAnimationFrame(this.frame);
  }
}
