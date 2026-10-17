// Atributos-base das classes. Valores iniciais de balanceamento, ajustáveis por dados.
// attackInterval = segundos entre ataques básicos; range = alcance do ataque básico (px).
// Todos começam como Aldeão; pegar a arma de uma classe (no chão) transforma o personagem nela.
// resource = barra de ação gasta pelas habilidades: max, regen por segundo (negativo = decai),
// start = valor inicial, onHit / onHurt = ganho ao acertar um ataque básico / ao sofrer dano.
import { ABILITIES_BY_CLASS } from './abilityDefinitions.js';

export const VILLAGER = 'villager';
// Classes obtidas com armas, na ordem exibida na interface.
export const CLASS_ORDER = ['warrior', 'barbarian', 'mage', 'archer', 'mercenary', 'halberdier', 'engineer'];
export const ALL_CLASSES = [VILLAGER, ...CLASS_ORDER];

export const CLASSES = {
  villager: {
    id: 'villager',
    name: 'Aldeão',
    role: 'Sem arma',
    weapon: null,
    description: 'Todos começam assim. Pegue uma arma no chão para virar uma classe.',
    attributes: {
      maxHp: 180, damage: 9, speed: 160, range: 52, attackInterval: 0.7, armor: 0,
      magicPower: 0, critChance: 0.05, critMult: 1.5, ccResist: 0, radius: 16,
    },
    attack: { kind: 'melee', arc: 90, damageType: 'physical' },
    resource: { name: 'Estamina', color: '#9be36a', max: 100, regen: 12 },
  },
  warrior: {
    id: 'warrior',
    weapon: 'Espada e escudo',
    resource: { name: 'Vigor', color: '#ffb340', max: 100, regen: 9 },
    name: 'Guerreiro',
    role: 'Linha de frente',
    description: 'Armadura robusta, espada e escudo. Segura posições e protege os aliados.',
    attributes: {
      maxHp: 340, damage: 18, speed: 150, range: 66, attackInterval: 0.75, armor: 45,
      magicPower: 0, critChance: 0.05, critMult: 1.5, ccResist: 0.3, radius: 18,
    },
    attack: { kind: 'melee', arc: 100, damageType: 'physical' },
  },
  barbarian: {
    id: 'barbarian',
    weapon: 'Machado de duas mãos',
    resource: { name: 'Fúria', color: '#ff5a3c', max: 100, regen: -2, start: 30, onHit: 9, onHurt: 0.25 },
    name: 'Bárbaro',
    role: 'Dano corpo a corpo',
    description: 'Corpo volumoso e machado enorme. Causa muito dano, mas sofre quando fica isolado.',
    attributes: {
      maxHp: 300, damage: 26, speed: 155, range: 66, attackInterval: 0.8, armor: 20,
      magicPower: 0, critChance: 0.12, critMult: 1.7, ccResist: 0.15, radius: 19,
    },
    attack: { kind: 'melee', arc: 110, damageType: 'physical' },
  },
  mage: {
    id: 'mage',
    weapon: 'Cajado',
    resource: { name: 'Mana', color: '#5aa8ff', max: 150, regen: 11 },
    name: 'Mago',
    role: 'Dano mágico e controle',
    description: 'Vestes e cajado luminoso. Dano em área e controle de grupos à distância.',
    attributes: {
      maxHp: 200, damage: 18, speed: 140, range: 340, attackInterval: 0.9, armor: 5,
      magicPower: 30, critChance: 0.05, critMult: 1.5, ccResist: 0, radius: 16,
    },
    attack: { kind: 'ranged', damageType: 'magic', projectileSpeed: 440, projectileRadius: 7, visual: 'arcane' },
  },
  archer: {
    id: 'archer',
    weapon: 'Besta',
    resource: { name: 'Foco', color: '#c6f06a', max: 100, regen: 10 },
    name: 'Arqueiro',
    role: 'Combate à distância',
    description: 'Besta, capuz e armadura leve. Elimina alvos vulneráveis de longe.',
    attributes: {
      maxHp: 210, damage: 17, speed: 150, range: 420, attackInterval: 0.65, armor: 10,
      magicPower: 0, critChance: 0.15, critMult: 1.8, ccResist: 0, radius: 16,
    },
    attack: { kind: 'ranged', damageType: 'physical', projectileSpeed: 640, projectileRadius: 5, visual: 'arrow' },
  },
  mercenary: {
    id: 'mercenary',
    weapon: 'Adagas',
    resource: { name: 'Energia', color: '#ffe066', max: 100, regen: 14 },
    name: 'Mercenário',
    role: 'Flanqueamento',
    description: 'Lâminas curtas e silhueta compacta. Muito móvel, persegue e finaliza alvos.',
    attributes: {
      maxHp: 235, damage: 15, speed: 180, range: 58, attackInterval: 0.5, armor: 15,
      magicPower: 0, critChance: 0.2, critMult: 1.8, ccResist: 0.1, radius: 16,
    },
    attack: { kind: 'melee', arc: 90, damageType: 'physical' },
  },
  halberdier: {
    id: 'halberdier',
    weapon: 'Alabarda',
    resource: { name: 'Vigor', color: '#ffb340', max: 100, regen: 9 },
    name: 'Alabardeiro',
    role: 'Controle de espaço',
    description: 'Arma longa e postura defensiva. Controla passagens com estocadas e varreduras.',
    attributes: {
      maxHp: 310, damage: 21, speed: 135, range: 104, attackInterval: 0.9, armor: 32,
      magicPower: 0, critChance: 0.05, critMult: 1.5, ccResist: 0.25, radius: 18,
    },
    attack: { kind: 'melee', arc: 60, damageType: 'physical' },
  },
  engineer: {
    id: 'engineer',
    weapon: 'Bacamarte',
    resource: { name: 'Materiais', color: '#d7a35a', max: 150, regen: 7, start: 90 },
    name: 'Engenheiro',
    role: 'Defesas e reparos',
    description: 'Bacamarte nas mãos e ferramentas no cinto. Atira de média distância, ergue torres que evoluem, barricadas e armadilhas, e conserta construções e muralhas.',
    attributes: {
      maxHp: 250, damage: 16, speed: 145, range: 360, attackInterval: 0.85, armor: 20,
      magicPower: 0, critChance: 0.08, critMult: 1.6, ccResist: 0.15, radius: 17, structureDamageMult: 1.6,
    },
    attack: { kind: 'ranged', damageType: 'physical', projectileSpeed: 900, projectileRadius: 5, visual: 'bullet' },
  },
};

// Bônus por nível da arma (vem do nível da construção que a fabricou).
export const TIER_BONUS = Object.freeze({ 1: { damage: 1, maxHp: 1 }, 2: { damage: 1.15, maxHp: 1.12 }, 3: { damage: 1.3, maxHp: 1.25 } });

for (const id of ALL_CLASSES) CLASSES[id].abilities = ABILITIES_BY_CLASS[id];

export function getClass(id) {
  const def = CLASSES[id];
  if (!def) throw new Error(`Classe desconhecida: ${id}`);
  return def;
}
