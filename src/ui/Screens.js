// Telas de menu (DOM): menu inicial, seleção de classe, configurações, créditos, pausa e resultado.
import { CLASSES, CLASS_ORDER } from '../classes/classDefinitions.js';
import { keyLabel } from '../core/InputManager.js';
import { drawPlaceholderCharacter } from '../render/PlaceholderArt.js';
import { abilityIcon } from './HUD.js';

const SCREEN_IDS = ['menu', 'classes', 'settings', 'credits', 'pause', 'results'];
const ABILITY_KEYS = ['ability1', 'ability2', 'ability3', 'ability4', 'ability5'];

// Valores de referência para as barras de atributos.
const STAT_SCALE = [
  ['maxHp', 'Vida', 340],
  ['damage', 'Dano', 26],
  ['speed', 'Velocidade', 180],
  ['range', 'Alcance', 420],
  ['armor', 'Armadura', 45],
];

export class Screens {
  constructor(root, { onAction, bindings, sprites }) {
    this.sprites = sprites;
    this.root = root;
    this.onAction = onAction;
    this.bindings = bindings;
    this.screens = Object.fromEntries(SCREEN_IDS.map((id) => [id, root.querySelector(`#screen-${id}`)]));
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) onAction(btn.dataset.action, btn.dataset);
    });
    this.current = null;
  }

  show(id) {
    for (const [key, el] of Object.entries(this.screens)) el.classList.toggle('hidden', key !== id);
    this.current = id;
    const focus = id && this.screens[id]?.querySelector('button.primary');
    focus?.focus({ preventScroll: true });
  }

  setMenuClass(classId) {
    this.root.querySelector('#menu-class').textContent = CLASSES[classId].name;
  }

  // ---------- Seleção de classe ----------
  buildClassSelection(selectedId, onSelect) {
    const grid = this.root.querySelector('#class-grid');
    grid.innerHTML = '';
    this.classCards = {};
    for (const id of CLASS_ORDER) {
      const def = CLASSES[id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'class-card';
      card.innerHTML = `<canvas width="120" height="120"></canvas><h3>${def.name}</h3><div class="role">${def.role}</div>`;
      card.addEventListener('click', () => onSelect(id));
      card.addEventListener('dblclick', () => this.onAction('play', {}));
      grid.appendChild(card);
      this.classCards[id] = card;
      drawPreview(card.querySelector('canvas'), def, this.sprites);
    }
    this.selectClass(selectedId);
  }

  // Redesenha os retratos das classes (por exemplo, quando os sprites terminam de carregar).
  refreshPreviews() {
    for (const [id, card] of Object.entries(this.classCards ?? {})) drawPreview(card.querySelector('canvas'), CLASSES[id], this.sprites);
  }

  selectClass(id) {
    for (const [cid, card] of Object.entries(this.classCards)) card.classList.toggle('selected', cid === id);
    const def = CLASSES[id];
    const detail = this.root.querySelector('#class-detail');
    const stats = STAT_SCALE.map(([key, label, max]) => {
      const v = def.attributes[key];
      return `<div class="stat-row"><span>${label}</span><div class="stat-bar"><div style="width:${Math.min(100, (v / max) * 100)}%"></div></div><b>${v}</b></div>`;
    }).join('');
    const abilities = def.abilities.map((a, i) => `
      <li>
        <img class="ab-icon" src="${abilityIcon(a)}" alt="${a.icon}">
        <span><b>${a.name}</b><small>${a.description}</small></span>
        <span class="ab-key"><kbd>${keyLabel(this.bindings[ABILITY_KEYS[i]][0])}</kbd> ${a.cooldown} s</span>
      </li>`).join('');
    detail.innerHTML = `
      <div>
        <h3>${def.name} — ${def.role}</h3>
        <p>${def.description}</p>
        ${stats}
        <p><small>Ataque básico: ${def.attack.kind === 'ranged' ? 'à distância' : 'corpo a corpo'}, ${def.attack.damageType === 'magic' ? 'dano mágico' : 'dano físico'}.</small></p>
      </div>
      <div><h3>Habilidades</h3><ul class="ability-list">${abilities}</ul></div>`;
  }

  // ---------- Configurações ----------
  fillSettings(settings) {
    const f = this.root.querySelector('#settings-form');
    f.alliesCount.value = settings.alliesCount;
    f.enemiesCount.value = settings.enemiesCount;
    f.matchMinutes.value = Math.round(settings.matchDuration / 60);
    f.respawnTime.value = settings.respawnTime;
    f.captureTime.value = settings.captureTime;
    f.difficulty.value = settings.difficulty;
    f.showDamageNumbers.checked = settings.showDamageNumbers;
    f.sound.checked = settings.sound;
  }

  readSettings(settings) {
    const f = this.root.querySelector('#settings-form');
    const int = (input, min, max, fallback) => {
      const v = parseInt(input.value, 10);
      return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
    };
    return {
      ...settings,
      alliesCount: int(f.alliesCount, 0, 6, settings.alliesCount),
      enemiesCount: int(f.enemiesCount, 1, 7, settings.enemiesCount),
      matchDuration: int(f.matchMinutes, 1, 20, settings.matchDuration / 60) * 60,
      respawnTime: int(f.respawnTime, 1, 30, settings.respawnTime),
      captureTime: int(f.captureTime, 3, 60, settings.captureTime),
      difficulty: f.difficulty.value,
      showDamageNumbers: f.showDamageNumbers.checked,
      sound: f.sound.checked,
    };
  }

  // ---------- Resultado ----------
  showResult(result) {
    const title = this.root.querySelector('#result-title');
    const labels = { victory: 'Vitória!', defeat: 'Derrota', draw: 'Empate' };
    title.textContent = labels[result.outcome];
    title.className = result.outcome;
    const reasons = {
      objective: result.outcome === 'victory' ? 'Sua equipe conquistou a base vermelha.' : 'A equipe vermelha conquistou a sua base.',
      timeout: result.outcome === 'draw'
        ? 'O tempo acabou com as equipes empatadas.'
        : 'O tempo acabou: vence quem avançou mais na base adversária (e, em caso de empate, quem eliminou mais).',
    };
    this.root.querySelector('#result-reason').textContent = reasons[result.reason];
    const mm = Math.floor(result.duration / 60);
    const ss = String(Math.floor(result.duration % 60)).padStart(2, '0');
    const rows = [
      ['Duração da partida', `${mm}:${ss}`],
      ['Suas eliminações', result.player.kills],
      ['Suas mortes', result.player.deaths],
      ['Dano causado', Math.round(result.player.damageDealt)],
      ['Tempo conquistando', `${Math.round(result.player.captureTime)} s`],
      ['Eliminações (azul × vermelho)', `${result.teamKills.blue} × ${result.teamKills.red}`],
      ['Conquista da base vermelha', `${Math.round(result.objectives.blueAdvance * 100)}%`],
      ['Conquista da base azul', `${Math.round(result.objectives.redAdvance * 100)}%`],
      ['Objetivos concluídos', result.objectives.blueCaptured ? '1 (base vermelha)' : '0'],
    ];
    this.root.querySelector('#result-table').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    this.show('results');
  }
}

function drawPreview(canvas, def, sprites) {
  const ctx = canvas.getContext('2d');
  const frame = sprites?.frame(def.id, 'blue', 'idle', 0, Math.PI / 2);
  if (frame) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = 0.62;
    ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, 60 - frame.ox * s, 112 - frame.oy * s, frame.sw * s, frame.sh * s);
    return;
  }
  const fake = {
    classId: def.id,
    team: 'blue',
    radius: def.attributes.radius,
    facing: 0.5,
  };
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPlaceholderCharacter(ctx, fake, 50, 108, 1.3, { name: 'idle', time: 0, progress: 0 });
}
