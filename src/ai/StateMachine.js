// Máquina de estados finitos mínima, independente da renderização.
export const AI_STATE = Object.freeze({
  IDLE: 'idle',
  FOLLOW: 'follow',
  SEEK: 'seek',
  CHASE: 'chase',
  ATTACK: 'attack',
  RETREAT: 'retreat',
  DEFEND: 'defend',
  DEAD: 'dead',
});

export class StateMachine {
  constructor(initial) {
    this.state = initial;
    this.timeInState = 0;
    this.onChange = null;
  }

  set(next) {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this.timeInState = 0;
    this.onChange?.(prev, next);
  }

  update(dt) {
    this.timeInState += dt;
  }
}
