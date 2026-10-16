import { circleIntersectsRect } from '../world/CollisionSystem.js';

let nextProjectileId = 1;

export class Projectile {
  constructor(props) {
    Object.assign(
      this,
      { pierce: 0, knockback: 0, pull: false, stun: 0, critBonus: 0, basic: false, visual: 'arrow', damageType: 'physical' },
      props,
    );
    this.id = nextProjectileId++;
    this.traveled = 0;
    this.hitIds = new Set();
    this.alive = true;
  }

  // Avança em subpassos para não atravessar alvos nem paredes em alta velocidade.
  update(world, dt, onHit) {
    const total = this.speed * dt;
    const steps = Math.max(1, Math.ceil(total / Math.max(4, this.radius)));
    const step = total / steps;
    for (let i = 0; i < steps && this.alive; i++) {
      this.pos.x += this.dir.x * step;
      this.pos.y += this.dir.y * step;
      this.traveled += step;
      const { x, y } = this.pos;
      if (x < 0 || y < 0 || x > world.map.width || y > world.map.height ||
          world.map.obstacles.some((r) => circleIntersectsRect(x, y, this.radius * 0.5, r))) {
        this.alive = false;
        world.events.emit('fx', { kind: 'impact', x, y, visual: this.visual });
        return;
      }
      for (const c of world.characters) {
        if (!c.alive || c.team === this.team || this.hitIds.has(c.id)) continue;
        const dx = c.pos.x - x;
        const dy = c.pos.y - y;
        const rr = c.radius + this.radius;
        if (dx * dx + dy * dy <= rr * rr) {
          this.hitIds.add(c.id);
          onHit(this, c);
          if (this.hitIds.size > this.pierce) {
            this.alive = false;
            return;
          }
        }
      }
      if (this.traveled >= this.range) this.alive = false;
    }
  }
}
