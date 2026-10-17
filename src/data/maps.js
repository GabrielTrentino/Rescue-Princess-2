// Definições de mapas como dados. Novos mapas podem ser adicionados aqui sem tocar na lógica de combate.
// O lado esquerdo (equipe azul) é espelhado automaticamente para o direito (equipe vermelha).
// Construções também viram obstáculos de colisão (o retângulo da construção bloqueia a passagem).

const LEFT_OBSTACLES = [
  // Muralhas da base azul, com portões voltados para o centro.
  { x: 380, y: 1150, w: 440, h: 36, kind: 'wall' },
  { x: 380, y: 1614, w: 440, h: 36, kind: 'wall' },
  { x: 784, y: 1150, w: 36, h: 170, kind: 'wall' },
  { x: 784, y: 1480, w: 36, h: 170, kind: 'wall' },
  // Rochas
  { x: 1180, y: 1280, w: 110, h: 240, kind: 'rock' },
  { x: 1720, y: 860, w: 170, h: 120, kind: 'rock' },
  { x: 1720, y: 1820, w: 170, h: 120, kind: 'rock' },
  { x: 2000, y: 300, w: 140, h: 110, kind: 'rock' },
  { x: 2000, y: 2390, w: 140, h: 110, kind: 'rock' },
  // Árvores
  ...[
    [140, 300], [230, 420], [120, 560], [1000, 300], [1100, 380], [1620, 230], [1720, 330], [1500, 1080],
    [1500, 1660], [1900, 1200], [1900, 1540], [140, 2440], [230, 2320], [120, 2180], [1000, 2440], [1100, 2360],
    [1620, 2500], [1720, 2400], [600, 1000], [600, 1760], [2150, 700], [2150, 2050],
  ].map(([x, y]) => ({ x, y, w: 60, h: 60, kind: 'tree' })),
  { x: 1100, y: 1200, w: 60, h: 50, kind: 'crate' },
  { x: 1100, y: 1550, w: 60, h: 50, kind: 'crate' },
];

const CENTER_OBSTACLES = [
  { x: 2300, y: 1250, w: 200, h: 300, kind: 'rock' },
  { x: 2240, y: 900, w: 320, h: 50, kind: 'wall' },
  { x: 2240, y: 1850, w: 320, h: 50, kind: 'wall' },
  ...[[2370, 120], [2370, 2620], [2600, 1100], [2140, 1620]].map(([x, y]) => ({ x, y, w: 60, h: 60, kind: 'tree' })),
];

// Construções da equipe azul. rackSide: lado do suporte de armas (+1 = voltado para a direita).
const LEFT_BUILDINGS = [
  { kind: 'castle', x: 200, y: 1290, w: 210, h: 220 },
  { kind: 'barracks', x: 880, y: 1000, w: 150, h: 150 },
  { kind: 'lumbermill', x: 880, y: 1650, w: 150, h: 150 },
  { kind: 'magetower', x: 1240, y: 700, w: 130, h: 130 },
  { kind: 'archeryrange', x: 1240, y: 1970, w: 150, h: 140 },
  { kind: 'tavern', x: 560, y: 520, w: 150, h: 150 },
  { kind: 'blacksmith', x: 560, y: 2130, w: 150, h: 150 },
  { kind: 'mine', x: 300, y: 820, w: 140, h: 130 },
];

// Ruínas neutras no meio: um Engenheiro pode reconstruí-las para a sua equipe (mercados geram ouro).
const CENTER_BUILDINGS = [
  { kind: 'market', team: 'neutral', destroyed: true, x: 2330, y: 480, w: 140, h: 140 },
  { kind: 'market', team: 'neutral', destroyed: true, x: 2330, y: 2180, w: 140, h: 140 },
];

function mirror(obstacles, width) {
  return obstacles.map((o) => ({ ...o, x: width - o.x - o.w }));
}

function buildSymmetricMap(def) {
  const blue = def.leftBuildings.map((b) => ({ ...b, team: 'blue', rackSide: 1 }));
  const red = mirror(def.leftBuildings, def.width).map((b) => ({ ...b, team: 'red', rackSide: -1 }));
  const center = def.centerBuildings.map((b) => ({ ...b, rackSide: 1 }));
  const buildings = [...blue, ...red, ...center];
  const buildingRects = buildings.map((b, i) => ({ x: b.x, y: b.y, w: b.w, h: b.h, kind: 'building', buildingKey: i }));
  return {
    ...def,
    buildings,
    obstacles: [...def.left, ...mirror(def.left, def.width), ...def.center, ...buildingRects],
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
    bases: {
      blue: { x: 580, y: 1400, radius: 170, name: 'Base Azul' },
      red: { x: 4220, y: 1400, radius: 170, name: 'Base Vermelha' },
    },
  }),
};

export function getMap(id) {
  const map = MAPS[id];
  if (!map) throw new Error(`Mapa desconhecido: ${id}`);
  return map;
}
