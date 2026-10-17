// Interface da partida (DOM). Apenas exibe o estado; não decide regras.
import { keyLabel } from '../core/InputManager.js';
import { BUILDING_TYPES } from '../world/Structures.js';

const ABILITY_ACTIONS = ['ability1', 'ability2', 'ability3', 'ability4', 'ability5'];

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class HUD {
  constructor(root, bindings) {
    this.root = root;
    this.bindings = bindings;
    this.el = {
      timer: root.querySelector('#hud-timer'),
      score: root.querySelector('#hud-score'),
      ours: root.querySelector('#obj-ours'),
      theirs: root.querySelector('#obj-theirs'),
      oursBar: root.querySelector('.obj-ours'),
      theirsBar: root.querySelector('.obj-theirs'),
      feed: root.querySelector('#hud-feed'),
      banner: root.querySelector('#hud-banner'),
      respawn: root.querySelector('#hud-respawn'),
      cls: root.querySelector('#hud-class'),
      hp: root.querySelector('#hud-hp'),
      hpText: root.querySelector('#hud-hp-text'),
      kd: root.querySelector('#hud-kd'),
      res: root.querySelector('#hud-res'),
      resText: root.querySelector('#hud-res-text'),
      gold: root.querySelector('#hud-gold'),
      abilities: root.querySelector('#hud-abilities'),
    };
    this.slots = [];
    this.unsubs = [];
  }

  show(v) {
    this.root.classList.toggle('hidden', !v);
  }

  attach(match) {
    this.detach();
    this.match = match;
    const player = match.player;
    this.el.feed.innerHTML = '';
    this.buildSlots(player);
    const ev = match.events;
    const name = (id) => {
      const c = match.world.getCharacter(id);
      if (c) return `<span class="${c.team}">${c.name} (${c.classDef.name})</span>`;
      // Defesas e construções também derrotam personagens.
      const s = match.world.getEntity(id);
      const label = s?.type?.name;
      return label ? `<span class="${s.team}">${label}</span>` : 'Uma defesa';
    };
    this.unsubs.push(
      ev.on('death', (e) => {
        const text = e.killerId ? `${name(e.killerId)} derrotou ${name(e.victimId)}` : `${name(e.victimId)} caiu`;
        this.feed(text);
      }),
      ev.on('objective', (e) => {
        const ours = e.team === player.team;
        if (e.type === 'underAttack') {
          const msg = ours ? 'Nossa base está sendo invadida!' : 'Estamos conquistando a base inimiga!';
          this.feed(msg, 'objective');
          this.banner(msg);
        } else if (e.type === 'captured') {
          this.banner(ours ? 'A base azul caiu!' : 'Base vermelha conquistada!');
        }
      }),
      ev.on('ability', (e) => {
        if (e.casterId !== player.id) return;
        const idx = player.classDef.abilities.findIndex((a) => a.id === e.abilityId);
        this.flashSlot(idx, 'used');
      }),
      ev.on('transform', (e) => {
        const c = match.world.getCharacter(e.characterId);
        if (!c) return;
        if (c.id === player.id) this.banner(`Você virou ${c.classDef.name}!`);
        else if (c.team === player.team && e.from === 'villager') this.feed(`${name(c.id)} pegou uma arma`);
      }),
      ev.on('buildingDestroyed', (e) => {
        const b = match.world.buildings.find((x) => x.id === e.buildingId);
        const label = b ? BUILDING_TYPES[b.kind].name : 'Construção';
        const ours = e.team === player.team;
        this.feed(`${ours ? 'Construção perdida' : 'Construção inimiga destruída'}: ${label}`, 'objective');
        if (ours && b?.kind === 'castle') this.banner('Nosso castelo caiu!');
      }),
      ev.on('buildingUpgraded', (e) => {
        if (e.team !== player.team) return;
        const b = match.world.buildings.find((x) => x.id === e.buildingId);
        if (b) this.feed(`${BUILDING_TYPES[b.kind].name} melhorada para o nível ${e.level}`);
      }),
      ev.on('buildingRebuilt', (e) => {
        if (e.team !== player.team) return;
        const b = match.world.buildings.find((x) => x.id === e.buildingId);
        if (b) this.feed(`${BUILDING_TYPES[b.kind].name} reconstruída`);
      }),
      ev.on('upgradeFailed', (e) => {
        if (e.characterId === player.id) this.banner(`Não deu para melhorar: ${e.reason}`);
      }),
      ev.on('abilityFailed', (e) => {
        if (e.casterId !== player.id || !e.abilityId || e.reason === 'ocupado') return;
        const idx = player.classDef.abilities.findIndex((a) => a.id === e.abilityId);
        this.flashSlot(idx, 'denied');
      }),
    );
  }

  detach() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  buildSlots(player) {
    const box = this.el.abilities;
    box.innerHTML = '';
    this.slots = [];
    const basic = document.createElement('div');
    basic.className = 'ability-slot basic';
    basic.title = `Ataque básico (${keyLabel(this.bindings.attack[0])})`;
    basic.innerHTML = `<img class="icon" src="assets/ui/icons/basic_${player.classDef.attack.kind === 'ranged' ? 'ranged' : 'melee'}.svg" alt=""><div class="cd-overlay"></div>`;
    box.appendChild(basic);
    this.basicSlot = basic;
    player.classDef.abilities.forEach((a, i) => {
      const slot = document.createElement('div');
      slot.className = 'ability-slot';
      slot.title = `${a.name} (${a.cost} de ${player.classDef.resource.name})\n${a.description}`;
      slot.innerHTML = `<span class="key">${keyLabel(this.bindings[ABILITY_ACTIONS[i]][0])}</span><img class="icon" src="${abilityIcon(a)}" alt="${a.icon}"><span class="cost">${a.cost}</span>`;
      box.appendChild(slot);
      this.slots.push({ el: slot, def: a, ready: null });
    });
    this.slotsClass = player.classId;
    const res = player.classDef.resource;
    this.el.cls.textContent = `${player.classDef.name}${player.tier > 1 ? ' ' + '★'.repeat(player.tier - 1) : ''} · ${player.classDef.role}`;
    this.el.res.style.background = res.color;
    this.slotsTier = player.tier;
  }

  flashSlot(idx, cls) {
    const slot = this.slots[idx];
    if (!slot) return;
    slot.el.classList.remove('denied', 'used');
    void slot.el.offsetWidth; // reinicia a animação
    slot.el.classList.add(cls);
  }

  feed(html, cls = '') {
    const item = document.createElement('div');
    item.className = `feed-item ${cls}`;
    item.innerHTML = html;
    this.el.feed.prepend(item);
    while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove();
    setTimeout(() => item.remove(), 6000);
  }

  banner(text) {
    const b = this.el.banner;
    b.textContent = text;
    b.classList.remove('hidden');
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
  }

  update() {
    const match = this.match;
    if (!match) return;
    const player = match.player;
    const bases = match.objective.status();
    this.el.timer.textContent = formatTime(match.timeLeft);
    this.el.timer.classList.toggle('urgent', match.timeLeft <= 30);
    this.el.score.innerHTML = `<span class="blue">${match.teamKills('blue')}</span> × <span class="red">${match.teamKills('red')}</span>`;
    this.el.ours.style.width = `${bases.red.progress * 100}%`;
    this.el.theirs.style.width = `${bases.blue.progress * 100}%`;
    this.el.oursBar.classList.toggle('alert', bases.red.attackers > bases.red.defenders);
    this.el.theirsBar.classList.toggle('alert', bases.blue.attackers > bases.blue.defenders);

    const hpPct = (player.hp / player.maxHp) * 100;
    this.el.hp.style.width = `${hpPct}%`;
    this.el.hp.classList.toggle('low', hpPct < 30);
    this.el.hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    this.el.kd.textContent = `Eliminações ${player.stats.kills} · Mortes ${player.stats.deaths}`;

    if (!player.alive) {
      this.el.respawn.classList.remove('hidden');
      this.el.respawn.textContent = `Você foi derrotado. Reaparecendo em ${Math.ceil(player.respawnTimer)} s`;
    } else {
      this.el.respawn.classList.add('hidden');
    }

    if (this.slotsClass !== player.classId || this.slotsTier !== player.tier) this.buildSlots(player);
    const res = player.classDef.resource;
    this.el.res.style.width = `${(player.resource / player.resourceMax) * 100}%`;
    this.el.resText.textContent = `${res.name} ${Math.floor(player.resource)} / ${player.resourceMax}`;
    this.el.gold.textContent = `Ouro da equipe: ${Math.floor(match.world.gold[player.team])}`;
    this.basicSlot.querySelector('.cd-overlay').style.setProperty('--cd', player.cooldowns.fraction('basic'));
    for (const slot of this.slots) {
      const ready = player.resource >= slot.def.cost;
      if (slot.ready !== ready) {
        slot.el.classList.toggle('ready', ready);
        slot.ready = ready;
      }
    }
  }
}

// Ícone desenhado da habilidade (assets/ui/icons/<id>.svg).
export function abilityIcon(ability) {
  return `assets/ui/icons/${ability.id}.svg`;
}
