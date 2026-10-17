// Atributos-base das seis classes. Valores iniciais de balanceamento, ajustáveis por dados.
// attackInterval = segundos entre ataques básicos; range = alcance do ataque básico (px).
import { ABILITIES_BY_CLASS } from './abilityDefinitions.js';

export const CLASS_ORDER = ['warrior', 'barbarian', 'mage', 'archer', 'mercenary', 'halberdier'];

export const CLASSES = {
  warrior: {
    id: 'warrior',
    name: 'Guerreiro',
    role: 'Linha de frente',
    description: 'Armadura robusta, espada e escudo. Segura posições e protege os aliados.',
    attributes: {
      maxHp: 340, damage: 18, speed: 150, range: 48, attackInterval: 0.75, armor: 45,
      magicPower: 0, critChance: 0.05, critMult: 1.5, ccResist: 0.3, radius: 18,
    },
    attack: { kind: 'melee', arc: 100, damageType: 'physical' },
  },
  barbarian: {
    id: 'barbarian',
    name: 'Bárbaro',
    role: 'Dano corpo a corpo',
    description: 'Corpo volumoso e machado enorme. Causa muito dano, mas sofre quando fica isolado.',
    attributes: {
      maxHp: 300, damage: 26, speed: 155, range: 46, attackInterval: 0.8, armor: 20,
      magicPower: 0, critChance: 0.12, critMult: 1.7, ccResist: 0.15, radius: 19,
    },
    attack: { kind: 'melee', arc: 110, damageType: 'physical' },
  },
  mage: {
    id: 'mage',
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
    name: 'Arqueiro',
    role: 'Combate à distância',
    description: 'Arco, aljava e armadura leve. Elimina alvos vulneráveis de longe.',
    attributes: {
      maxHp: 210, damage: 17, speed: 150, range: 420, attackInterval: 0.65, armor: 10,
      magicPower: 0, critChance: 0.15, critMult: 1.8, ccResist: 0, radius: 16,
    },
    attack: { kind: 'ranged', damageType: 'physical', projectileSpeed: 640, projectileRadius: 5, visual: 'arrow' },
  },
  mercenary: {
    id: 'mercenary',
    name: 'Mercenário',
    role: 'Flanqueamento',
    description: 'Lâminas curtas e silhueta compacta. Muito móvel, persegue e finaliza alvos.',
    attributes: {
      maxHp: 235, damage: 15, speed: 180, range: 42, attackInterval: 0.5, armor: 15,
      magicPower: 0, critChance: 0.2, critMult: 1.8, ccResist: 0.1, radius: 16,
    },
    attack: { kind: 'melee', arc: 90, damageType: 'physical' },
  },
  halberdier: {
    id: 'halberdier',
    name: 'Alabardeiro',
    role: 'Controle de espaço',
    description: 'Arma longa e postura defensiva. Controla passagens com estocadas e varreduras.',
    attributes: {
      maxHp: 310, damage: 21, speed: 135, range: 78, attackInterval: 0.9, armor: 32,
      magicPower: 0, critChance: 0.05, critMult: 1.5, ccResist: 0.25, radius: 18,
    },
    attack: { kind: 'melee', arc: 60, damageType: 'physical' },
  },
};

for (const id of CLASS_ORDER) CLASSES[id].abilities = ABILITIES_BY_CLASS[id];

export function getClass(id) {
  const def = CLASSES[id];
  if (!def) throw new Error(`Classe desconhecida: ${id}`);
  return def;
}
