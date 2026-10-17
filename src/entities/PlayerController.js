// Converte a entrada do jogador em intenções para o personagem, no mesmo formato usado pelos bots.
export class PlayerController {
  constructor(input, camera) {
    this.input = input;
    this.camera = camera;
  }

  aimPoint() {
    const m = this.input.mouse;
    return this.camera.toWorld(m.x, m.y);
  }

  update(world, c) {
    const input = this.input;
    const x = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const y = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
    c.intent.move = { x, y };
    c.intent.aim = this.aimPoint();
    c.intent.attack = input.isDown('attack');
    for (let i = 0; i < 5; i++) {
      if (input.wasPressed(`ability${i + 1}`)) c.intent.abilities.push(i);
    }
  }
}
