// Controle dos bots por máquina de estados. As decisões (alvo, estado, habilidades) acontecem
// em intervalos configuráveis; a execução (movimento, mira, ataque) acontece a cada passo.
import { dist, normalize, angleTo } from '../core/math.js';
import { hasLineOfSight } from '../world/CollisionSystem.js';
import { otherTeam } from '../config.js';
import { AI_STATE, StateMachine } from './StateMachine.js';
import { selectTarget, countEnemiesNear, countAlliesNear } from './TargetSelector.js';

export const BOT_ROLE = Object.freeze({ ATTACK: 'attack', DEFEND: 'defend', ESCORT: 'escort' });

export class BotController {
  constructor({ role = BOT_ROLE.ATTACK, decisionInterval = 0.25, abilityChance = 0.6, rng = Math.random, leaderId = null }) {
    this.role = role;
    this.decisionInterval = decisionInterval;
    this.abilityChance = abilityChance;
    this.rng = rng;
    this.leaderId = leaderId;
    this.fsm = new StateMachine(AI_STATE.IDLE);
    this.decisionTimer = rng() * decisionInterval;
    this.target = null;
    this.goal = null;
    this.path = null;
    this.pathGoal = null;
    this.pathAge = 0;
    this.stuck = { x: 0, y: 0, timer: 0, sidestep: 0, dir: null };
    this.strafeSign = rng() < 0.5 ? -1 : 1;
    this.strafeTimer = 0;
  }

  get state() {
    return this.fsm.state;
  }

  onDeath() {
    this.fsm.set(AI_STATE.DEAD);
    this.target = null;
    this.path = null;
    this.goal = null;
  }

  onRespawn() {
    this.fsm.set(AI_STATE.IDLE);
    this.decisionTimer = 0;
  }

