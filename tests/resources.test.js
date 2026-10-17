import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cooldowns } from '../src/combat/CooldownSystem.js';
import { tryUseAbility, FAIL } from '../src/combat/AbilitySystem.js';
import { applyStun } from '../src/combat/CombatSystem.js';
import { CLASSES, ALL_CLASSES } from '../src/classes/classDefinitions.js';
import { makeWorld, addChar, step } from './helpers.js';

test('o intervalo do ataque básico continua independente', () => {
  const cd = new Cooldowns();
  cd.start('basic', 2);
  cd.update(1);
  assert.equal(cd.isReady('basic'), false);
  assert.ok(Math.abs(cd.fraction('basic') - 0.5) < 1e-9);
});

test('cada classe tem uma barra de ação e toda habilidade tem custo menor que a barra', () => {
  for (const id of ALL_CLASSES) {
    const res = CLASSES[id].resource;
    assert.ok(res.name && res.max > 0, id);
    for (const a of CLASSES[id].abilities) {
      assert.ok(a.cost > 0 && a.cost <= res.max, `${a.id}: custo ${a.cost}`);
      assert.equal(a.cooldown, undefined, `${a.id} não deve ter recarga`);
    }
  }
});

test('habilidades não têm recarga: gastam a barra e podem repetir enquanto houver recurso', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  const def = w.classDef.abilities[2];
  const start = w.resource;
  assert.equal(tryUseAbility(world, w, 2).ok, true);
  assert.equal(w.resource, start - def.cost);
  w.actionTimer = 0;
  assert.equal(tryUseAbility(world, w, 2).ok, true, 'a mesma habilidade pode ser usada de novo logo em seguida');
});

test('sem recurso suficiente a habilidade falha e nada é gasto', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  w.resource = w.classDef.abilities[4].cost - 1;
  const before = w.resource;
  const r = tryUseAbility(world, w, 4);
  assert.equal(r.ok, false);
  assert.equal(r.reason, FAIL.RESOURCE);
  assert.equal(w.resource, before);
});

test('a barra se recupera com o tempo até o máximo', () => {
  const world = makeWorld();
  const m = addChar(world, 'mage', 'blue', 300, 300);
  m.resource = 0;
  step(world, 2);
  assert.ok(Math.abs(m.resource - m.classDef.resource.regen * 2) < 0.5);
  step(world, 60);
  assert.equal(m.resource, m.resourceMax);
});

test('a fúria do bárbaro decai sozinha e enche ao acertar ataques básicos', () => {
  const world = makeWorld();
  const b = addChar(world, 'barbarian', 'blue', 300, 300);
  const t = addChar(world, 'warrior', 'red', 300 + b.radius + 25, 300);
  t.attrs.maxHp = t.hp = 99999;
  b.resource = 50;
  step(world, 1);
  assert.ok(b.resource < 50, 'fúria decai');
  const before = b.resource;
  b.facing = 0;
  b.intent.attack = true;
  world.update(1 / 60);
  assert.ok(b.resource > before + 5, 'acertar enche a fúria');
});

test('tentativas inválidas (morto, atordoado, ocupado) não gastam recurso', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  const enemy = addChar(world, 'mage', 'red', 600, 300);
  const full = w.resource;

  w.actionTimer = 0.2;
  assert.equal(tryUseAbility(world, w, 2).reason, FAIL.BUSY);
  w.actionTimer = 0;

  applyStun(world, w, 1, enemy.id);
  assert.equal(tryUseAbility(world, w, 2).reason, FAIL.STUNNED);
  assert.equal(w.resource, full);

  world.killCharacter(w, enemy);
  assert.equal(tryUseAbility(world, w, 2).reason, FAIL.DEAD);
  assert.equal(w.resource, full);
});
