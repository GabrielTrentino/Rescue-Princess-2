// Controle dos bots por máquina de estados. As decisões (alvo, estado, habilidades) acontecem
// em intervalos configuráveis; a execução (movimento, mira, ataque) acontece a cada passo.
import { dist, normalize, angleTo } from '../core/math.js';
import { hasLineOfSight } from '../world/CollisionSystem.js';
import { otherTeam } from '../config.js';
import { AI_STATE, StateMachine } from './StateMachine.js';
import { selectTarget, selectStructureTarget, countEnemiesNear, countAlliesNear } from './TargetSelector.js';
import { edgeDistance, closestPoint, DEFENSE_TYPES } from '../world/Structures.js';
import { PICKUP_RANGE } from '../world/Weapons.js';

export const BOT_ROLE = Object.freeze({ ATTACK: 'attack', DEFEND: 'defend', ESCORT: 'escort' });

export class BotController {
  constructor({ role = BOT_ROLE.ATTACK, decisionInterval = 0.25, abilityChance = 0.6, rng = Math.random, leaderId = null, preferredClass = null }) {
    this.role = role;
    this.preferredClass = preferredClass;
    this.dropTarget = null;
    this.buildPlan = null;
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
    this.dropTarget = null;
    this.buildPlan = null;
    this.siege = null;
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
    if (bot.arming) return;

    // Sem arma: a prioridade é pegar uma (de preferência a da sua classe favorita).
    if (!bot.isArmed) {
      if (this.decideArming(world, bot)) return;
    } else {
      this.dropTarget = null;
    }
    if (bot.classId === 'engineer' && this.decideEngineer(world, bot)) return;

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

    // Sem inimigos por perto: atacantes e escoltas derrubam construções e defesas inimigas no caminho.
    if (!this.target && this.role !== BOT_ROLE.DEFEND && bot.isArmed) {
      this.target = selectStructureTarget(world, bot, { range: pushing ? 200 : this.role === BOT_ROLE.ATTACK ? 380 : 300, current: this.target });
    }

    if (this.target) {
      const gap = edgeDistance(this.target, bot.pos);
      this.fsm.set(gap <= bot.attrs.range * 1.05 ? AI_STATE.ATTACK : AI_STATE.CHASE);
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
    // Atacantes derrubam as construções inimigas pelo caminho antes de invadir a base.
    const siege = this.role === BOT_ROLE.ATTACK && bot.isArmed ? this.pickSiegeTarget(world, bot) : null;
    if (siege) {
      this.goal = closestApproach(siege, bot.pos, 50);
    } else if (!this.goal || dist(this.goal, enemyBase) > enemyBase.radius) this.goal = this.jitter(enemyBase, enemyBase.radius);
    else if (dist(bot.pos, this.goal) < 30) this.goal = this.jitter(enemyBase, enemyBase.radius);
    // Usa habilidades defensivas mesmo sem alvo definido (ex.: emboscada fora da linha de visão).
    this.decideAbility(world, bot);
  }

  decideAbility(world, bot) {
    if (!bot.canAct || this.rng() > this.abilityChance) return;
    const abilities = bot.classDef.abilities;
    const order = abilities.map((_, i) => i).sort(() => this.rng() - 0.5);
    // Guarda um pouco da barra para emergências, exceto quando ela está quase cheia.
    const reserve = bot.resource > bot.resourceMax * 0.8 ? 0 : bot.resourceMax * 0.15;
    for (const i of order) {
      const a = abilities[i];
      if (bot.resource < a.cost + (a.ai?.when === 'lowHp' ? 0 : reserve)) continue;
      if (this.target?.isStructure && a.ai?.when !== 'targetInRange') continue;
      if (!abilityConditionMet(world, bot, this.target, a.ai)) continue;
      bot.intent.abilities.push(i);
      if (this.target) bot.intent.aim = { ...closestPoint(this.target, bot.pos) };
      return;
    }
  }

  // Construção inimiga a derrubar: a mais próxima, deixando o castelo por último.
  pickSiegeTarget(world, bot) {
    if (this.siege && !this.siege.destroyed && this.siege.team !== bot.team) return this.siege;
    let best = null;
    let bestScore = Infinity;
    for (const b of world.buildings) {
      if (b.destroyed || b.team === bot.team || b.team === 'neutral') continue;
      const score = dist(b.pos, bot.pos) + (b.kind === 'castle' ? 1500 : 0) + this.rng() * 300;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    // Às vezes ignora as construções e vai direto para a base.
    this.siege = best && this.rng() < 0.75 ? best : null;
    return this.siege;
  }

  // ---------- Aldeão: escolher e pegar uma arma ----------
  decideArming(world, bot) {
    // Ameaçado de perto e sem arma: revida com socos (ou foge se estiver muito ferido).
    const threat = selectTarget(world, bot, { range: 90, current: this.target });
    if (threat && bot.hpFraction > 0.35) {
      this.target = threat;
      this.fsm.set(AI_STATE.ATTACK);
      this.decideAbility(world, bot);
      return true;
    }
    let best = null;
    let bestScore = Infinity;
    for (const d of world.drops) {
      if (d.claimedBy && d.claimedBy !== bot.id) continue;
      const rack = d.buildingId ? world.buildings.find((b) => b.id === d.buildingId) : null;
      // Suportes inimigos são arriscados: só valem a pena se estiverem bem perto.
      const enemyRack = rack && rack.team !== bot.team;
      const dd = dist(bot.pos, d.pos);
      if (enemyRack && dd > 450) continue;
      let score = dd + (d.classId === this.preferredClass ? 0 : 500) - (d.tier - 1) * 150;
      // Evita que vários aliados corram para a mesma arma.
      if (world.characters.some((c) => c !== bot && c.alive && c.team === bot.team && c.controller?.dropTarget === d.id)) score += 900;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }
    this.target = null;
    if (!best) {
      this.dropTarget = null;
      // Esperou demais sem arma: vai à luta assim mesmo (pedradas e socos).
      if (this.fsm.state === AI_STATE.ARM && this.fsm.timeInState > 12) return false;
      // Nada disponível: espera perto da construção da sua classe preferida.
      const home = world.buildings.find((b) => b.team === bot.team && b.classId === this.preferredClass && !b.destroyed) ??
        world.buildings.find((b) => b.team === bot.team && b.classId && !b.destroyed);
      if (!home) return false;
      this.fsm.set(AI_STATE.ARM);
      if (!this.goal || dist(this.goal, home.rack) > 80) this.goal = this.jitter(home.rack, 80);
      return true;
    }
    this.dropTarget = best.id;
    this.fsm.set(AI_STATE.ARM);
    this.goal = { x: best.pos.x, y: best.pos.y };
    if (dist(bot.pos, best.pos) <= PICKUP_RANGE * 0.8) bot.intent.interact = true;
    return true;
  }

  // ---------- Engenheiro: consertar, reconstruir e erguer defesas ----------
  decideEngineer(world, bot) {
    if (countEnemiesNear(world, bot, 260) > 0) {
      this.buildPlan = null;
      // Sob ataque: uma armadilha ou barricada rápida entre ele e o inimigo.
      return false;
    }
    if (!this.buildPlan) this.buildPlan = this.planEngineerWork(world, bot);
    const plan = this.buildPlan;
    if (!plan) return false;
    const ability = bot.classDef.abilities[plan.index];
    if (bot.resource < ability.cost) {
      // Espera juntar materiais perto do local, protegendo-o.
      this.fsm.set(AI_STATE.BUILD);
      this.goal = plan.stand;
      if (bot.resource < ability.cost && this.fsm.timeInState > 12) this.buildPlan = null;
      return true;
    }
    this.fsm.set(AI_STATE.BUILD);
    this.goal = plan.stand;
    if (dist(bot.pos, plan.stand) <= plan.reach) {
      bot.intent.abilities.push(plan.index);
      bot.intent.aim = { ...plan.at };
      this.buildPlan = null;
    }
    return true;
  }

  planEngineerWork(world, bot) {
    const abilities = bot.classDef.abilities;
    const repairIdx = abilities.findIndex((a) => a.id === 'eng_repair');
    // 1) Ruínas próximas (inclusive as neutras do meio do mapa) viram construções da equipe.
    const ruin = world.buildings
      .filter((b) => b.destroyed && dist(b.pos, bot.pos) < 1400)
      .sort((a, b) => dist(a.pos, bot.pos) - dist(b.pos, bot.pos))[0];
    if (ruin && this.rng() < 0.6) return { index: repairIdx, at: ruin.pos, stand: closestApproach(ruin, bot.pos, 60), reach: 80 };
    // 2) Construções aliadas danificadas.
    const hurt = world.buildings
      .filter((b) => !b.destroyed && b.team === bot.team && b.hpFraction < 0.8)
      .sort((a, b) => a.hpFraction - b.hpFraction)[0];
    if (hurt) return { index: repairIdx, at: hurt.pos, stand: closestApproach(hurt, bot.pos, 60), reach: 80 };
    // 3) Novas defesas na frente da base, até um limite por engenheiro.
    const mine = world.defenses.filter((d) => d.ownerId === bot.id).length;
    if (mine >= 6) return null;
    const kinds = ['eng_arrow_tower', 'eng_barricade', 'eng_arrow_tower', 'eng_trap', 'eng_catapult'];
    const id = kinds[Math.floor(this.rng() * kinds.length)];
    const index = abilities.findIndex((a) => a.id === id);
    const own = this.ownBase(world, bot);
    const towardCenter = Math.sign(world.map.width / 2 - own.x);
    const anchor = world.buildings.filter((b) => b.team === bot.team && !b.destroyed && b.classId);
    const near = anchor[Math.floor(this.rng() * anchor.length)] ?? own;
    const at = this.jitter({ x: near.pos ? near.pos.x + towardCenter * 230 : own.x + towardCenter * 320, y: near.pos ? near.pos.y : own.y }, 160);
    at.x = Math.min(world.map.width - 60, Math.max(60, at.x));
    at.y = Math.min(world.map.height - 60, Math.max(60, at.y));
    const r = DEFENSE_TYPES[abilities[index].effects[0].structure].radius;
    return { index, at, stand: { x: at.x - towardCenter * 70, y: at.y }, reach: 90 + r };
  }

  act(world, bot, dt) {
    const intent = bot.intent;
    intent.attack = false;
    if (bot.arming) {
      intent.move = { x: 0, y: 0 };
      return;
    }
    let dest = null;
    let desiredMove = null;
    const t = this.target && this.target.alive ? this.target : null;
    if (!t && (this.fsm.state === AI_STATE.ATTACK || this.fsm.state === AI_STATE.CHASE)) this.fsm.set(AI_STATE.IDLE);

    if (t) {
      const point = closestPoint(t, bot.pos);
      intent.aim = { x: point.x, y: point.y };
      const gap = edgeDistance(t, bot.pos);
      const range = bot.attrs.range;
      const ranged = bot.classDef.attack.kind === 'ranged';
      // Construções bloqueiam a própria linha de visão; contra elas basta a distância.
      const los = t.rect ? true : hasLineOfSight(world.map, bot.pos, t.pos);
      if (gap <= range * 0.97 && los) intent.attack = true;
      if (ranged) {
        if (!los || gap > range * 0.8) dest = t.rect ? closestApproach(t, bot.pos, range * 0.6) : t.pos;
        else if (gap < range * 0.3 && !t.isStructure) desiredMove = normalize(bot.pos.x - t.pos.x, bot.pos.y - t.pos.y);
        else if (!t.isStructure) desiredMove = this.strafe(bot, t, dt, 0.6);
      } else if (gap > bot.radius + range * 0.45 || !los) {
        dest = t.rect ? closestApproach(t, bot.pos, bot.radius + 4) : t.pos;
      } else if (!t.isStructure) {
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

// Ponto de onde chegar a uma construção retangular (fora dela, a `pad` da borda).
function closestApproach(target, from, pad) {
  const p = closestPoint(target, from);
  if (!target.rect) return p;
  const dx = from.x - p.x;
  const dy = from.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len > 1e-6) return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad };
  return { x: target.rect.x - pad, y: p.y };
}

export function abilityConditionMet(world, bot, target, ai) {
  if (!ai) return false;
  const d = target ? dist(bot.pos, target.pos) : Infinity;
  const gap = target ? edgeDistance(target, bot.pos) : Infinity;
  const los = !ai.los || (target && (target.rect || hasLineOfSight(world.map, bot.pos, target.pos)));
  switch (ai.when) {
    case 'targetInRange':
      return !!target && gap <= ai.range && los;
    case 'targetBetween':
      return !!target && d >= ai.min && d <= ai.max && los;
    case 'enemiesNear':
      return countEnemiesNear(world, bot, ai.radius) >= ai.count && bot.hpFraction >= (ai.minHp ?? 0);
    case 'underPressure':
      return bot.hpFraction <= ai.hp && countEnemiesNear(world, bot, ai.radius) >= ai.count;
    case 'lowHp':
      return bot.hpFraction <= ai.hp && countEnemiesNear(world, bot, ai.radius) >= 1;
    case 'targetLowHp':
      return !!target && !target.isStructure && target.hpFraction <= ai.hp && gap <= ai.range;
    default:
      return false;
  }
}
