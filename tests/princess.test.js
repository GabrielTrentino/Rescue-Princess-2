import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchManager } from '../src/systems/MatchManager.js';
import { CARRY_RANGE, COXINHAS_PER_LEVEL, RETURN_TIME, RESCUE_SPEED } from '../src/world/Princess.js';
import { Building, destroyBuilding, repairNear, DEFENSE_TYPES } from '../src/world/Structures.js';
import { pointBlocked } from '../src/world/CollisionSystem.js';
import { heightAt, insideCastle } from '../src/world/Terrain.js';
import { tryUseAbility } from '../src/combat/AbilitySystem.js';
import { getClass } from '../src/classes/classDefinitions.js';
import { BotController } from '../src/ai/BotController.js';
import { makeWorld, makeMap, addChar, step } from './helpers.js';

// Partida no mapa real com todos parados (sem IA), cada um na própria base.
function quietMatch(seed = 1) {
  const m = new MatchManager({ playerClassId: 'warrior', seed }).start();
  for (const c of m.world.characters) {
    c.controller = null;
    const base = m.world.map.bases[c.team];
    c.pos.x = base.x;
    c.pos.y = base.y;
  }
  return m;
}

function place(c, p, dx = 0, dy = 0) {
  c.pos.x = p.x + dx;
  c.pos.y = p.y + dy;
}

test('a princesa de cada equipe fica presa no castelo adversário', () => {
  const m = quietMatch();
  const map = m.world.map;
  const { blue, red } = m.objective.princesses;
  assert.ok(insideCastle(map, 'red', blue.prison.x, blue.prison.y), 'princesa azul presa no castelo vermelho');
  assert.ok(insideCastle(map, 'blue', red.prison.x, red.prison.y), 'princesa vermelha presa no castelo azul');
  assert.equal(blue.state, 'captive');
});

test('carregar a princesa: quem a leva fica lento e, ao morrer, ela cai e volta para a prisão', () => {
  const m = quietMatch(2);
  const world = m.world;
  const [carrier] = world.characters.filter((c) => c.team === 'blue');
  const p = m.objective.princesses.blue;
  place(carrier, p.pos, CARRY_RANGE + 30);
  assert.equal(m.objective.interact(carrier), false, 'longe demais');
  place(carrier, p.pos, 20);
  assert.equal(m.objective.interact(carrier), true);
  assert.equal(p.state, 'carried');
  assert.equal(m.objective.speedMultiplier(carrier), RESCUE_SPEED[0]);
  carrier.pos.x -= 300;
  m.update(1 / 60);
  assert.ok(Math.abs(p.pos.x - carrier.pos.x) < 1, 'a princesa acompanha quem a carrega');
  world.killCharacter(carrier, null);
  carrier.respawnTimer = 999;
  m.update(1 / 60);
  assert.equal(p.state, 'dropped');
  // Um inimigo encosta nela: volta para a prisão.
  const guard = world.characters.find((c) => c.team === 'red');
  place(guard, p.pos, 10);
  m.update(1 / 60);
  assert.equal(p.state, 'captive');
  assert.deepEqual(p.pos, p.prison);
});

test('princesa largada volta sozinha para a prisão depois de um tempo', () => {
  const m = quietMatch(3);
  const [carrier] = m.world.characters.filter((c) => c.team === 'blue');
  const p = m.objective.princesses.blue;
  place(carrier, p.pos, 10);
  m.objective.interact(carrier);
  carrier.pos.x -= 900;
  m.update(1 / 60);
  m.objective.interact(carrier); // F de novo: larga
  assert.equal(p.state, 'dropped');
  carrier.pos.x -= 400;
  for (let t = 0; t < RETURN_TIME + 1; t += 1 / 60) m.update(1 / 60);
  assert.equal(p.state, 'captive');
});

test('coxinhas engordam a princesa presa; mais pesada, mais lenta de carregar', () => {
  const m = quietMatch(4);
  const world = m.world;
  const feeder = world.characters.find((c) => c.team === 'blue');
  const captive = m.objective.princesses.red; // presa no castelo azul
  for (let i = 0; i < COXINHAS_PER_LEVEL; i++) {
    feeder.heldItem = 'coxinha';
    place(feeder, captive.pos, 30);
    m.update(1 / 60);
    assert.equal(feeder.heldItem, null, 'entregou a coxinha');
  }
  assert.equal(captive.level, 1);
  assert.equal(captive.satiety, 0);
  feeder.heldItem = 'coxinha';
  m.update(1 / 60);
  assert.ok(Math.abs(captive.satiety - 1 / COXINHAS_PER_LEVEL) < 1e-9, 'a barra de saciedade enche');
  assert.ok(RESCUE_SPEED[1] < RESCUE_SPEED[0]);
  assert.equal(feeder.stats.coxinhas, COXINHAS_PER_LEVEL + 1);
});

