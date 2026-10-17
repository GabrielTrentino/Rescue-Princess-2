// Coordena a partida: criação das equipes, respawn, objetivo, tempo, vitória, derrota e reinício.
import { EventBus } from '../core/EventBus.js';
import { createRng } from '../core/math.js';
import { DIFFICULTY, MATCH_DEFAULTS, TEAMS } from '../config.js';
import { getMap } from '../data/maps.js';
import { CLASS_ORDER, VILLAGER, getClass } from '../classes/classDefinitions.js';
import { Building, upgradeBuilding } from '../world/Structures.js';
import { spawnWeaponDrop } from '../world/Weapons.js';
import { Character } from '../entities/Character.js';
import { World } from '../world/World.js';
import { CaptureObjective } from '../world/ObjectiveManager.js';
import { BotController, BOT_ROLE } from '../ai/BotController.js';
import { spawnPoint, updateRespawns } from './RespawnSystem.js';

const BLUE_NAMES = ['Lia', 'Bento', 'Iara', 'Caio', 'Nina', 'Teo', 'Duda', 'Rui', 'Mel', 'Juca', 'Bia', 'Davi'];
const RED_NAMES = ['Grum', 'Vexa', 'Morg', 'Tarn', 'Ilka', 'Bors', 'Zeca', 'Fera', 'Drak', 'Sura', 'Kael', 'Brum'];
const ALLY_ROLES = [BOT_ROLE.ESCORT, BOT_ROLE.ATTACK, BOT_ROLE.DEFEND, BOT_ROLE.ATTACK, BOT_ROLE.ESCORT, BOT_ROLE.DEFEND, BOT_ROLE.ATTACK];
const ENEMY_ROLES = [BOT_ROLE.ATTACK, BOT_ROLE.DEFEND, BOT_ROLE.ATTACK, BOT_ROLE.ATTACK, BOT_ROLE.DEFEND, BOT_ROLE.ATTACK, BOT_ROLE.ESCORT];
// A equipe guarda um pouco de ouro antes de melhorar construções sozinha (o jogador também pode melhorar).
const DIRECTOR_INTERVAL = 6;

export const MATCH_STATE = Object.freeze({ PLAYING: 'playing', ENDED: 'ended' });

