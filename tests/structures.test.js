import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tryUseAbility } from '../src/combat/AbilitySystem.js';
import { tryBasicAttack } from '../src/combat/CombatSystem.js';
import { Building, PRODUCTION_TIME, RACK_CAPACITY, upgradeBuilding, DEFENSE_TYPES } from '../src/world/Structures.js';
import { spawnWeaponDrop, PICKUP_TIME } from '../src/world/Weapons.js';
import { updateRespawns } from '../src/systems/RespawnSystem.js';
import { MatchManager, MATCH_STATE } from '../src/systems/MatchManager.js';
import { makeWorld, makeMap, addChar, aimAt, step } from './helpers.js';

function worldWithBuilding(kind = 'barracks', team = 'blue') {
  const rect = { x: 400, y: 250, w: 120, h: 120 };
  const map = makeMap({ obstacles: [{ ...rect, kind: 'building', buildingKey: 0 }] });
  const world = makeWorld({ map });
  const b = new Building({ kind, team, rect, rackSide: 1 });
  world.buildings.push(b);
  return { world, b };
}

test('todos começam como aldeão e viram a classe da arma que pegam', () => {
  const world = makeWorld();
  const v = addChar(world, 'villager', 'blue', 300, 300);
  assert.equal(v.isArmed, false);
  spawnWeaponDrop(world, { classId: 'mage', tier: 1, x: 320, y: 300 });
  v.intent.interact = true;
  world.update(1 / 60);
  assert.ok(v.arming, 'começa a pegar a arma');
  step(world, PICKUP_TIME / 2);
  assert.equal(v.classId, 'villager', 'a transformação leva um instante');
  step(world, PICKUP_TIME);
  assert.equal(v.classId, 'mage');
  assert.equal(world.drops.length, 0);
});

test('quem já tem arma deixa a antiga no chão ao pegar outra', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  spawnWeaponDrop(world, { classId: 'archer', tier: 2, x: 310, y: 300 });
  w.intent.interact = true;
  step(world, PICKUP_TIME + 0.2);
  assert.equal(w.classId, 'archer');
  assert.equal(w.tier, 2);
  assert.deepEqual(world.drops.map((d) => d.classId), ['warrior']);
});

test('ao morrer o personagem derruba a arma e renasce como aldeão', () => {
  const world = makeWorld();
  const b = addChar(world, 'barbarian', 'red', 500, 300);
  const killer = addChar(world, 'archer', 'blue', 300, 300);
  world.killCharacter(b, killer);
  assert.deepEqual(world.drops.map((d) => d.classId), ['barbarian']);
  b.respawnTimer = 0;
  updateRespawns(world, 0.1);
  assert.equal(b.alive, true);
  assert.equal(b.classId, 'villager');
  assert.equal(b.hp, b.maxHp);
});

test('construções fabricam armas no suporte até encher', () => {
  const { world, b } = worldWithBuilding('barracks');
  step(world, PRODUCTION_TIME[1] + 0.1);
  assert.equal(world.drops.length, 1);
  assert.equal(world.drops[0].classId, 'warrior');
  step(world, PRODUCTION_TIME[1] * (RACK_CAPACITY + 1));
  assert.equal(world.drops.filter((d) => d.buildingId === b.id).length, RACK_CAPACITY);
});

test('upgrade custa ouro, sobe o nível e as armas saem mais fortes', () => {
  const { world, b } = worldWithBuilding('lumbermill');
  assert.equal(upgradeBuilding(world, b, 'blue').ok, false, 'sem ouro não melhora');
  world.gold.blue = 1000;
  assert.equal(upgradeBuilding(world, b, 'red').ok, false, 'inimigo não melhora');
  assert.equal(upgradeBuilding(world, b, 'blue').ok, true);
  assert.equal(b.level, 2);
  assert.ok(world.gold.blue < 1000);
  step(world, PRODUCTION_TIME[2] + 0.1);
  assert.equal(world.drops[0].tier, 2);
  const v = addChar(world, 'villager', 'blue', world.drops[0].pos.x, world.drops[0].pos.y);
  const plain = addChar(world, 'barbarian', 'red', 100, 100);
  v.intent.interact = true;
  step(world, PICKUP_TIME + 0.1);
  assert.ok(v.attrs.damage > plain.attrs.damage, 'arma de nível 2 dá mais dano');
});

