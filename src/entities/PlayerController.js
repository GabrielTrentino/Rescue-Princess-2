// Converte a entrada do jogador em intenções para o personagem, no mesmo formato usado pelos bots.
// O movimento segue a câmera: "para cima" na tela é sempre para longe da câmera, mesmo girada.
export class PlayerController {
  constructor(input, rig) {
    this.input = input;
    this.rig = rig;
  }

  aimPoint() {
    const m = this.input.mouse;
    return this.rig.screenToWorld(m.x, m.y);
  }

  update(world, c) {
    const input = this.input;
    const sx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const sy = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
    const { right, up } = this.rig.screenAxes();
    c.intent.move = { x: right.x * sx + up.x * sy, y: right.y * sx + up.y * sy };
    c.intent.aim = this.aimPoint();
    c.intent.attack = input.isDown('attack');
    for (let i = 0; i < 5; i++) {
      if (input.wasPressed(`ability${i + 1}`)) c.intent.abilities.push(i);
    }
    if (input.wasPressed('interact')) c.intent.interact = true;
    if (input.wasPressed('upgrade')) c.intent.upgrade = true;
  }
}