export class MatchManager {
  /**
   * @param {object} opts
   * @param {string} [opts.playerClassId]  classe inicial do jogador (padrão: aldeão, como todos)
   * @param {object} [opts.config]   sobrescreve MATCH_DEFAULTS
   * @param {EventBus} [opts.events]
   * @param {number} [opts.seed]
   * @param {() => object|null} [opts.createPlayerController]  null = jogador controlado por IA (útil em testes)
   */
  constructor({ playerClassId = VILLAGER, config = {}, events = new EventBus(), seed, createPlayerController = () => null }) {
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
    this.directorTimer = DIRECTOR_INTERVAL;

    const world = this.world;
    const makeId = () => world.nextId++;
    const shuffle = (arr) => arr.map((v) => [rng(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

    // Construções do mapa. Cada uma que fabrica armas já começa com uma no suporte.
    for (const def of map.buildings) {
      const b = new Building({
        kind: def.kind, team: def.team, rect: { x: def.x, y: def.y, w: def.w, h: def.h },
        destroyed: def.destroyed ?? false, rackSide: def.rackSide,
      });
      world.buildings.push(b);
      if (b.classId && !b.destroyed) {
        for (const slot of [-1, 1]) spawnWeaponDrop(world, { classId: b.classId, tier: 1, x: b.rack.x, y: b.rack.y + slot * 22, buildingId: b.id });
      }
    }

    // Jogador
    const p0 = spawnPoint(map, TEAMS.BLUE, 0);
    const player = new Character({ id: makeId(), classDef: getClass(this.playerClassId), team: TEAMS.BLUE, x: p0.x, y: p0.y, name: 'Você', isPlayer: true });
    const human = this.createPlayerController(player);
    this.hasHuman = !!human;
    player.controller = human ??
      new BotController({ role: BOT_ROLE.ATTACK, decisionInterval: config.aiDecisionInterval, rng, preferredClass: CLASS_ORDER[0] });
    world.addCharacter(player);
    this.playerId = player.id;

    // Todos começam como aldeões. Cada bot tem uma classe preferida, para a equipe ficar variada.
    const allyClasses = shuffle([...CLASS_ORDER]);
    for (let i = 0; i < config.alliesCount; i++) {
      const p = spawnPoint(map, TEAMS.BLUE, i + 1);
      const c = new Character({ id: makeId(), classDef: getClass(VILLAGER), team: TEAMS.BLUE, x: p.x, y: p.y, name: BLUE_NAMES[i % BLUE_NAMES.length] });
      c.controller = new BotController({
        role: ALLY_ROLES[i % ALLY_ROLES.length], decisionInterval: config.aiDecisionInterval, rng, leaderId: player.id, abilityChance: 0.6,
        preferredClass: allyClasses[i % allyClasses.length],
      });
      world.addCharacter(c);
    }

    const enemyClasses = shuffle([...CLASS_ORDER]);
    for (let i = 0; i < config.enemiesCount; i++) {
      const p = spawnPoint(map, TEAMS.RED, i);
      const c = new Character({ id: makeId(), classDef: getClass(VILLAGER), team: TEAMS.RED, x: p.x, y: p.y, name: RED_NAMES[i % RED_NAMES.length] });
      c.outgoingDamageMult = difficulty.enemyDamage;
      c.controller = new BotController({
        role: ENEMY_ROLES[i % ENEMY_ROLES.length],
        decisionInterval: Math.max(config.aiDecisionInterval, difficulty.reaction),
        abilityChance: difficulty.abilityChance,
        preferredClass: enemyClasses[i % enemyClasses.length],
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

  castle(team) {
    return this.world.buildings.find((b) => b.kind === 'castle' && b.team === team) ?? null;
  }

  buildingsLost(team) {
    return this.world.buildings.filter((b) => b.destroyed && b.team === team).length;
  }

  // Cada equipe melhora construções sozinha quando junta ouro de sobra.
  runDirector(dt) {
    this.directorTimer -= dt;
    if (this.directorTimer > 0) return;
    this.directorTimer = DIRECTOR_INTERVAL;
    for (const team of [TEAMS.BLUE, TEAMS.RED]) {
      const reserve = team === this.player?.team && this.hasHuman ? 250 : 80;
      const options = this.world.buildings
        .filter((b) => b.team === team && !b.destroyed && b.classId && b.upgradeCost !== null)
        .sort((a, b) => a.level - b.level || a.upgradeCost - b.upgradeCost);
      const pick = options[0];
      if (pick && this.world.gold[team] >= pick.upgradeCost + reserve) upgradeBuilding(this.world, pick, team);
    }
  }

  update(dt) {
    if (this.state !== MATCH_STATE.PLAYING) return;
    this.elapsed += dt;
    this.world.update(dt);
    updateRespawns(this.world, dt);
    this.runDirector(dt);
    // Destruir o castelo inimigo também vence a partida.
    for (const team of [TEAMS.BLUE, TEAMS.RED]) {
      const castle = this.castle(team);
      if (castle && castle.destroyed) {
        this.end(team === TEAMS.BLUE ? TEAMS.RED : TEAMS.BLUE, 'castle');
        return;
      }
    }
    const winner = this.objective.update(dt);
    if (winner) this.end(winner, 'objective');
    else if (this.elapsed >= this.config.matchDuration) this.end(this.decideOnTimeout(), 'timeout');
  }

  // Ao fim do tempo: avanço na base adversária, depois construções derrubadas, depois eliminações.
  decideOnTimeout() {
    const byObjective = this.objective.decideOnTimeout({ tiebreakKills: false });
    if (byObjective) return byObjective;
    const lostBlue = this.buildingsLost(TEAMS.BLUE);
    const lostRed = this.buildingsLost(TEAMS.RED);
    if (lostBlue !== lostRed) return lostBlue < lostRed ? TEAMS.BLUE : TEAMS.RED;
    const kb = this.teamKills(TEAMS.BLUE);
    const kr = this.teamKills(TEAMS.RED);
    if (kb === kr) return null;
    return kb > kr ? TEAMS.BLUE : TEAMS.RED;
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
      buildingsDestroyed: { blue: this.buildingsLost(TEAMS.RED), red: this.buildingsLost(TEAMS.BLUE) },
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
