// Controla o estado geral da aplicação: cenas, partida atual, loop, renderização e interface.
import { FIXED_DT } from '../config.js';
import { EventBus } from './EventBus.js';
import { GameLoop } from './GameLoop.js';
import { InputManager, DEFAULT_BINDINGS } from './InputManager.js';
import { MatchManager, MATCH_STATE } from '../systems/MatchManager.js';
import { loadSettings, saveSettings, defaultSettings } from '../systems/Settings.js';
import { PlayerController } from '../entities/PlayerController.js';
import { Effects } from '../render/Effects.js';
import { Assets } from '../render3d/Assets.js';
import { CameraRig } from '../render3d/CameraRig.js';
import { Renderer3D } from '../render3d/Renderer3D.js';
import { Overlay } from '../render3d/Overlay.js';
import { renderPortraits } from '../render3d/Portraits.js';
import { HUD } from '../ui/HUD.js';
import { Screens } from '../ui/Screens.js';
import { Sfx } from '../audio/Sfx.js';

// Resolução lógica: o canvas real acompanha o tamanho da janela, mas o jogo enxerga sempre 1280×720.
const VIEW_W = 1280;
const VIEW_H = 720;

export const SCENE = Object.freeze({
  MENU: 'menu',
  CLASSES: 'classes',
  SETTINGS: 'settings',
  CREDITS: 'credits',
  PLAYING: 'playing',
  PAUSED: 'paused',
  RESULTS: 'results',
});

export class Game {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#game');
    this.settings = loadSettings();
    this.bindings = DEFAULT_BINDINGS;
    this.overlayCanvas = root.querySelector('#overlay');
    this.input = new InputManager(window, this.canvas, this.bindings, { width: VIEW_W, height: VIEW_H });
    this.rig = new CameraRig(VIEW_W, VIEW_H);
    this.assets = new Assets();
    this.renderer = new Renderer3D(this.canvas, this.rig, this.assets);
    this.overlay = new Overlay(this.overlayCanvas, this.rig);
    this.sfx = new Sfx();
    this.hud = new HUD(root.querySelector('#hud'), this.bindings);
    this.screens = new Screens(root, { onAction: (a) => this.onAction(a), bindings: this.bindings });
    this.scene = null;
    this.match = null;
    this.effects = null;
    this.previousScene = SCENE.MENU;
    this.loop = new GameLoop({
      step: FIXED_DT,
      update: (dt) => this.update(dt),
      render: (alpha, elapsed) => this.render(elapsed),
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointerdown', () => this.sfx.unlock(), { once: false });
    window.addEventListener('keydown', () => this.sfx.unlock(), { once: false });
  }

  // Ajusta a resolução real dos canvas à tela (nitidez em telas grandes e de alta densidade).
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = this.canvas.clientWidth || VIEW_W;
    const cssHeight = this.canvas.clientHeight || VIEW_H;
    this.renderer.setSize(cssWidth, cssHeight, dpr);
    const w = Math.round(cssWidth * dpr);
    const h = Math.round(cssHeight * dpr);
    this.overlay.resize(w, h, w / VIEW_W);
  }

  async start() {
    this.screens.buildClassSelection('villager', (id) => this.screens.selectClass(id));
    this.setScene(SCENE.MENU);
    const fill = this.root.querySelector('#loading-fill');
    await this.assets.load((k) => (fill.style.width = `${Math.round(k * 100)}%`));
    this.root.querySelector('#loading').classList.add('hidden');
    renderPortraits(this.assets, this.screens.portraitTargets());
    this.startDemo();
    this.loop.start();
  }

  // Partida de demonstração (só bots) que roda ao fundo dos menus.
  startDemo() {
    this.beginMatch({ demo: true });
  }

  beginMatch({ demo = false } = {}) {
    this.hud.detach();
    this.effects?.dispose();
    const events = new EventBus();
    const config = demo
      ? { ...this.settings, matchDuration: 9999 }
      : { ...this.settings };
    this.match = new MatchManager({
      config,
      events,
      createPlayerController: demo ? () => null : () => new PlayerController(this.input, this.rig),
    }).start();
    this.demo = demo;
    this.effects = new Effects(events, {
      getCharacter: (id) => this.match.world.getCharacter(id),
      onShake: (v) => !demo && this.rig.addShake(v),
      settings: this.settings,
    });
    events.on('ability', (e) => {
      const c = this.match.world.getCharacter(e.casterId);
      const idx = c ? c.classDef.abilities.findIndex((a) => a.id === e.abilityId) : -1;
      if (idx >= 0) this.renderer.onAbility(e.casterId, idx);
    });
    const p = this.match.player;
    if (!demo) this.rig.yaw = this.rig.yawGoal = -Math.PI / 4;
    this.rig.follow(p.pos, 0, true);
    if (!demo) {
      this.hookSounds(events);
      this.hud.attach(this.match);
      events.on('matchEnd', (result) => {
        setTimeout(() => {
          if (this.match.result === result) {
            this.setScene(SCENE.RESULTS);
            this.screens.showResult(result);
          }
        }, 1200);
        if (result.outcome === 'victory') this.sfx.victory();
        else this.sfx.defeat();
      });
    }
  }

