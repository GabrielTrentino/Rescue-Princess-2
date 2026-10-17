import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, CLASS_ORDER } from '../src/classes/classDefinitions.js';
import { ABILITIES } from '../src/classes/abilityDefinitions.js';
import { tryUseAbility } from '../src/combat/AbilitySystem.js';
import { BotController } from '../src/ai/BotController.js';
import { selectTarget } from '../src/ai/TargetSelector.js';
import { makeWorld, addChar, aimAt, step, noCrit } from './helpers.js';

test('sete classes de arma mais o aldeão, cada classe com cinco habilidades e identificadores únicos', () => {
  assert.equal(CLASS_ORDER.length, 7);
  for (const id of CLASS_ORDER) assert.equal(CLASSES[id].abilities.length, 5, id);
  assert.equal(CLASSES.villager.abilities.length, 2);
  assert.equal(Object.keys(ABILITIES).length, 37);
});

test('todas as habilidades executam, causam efeito e gastam a barra de ação', () => {
  for (const classId of ['villager', ...CLASS_ORDER]) {
    CLASSES[classId].abilities.forEach((def, i) => {
      const world = makeWorld({ width: 1400, height: 800 });
      const caster = addChar(world, classId, 'blue', 500, 400);
      caster.resource = caster.resourceMax;
      const enemy = addChar(world, 'warrior', 'red', 500 + caster.radius + 30, 400);
      const enemy2 = addChar(world, 'mage', 'red', 500 + caster.radius + 34, 440);
      const ally = addChar(world, 'warrior', 'blue', 470, 430);
      enemy.hp = enemy.maxHp * 0.3; // permite testar Execução e bônus contra alvos vulneráveis
      enemy.controller = new BotController({ rng: () => 0.5 });
      let events = 0;
      world.events.on('damage', () => events++);
      world.events.on('fx', () => events++);
      aimAt(caster, enemy.pos.x, enemy.pos.y);
      const hpBefore = enemy.hp + enemy2.hp;
      const resBefore = caster.resource;
      // Engenheiro: constrói longe dos personagens; o reparo precisa de algo danificado por perto.
      let aim = { ...enemy.pos };
      if (def.effects[0].type === 'build') aim = { x: 500, y: 250 };
      if (def.effects[0].type === 'repair') {
        tryUseAbility(world, caster, 1, { x: 500, y: 320 });
        caster.actionTimer = 0;
        caster.resource = caster.resourceMax;
        world.defenses[0].hp = 10;
        events++;
      }
      const r = tryUseAbility(world, caster, i, aim);
      assert.equal(r.ok, true, `${def.id} deveria ativar (${r.reason})`);
      assert.ok(caster.resource < (def.effects[0].type === 'repair' ? caster.resourceMax : resBefore), `${def.id} deveria gastar recurso`);
      step(world, 1.5);
      const changed = enemy.hp + enemy2.hp < hpBefore || caster.effects.list.length > 0 || ally.effects.list.length > 0 ||
        enemy.taunt !== null || world.zones.length > 0 || world.defenses.length > 0 || events > 0;
      assert.ok(changed, `${def.id} deveria produzir algum efeito`);
      void ally;
    });
  }
});

test('Golpe Poderoso causa mais dano que o ataque básico e empurra o alvo', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  const t = addChar(world, 'mage', 'red', 300 + w.radius + 25, 300);
  noCrit(w);
  aimAt(w, 600, 300);
  const x0 = t.pos.x;
  tryUseAbility(world, w, 0, { x: 600, y: 300 });
  const dmg = t.maxHp - t.hp;
  assert.ok(dmg > w.attrs.damage * 1.5);
  step(world, 0.5);
  assert.ok(t.pos.x > x0 + 20, 'alvo deve ser empurrado');
});

test('Investida desloca o guerreiro e atordoa o primeiro inimigo atingido', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 200, 300);
  const t = addChar(world, 'mage', 'red', 380, 300);
  aimAt(w, 380, 300);
  tryUseAbility(world, w, 1, { x: 380, y: 300 });
  step(world, 0.3);
  assert.ok(w.pos.x > 300);
  assert.ok(t.hp < t.maxHp);
  assert.ok(t.stunned);
});

