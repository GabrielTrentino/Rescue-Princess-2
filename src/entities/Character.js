// Personagem: dados e estado. As regras de combate ficam nos sistemas de combate;
// a aparência fica no renderizador. O raio de colisão vem dos atributos da classe.
import { StatusEffects } from '../combat/StatusEffects.js';
import { Cooldowns } from '../combat/CooldownSystem.js';
import { TIER_BONUS } from '../classes/classDefinitions.js';

export const CHARACTER_STATE = Object.freeze({
  NORMAL: 'normal',
  ATTACKING: 'atacando',
  CASTING: 'usando habilidade',
  CONTROLLED: 'sob controle',
  ARMING: 'pegando arma',
  DEAD: 'morto',
});

export class Character {
  constructor({ id, classDef, team, x, y, name, isPlayer = false, tier = 1 }) {
    this.id = id;
    this.team = team;
    this.name = name;
    this.isPlayer = isPlayer;
    this.pos = { x, y };
    this.setClass(classDef, tier);
    this.facing = team === 'blue' ? 0 : Math.PI;
    this.hp = this.attrs.maxHp;
    this.resource = this.classDef.resource.start ?? this.classDef.resource.max;
    this.arming = null;     // { drop, remaining } enquanto pega uma arma do chão
    this.alive = true;
    this.effects = new StatusEffects();
    this.cooldowns = new Cooldowns();
    this.intent = { move: { x: 0, y: 0 }, aim: null, attack: false, abilities: [], interact: false };
    this.motion = null;
    this.actionTimer = 0;   // trava curta após atacar ou usar habilidade
    this.lastAction = null; // 'attack' | 'ability'
    this.attackAnim = 0;
    this.hurtTimer = 0;
    this.moving = false;
    this.respawnTimer = 0;
    this.taunt = null;
    this.lastHitBy = null;
    this.bufferedAbility = null;
    this.outgoingDamageMult = 1;
    this.controller = null;
    this.stats = { kills: 0, deaths: 0, damageDealt: 0, captureTime: 0 };
  }

  // Troca a classe (ao pegar uma arma ou ao renascer como aldeão), mantendo a fração de vida.
  setClass(classDef, tier = 1) {
    const fraction = this.attrs ? this.hp / this.attrs.maxHp : 1;
    const bonus = TIER_BONUS[tier] ?? TIER_BONUS[1];
    this.classDef = classDef;
    this.classId = classDef.id;
    this.tier = classDef.weapon ? tier : 1;
    this.attrs = { ...classDef.attributes };
    this.attrs.damage *= bonus.damage;
    this.attrs.maxHp = Math.round(this.attrs.maxHp * bonus.maxHp);
    this.radius = this.attrs.radius;
    if (this.hp !== undefined) {
      this.hp = Math.max(1, Math.round(this.attrs.maxHp * fraction));
      const res = classDef.resource;
      this.resource = res.start ?? res.max;
    }
  }

  get isArmed() {
    return !!this.classDef.weapon;
  }

  get isStructure() {
    return false;
  }

  get maxHp() {
    return this.attrs.maxHp;
  }

  get resourceMax() {
    return this.classDef.resource.max;
  }

  gainResource(amount) {
    this.resource = Math.min(this.resourceMax, Math.max(0, this.resource + amount));
  }

  getStat(name) {
    const base = this.attrs[name] ?? 0;
    switch (name) {
      case 'speed':
        return base * Math.max(0.2, this.effects.multiplier('speedMult'));
      case 'attackInterval':
        return base / this.effects.multiplier('attackSpeedMult');
      default:
        return base;
    }
  }

  get stunned() {
    return this.effects.has('stunned');
  }

  get state() {
    if (!this.alive) return CHARACTER_STATE.DEAD;
    if (this.stunned || (this.motion && this.motion.forced)) return CHARACTER_STATE.CONTROLLED;
    if (this.arming) return CHARACTER_STATE.ARMING;
    if (this.actionTimer > 0) return this.lastAction === 'ability' ? CHARACTER_STATE.CASTING : CHARACTER_STATE.ATTACKING;
    return CHARACTER_STATE.NORMAL;
  }

  // Pode iniciar ações (ataque ou habilidade) neste momento?
  get canAct() {
    return this.alive && !this.stunned && !this.motion && !this.arming && this.actionTimer <= 0;
  }

  get hpFraction() {
    return this.hp / this.maxHp;
  }

  resetForSpawn(x, y) {
    this.pos.x = x;
    this.pos.y = y;
    this.hp = this.maxHp;
    this.alive = true;
    this.effects.clear();
    this.motion = null;
    this.actionTimer = 0;
    this.attackAnim = 0;
    this.hurtTimer = 0;
    this.taunt = null;
    this.bufferedAbility = null;
    this.arming = null;
    this.resource = this.classDef.resource.start ?? this.classDef.resource.max;
    this.intent = { move: { x: 0, y: 0 }, aim: null, attack: false, abilities: [], interact: false };
  }
}