  update(world, bot, dt) {
    this.fsm.update(dt);
    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = this.decisionInterval * (0.8 + this.rng() * 0.4);
      this.decide(world, bot);
    }
    this.act(world, bot, dt);
  }

  ownBase(world, bot) {
    return world.map.bases[bot.team];
  }

  enemyBase(world, bot) {
    return world.map.bases[otherTeam(bot.team)];
  }

  jitter(point, amount) {
    return { x: point.x + (this.rng() - 0.5) * amount, y: point.y + (this.rng() - 0.5) * amount };
  }

  decide(world, bot) {
    const own = this.ownBase(world, bot);
    const enemyBase = this.enemyBase(world, bot);

    // Recuar quando muito ferido e sem apoio, até recuperar vida na base.
    if (this.fsm.state === AI_STATE.RETREAT) {
      if (bot.hpFraction > 0.85) this.fsm.set(AI_STATE.IDLE);
      else {
        this.goal = own;
        this.target = null;
        return;
      }
    } else if (bot.hpFraction < 0.22 && this.role !== BOT_ROLE.DEFEND && !bot.taunt &&
        countAlliesNear(world, bot, 220) === 0 && countEnemiesNear(world, bot, 320) > 0) {
      this.fsm.set(AI_STATE.RETREAT);
      this.goal = own;
      this.target = null;
      return;
    }

    const defending = this.role === BOT_ROLE.DEFEND;
    // Atacantes saudáveis perto da base inimiga focam no objetivo e só reagem a ameaças muito próximas.
    const pushing = this.role === BOT_ROLE.ATTACK && bot.hpFraction > 0.4 && dist(bot.pos, enemyBase) < 900;
    this.target = selectTarget(world, bot, {
      range: defending ? 360 : pushing ? 170 : this.role === BOT_ROLE.ATTACK ? 300 : 400,
      current: this.target,
      anchor: defending ? own : null,
      leash: defending ? 520 : Infinity,
    });

    if (this.target) {
      const reach = bot.attrs.range + this.target.radius;
      this.fsm.set(dist(bot.pos, this.target.pos) <= reach * 1.05 ? AI_STATE.ATTACK : AI_STATE.CHASE);
      this.decideAbility(world, bot);
      return;
    }

    if (this.role === BOT_ROLE.ESCORT) {
      const leader = world.getCharacter(this.leaderId);
      if (leader && leader.alive) {
        this.fsm.set(AI_STATE.FOLLOW);
        if (!this.goal || dist(this.goal, leader.pos) > 110) this.goal = this.jitter(leader.pos, 140);
        return;
      }
    }
    if (defending) {
      this.fsm.set(AI_STATE.DEFEND);
      if (!this.goal || dist(bot.pos, this.goal) < 30 || this.fsm.timeInState > 4) {
        const toCenter = normalize(world.map.width / 2 - own.x, 0);
        this.goal = this.jitter({ x: own.x + toCenter.x * 110, y: own.y }, 160);
        this.fsm.timeInState = 0;
      }
      return;
    }
    this.fsm.set(AI_STATE.SEEK);
    if (!this.goal || dist(this.goal, enemyBase) > enemyBase.radius) this.goal = this.jitter(enemyBase, enemyBase.radius);
    else if (dist(bot.pos, this.goal) < 30) this.goal = this.jitter(enemyBase, enemyBase.radius);
    // Usa habilidades defensivas mesmo sem alvo definido (ex.: emboscada fora da linha de visão).
    this.decideAbility(world, bot);
  }

  decideAbility(world, bot) {
    if (!bot.canAct || this.rng() > this.abilityChance) return;
    const abilities = bot.classDef.abilities;
    const order = abilities.map((_, i) => i).sort(() => this.rng() - 0.5);
    for (const i of order) {
      const a = abilities[i];
      if (!bot.cooldowns.isReady(a.id)) continue;
      if (!abilityConditionMet(world, bot, this.target, a.ai)) continue;
      bot.intent.abilities.push(i);
      if (this.target) bot.intent.aim = { x: this.target.pos.x, y: this.target.pos.y };
      return;
    }
  }

  act(world, bot, dt) {
    const intent = bot.intent;
    intent.attack = false;
    let dest = null;
    let desiredMove = null;
    const t = this.target && this.target.alive ? this.target : null;
    if (!t && (this.fsm.state === AI_STATE.ATTACK || this.fsm.state === AI_STATE.CHASE)) this.fsm.set(AI_STATE.IDLE);

    if (t) {
      intent.aim = { x: t.pos.x, y: t.pos.y };
      const d = dist(bot.pos, t.pos);
      const reach = bot.attrs.range + t.radius;
      const ranged = bot.classDef.attack.kind === 'ranged';
      const los = hasLineOfSight(world.map, bot.pos, t.pos);
      if (d <= reach * 0.97 && los) intent.attack = true;
      if (ranged) {
        if (!los || d > reach * 0.8) dest = t.pos;
        else if (d < reach * 0.35) desiredMove = normalize(bot.pos.x - t.pos.x, bot.pos.y - t.pos.y);
        else desiredMove = this.strafe(bot, t, dt, 0.6);
      } else if (d > bot.radius + t.radius + bot.attrs.range * 0.45 || !los) {
        dest = t.pos;
      } else {
        desiredMove = this.strafe(bot, t, dt, 0.25);
      }
    } else if (this.goal) {
      if (dist(bot.pos, this.goal) > 24) dest = this.goal;
      if (this.fsm.state !== AI_STATE.RETREAT && !dest) intent.aim = null;
    }

    if (dest) desiredMove = this.steerTo(world, bot, dest, dt);
    if (desiredMove && !intent.aim) intent.aim = { x: bot.pos.x + desiredMove.x * 50, y: bot.pos.y + desiredMove.y * 50 };
    intent.move = this.applyUnstuck(bot, desiredMove ?? { x: 0, y: 0 }, dt);
  }

  // Movimento lateral ao redor do alvo para evitar ficar parado.
  strafe(bot, target, dt, amount) {
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 0.8 + this.rng() * 1.2;
      this.strafeSign *= -1;
    }
    const a = angleTo(bot.pos, target.pos) + (Math.PI / 2) * this.strafeSign;
    return { x: Math.cos(a) * amount, y: Math.sin(a) * amount };
  }

  steerTo(world, bot, dest, dt) {
    this.pathAge += dt;
    const needRepath = !this.path || this.path.length === 0 || !this.pathGoal ||
      dist(this.pathGoal, dest) > 70 || this.pathAge > 1.2;
    if (needRepath) {
      this.path = world.nav.findPath(bot.pos, dest) ?? [{ x: dest.x, y: dest.y }];
      this.pathGoal = { x: dest.x, y: dest.y };
      this.pathAge = this.rng() * 0.3;
    }
    while (this.path.length > 1 && dist(bot.pos, this.path[0]) < 14) this.path.shift();
    const next = this.path[0];
    const v = normalize(next.x - bot.pos.x, next.y - bot.pos.y);
    return v;
  }

  // Detecta quando o bot não sai do lugar e faz um desvio lateral curto com novo caminho.
  applyUnstuck(bot, move, dt) {
    const s = this.stuck;
    if (s.sidestep > 0) {
      s.sidestep -= dt;
      return s.dir;
    }
    s.timer += dt;
    if (s.timer >= 0.6) {
      const moved = Math.hypot(bot.pos.x - s.x, bot.pos.y - s.y);
      const wanted = Math.hypot(move.x, move.y) > 0.5;
      if (wanted && moved < 8 && !bot.stunned && bot.actionTimer <= 0) {
        const side = this.rng() < 0.5 ? -1 : 1;
        s.dir = normalize(-move.y * side + (this.rng() - 0.5) * 0.6, move.x * side + (this.rng() - 0.5) * 0.6);
        s.sidestep = 0.35;
        this.path = null;
      }
      s.timer = 0;
      s.x = bot.pos.x;
      s.y = bot.pos.y;
    }
    return move;
  }
}

export function abilityConditionMet(world, bot, target, ai) {
  if (!ai) return false;
  const d = target ? dist(bot.pos, target.pos) : Infinity;
  const los = !ai.los || (target && hasLineOfSight(world.map, bot.pos, target.pos));
  switch (ai.when) {
    case 'targetInRange':
      return !!target && d - target.radius <= ai.range && los;
    case 'targetBetween':
      return !!target && d >= ai.min && d <= ai.max && los;
    case 'enemiesNear':
      return countEnemiesNear(world, bot, ai.radius) >= ai.count && bot.hpFraction >= (ai.minHp ?? 0);
    case 'underPressure':
      return bot.hpFraction <= ai.hp && countEnemiesNear(world, bot, ai.radius) >= ai.count;
    case 'lowHp':
      return bot.hpFraction <= ai.hp && countEnemiesNear(world, bot, ai.radius) >= 1;
    case 'targetLowHp':
      return !!target && target.hpFraction <= ai.hp && d - target.radius <= ai.range;
    default:
      return false;
  }
}