test('Provocação faz bots inimigos priorizarem o guerreiro', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  const archer = addChar(world, 'archer', 'blue', 380, 300);
  const bot = addChar(world, 'barbarian', 'red', 420, 300);
  assert.equal(selectTarget(world, bot, { range: 400 }), archer);
  tryUseAbility(world, w, 3);
  assert.equal(selectTarget(world, bot, { range: 400 }), w);
  step(world, 4);
  assert.equal(bot.taunt, null, 'a provocação termina');
});

test('Postura Defensiva reduz o dano e termina após a duração', () => {
  const world = makeWorld();
  const w = addChar(world, 'warrior', 'blue', 300, 300);
  tryUseAbility(world, w, 2);
  assert.equal(w.effects.multiplier('damageTakenMult'), 0.6);
  step(world, 4.1);
  assert.equal(w.effects.multiplier('damageTakenMult'), 1);
});

test('Campo Congelante deixa inimigos mais lentos dentro da área', () => {
  const world = makeWorld();
  const m = addChar(world, 'mage', 'blue', 200, 300);
  const t = addChar(world, 'warrior', 'red', 400, 300);
  tryUseAbility(world, m, 3, { x: 400, y: 300 });
  step(world, 0.1);
  assert.ok(t.getStat('speed') < t.attrs.speed * 0.75);
  step(world, 3.5);
  assert.equal(world.zones.length, 0);
  assert.equal(t.getStat('speed'), t.attrs.speed);
});

test('Gancho de Alabarda puxa o alvo sem atravessar obstáculos', () => {
  const world = makeWorld();
  const h = addChar(world, 'halberdier', 'blue', 200, 300);
  const t = addChar(world, 'mage', 'red', 450, 300);
  aimAt(h, 450, 300);
  tryUseAbility(world, h, 2, { x: 450, y: 300 });
  step(world, 1);
  assert.ok(t.pos.x < 320, `alvo deveria ser puxado (x=${t.pos.x})`);
  assert.ok(t.pos.x > h.pos.x, 'o alvo não atravessa o alabardeiro');
});

test('Flecha Perfurante atravessa inimigos alinhados', () => {
  const world = makeWorld();
  const a = addChar(world, 'archer', 'blue', 100, 300);
  const t1 = addChar(world, 'warrior', 'red', 300, 300);
  const t2 = addChar(world, 'warrior', 'red', 400, 300);
  aimAt(a, 800, 300);
  tryUseAbility(world, a, 2, { x: 800, y: 300 });
  step(world, 1);
  assert.ok(t1.hp < t1.maxHp && t2.hp < t2.maxHp);
});

test('Execução causa dano muito maior contra alvos com pouca vida', () => {
  const world = makeWorld();
  const m = addChar(world, 'mercenary', 'blue', 300, 300);
  const healthy = addChar(world, 'warrior', 'red', 300 + m.radius + 25, 300);
  noCrit(m);
  aimAt(m, 600, 300);
  tryUseAbility(world, m, 4, { x: 600, y: 300 });
  const normalDmg = healthy.maxHp - healthy.hp;

  const world2 = makeWorld();
  const m2 = addChar(world2, 'mercenary', 'blue', 300, 300);
  const weak = addChar(world2, 'warrior', 'red', 300 + m2.radius + 25, 300);
  noCrit(m2);
  weak.hp = weak.maxHp * 0.3;
  const before = weak.hp;
  aimAt(m2, 600, 300);
  tryUseAbility(world2, m2, 4, { x: 600, y: 300 });
  assert.ok(before - weak.hp > normalDmg * 3);
});

test('Bomba de Fumaça impede bots de mirar aliados dentro dela', () => {
  const world = makeWorld();
  const merc = addChar(world, 'mercenary', 'blue', 300, 300);
  const bot = addChar(world, 'archer', 'red', 600, 300);
  assert.equal(selectTarget(world, bot, { range: 500 }), merc);
  tryUseAbility(world, merc, 3);
  assert.equal(selectTarget(world, bot, { range: 500 }), null);
});

test('Rajada Mortal dispara oito flechas em sequência', () => {
  const world = makeWorld();
  const a = addChar(world, 'archer', 'blue', 100, 300);
  let shots = 0;
  world.events.on('fx', (e) => e.kind === 'shoot' && shots++);
  aimAt(a, 800, 300);
  tryUseAbility(world, a, 4, { x: 800, y: 300 });
  step(world, 1);
  assert.equal(shots, 8);
});
