// As 30 habilidades, descritas como dados. O AbilitySystem executa os efeitos por tipo:
//   melee, dash, buff, taunt, projectile, aoe, zone
// "dmg" é um coeficiente sobre o dano-base da classe. Cooldowns em segundos (handoff, seção 5).
// "ai" descreve quando um bot deve usar a habilidade.

const warrior = [
  {
    id: 'warrior_power_strike', name: 'Golpe Poderoso', cooldown: 6, icon: '⚔',
    description: 'Ataque frontal com dano aumentado que empurra os inimigos.',
    effects: [{ type: 'melee', range: 62, arc: 110, dmg: 2.2, knockback: 70 }],
    ai: { when: 'targetInRange', range: 58 },
  },
  {
    id: 'warrior_charge', name: 'Investida', cooldown: 10, icon: '➶',
    description: 'Avança rapidamente; o primeiro inimigo atingido sofre dano e fica atordoado.',
    effects: [{ type: 'dash', distance: 270, speed: 760, hitDamage: 1.5, stun: 0.6, stopOnHit: true }],
    ai: { when: 'targetBetween', min: 110, max: 260 },
  },
  {
    id: 'warrior_defensive_stance', name: 'Postura Defensiva', cooldown: 14, icon: '🛡',
    description: 'Reduz em 40% o dano recebido por 4 s, com leve perda de velocidade.',
    effects: [{ type: 'buff', duration: 4, modifiers: { damageTakenMult: 0.6, speedMult: 0.85 }, visual: 'shield' }],
    ai: { when: 'underPressure', hp: 0.8, radius: 140, count: 1 },
  },
  {
    id: 'warrior_taunt', name: 'Provocação', cooldown: 16, icon: '📣',
    description: 'Bots inimigos próximos passam a atacar o guerreiro por 3 s.',
    effects: [{ type: 'taunt', radius: 260, duration: 3 }],
    ai: { when: 'enemiesNear', radius: 240, count: 2 },
  },
  {
    id: 'warrior_last_stand', name: 'Última Resistência', cooldown: 50, icon: '✚',
    description: 'Reduz em 75% o dano recebido por 5 s.',
    effects: [{ type: 'buff', duration: 5, modifiers: { damageTakenMult: 0.25 }, visual: 'goldShield' }],
    ai: { when: 'lowHp', hp: 0.35, radius: 200 },
  },
];

const barbarian = [
  {
    id: 'barb_fury', name: 'Fúria', cooldown: 14, icon: '🔥',
    description: 'Ataques básicos causam 40% mais dano por 6 s.',
    effects: [{ type: 'buff', duration: 6, modifiers: { basicDamageMult: 1.4 }, visual: 'fury' }],
    ai: { when: 'enemiesNear', radius: 160, count: 1 },
  },
  {
    id: 'barb_brutal', name: 'Golpe Brutal', cooldown: 10, icon: '🪓',
    description: 'Golpe pesado contra um único alvo.',
    effects: [{ type: 'melee', range: 60, arc: 70, dmg: 3.0, maxTargets: 1 }],
    ai: { when: 'targetInRange', range: 56 },
  },
  {
    id: 'barb_whirl', name: 'Giro Selvagem', cooldown: 12, icon: '🌀',
    description: 'Gira o machado e atinge todos os inimigos ao redor.',
    effects: [{ type: 'aoe', at: 'self', radius: 115, dmg: 1.6, visual: 'whirl' }],
    ai: { when: 'enemiesNear', radius: 105, count: 1 },
  },
  {
    id: 'barb_guard_break', name: 'Quebra-Guarda', cooldown: 18, icon: '💥',
    description: 'Causa dano e atordoa o alvo por 1,2 s.',
    effects: [{ type: 'melee', range: 58, arc: 80, dmg: 1.4, maxTargets: 1, stun: 1.2 }],
    ai: { when: 'targetInRange', range: 54 },
  },
  {
    id: 'barb_berserk', name: 'Fúria Berserker', cooldown: 45, icon: '😤',
    description: 'Por 8 s: +50% de dano, ataques 40% mais rápidos e +15% de velocidade.',
    effects: [{ type: 'buff', duration: 8, modifiers: { damageMult: 1.5, attackSpeedMult: 1.4, speedMult: 1.15 }, visual: 'berserk' }],
    ai: { when: 'enemiesNear', radius: 200, count: 1, minHp: 0.4 },
  },
];

