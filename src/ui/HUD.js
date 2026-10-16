// Interface da partida (DOM). Apenas exibe o estado; não decide regras.
import { keyLabel } from '../core/InputManager.js';

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
    this.el.cls.textContent = `${player.classDef.name} · ${player.classDef.role}`;
    this.buildSlots(player);
    const ev = match.events;
    const name = (id) => {
      const c = match.world.getCharacter(id);
      return c ? `<span class="${c.team}">${c.name} (${c.classDef.name})</span>` : '?';
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
    basic.innerHTML = `<span class="icon">${player.classDef.attack.kind === 'ranged' ? '➵' : '⚔'}</span><div class="cd-overlay"></div>`;
    box.appendChild(basic);
    this.basicSlot = basic;
    player.classDef.abilities.forEach((a, i) => {
      const slot = document.createElement('div');
      slot.className = 'ability-slot';
      slot.title = `${a.name} (${a.cooldown} s)\n${a.description}`;
      slot.innerHTML = `<span class="key">${keyLabel(this.bindings[ABILITY_ACTIONS[i]][0])}</span><span class="icon">${a.icon}</span><div class="cd-overlay"></div><div class="cd-text"></div>`;
      box.appendChild(slot);
      this.slots.push({ el: slot, def: a, overlay: slot.querySelector('.cd-overlay'), text: slot.querySelector('.cd-text'), ready: null });
    });
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

    this.basicSlot.querySelector('.cd-overlay').style.setProperty('--cd', player.cooldowns.fraction('basic'));
    for (const slot of this.slots) {
      const remaining = player.cooldowns.remaining(slot.def.id);
      const ready = remaining <= 0;
      slot.overlay.style.setProperty('--cd', player.cooldowns.fraction(slot.def.id));
      slot.text.textContent = ready ? '' : remaining >= 1 ? Math.ceil(remaining) : remaining.toFixed(1);
      if (slot.ready !== ready) {
        slot.el.classList.toggle('ready', ready);
        slot.ready = ready;
      }
    }
  }
}
