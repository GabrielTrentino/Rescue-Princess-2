// Parâmetros configuráveis da partida. Nada de valores mágicos espalhados pelo código:
// tudo que afeta regras de partida mora aqui e pode ser sobrescrito pelas configurações.
export const FIXED_DT = 1 / 60;

export const MATCH_DEFAULTS = Object.freeze({
  mapId: 'vale',
  alliesCount: 7,          // bots aliados além do jogador
  enemiesCount: 8,         // bots inimigos
  matchDuration: 600,      // segundos
  goldPerSecond: 2,        // ouro que cada equipe ganha por segundo (abates e construções dão mais)
  respawnTime: 6,          // segundos
  captureTime: 12,         // segundos de presença sem oposição para conquistar uma base
  baseHealPerSecond: 0.05, // fração da vida máxima recuperada por segundo dentro da própria base
  aiDecisionInterval: 0.25,
  difficulty: 'normal',    // 'facil' | 'normal' | 'dificil'
  showDamageNumbers: true,
  sound: true,
});

// Modificadores aplicados aos bots inimigos conforme a dificuldade.
export const DIFFICULTY = Object.freeze({
  facil: { enemyDamage: 0.75, reaction: 0.45, abilityChance: 0.35 },
  normal: { enemyDamage: 1, reaction: 0.25, abilityChance: 0.6 },
  dificil: { enemyDamage: 1.15, reaction: 0.15, abilityChance: 0.85 },
});

export const TEAMS = Object.freeze({ BLUE: 'blue', RED: 'red' });

export function otherTeam(team) {
  return team === TEAMS.BLUE ? TEAMS.RED : TEAMS.BLUE;
}
