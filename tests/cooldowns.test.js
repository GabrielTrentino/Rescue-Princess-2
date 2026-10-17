import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cooldowns } from '../src/combat/CooldownSystem.js';
import { tryUseAbility, FAIL } from '../src/combat/AbilitySystem.js';
import { applyStun } from '../src/combat/CombatSystem.js';
import { makeWorld, addChar, step } from './helpers.js';

test('cooldowns são independentes por habilidade', () => {
  const cd = new Cooldowns();
  cd.start('a', 2);
  cd.start('b', 5);
  cd.update(2.5);
  assert.equal(cd.isReady('a'), true);
  assert.equal(cd.isReady('b'), false);
  assert.ok(Math.abs(cd.remaining('b') - 2.5) < 1e-9);
  assert.ok(Math.abs(cd.fraction('b') - 0.5) < 1e-9);
});

test('habilidade em recarga não pode ser usada e a tentativa não altera o cooldown', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  const def = w.classDef.abilities[2];
  assert.equal(tryUseAbility(world, w, 2).ok, true);
  assert.equal(w.cooldowns.remaining(def.id), def.cooldown);
  step(world, 1);
  const before = w.cooldowns.remaining(def.id);
  const r = tryUseAbility(world, w, 2);
  assert.equal(r.ok, false);
  assert.equal(r.reason, FAIL.COOLDOWN);
  assert.equal(w.cooldowns.remaining(def.id), before);
});

test('usar uma habilidade não coloca as outras em recarga', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  tryUseAbility(world, w, 2);
  for (const i of [0, 1, 3, 4]) assert.equal(w.cooldowns.isReady(w.classDef.abilities[i].id), true);
});

test('tentativas inválidas (morto, atordoado, ocupado) não consomem a habilidade', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  const enemy = addChar(world, 'mage', 'red', 600, 300);
  const id = w.classDef.abilities[2].id;

  w.actionTimer = 0.2;
  assert.equal(tryUseAbility(world, w, 2).reason, FAIL.BUSY);
  w.actionTimer = 0;

  applyStun(world, w, 1, enemy.id);
  assert.equal(tryUseAbility(world, w, 2).reason, FAIL.STUNNED);
  assert.equal(w.cooldowns.isReady(id), true);

  world.killCharacter(w, enemy);
  assert.equal(tryUseAbility(world, w, 2).reason, FAIL.DEAD);
  assert.equal(w.cooldowns.isReady(id), true);
});

test('cooldown termina no tempo configurado', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  const def = w.classDef.abilities[0];
  tryUseAbility(world, w, 0);
  step(world, def.cooldown - 0.1);
  assert.equal(w.cooldowns.isReady(def.id), false);
  step(world, 0.2);
  assert.equal(w.cooldowns.isReady(def.id), true);
});
