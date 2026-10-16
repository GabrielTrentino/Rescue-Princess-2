import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDamage, dealDamage, armorReduction } from '../src/combat/DamageSystem.js';
import { tryBasicAttack } from '../src/combat/CombatSystem.js';
import { makeWorld, addChar, aimAt, step, noCrit } from './helpers.js';

test('armadura reduz dano físico com retorno decrescente', () => {
  assert.equal(armorReduction(0), 1);
  assert.equal(armorReduction(100), 0.5);
  assert.ok(armorReduction(45) < 1 && armorReduction(45) > 0.5);
});

test('dano físico considera armadura; dano mágico considera poder mágico e ignora armadura', () => {
  const world = makeWorld();
  const warrior = addChar(world, 'warrior', 'blue', 100, 100);
  const mage = addChar(world, 'mage', 'red', 200, 100);
  noCrit(warrior, mage);
  const phys = computeDamage({ base: 100, type: 'physical', attacker: mage, defender: warrior, rng: () => 1 });
  assert.equal(phys.amount, Math.round(100 * armorReduction(warrior.attrs.armor)));
  const magic = computeDamage({ base: 100, type: 'magic', attacker: mage, defender: warrior, rng: () => 1 });
  assert.equal(magic.amount, Math.round(100 * (1 + mage.attrs.magicPower / 100)));
});

test('crítico multiplica o dano quando o sorteio é favorável', () => {
  const world = makeWorld();
  const a = addChar(world, 'archer', 'blue', 0, 0);
  const d = addChar(world, 'mage', 'red', 50, 0);
  d.attrs.armor = 0;
  const normal = computeDamage({ base: 100, attacker: a, defender: d, rng: () => 0.99 });
  const crit = computeDamage({ base: 100, attacker: a, defender: d, rng: () => 0 });
  assert.equal(normal.crit, false);
  assert.equal(crit.crit, true);
  assert.equal(crit.amount, Math.round(100 * a.attrs.critMult));
});

test('modificadores temporários entram no cálculo e terminam ao expirar', () => {
  const world = makeWorld();
  const a = addChar(world, 'barbarian', 'blue', 0, 0);
  const d = addChar(world, 'warrior', 'red', 50, 0);
  noCrit(a);
  d.attrs.armor = 0;
  d.effects.add({ id: 'teste', duration: 1, modifiers: { damageTakenMult: 0.5 } });
  assert.equal(computeDamage({ base: 100, attacker: a, defender: d }).amount, 50);
  step(world, 1.1);
  assert.equal(computeDamage({ base: 100, attacker: a, defender: d }).amount, 100);
});

test('aliados não causam dano entre si e mortos não recebem dano', () => {
  const world = makeWorld();
  const a = addChar(world, 'barbarian', 'blue', 0, 0);
  const ally = addChar(world, 'warrior', 'blue', 30, 0);
  const enemy = addChar(world, 'warrior', 'red', 60, 0);
  assert.equal(dealDamage(world, a, ally, { base: 50 }), 0);
  assert.equal(ally.hp, ally.maxHp);
  world.killCharacter(enemy, a);
  assert.equal(dealDamage(world, a, enemy, { base: 50 }), 0);
});

test('morte registra eliminação e morte uma única vez', () => {
  const world = makeWorld();
  const a = addChar(world, 'barbarian', 'blue', 0, 0);
  const d = addChar(world, 'mage', 'red', 40, 0);
  let deaths = 0;
  world.events.on('death', () => deaths++);
  dealDamage(world, a, d, { base: 100000 });
  dealDamage(world, a, d, { base: 100000 });
  assert.equal(d.alive, false);
  assert.equal(deaths, 1);
  assert.equal(a.stats.kills, 1);
  assert.equal(d.stats.deaths, 1);
});

test('ataque básico respeita alcance, direção e intervalo', () => {
  const world = makeWorld();
  const a = addChar(world, 'warrior', 'blue', 300, 300);
  const front = addChar(world, 'mage', 'red', 300 + a.radius + 30, 300);
  const behind = addChar(world, 'mage', 'red', 300 - a.radius - 40, 300);
  const far = addChar(world, 'mage', 'red', 600, 300);
  noCrit(a);
  aimAt(a, 1000, 300);
  assert.equal(tryBasicAttack(world, a), true);
  assert.ok(front.hp < front.maxHp, 'alvo à frente deve ser atingido');
  assert.equal(behind.hp, behind.maxHp, 'alvo atrás não deve ser atingido');
  assert.equal(far.hp, far.maxHp, 'alvo fora de alcance não deve ser atingido');
  const hpAfter = front.hp;
  assert.equal(tryBasicAttack(world, a), false, 'segundo ataque imediato deve ser bloqueado');
  assert.equal(front.hp, hpAfter);
});

test('um único golpe não aplica dano repetido no mesmo alvo', () => {
  const world = makeWorld();
  const a = addChar(world, 'warrior', 'blue', 300, 300);
  const t = addChar(world, 'mage', 'red', 300 + a.radius + 20, 300);
  noCrit(a);
  let hits = 0;
  world.events.on('damage', () => hits++);
  aimAt(a, 1000, 300);
  tryBasicAttack(world, a);
  step(world, 0.05);
  assert.equal(hits, 1);
  assert.ok(t.hp < t.maxHp);
});

test('personagem morto não ataca', () => {
  const world = makeWorld();
  const a = addChar(world, 'warrior', 'blue', 300, 300);
  const t = addChar(world, 'mage', 'red', 300 + a.radius + 20, 300);
  world.killCharacter(a, t);
  aimAt(a, 1000, 300);
  assert.equal(tryBasicAttack(world, a), false);
  assert.equal(t.hp, t.maxHp);
});

test('projéteis colidem com alvos válidos e param em obstáculos', () => {
  const wall = { x: 450, y: 200, w: 40, h: 200, kind: 'wall' };
  const world = makeWorld({ obstacles: [wall] });
  const archer = addChar(world, 'archer', 'blue', 200, 300);
  const open = addChar(world, 'mage', 'red', 380, 300);
  const hidden = addChar(world, 'mage', 'red', 600, 300);
  noCrit(archer);
  aimAt(archer, 900, 300);
  tryBasicAttack(world, archer);
  step(world, 1);
  assert.ok(open.hp < open.maxHp, 'alvo no caminho é atingido');
  assert.equal(hidden.hp, hidden.maxHp);
  open.alive = false; // tira o primeiro alvo do caminho
  archer.cooldowns.reset();
  tryBasicAttack(world, archer);
  step(world, 1.5);
  assert.equal(hidden.hp, hidden.maxHp, 'a parede bloqueia o projétil');
  assert.equal(world.projectiles.length, 0);
});