test('inimigos destroem construções; reparar reconstrói as ruínas para a equipe do engenheiro', () => {
  const { world, b } = worldWithBuilding('tavern', 'red');
  const brute = addChar(world, 'barbarian', 'blue', b.rect.x - 20, b.pos.y);
  const friend = addChar(world, 'mercenary', 'red', b.rect.x - 20, b.pos.y + 80);
  aimAt(brute, b.pos.x, b.pos.y);
  assert.equal(tryBasicAttack(world, brute), true);
  assert.ok(b.hp < b.maxHp, 'golpe inimigo causa dano');
  const hp = b.hp;
  friend.facing = 0;
  tryBasicAttack(world, friend);
  assert.equal(b.hp, hp, 'a própria equipe não danifica');
  let destroyed = null;
  world.events.on('buildingDestroyed', (e) => (destroyed = e));
  b.hp = 1;
  brute.cooldowns.update(5);
  brute.actionTimer = 0;
  tryBasicAttack(world, brute);
  assert.ok(destroyed && b.destroyed);
  const eng = addChar(world, 'engineer', 'blue', b.rect.x - 20, b.pos.y - 40);
  assert.equal(tryUseAbility(world, eng, 4).ok, true);
  assert.equal(b.destroyed, false);
  assert.equal(b.team, 'blue');
});

test('engenheiro ergue defesas: torre atira, armadilha atordoa e barricada bloqueia', () => {
  const world = makeWorld({ width: 1400, height: 800 });
  const eng = addChar(world, 'engineer', 'blue', 300, 400);
  eng.resource = eng.resourceMax;
  assert.equal(tryUseAbility(world, eng, 1, { x: 400, y: 400 }).ok, true);
  const tower = world.defenses[0];
  assert.equal(tower.kind, 'arrowTower');
  const enemy = addChar(world, 'warrior', 'red', tower.pos.x + DEFENSE_TYPES.arrowTower.range - 60, 400);
  step(world, 3);
  assert.ok(enemy.hp < enemy.maxHp, 'a torre fere inimigos no alcance');

  eng.actionTimer = 0;
  eng.resource = eng.resourceMax;
  assert.equal(tryUseAbility(world, eng, 3, { x: 300, y: 540 }).ok, true);
  const trap = world.defenses.find((d) => d.kind === 'trap');
  const victim = addChar(world, 'mage', 'red', trap.pos.x + 60, trap.pos.y);
  victim.intent.move = { x: -1, y: 0 };
  step(world, 0.6);
  assert.ok(victim.stunned, 'armadilha atordoa');
  assert.ok(!world.defenses.includes(trap), 'armadilha é consumida');

  eng.actionTimer = 0;
  eng.resource = eng.resourceMax;
  assert.equal(tryUseAbility(world, eng, 0, { x: 300, y: 260 }).ok, true);
  const wall = world.defenses.find((d) => d.kind === 'barricade');
  const runner = addChar(world, 'mercenary', 'red', wall.pos.x, wall.pos.y - 80);
  runner.intent.move = { x: 0, y: 1 };
  step(world, 1.5);
  assert.ok(Math.hypot(runner.pos.x - wall.pos.x, runner.pos.y - wall.pos.y) >= wall.radius + runner.radius - 1, 'não atravessa a barricada');
});

test('defesas não duram para sempre só por tempo, mas podem ser destruídas', () => {
  const world = makeWorld();
  const eng = addChar(world, 'engineer', 'blue', 300, 300);
  tryUseAbility(world, eng, 0, { x: 400, y: 300 });
  step(world, 120);
  assert.equal(world.defenses.length, 1, 'continua de pé com o tempo');
  const enemy = addChar(world, 'barbarian', 'red', world.defenses[0].pos.x + 40, 300);
  world.defenses[0].hp = 5;
  enemy.facing = Math.PI;
  tryBasicAttack(world, enemy);
  world.update(1 / 60);
  assert.equal(world.defenses.length, 0);
});

test('destruir o castelo inimigo vence a partida', () => {
  const m = new MatchManager({ seed: 4 }).start();
  const castle = m.castle('red');
  castle.hp = 1;
  const p = m.player;
  m.world.destroyStructure(castle, p);
  m.update(1 / 60);
  assert.equal(m.state, MATCH_STATE.ENDED);
  assert.equal(m.result.outcome, 'victory');
  assert.equal(m.result.reason, 'castle');
});