test('seringa Jonmaros emagrece a própria princesa em um nível', () => {
  const m = quietMatch(5);
  const red = m.world.characters.find((c) => c.team === 'red');
  const own = m.objective.princesses.red;
  own.level = 2;
  own.satiety = 0.66;
  red.heldItem = 'syringe';
  place(red, own.pos, 30);
  m.update(1 / 60);
  assert.equal(own.level, 1);
  assert.equal(own.satiety, 0);
  assert.equal(red.heldItem, null);
});

test('coxinhas e seringas aparecem no mapa e são apanhadas ao passar por cima', () => {
  const m = quietMatch(6);
  for (let t = 0; t < 12; t += 1 / 60) m.update(1 / 60);
  const items = m.objective.items;
  assert.ok(items.some((i) => i.kind === 'coxinha'));
  assert.ok(items.some((i) => i.kind === 'syringe'));
  const c = m.world.characters.find((x) => x.team === 'blue');
  const item = items.find((i) => i.kind === 'coxinha');
  place(c, item.pos);
  m.update(1 / 60);
  assert.equal(c.heldItem, 'coxinha');
  assert.ok(!m.objective.items.includes(item));
  // Quem morre deixa o item cair.
  m.world.killCharacter(c, null);
  assert.equal(c.heldItem, null);
  assert.ok(m.objective.items.some((i) => i.kind === 'coxinha' && Math.abs(i.pos.x - c.pos.x) < 1));
});

test('aldeões ficam 80% mais rápidos dentro do próprio castelo (só do próprio time)', () => {
  const m = quietMatch(7);
  const world = m.world;
  const area = world.map.castleAreas.blue;
  const spot = { x: area.x + 120, y: area.y + 330 };
  const run = (team) => {
    const c = world.characters.find((x) => x.team === team && x.classId === 'villager' && !x.isPlayer);
    place(c, spot);
    c.intent.move = { x: 0, y: 1 };
    const y0 = c.pos.y;
    for (let i = 0; i < 12; i++) world.update(1 / 60);
    c.intent.move = { x: 0, y: 0 };
    const d = c.pos.y - y0;
    place(c, world.map.bases[team]);
    return d;
  };
  const own = run('blue');
  const enemy = run('red');
  assert.ok(Math.abs(own / enemy - 1.8) < 0.1, `azul ${own.toFixed(1)} × vermelho ${enemy.toFixed(1)}`);
});

test('relevo: o castelo é mais alto que o campo e o andar do castelo é o mais alto', () => {
  const map = quietMatch(8).world.map;
  const area = map.castleAreas.blue;
  const court = heightAt(map, area.x + 560, area.y + 100);
  const keep = heightAt(map, 320, 1400);
  const field = heightAt(map, 1300, 1400);
  assert.ok(court > field);
  assert.ok(keep > court);
  assert.ok(heightAt(map, 1700, 520) < 0, 'há vales nos caminhos laterais');
});

test('muralha derrubada abre passagem e só o Engenheiro da própria equipe a conserta', () => {
  const m = quietMatch(9);
  const world = m.world;
  const gate = world.buildings.find((b) => b.kind === 'wallGate' && b.team === 'red');
  const cx = gate.pos.x;
  const cy = gate.pos.y;
  assert.ok(pointBlocked(world.map, cx, cy, 10), 'a muralha bloqueia');
  const col = Math.floor(cx / world.nav.cellSize);
  const row = Math.floor(cy / world.nav.cellSize);
  assert.ok(world.nav.isBlocked(col, row));
  destroyBuilding(world, gate, null);
  assert.ok(!pointBlocked(world.map, cx, cy, 10), 'derrubada, deixa passar');
  assert.ok(!world.nav.isBlocked(col, row), 'a navegação dos bots enxerga a passagem');
  // Engenheiro inimigo não reconstrói a muralha dos outros.
  const blueEng = addCharTo(world, 'engineer', 'blue', cx, cy + 50);
  assert.equal(repairNear(world, blueEng, 80, 50).rebuilt, undefined);
  assert.ok(gate.destroyed);
  const redEng = addCharTo(world, 'engineer', 'red', cx, cy + 50);
  assert.equal(repairNear(world, redEng, 80, 50).rebuilt, true);
  assert.ok(!gate.destroyed);
  assert.equal(gate.team, 'red');
  assert.ok(pointBlocked(world.map, cx, cy, 10), 'consertada, volta a bloquear');
  // A muralha de um mundo não vaza para o mapa compartilhado da próxima partida.
  const fresh = new MatchManager({ seed: 9 }).start();
  destroyBuilding(world, gate, null);
  const freshGate = fresh.world.buildings.find((b) => b.kind === 'wallGate' && b.team === 'red');
  assert.ok(pointBlocked(fresh.world.map, freshGate.pos.x, freshGate.pos.y, 10));
});

function addCharTo(world, classId, team, x, y) {
  return addChar(world, classId, team, x, y);
}

