// Definições de mapas como dados. Novos mapas podem ser adicionados aqui sem tocar na lógica de combate.
// O lado esquerdo (equipe azul) é espelhado automaticamente para o direito (equipe vermelha).
// Construções também viram obstáculos de colisão (o retângulo da construção bloqueia a passagem);
// pontos fracos das muralhas são construções que, derrubadas, deixam de bloquear.

// Muralha do castelo: um pátio fechado com o portão principal voltado para o centro.
const COMPOUND = { x: 160, y: 1080, w: 640, h: 640 };
const WALL = 36;

const LEFT_OBSTACLES = [
  // Muralhas fixas do castelo (os pontos fracos estão em LEFT_BUILDINGS).
  { x: 160, y: 1080, w: 280, h: WALL, kind: 'wall' },
  { x: 540, y: 1080, w: 260, h: WALL, kind: 'wall' },
  { x: 160, y: 1684, w: 280, h: WALL, kind: 'wall' },
  { x: 540, y: 1684, w: 260, h: WALL, kind: 'wall' },
  { x: 160, y: 1116, w: WALL, h: 568, kind: 'wall' },
  { x: 764, y: 1116, w: WALL, h: 184, kind: 'wall' },
  { x: 764, y: 1500, w: WALL, h: 184, kind: 'wall' },
  // Rochas
  { x: 1420, y: 1300, w: 110, h: 200, kind: 'rock' },
  { x: 1720, y: 820, w: 170, h: 120, kind: 'rock' },
  { x: 1720, y: 1860, w: 170, h: 120, kind: 'rock' },
  { x: 2000, y: 300, w: 140, h: 110, kind: 'rock' },
  { x: 2000, y: 2390, w: 140, h: 110, kind: 'rock' },
  // Árvores
  ...[
    [140, 300], [230, 420], [120, 560], [1000, 300], [1100, 380], [1620, 230], [1720, 330], [1560, 1060],
    [1560, 1700], [1960, 1180], [1960, 1560], [140, 2440], [230, 2320], [120, 2180], [1000, 2440], [1100, 2360],
    [1620, 2500], [1720, 2400], [2150, 700], [2150, 2050], [80, 760], [80, 2000],
  ].map(([x, y]) => ({ x, y, w: 60, h: 60, kind: 'tree' })),
  { x: 1300, y: 900, w: 60, h: 50, kind: 'crate' },
  { x: 1300, y: 1850, w: 60, h: 50, kind: 'crate' },
];

const CENTER_OBSTACLES = [
  { x: 2300, y: 1250, w: 200, h: 300, kind: 'rock' },
  { x: 2240, y: 900, w: 320, h: 50, kind: 'wall' },
  { x: 2240, y: 1850, w: 320, h: 50, kind: 'wall' },
  ...[[2370, 120], [2370, 2620], [2600, 1100], [2140, 1620]].map(([x, y]) => ({ x, y, w: 60, h: 60, kind: 'tree' })),
];

// Construções da equipe azul, todas perto do castelo. rackSide: lado do suporte de armas (+1 = direita).
const LEFT_BUILDINGS = [
  { kind: 'castle', x: 220, y: 1290, w: 200, h: 220 },
  // Pontos fracos da muralha: podem ser derrubados e o Engenheiro os conserta.
  { kind: 'wallGate', x: 440, y: 1080, w: 100, h: WALL },
  { kind: 'wallGate', x: 440, y: 1684, w: 100, h: WALL },
  // Torres principais na frente do castelo.
  { kind: 'tower', x: 1140, y: 1150, w: 80, h: 80 },
  { kind: 'tower', x: 1140, y: 1570, w: 80, h: 80 },
  // Uma construção por arma, em duas fileiras junto à muralha.
  { kind: 'mine', x: 180, y: 880, w: 110, h: 110 },
  { kind: 'tavern', x: 400, y: 880, w: 110, h: 110 },
  { kind: 'barracks', x: 620, y: 880, w: 110, h: 110 },
  { kind: 'lumbermill', x: 180, y: 1810, w: 110, h: 110 },
  { kind: 'blacksmith', x: 400, y: 1810, w: 110, h: 110 },
  { kind: 'archeryrange', x: 620, y: 1810, w: 110, h: 110 },
  { kind: 'magetower', x: 860, y: 1110, w: 100, h: 100 },
];