  hookSounds(events) {
    const isPlayer = (id) => id === this.match.playerId;
    this.sfx.enabled = this.settings.sound;
    events.on('attack', (e) => isPlayer(e.attackerId) && this.sfx.swing());
    events.on('ability', (e) => isPlayer(e.casterId) && this.sfx.ability());
    events.on('abilityFailed', (e) => isPlayer(e.casterId) && e.reason === 'sem recurso' && this.sfx.denied());
    events.on('upgradeFailed', (e) => isPlayer(e.characterId) && this.sfx.denied());
    events.on('transform', (e) => isPlayer(e.characterId) && this.sfx.ability());
    events.on('buildingDestroyed', () => this.sfx.alert());
    events.on('damage', (e) => {
      if (isPlayer(e.targetId)) this.sfx.hurt();
      else if (isPlayer(e.sourceId)) this.sfx.hit();
    });
    events.on('death', (e) => {
      if (isPlayer(e.victimId)) this.sfx.death();
      else if (isPlayer(e.killerId)) this.sfx.kill();
    });
    events.on('objective', () => this.sfx.alert());
  }

  setScene(scene) {
    this.scene = scene;
    const screenFor = {
      [SCENE.MENU]: 'menu', [SCENE.CLASSES]: 'classes', [SCENE.SETTINGS]: 'settings',
      [SCENE.CREDITS]: 'credits', [SCENE.PAUSED]: 'pause', [SCENE.RESULTS]: 'results', [SCENE.PLAYING]: null,
    };
    this.screens.show(screenFor[scene]);
    this.hud.show(!this.demo && (scene === SCENE.PLAYING || scene === SCENE.PAUSED));
    this.input.enabled = scene === SCENE.PLAYING;
    this.input.releaseAll();
    this.canvas.style.cursor = scene === SCENE.PLAYING ? 'none' : 'default';
  }

  play() {
    this.beginMatch();
    this.setScene(SCENE.PLAYING);
  }

  toMenu() {
    this.startDemo();
    this.setScene(SCENE.MENU);
  }

  onAction(action) {
    switch (action) {
      case 'play':
        this.play();
        break;
      case 'classes':
        if (!this.demo) this.startDemo();
        this.previousScene = SCENE.MENU;
        this.setScene(SCENE.CLASSES);
        break;
      case 'settings':
        this.screens.fillSettings(this.settings);
        this.setScene(SCENE.SETTINGS);
        break;
      case 'reset-settings':
        this.screens.fillSettings(defaultSettings());
        break;
      case 'credits':
        this.setScene(SCENE.CREDITS);
        break;
      case 'back':
        if (this.scene === SCENE.SETTINGS) {
          this.settings = this.screens.readSettings(this.settings);
          this.effects.settings = this.settings;
          saveSettings(this.settings);
        }
        this.setScene(SCENE.MENU);
        break;
      case 'resume':
        this.setScene(SCENE.PLAYING);
        break;
      case 'restart':
        this.play();
        break;
      case 'menu':
        this.toMenu();
        break;
      default:
        break;
    }
  }

  update(dt) {
    if (this.scene === SCENE.PLAYING) {
      if (this.input.wasPressed('pause')) {
        this.input.consumePressed();
        this.setScene(SCENE.PAUSED);
        return;
      }
      if (this.input.wasPressed('restart')) {
        this.input.consumePressed();
        this.play();
        return;
      }
      if (this.input.wasPressed('rotateLeft')) this.rig.rotate(-Math.PI / 4);
      if (this.input.wasPressed('rotateRight')) this.rig.rotate(Math.PI / 4);
      this.match.update(dt);
      this.input.consumePressed();
    } else if (this.demo) {
      this.match.update(dt);
    } else if (this.scene === SCENE.PAUSED && this.inputPausePressed()) {
      this.setScene(SCENE.PLAYING);
    }
  }

  // Esc também fecha a pausa (a entrada fica desativada fora do jogo, então lemos direto).
  inputPausePressed() {
    const pressed = this.bindings.pause.some((code) => this.input.pressed.has(code));
    this.input.pressed.clear();
    return pressed;
  }

  render(elapsed) {
    if (!this.match) return;
    const running = this.scene === SCENE.PLAYING || this.demo;
    const dt = running ? elapsed : 0;
    const player = this.match.player;
    // A câmera da demonstração passeia entre os personagens e gira devagar.
    let focus = player.pos;
    if (this.demo) {
      const alive = this.match.world.characters.filter((c) => c.alive);
      const idx = Math.floor(this.match.elapsed / 8) % Math.max(1, alive.length);
      focus = alive[idx]?.pos ?? player.pos;
      this.rig.rotate(dt * 0.08);
    } else if (this.scene === SCENE.PLAYING) {
      const cam = this.input.takeCameraInput();
      if (cam.dragX) this.rig.rotate(cam.dragX * 0.01);
      if (cam.wheel) this.rig.zoom(-cam.wheel * 2.5);
    }
    this.rig.follow(focus, dt);
    this.effects.update(dt);
    const aim = this.scene === SCENE.PLAYING && this.input.mouse.inside && player.alive
      ? this.rig.screenToWorld(this.input.mouse.x, this.input.mouse.y)
      : null;
    this.renderer.render(this.match, this.effects, dt, this.demo ? null : player.pos);
    this.overlay.render(this.match, this.effects, { aim, showPlayerUi: !this.demo && this.scene !== SCENE.RESULTS });
    if (!this.demo && this.scene !== SCENE.RESULTS) this.hud.update();
    if (this.match.state === MATCH_STATE.ENDED && this.demo) this.startDemo();
  }
}