test('torres principais: muita vida e muito dano, menos contra Guerreiro e Bárbaro', () => {
  const rect = { x: 460, y: 260, w: 80, h: 80 };
  const map = makeMap({ obstacles: [{ ...rect, kind: 'building', buildingKey: 0 }] });
  const world = makeWorld({ map });
  const tower = new Building({ kind: 'tower', team: 'red', rect, rackSide: 1 });
  world.buildings.push(tower);
  assert.ok(tower.maxHp >= 3000);
  const hits = new Map();
  world.events.on('damage', (e) => hits.set(e.targetId, (hits.get(e.targetId) ?? []).concat(e.amount)));
  const perHit = (classId) => {
    const c = addChar(world, classId, 'blue', tower.pos.x - 250, tower.pos.y);
    c.attrs.dodgeChance = 0;
    step(world, 2.5);
    world.characters.splice(world.characters.indexOf(c), 1);
    const list = hits.get(c.id) ?? [];
    assert.ok(list.length > 0, `torre acertou ${classId}`);
    return list[0] / (1 - Math.min(0.8, (c.getStat('armor') ?? 0) / 100)) ;
  };
  const halberdier = perHit('halberdier');
  const warrior = perHit('warrior');
  const barbarian = perHit('barbarian');
  assert.ok(warrior < halberdier * 0.5, `guerreiro ${warrior} × alabardeiro ${halberdier}`);
  assert.ok(barbarian < halberdier * 0.5);
});

test('torre do Engenheiro evolui ao encher a segunda barra (reparo e habilidade Torre)', () => {
  const world = makeWorld({ width: 1400, height: 800 });
  const eng = addChar(world, 'engineer', 'blue', 300, 400);
  eng.resource = eng.resourceMax;
  assert.equal(tryUseAbility(world, eng, 1, { x: 400, y: 400 }).ok, true);
  const tower = world.defenses[0];
  assert.equal(tower.kind, 'arrowTower');
  // Mirar a própria torre com a habilidade Torre enche a barra de evolução.
  eng.actionTimer = 0;
  eng.resource = eng.resourceMax;
  eng.cooldowns.update(99);
  assert.equal(tryUseAbility(world, eng, 1, { x: tower.pos.x, y: tower.pos.y }).ok, true);
  assert.equal(world.defenses.length, 1, 'não ergueu outra torre');
  assert.ok(tower.evolve > 0);
  // Reparos com a vida cheia terminam de encher: vira Torre de Canhão, depois Torre Real.
  let guard = 0;
  while (tower.kind === 'arrowTower' && guard++ < 100) repairNear(world, eng, 120, 60);
  assert.equal(tower.kind, 'catapult');
  assert.equal(tower.evolve, 0);
  while (tower.kind === 'catapult' && guard++ < 200) repairNear(world, eng, 120, 60);
  assert.equal(tower.kind, 'royalTower');
  assert.equal(tower.hp, DEFENSE_TYPES.royalTower.hp);
});

test('Engenheiro atira com o bacamarte; Tiro Duplo dispara duas balas', () => {
  const world = makeWorld();
  const eng = addChar(world, 'engineer', 'blue', 300, 300);
  assert.equal(getClass('engineer').attack.kind, 'ranged');
  eng.resource = eng.resourceMax;
  eng.intent.aim = { x: 600, y: 300 };
  eng.facing = 0;
  let shots = 0;
  const before = world.projectiles.length;
  assert.equal(tryUseAbility(world, eng, 0, { x: 600, y: 300 }).ok, true);
  for (let i = 0; i < 20; i++) {
    world.update(1 / 60);
    shots = Math.max(shots, world.projectiles.filter((p) => p.visual === 'bullet').length);
  }
  assert.ok(before === 0 && shots === 2, `duas balas (${shots})`);
});

test('ataques corpo a corpo alcançam mais longe', () => {
  for (const [id, min] of [['villager', 50], ['warrior', 64], ['barbarian', 64], ['mercenary', 56], ['halberdier', 100]]) {
    const range = getClass(id).attributes.range;
    assert.ok(range >= min, `${id}: ${range}`);
  }
});

test('bot andando sem alvo olha para onde está indo', () => {
  const world = makeWorld({ width: 2000, height: 600 });
  const bot = addChar(world, 'warrior', 'blue', 200, 300);
  bot.controller = new BotController({ role: 'attack', rng: () => 0.5 });
  bot.controller.goal = { x: 1800, y: 300 };
  let checked = 0;
  for (let i = 0; i < 120; i++) {
    world.update(1 / 60);
    if (bot.moving && bot.moveDir) {
      const along = Math.atan2(bot.moveDir.y, bot.moveDir.x);
      const diff = Math.abs(Math.atan2(Math.sin(bot.facing - along), Math.cos(bot.facing - along)));
      assert.ok(diff < 0.3, `olhando ${bot.facing.toFixed(2)} indo para ${along.toFixed(2)}`);
      checked++;
    }
  }
  assert.ok(checked > 30, 'o bot andou');
});
