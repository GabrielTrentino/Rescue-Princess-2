// A* em grade com obstáculos inflados pelo raio do agente, com suavização por linha de visão.
import { hasLineOfSight, circleIntersectsRect } from './CollisionSystem.js';

class MinHeap {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  push(node, priority) {
    const items = this.items;
    items.push({ node, priority });
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (items[p].priority <= items[i].priority) break;
      [items[p], items[i]] = [items[i], items[p]];
      i = p;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l].priority < items[m].priority) m = l;
        if (r < items.length && items[r].priority < items[m].priority) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top.node;
  }
}

export class NavGrid {
  constructor(map, { cellSize = 40, agentRadius = 20 } = {}) {
    this.map = map;
    this.cellSize = cellSize;
    this.agentRadius = agentRadius;
    this.cols = Math.ceil(map.width / cellSize);
    this.rows = Math.ceil(map.height / cellSize);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const { x, y } = this.cellCenter(col, row);
        const out = x < agentRadius || y < agentRadius || x > map.width - agentRadius || y > map.height - agentRadius;
        const hit = map.obstacles.some((rect) => circleIntersectsRect(x, y, agentRadius + 2, rect));
        this.blocked[row * this.cols + col] = out || hit ? 1 : 0;
      }
    }
  }

  cellCenter(col, row) {
    return { x: (col + 0.5) * this.cellSize, y: (row + 0.5) * this.cellSize };
  }

  cellOf(p) {
    return {
      col: Math.min(this.cols - 1, Math.max(0, Math.floor(p.x / this.cellSize))),
      row: Math.min(this.rows - 1, Math.max(0, Math.floor(p.y / this.cellSize))),
    };
  }

  isBlocked(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return true;
    return this.blocked[row * this.cols + col] === 1;
  }

  nearestFree(col, row) {
    if (!this.isBlocked(col, row)) return { col, row };
    for (let radius = 1; radius < 8; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          if (!this.isBlocked(col + dx, row + dy)) return { col: col + dx, row: row + dy };
        }
      }
    }
    return null;
  }

  // Retorna uma lista de pontos (sem incluir a origem) até o destino, ou null.
  findPath(from, to) {
    const pad = this.agentRadius * 0.9;
    if (hasLineOfSight(this.map, from, to, pad)) return [{ x: to.x, y: to.y }];

    const startCell = this.cellOf(from);
    const endCell0 = this.cellOf(to);
    const start = this.nearestFree(startCell.col, startCell.row);
    const end = this.nearestFree(endCell0.col, endCell0.row);
    if (!start || !end) return null;

    const cols = this.cols;
    const startIdx = start.row * cols + start.col;
    const endIdx = end.row * cols + end.col;
    const g = new Float32Array(this.cols * this.rows).fill(Infinity);
    const came = new Int32Array(this.cols * this.rows).fill(-1);
    const closed = new Uint8Array(this.cols * this.rows);
    const heap = new MinHeap();
    const h = (idx) => {
      const c = idx % cols;
      const r = (idx / cols) | 0;
      const dx = Math.abs(c - end.col);
      const dy = Math.abs(r - end.row);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    g[startIdx] = 0;
    heap.push(startIdx, h(startIdx));
    let found = false;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (cur === endIdx) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cc = cur % cols;
      const cr = (cur / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nc = cc + dx;
          const nr = cr + dy;
          if (this.isBlocked(nc, nr)) continue;
          // Não corta quinas.
          if (dx && dy && (this.isBlocked(cc + dx, cr) || this.isBlocked(cc, cr + dy))) continue;
          const ni = nr * cols + nc;
          if (closed[ni]) continue;
          const cost = g[cur] + (dx && dy ? Math.SQRT2 : 1);
          if (cost < g[ni]) {
            g[ni] = cost;
            came[ni] = cur;
            heap.push(ni, cost + h(ni));
          }
        }
      }
    }
    if (!found) return null;

    const cells = [];
    for (let idx = endIdx; idx !== -1 && idx !== startIdx; idx = came[idx]) cells.push(idx);
    cells.reverse();
    const points = cells.map((idx) => this.cellCenter(idx % cols, (idx / cols) | 0));
    points.push({ x: to.x, y: to.y });

    // Suavização: pula pontos intermediários quando há linha de visão.
    const smooth = [];
    let anchor = from;
    let i = 0;
    while (i < points.length) {
      let j = points.length - 1;
      while (j > i && !hasLineOfSight(this.map, anchor, points[j], pad)) j--;
      smooth.push(points[j]);
      anchor = points[j];
      i = j + 1;
    }
    return smooth;
  }
}