// Ruínas neutras no meio: um Engenheiro pode reconstruí-las para a sua equipe (mercados geram ouro).
const CENTER_BUILDINGS = [
  { kind: 'market', team: 'neutral', destroyed: true, x: 2330, y: 480, w: 140, h: 140 },
  { kind: 'market', team: 'neutral', destroyed: true, x: 2330, y: 2180, w: 140, h: 140 },
];

// Relevo (só visual): platôs com rampas. height em unidades 3D; ramp em pixels a partir da borda.
const LEFT_TERRAIN = [
  { ...COMPOUND, height: 1.0, ramp: 150 },
  { x: 190, y: 1230, w: 330, h: 330, height: 2.0, ramp: 50 }, // andar de cima, em volta do castelo
  { x: 1640, y: 1160, w: 420, h: 480, height: 1.3, ramp: 220 },
  { x: 1250, y: 420, w: 900, h: 200, height: -0.8, ramp: 170 },
  { x: 1250, y: 2180, w: 900, h: 200, height: -0.8, ramp: 170 },
];
const CENTER_TERRAIN = [{ x: 2150, y: 1100, w: 500, h: 600, height: 0.8, ramp: 260 }];

// Onde aparecem as coxinhas (alimentam a princesa) e as seringas Jonmaros (emagrecem a princesa).
const LEFT_COXINHAS = [[1450, 720], [1450, 2080]];
const CENTER_COXINHAS = [[2400, 760], [2400, 2040]];
const SYRINGES = [[2400, 260], [2400, 2540]];

function mirror(list, width) {
  return list.map((o) => ({ ...o, x: width - o.x - o.w }));
}

function mirrorPoints(list, width) {
  return list.map(([x, y]) => [width - x, y]);
}

function buildSymmetricMap(def) {
  const blue = def.leftBuildings.map((b) => ({ ...b, team: 'blue', rackSide: 1 }));
  const red = mirror(def.leftBuildings, def.width).map((b) => ({ ...b, team: 'red', rackSide: -1 }));
  const center = def.centerBuildings.map((b) => ({ ...b, rackSide: 1 }));
  const buildings = [...blue, ...red, ...center];
  const buildingRects = buildings.map((b, i) => ({ x: b.x, y: b.y, w: b.w, h: b.h, kind: 'building', buildingKey: i }));
  const compoundRed = mirror([def.compound], def.width)[0];
  return {
    ...def,
    buildings,
    obstacles: [...def.left, ...mirror(def.left, def.width), ...def.center, ...buildingRects],
    terrain: [...def.leftTerrain, ...mirror(def.leftTerrain, def.width), ...def.centerTerrain],
    castleAreas: { blue: def.compound, red: compoundRed },
    coxinhaSpots: [...def.leftCoxinhas, ...mirrorPoints(def.leftCoxinhas, def.width), ...def.centerCoxinhas].map(([x, y]) => ({ x, y })),
    syringeSpots: def.syringes.map(([x, y]) => ({ x, y })),
    // A princesa de cada equipe fica presa no castelo da equipe adversária.
    prisons: { blue: { x: def.width - def.prison.x, y: def.prison.y }, red: { ...def.prison } },
  };
}

export const MAPS = {
  vale: buildSymmetricMap({
    id: 'vale',
    name: 'Vale das Duas Muralhas',
    width: 4800,
    height: 2800,
    left: LEFT_OBSTACLES,
    center: CENTER_OBSTACLES,
    leftBuildings: LEFT_BUILDINGS,
    centerBuildings: CENTER_BUILDINGS,
    leftTerrain: LEFT_TERRAIN,
    centerTerrain: CENTER_TERRAIN,
    leftCoxinhas: LEFT_COXINHAS,
    centerCoxinhas: CENTER_COXINHAS,
    syringes: SYRINGES,
    compound: COMPOUND,
    prison: { x: 330, y: 1610 },
    bases: {
      blue: { x: 640, y: 1400, radius: 110, name: 'Base Azul' },
      red: { x: 4160, y: 1400, radius: 110, name: 'Base Vermelha' },
    },
  }),
};

export function getMap(id) {
  const map = MAPS[id];
  if (!map) throw new Error(`Mapa desconhecido: ${id}`);
  return map;
}
