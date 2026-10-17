// Colisões em plano 2D: personagens são círculos, obstáculos são retângulos alinhados aos eixos.
// Tudo aqui é independente da renderização (as dimensões visuais dos sprites não interferem).
import { clamp } from '../core/math.js';

export function circleIntersectsRect(x, y, r, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

// Empurra o círculo para fora de um retângulo. Retorna true se houve correção.
export function pushCircleOutOfRect(pos, r, rect) {
  const cx = clamp(pos.x, rect.x, rect.x + rect.w);
  const cy = clamp(pos.y, rect.y, rect.y + rect.h);
  let dx = pos.x - cx;
  let dy = pos.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * r;
    pos.y = cy + (dy / d) * r;
    return true;
  }
  // Centro dentro do retângulo: sai pelo lado de menor penetração.
  const left = pos.x - rect.x;
  const right = rect.x + rect.w - pos.x;
  const top = pos.y - rect.y;
  const bottom = rect.y + rect.h - pos.y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) pos.x = rect.x - r;
  else if (min === right) pos.x = rect.x + rect.w + r;
  else if (min === top) pos.y = rect.y - r;
  else pos.y = rect.y + rect.h + r;
  return true;
}

export function clampToBounds(pos, r, map) {
  pos.x = clamp(pos.x, r, map.width - r);
  pos.y = clamp(pos.y, r, map.height - r);
}

export function resolveStatic(pos, r, map) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const rect of map.obstacles) {
      if (pushCircleOutOfRect(pos, r, rect)) moved = true;
    }
    clampToBounds(pos, r, map);
    if (!moved) break;
  }
}

// Move um círculo em subpassos para não atravessar obstáculos finos em velocidades altas.
// Retorna a distância efetivamente percorrida.
export function moveCircle(map, pos, r, dx, dy) {
  const total = Math.hypot(dx, dy);
  if (total < 1e-9) return 0;
  const steps = Math.max(1, Math.ceil(total / (r * 0.5)));
  const sx = dx / steps;
  const sy = dy / steps;
  const startX = pos.x;
  const startY = pos.y;
  for (let i = 0; i < steps; i++) {
    pos.x += sx;
    pos.y += sy;
    resolveStatic(pos, r, map);
  }
  return Math.hypot(pos.x - startX, pos.y - startY);
}

// Interseção segmento x retângulo (Liang–Barsky).
export function segmentIntersectsRect(x1, y1, x2, y2, rect, pad = 0) {
  const minX = rect.x - pad;
  const maxX = rect.x + rect.w + pad;
  const minY = rect.y - pad;
  const maxY = rect.y + rect.h + pad;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

export function hasLineOfSight(map, a, b, pad = 0) {
  for (const rect of map.obstacles) {
    if (segmentIntersectsRect(a.x, a.y, b.x, b.y, rect, pad)) return false;
  }
  return true;
}

export function pointBlocked(map, x, y, r = 0) {
  if (x < r || y < r || x > map.width - r || y > map.height - r) return true;
  return map.obstacles.some((rect) => circleIntersectsRect(x, y, r, rect));
}
