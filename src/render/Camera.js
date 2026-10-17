// Câmera com inclinação: o plano do chão é achatado verticalmente (TILT) para simular a
// visão superior inclinada do handoff de arte, enquanto personagens são desenhados "em pé".
// A lógica do jogo continua em coordenadas de chão (x, y) sem inclinação.
export const TILT = Math.sin((50 * Math.PI) / 180); // mesma inclinação da câmera usada nos renders (50°)

export class Camera {
  constructor(viewW, viewH, zoom = 1) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.zoom = zoom;
    this.x = 0;
    this.y = 0;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  follow(target, map, dt, snap = false) {
    const k = snap ? 1 : 1 - Math.exp(-dt * 8);
    this.x += (target.x - this.x) * k;
    this.y += (target.y - this.y) * k;
    const halfW = this.viewW / 2 / this.zoom;
    const halfH = this.viewH / 2 / this.zoom / TILT;
    this.x = Math.min(Math.max(this.x, halfW - 40), map.width - halfW + 40);
    this.y = Math.min(Math.max(this.y, halfH - 60), map.height - halfH + 30);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.shakeX = (Math.random() - 0.5) * this.shake;
    this.shakeY = (Math.random() - 0.5) * this.shake;
  }

  addShake(amount) {
    this.shake = Math.min(14, this.shake + amount);
  }

  toScreen(x, y) {
    return {
      x: (x - this.x) * this.zoom + this.viewW / 2 + this.shakeX,
      y: (y - this.y) * TILT * this.zoom + this.viewH / 2 + this.shakeY,
    };
  }

  toWorld(sx, sy) {
    return {
      x: (sx - this.viewW / 2 - this.shakeX) / this.zoom + this.x,
      y: (sy - this.viewH / 2 - this.shakeY) / (TILT * this.zoom) + this.y,
    };
  }

  // Transformação para desenhar elementos do chão (círculos viram elipses automaticamente).
  applyGround(ctx, pixelScale = 1) {
    const k = pixelScale;
    ctx.setTransform(
      this.zoom * k, 0, 0, this.zoom * TILT * k,
      (this.viewW / 2 - this.x * this.zoom + this.shakeX) * k,
      (this.viewH / 2 - this.y * TILT * this.zoom + this.shakeY) * k,
    );
  }
}
