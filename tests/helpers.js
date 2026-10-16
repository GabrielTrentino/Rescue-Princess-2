// Utilitários para montar mundos pequenos e determinísticos nos testes.
import { EventBus } from '../src/core/EventBus.js';
import { createRng } from '../src/core/math.js';
import { MATCH_DEFAULTS } from '../src/config.js';
import { World } from '../src/world/World.js';
import { Character } from '../src/entities/Character.js';
import { getClass } from '../src/classes/classDefinitions.js';

let mapCounter = 0;

export function makeMap({ obstacles = [], width = 1000, height = 600 } = {}) {
  return {
    id: `teste-${mapCounter++}`,
    name: 'Mapa de teste',
    width,
    height,
    obstacles,
    bases: {
      blue: { x: 80, y: height / 2, radius: 60, name: 'Base Azul' },
      red: { x: width - 80, y: height / 2, radius: 60, name: 'Base Vermelha' },
    },
  };
}

export function makeWorld(opts = {}) {
  const events = new EventBus();
  const world = new World({
    map: opts.map ?? makeMap(opts),
    config: { ...MATCH_DEFAULTS, ...(opts.config ?? {}) },
    rng: createRng(opts.seed ?? 42),
    events,
  });
  return world;
}

export function addChar(world, classId, team, x, y, extra = {}) {
  const c = new Character({ id: world.nextId++, classDef: getClass(classId), team, x, y, name: `${classId}-${team}`, ...extra });
  world.addCharacter(c);
  return c;
}

// Faz um personagem mirar em um ponto (sem controlador).
export function aimAt(c, x, y) {
  c.facing = Math.atan2(y - c.pos.y, x - c.pos.x);
  c.intent.aim = { x, y };
}

export function step(world, seconds, dt = 1 / 60) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) world.update(dt);
}

// Sem crítico: torna os testes de dano previsíveis.
export function noCrit(...chars) {
  for (const c of chars) c.attrs.critChance = 0;
}
