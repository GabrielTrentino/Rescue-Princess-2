// Relevo do mapa: platôs e vales com rampas suaves. A simulação continua plana (em pixels);
// a altura só muda onde as coisas aparecem na cena 3D.

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Distância (em pixels) de um ponto até um retângulo (0 dentro dele).
function rectDistance(r, x, y) {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** Altura do terreno (unidades 3D) no ponto (x, y) do jogo. */
export function heightAt(map, x, y) {
  let h = 0;
  let low = 0;
  for (const t of map.terrain ?? []) {
    const d = rectDistance(t, x, y);
    if (d >= t.ramp) continue;
    const v = t.height * smooth(1 - d / t.ramp);
    if (v > h) h = v;
    if (v < low) low = v;
  }
  return h > 0 ? h : low;
}

/** Retângulo do castelo (pátio murado) da equipe, ou null. */
export function insideCastle(map, team, x, y) {
  const r = map.castleAreas?.[team];
  return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
