import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, addChar, step } from './helpers.js';
import { segmentIntersectsRect, moveCircle } from '../src/world/CollisionSystem.js';
import { NavGrid } from '../src/world/Pathfinding.js';
import { getMap } from '../src/data/maps.js';
import { circleIntersectsRect } from '../src/world/CollisionSystem.js';

test('a velocidade na diagonal não é maior que a velocidade reta', () => {
  const world = makeWorld({ width: 3000, height: 3000 });
  const a = addChar(world, 'warrior', 'blue', 500, 500);
  const b = addChar(world, 'warrior', 'blue', 1500, 1500);
  a.intent.move = { x: 1, y: 0 };
  b.intent.move = { x: 1, y: 1 };
  step(world, 1);
  const da = Math.hypot(a.pos.x - 500, a.pos.y - 500);
  const db = Math.hypot(b.pos.x - 1500, b.pos.y - 1500);
  assert.ok(Math.abs(da - db) < 0.5, `reta=${da} diagonal=${db}`);
  assert.ok(Math.abs(da - a.attrs.speed) < 1);
});

test('a distância percorrida independe do tamanho do passo de simulação', () => {
  const run = (dt) => {
    const world = makeWorld({ width: 3000, height: 600 });
    const c = addChar(world, 'warrior', 'blue', 100, 300);
    c.intent.move = { x: 1, y: 0 };
    step(world, 2, dt);
    return c.pos.x;
  };
  assert.ok(Math.abs(run(1 / 60) - run(1 / 144)) < 1);
});

test('obstáculos sólidos bloqueiam o movimento', () => {
  const wall = { x: 400, y: 0, w: 50, h: 600, kind: 'wall' };
  const world = makeWorld({ obstacles: [wall] });
  const c = addChar(world, 'mercenary', 'blue', 300, 300);
  c.intent.move = { x: 1, y: 0 };
  step(world, 3);
  assert.ok(c.pos.x <= wall.x - c.radius + 0.01, `x=${c.pos.x}`);
});

test('movimento rápido não atravessa paredes finas', () => {
  const map = { width: 1000, height: 600, obstacles: [{ x: 500, y: 0, w: 8, h: 600 }] };
  const pos = { x: 400, y: 300 };
  moveCircle(map, pos, 16, 400, 0);
  assert.ok(pos.x < 500);
});

test('os limites do cenário seguram os personagens', () => {
  const world = makeWorld();
  const c = addChar(world, 'warrior', 'blue', 50, 50);
  c.intent.move = { x: -1, y: -1 };
  step(world, 2);
  assert.ok(c.pos.x >= c.radius - 0.01 && c.pos.y >= c.radius - 0.01);
});

test('personagens não se sobrepõem', () => {
  const world = makeWorld();
  const a = addChar(world, 'warrior', 'blue', 300, 300);
  const b = addChar(world, 'warrior', 'red', 302, 300);
  step(world, 0.1);
  assert.ok(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) >= a.radius + b.radius - 0.5);
});

test('segmento x retângulo detecta interseções corretamente', () => {
  const r = { x: 10, y: 10, w: 10, h: 10 };
  assert.equal(segmentIntersectsRect(0, 15, 30, 15, r), true);
  assert.equal(segmentIntersectsRect(0, 0, 30, 0, r), false);
});

test('o pathfinding encontra caminho entre as bases sem atravessar obstáculos', () => {
  const map = getMap('vale');
  const nav = new NavGrid(map);
  const path = nav.findPath(map.bases.blue, map.bases.red);
  assert.ok(path && path.length > 1);
  let prev = map.bases.blue;
  for (const p of path) {
    for (const o of map.obstacles) {
      assert.equal(segmentIntersectsRect(prev.x, prev.y, p.x, p.y, o), false, 'trecho atravessa obstáculo');
    }
    prev = p;
  }
});

test('as bases e os pontos de surgimento do mapa principal estão livres', () => {
  const map = getMap('vale');
  for (const base of Object.values(map.bases)) {
    assert.equal(map.obstacles.some((o) => circleIntersectsRect(base.x, base.y, 20, o)), false);
  }
});