const mage = [
  {
    id: 'mage_arcane_bolt', name: 'Projétil Arcano', cooldown: 5, icon: '✦',
    description: 'Dispara um projétil mágico poderoso.',
    effects: [{ type: 'projectile', speed: 540, range: 500, dmg: 2.0, radius: 10, visual: 'arcaneBig' }],
    ai: { when: 'targetInRange', range: 480, los: true },
  },
  {
    id: 'mage_elemental_burst', name: 'Explosão Elemental', cooldown: 14, icon: '☄',
    description: 'Após um breve aviso, uma explosão de fogo atinge a área marcada.',
    effects: [{ type: 'aoe', at: 'aim', maxRange: 380, radius: 100, dmg: 2.3, delay: 0.5, visual: 'fire' }],
    ai: { when: 'targetInRange', range: 380 },
  },
  {
    id: 'mage_mystic_ray', name: 'Raio Místico', cooldown: 8, icon: '⚡',
    description: 'Um raio quase instantâneo contra o primeiro inimigo na direção da mira.',
    effects: [{ type: 'projectile', speed: 1500, range: 440, dmg: 1.6, radius: 8, visual: 'lightning' }],
    ai: { when: 'targetInRange', range: 430, los: true },
  },
  {
    id: 'mage_freezing_field', name: 'Campo Congelante', cooldown: 12, icon: '❄',
    description: 'Cria uma área de gelo que reduz em 55% a velocidade dos inimigos por 3 s.',
    effects: [{ type: 'zone', at: 'aim', maxRange: 360, radius: 120, duration: 3, tickInterval: 0.5, dmg: 0.2, slow: 0.45, visual: 'frost' }],
    ai: { when: 'targetInRange', range: 360 },
  },
  {
    id: 'mage_arcane_storm', name: 'Tempestade Arcana', cooldown: 45, icon: '🌩',
    description: 'Invoca uma tempestade que causa dano mágico contínuo por 5 s.',
    effects: [{ type: 'zone', at: 'aim', maxRange: 360, radius: 150, duration: 5, tickInterval: 0.5, dmg: 0.75, visual: 'storm' }],
    ai: { when: 'targetInRange', range: 360 },
  },
];

const archer = [
  {
    id: 'archer_precise', name: 'Disparo Preciso', cooldown: 5, icon: '🎯',
    description: 'Flecha rápida de dano aumentado e chance crítica maior.',
    effects: [{ type: 'projectile', speed: 950, range: 580, dmg: 2.4, radius: 6, critBonus: 0.25, visual: 'arrowBig' }],
    ai: { when: 'targetInRange', range: 560, los: true },
  },
  {
    id: 'archer_rain', name: 'Chuva de Flechas', cooldown: 12, icon: '☔',
    description: 'Cinco ondas de flechas caem sobre a área marcada.',
    effects: [{ type: 'aoe', at: 'aim', maxRange: 460, radius: 110, dmg: 0.55, delay: 0.35, waves: 5, interval: 0.25, visual: 'arrows' }],
    ai: { when: 'targetInRange', range: 450 },
  },
  {
    id: 'archer_piercing', name: 'Flecha Perfurante', cooldown: 9, icon: '➹',
    description: 'A flecha atravessa todos os inimigos em linha.',
    effects: [{ type: 'projectile', speed: 880, range: 640, dmg: 1.8, radius: 7, pierce: 99, visual: 'arrowBig' }],
    ai: { when: 'targetInRange', range: 600, los: true },
  },
  {
    id: 'archer_recoil', name: 'Disparo de Recuo', cooldown: 14, icon: '↩',
    description: 'Dispara à queima-roupa, empurra o alvo e salta para trás.',
    effects: [
      { type: 'projectile', speed: 800, range: 300, dmg: 1.3, radius: 7, knockback: 170, visual: 'arrowBig' },
      { type: 'dash', distance: 150, speed: 700, direction: 'back' },
    ],
    ai: { when: 'targetInRange', range: 150, los: true },
  },
  {
    id: 'archer_volley', name: 'Rajada Mortal', cooldown: 40, icon: '🏹',
    description: 'Dispara oito flechas em sequência rápida na direção da mira.',
    effects: [{ type: 'projectile', speed: 760, range: 520, dmg: 0.9, radius: 5, count: 8, interval: 0.09, spread: 6, visual: 'arrow' }],
    ai: { when: 'targetInRange', range: 480, los: true },
  },
];

