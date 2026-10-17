// Telas de menu (DOM): menu inicial, seleção de classe, configurações, créditos, pausa e resultado.
import { CLASSES, ALL_CLASSES } from '../classes/classDefinitions.js';
import { BUILDING_TYPES } from '../world/Structures.js';
import { keyLabel } from '../core/InputManager.js';
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
  constructor(root, { onAction, bindings }) {
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

  // ---------- Guia das classes ----------
  buildClassSelection(selectedId, onSelect) {
    const grid = this.root.querySelector('#class-grid');
    grid.innerHTML = '';
    this.classCards = {};
    for (const id of ALL_CLASSES) {
      const def = CLASSES[id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'class-card';
      card.innerHTML = `<canvas width="120" height="120"></canvas><h3>${def.name}</h3><div class="role">${def.role}</div>`;
      card.addEventListener('click', () => onSelect(id));
      grid.appendChild(card);
      this.classCards[id] = card;
    }
    this.selectClass(selectedId);
  }

  // Pares [classe, canvas] para desenhar os retratos 3D depois que os modelos carregam.
  portraitTargets() {
    return Object.entries(this.classCards ?? {}).map(([id, card]) => [id, card.querySelector('canvas')]);
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
        <span class="ab-key"><kbd>${keyLabel(this.bindings[ABILITY_KEYS[i]][0])}</kbd> ${a.cost} ${def.resource.name.toLowerCase()}</span>
      </li>`).join('');
    detail.innerHTML = `
      <div>
        <h3>${def.name} — ${def.role}</h3>
        <p>${def.description}</p>
        <p><small>${source(id)} Barra de ação: <b style="color:${def.resource.color}">${def.resource.name}</b> (${def.resource.max}).</small></p>
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
      alliesCount: int(f.alliesCount, 0, 7, settings.alliesCount),
      enemiesCount: int(f.enemiesCount, 1, 8, settings.enemiesCount),
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
      castle: result.outcome === 'victory' ? 'Sua equipe derrubou o castelo vermelho.' : 'A equipe vermelha derrubou o seu castelo.',
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
      ['Construções destruídas (azul × vermelho)', `${result.buildingsDestroyed.blue} × ${result.buildingsDestroyed.red}`],
      ['Conquista da base vermelha', `${Math.round(result.objectives.blueAdvance * 100)}%`],
      ['Conquista da base azul', `${Math.round(result.objectives.redAdvance * 100)}%`],
      ['Objetivos concluídos', result.objectives.blueCaptured ? '1 (base vermelha)' : '0'],
    ];
    this.root.querySelector('#result-table').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    this.show('results');
  }
}

// De onde vem a arma da classe.
function source(classId) {
  if (classId === 'villager') return 'Classe inicial de todos (e de quem reaparece).';
  const b = Object.values(BUILDING_TYPES).find((t) => t.classId === classId);
  return b ? `Arma fabricada em: ${b.name}.` : '';
}
