// Definições de mapas como dados. Novos mapas podem ser adicionados aqui sem tocar na lógica de combate.
// Os obstáculos do lado esquerdo são espelhados automaticamente para o lado direito (mapa simétrico).
const LEFT_OBSTACLES = [
  // Muralhas da base azul, com uma entrada voltada para o centro.
  { x: 400, y: 450, w: 44, h: 190, kind: 'wall' },
  { x: 400, y: 760, w: 44, h: 190, kind: 'wall' },
  { x: 150, y: 410, w: 294, h: 40, kind: 'wall' },
  { x: 150, y: 950, w: 294, h: 40, kind: 'wall' },
  // Rochas e árvores no meio-campo esquerdo.
  { x: 700, y: 250, w: 170, h: 120, kind: 'rock' },
  { x: 700, y: 1030, w: 170, h: 120, kind: 'rock' },
  { x: 650, y: 615, w: 80, h: 170, kind: 'rock' },
  { x: 920, y: 110, w: 70, h: 70, kind: 'tree' },
  { x: 940, y: 1220, w: 70, h: 70, kind: 'tree' },
  { x: 520, y: 220, w: 60, h: 60, kind: 'tree' },
  { x: 540, y: 1130, w: 60, h: 60, kind: 'tree' },
  { x: 260, y: 220, w: 70, h: 60, kind: 'crate' },
  { x: 260, y: 1120, w: 70, h: 60, kind: 'crate' },
];

const CENTER_OBSTACLES = [
  // Bloco central e muros que formam passagens estreitas.
  { x: 1100, y: 560, w: 200, h: 280, kind: 'rock' },
  { x: 1040, y: 300, w: 320, h: 56, kind: 'wall' },
  { x: 1040, y: 1044, w: 320, h: 56, kind: 'wall' },
  { x: 1160, y: 60, w: 80, h: 80, kind: 'tree' },
  { x: 1160, y: 1260, w: 80, h: 80, kind: 'tree' },
];

function mirror(obstacles, width) {
  return obstacles.map((o) => ({ ...o, x: width - o.x - o.w }));
}

function buildSymmetricMap(def) {
  return {
    ...def,
    obstacles: [...def.left, ...mirror(def.left, def.width), ...def.center],
  };
}

export const MAPS = {
  vale: buildSymmetricMap({
    id: 'vale',
    name: 'Vale das Duas Muralhas',
    width: 2400,
    height: 1400,
    left: LEFT_OBSTACLES,
    center: CENTER_OBSTACLES,
    bases: {
      blue: { x: 250, y: 700, radius: 120, name: 'Base Azul' },
      red: { x: 2150, y: 700, radius: 120, name: 'Base Vermelha' },
    },
  }),
};

export function getMap(id) {
  const map = MAPS[id];
  if (!map) throw new Error(`Mapa desconhecido: ${id}`);
  return map;
}