const mercenary = [
  {
    id: 'merc_quick_cut', name: 'Corte Rápido', cooldown: 7, icon: '🗡',
    description: 'Corte veloz em arco amplo, quase sem tempo de execução.',
    effects: [{ type: 'melee', range: 56, arc: 130, dmg: 1.7 }],
    castLock: 0.05,
    ai: { when: 'targetInRange', range: 52 },
  },
  {
    id: 'merc_shadow_step', name: 'Passo Sombrio', cooldown: 16, icon: '💨',
    description: 'Desloca-se rapidamente na direção da mira e ganha velocidade por 1,5 s.',
    effects: [
      { type: 'dash', distance: 250, speed: 1150 },
      { type: 'buff', duration: 1.5, modifiers: { speedMult: 1.3 } },
    ],
    ai: { when: 'targetBetween', min: 150, max: 320 },
  },
  {
    id: 'merc_opportunist', name: 'Golpe Oportunista', cooldown: 10, icon: '🎲',
    description: 'Dano dobrado contra alvos isolados, atordoados, lentos ou com menos da metade da vida.',
    effects: [{ type: 'melee', range: 56, arc: 80, dmg: 1.6, maxTargets: 1, vulnerableMult: 2 }],
    ai: { when: 'targetInRange', range: 52 },
  },
  {
    id: 'merc_smoke', name: 'Bomba de Fumaça', cooldown: 18, icon: '☁',
    description: 'Nuvem de fumaça por 4 s: bots não conseguem mirar aliados dentro dela, e inimigos ficam lentos.',
    effects: [{ type: 'zone', at: 'self', radius: 140, duration: 4, smoke: true, slow: 0.8, visual: 'smoke' }],
    ai: { when: 'lowHp', hp: 0.45, radius: 180 },
  },
  {
    id: 'merc_execute', name: 'Execução', cooldown: 45, icon: '☠',
    description: 'Golpe letal: dano enorme contra inimigos com menos de 35% da vida.',
    effects: [{ type: 'melee', range: 58, arc: 80, dmg: 1.5, maxTargets: 1, execute: { threshold: 0.35, dmg: 6 } }],
    ai: { when: 'targetLowHp', hp: 0.35, range: 56 },
  },
];

const halberdier = [
  {
    id: 'halb_thrust', name: 'Estocada', cooldown: 5, icon: '↗',
    description: 'Estocada de longo alcance em linha reta.',
    effects: [{ type: 'melee', range: 130, arc: 28, dmg: 1.8 }],
    ai: { when: 'targetInRange', range: 120 },
  },
  {
    id: 'halb_sweep', name: 'Varredura', cooldown: 9, icon: '◠',
    description: 'Atinge os inimigos num arco frontal amplo e os afasta.',
    effects: [{ type: 'melee', range: 95, arc: 170, dmg: 1.4, knockback: 55 }],
    ai: { when: 'targetInRange', range: 90 },
  },
  {
    id: 'halb_hook', name: 'Gancho de Alabarda', cooldown: 14, icon: '⚓',
    description: 'Lança o gancho e puxa o primeiro inimigo atingido, respeitando obstáculos.',
    effects: [{ type: 'projectile', speed: 850, range: 320, dmg: 0.8, radius: 9, pull: true, stun: 0.3, visual: 'hook' }],
    ai: { when: 'targetBetween', min: 120, max: 310, los: true },
  },
  {
    id: 'halb_formation', name: 'Formação Defensiva', cooldown: 12, icon: '▣',
    description: 'Por 4 s, reduz em 45% o próprio dano recebido (mais lento) e protege aliados próximos.',
    effects: [
      { type: 'buff', duration: 4, modifiers: { damageTakenMult: 0.55, speedMult: 0.6 }, visual: 'shield' },
      { type: 'buff', target: 'allies', radius: 150, duration: 4, modifiers: { damageTakenMult: 0.8 }, visual: 'shieldSmall' },
    ],
    ai: { when: 'enemiesNear', radius: 200, count: 2 },
  },
  {
    id: 'halb_dominion', name: 'Domínio do Campo', cooldown: 45, icon: '✴',
    description: 'Cinco giros seguidos da alabarda que ferem e desaceleram tudo ao redor.',
    effects: [{ type: 'aoe', at: 'self', radius: 115, dmg: 1.0, waves: 5, interval: 0.35, slow: 0.7, slowDuration: 1, visual: 'whirl' }],
    ai: { when: 'enemiesNear', radius: 110, count: 1 },
  },
];

export const ABILITIES_BY_CLASS = { warrior, barbarian, mage, archer, mercenary, halberdier };

export const ABILITIES = Object.fromEntries(
  Object.values(ABILITIES_BY_CLASS).flat().map((a) => [a.id, a]),
);
