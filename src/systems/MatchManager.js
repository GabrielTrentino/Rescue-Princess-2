// Coordena a partida: criação das equipes, respawn, objetivo, tempo, vitória, derrota e reinício.
import { EventBus } from '../core/EventBus.js';
import { createRng } from '../core/math.js';
import { DIFFICULTY, MATCH_DEFAULTS, TEAMS } from '../config.js';
import { getMap } from '../data/maps.js';
import { CLASS_ORDER, getClass } from '../classes/classDefinitions.js';
import { Character } from '../entities/Character.js';
import { World } from '../world/World.js';
import { CaptureObjective } from '../world/ObjectiveManager.js';
import { BotController, BOT_ROLE } from '../ai/BotController.js';
import { spawnPoint, updateRespawns } from './RespawnSystem.js';

const BLUE_NAMES = ['Lia', 'Bento', 'Iara', 'Caio', 'Nina', 'Teo', 'Duda', 'Rui'];
const RED_NAMES = ['Grum', 'Vexa', 'Morg', 'Tarn', 'Ilka', 'Bors', 'Zeca', 'Fera'];
const ALLY_ROLES = [BOT_ROLE.ESCORT, BOT_ROLE.ATTACK, BOT_ROLE.DEFEND, BOT_ROLE.ATTACK, BOT_ROLE.ESCORT, BOT_ROLE.DEFEND];
const ENEMY_ROLES = [BOT_ROLE.ATTACK, BOT_ROLE.DEFEND, BOT_ROLE.ATTACK, BOT_ROLE.ATTACK, BOT_ROLE.DEFEND, BOT_ROLE.ATTACK];

export const MATCH_STATE = Object.freeze({ PLAYING: 'playing', ENDED: 'ended' });

export class MatchManager {
  /**
   * @param {object} opts
   * @param {string} opts.playerClassId
   * @param {object} [opts.config]   sobrescreve MATCH_DEFAULTS
   * @param {EventBus} [opts.events]
   * @param {number} [opts.seed]
   * @param {() => object|null} [opts.createPlayerController]  null = jogador controlado por IA (útil em testes)
   */
  constructor({ playerClassId = 'warrior', config = {}, events = new EventBus(), seed, createPlayerController = () => null }) {
    this.playerClassId = playerClassId;
    this.config = { ...MATCH_DEFAULTS, ...config };
    this.events = events;
    this.seed = seed;
    this.createPlayerController = createPlayerController;
    this.world = null;
  }

  start() {
    const config = this.config;
    const rng = createRng(this.seed ?? (Date.now() ^ 0x5f3759df));
    const map = getMap(config.mapId);
    const difficulty = DIFFICULTY[config.difficulty] ?? DIFFICULTY.normal;
    this.rng = rng;
    this.world = new World({ map, config, rng, events: this.events });
    this.objective = new CaptureObjective(this.world);
    this.elapsed = 0;
    this.state = MATCH_STATE.PLAYING;
    this.result = null;

    const world = this.world;
    const makeId = () => world.nextId++;
    const shuffle = (arr) => arr.map((v) => [rng(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

    // Jogador
    const p0 = spawnPoint(map, TEAMS.BLUE, 0);
    const player = new Character({ id: makeId(), classDef: getClass(this.playerClassId), team: TEAMS.BLUE, x: p0.x, y: p0.y, name: 'Você', isPlayer: true });
    player.controller = this.createPlayerController(player) ??
      new BotController({ role: BOT_ROLE.ATTACK, decisionInterval: config.aiDecisionInterval, rng });
    world.addCharacter(player);
    this.playerId = player.id;

    // Aliados: priorizam classes diferentes da do jogador para formar uma equipe variada.
    const allyClasses = shuffle(CLASS_ORDER.filter((c) => c !== this.playerClassId));
    for (let i = 0; i < config.alliesCount; i++) {
      const p = spawnPoint(map, TEAMS.BLUE, i + 1);
      const c = new Character({ id: makeId(), classDef: getClass(allyClasses[i % allyClasses.length]), team: TEAMS.BLUE, x: p.x, y: p.y, name: BLUE_NAMES[i % BLUE_NAMES.length] });
      c.controller = new BotController({
        role: ALLY_ROLES[i % ALLY_ROLES.length], decisionInterval: config.aiDecisionInterval, rng, leaderId: player.id, abilityChance: 0.6,
      });
      world.addCharacter(c);
    }

    const enemyClasses = shuffle([...CLASS_ORDER]);
    for (let i = 0; i < config.enemiesCount; i++) {
      const p = spawnPoint(map, TEAMS.RED, i);
      const c = new Character({ id: makeId(), classDef: getClass(enemyClasses[i % enemyClasses.length]), team: TEAMS.RED, x: p.x, y: p.y, name: RED_NAMES[i % RED_NAMES.length] });
      c.outgoingDamageMult = difficulty.enemyDamage;
      c.controller = new BotController({
        role: ENEMY_ROLES[i % ENEMY_ROLES.length],
        decisionInterval: Math.max(config.aiDecisionInterval, difficulty.reaction),
        abilityChance: difficulty.abilityChance,
        rng,
      });
      world.addCharacter(c);
    }

    this.events.emit('matchStart', { playerId: player.id });
    return this;
  }

  restart() {
    return this.start();
  }

  get player() {
    return this.world?.getCharacter(this.playerId) ?? null;
  }

  get timeLeft() {
    return Math.max(0, this.config.matchDuration - this.elapsed);
  }

  teamKills(team) {
    return this.world.characters.filter((c) => c.team === team).reduce((s, c) => s + c.stats.kills, 0);
  }

  update(dt) {
    if (this.state !== MATCH_STATE.PLAYING) return;
    this.elapsed += dt;
    this.world.update(dt);
    updateRespawns(this.world, dt);
    const winner = this.objective.update(dt);
    if (winner) this.end(winner, 'objective');
    else if (this.elapsed >= this.config.matchDuration) this.end(this.objective.decideOnTimeout(), 'timeout');
  }

  end(winner, reason) {
    if (this.state === MATCH_STATE.ENDED) return;
    this.state = MATCH_STATE.ENDED;
    const player = this.player;
    const outcome = winner === null ? 'draw' : winner === player.team ? 'victory' : 'defeat';
    this.result = {
      outcome,
      reason,
      winner,
      duration: this.elapsed,
      player: { ...player.stats, classId: player.classId },
      teamKills: { blue: this.teamKills(TEAMS.BLUE), red: this.teamKills(TEAMS.RED) },
      objectives: {
        blueCaptured: this.objective.bases.red.progress >= 1,
        redCaptured: this.objective.bases.blue.progress >= 1,
        blueAdvance: this.objective.bases.red.progress,
        redAdvance: this.objective.bases.blue.progress,
      },
    };
    this.events.emit('matchEnd', this.result);
  }
}
