import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { MatchManager, MATCH_STATE } from '../src/systems/MatchManager.js';
import { CLASSES, CLASS_ORDER, ALL_CLASSES } from '../src/classes/classDefinitions.js';
import { selectTarget } from '../src/ai/TargetSelector.js';
import { CHARACTER_MODELS, WEAPON_MODELS, WORLD_MODELS } from '../src/render3d/modelList.js';
import { CLASS_LOOKS } from '../src/render3d/looks.js';
import { dist } from '../src/core/math.js';

const DT = 1 / 60;

function run(match, seconds) {
  for (let i = 0; i < seconds / DT && match.state === MATCH_STATE.PLAYING; i++) match.update(DT);
}

test('uma partida só com bots roda até o fim com todas as classes', () => {
  for (const [i, classId] of CLASS_ORDER.entries()) {
    const m = new MatchManager({ playerClassId: classId, seed: 100 + i, config: { matchDuration: 90 } }).start();
    const ids = m.world.characters.map((c) => c.id);
    run(m, 200);
    assert.equal(m.state, MATCH_STATE.ENDED, classId);
    assert.ok(['victory', 'defeat', 'draw'].includes(m.result.outcome));
    // Respawns não duplicam personagens.
    assert.deepEqual(m.world.characters.map((c) => c.id), ids);
  }
});

test('bots pegam armas, encontram alvos, causam dano e pressionam o inimigo', () => {
  const m = new MatchManager({ seed: 7, config: { matchDuration: 240 } }).start();
  let damage = 0;
  let structureDamage = 0;
  let transforms = 0;
  let maxAttackers = 0;
  m.events.on('damage', (e) => {
    damage += e.amount;
    if (e.structure) structureDamage += e.amount;
  });
  m.events.on('transform', () => transforms++);
  for (let i = 0; i < 240 / DT && m.state === MATCH_STATE.PLAYING; i++) {
    m.update(DT);
    for (const b of Object.values(m.objective.bases)) maxAttackers = Math.max(maxAttackers, b.attackers);
  }
  assert.ok(transforms >= 12, `bots devem pegar armas (${transforms})`);
  assert.ok(damage > 0);
  assert.ok(structureDamage > 0 || maxAttackers > 0, 'bots devem atacar construções ou a base adversária');
});

test('bots não escolhem personagens mortos como alvo', () => {
  const m = new MatchManager({ playerClassId: 'archer', seed: 3 }).start();
  run(m, 20);
  for (const bot of m.world.characters.filter((c) => c.alive)) {
    for (const enemy of m.world.characters) if (enemy.team !== bot.team) enemy.alive = false;
    assert.equal(selectTarget(m.world, bot, { range: 5000 }), null);
    break;
  }
});

test('bots não ficam presos indefinidamente', () => {
  const m = new MatchManager({ playerClassId: 'mage', seed: 11, config: { matchDuration: 300 } }).start();
  const last = new Map(m.world.characters.map((c) => [c.id, { x: c.pos.x, y: c.pos.y, still: 0 }]));
  let worst = 0;
  for (let i = 0; i < 90 / DT; i++) {
    m.update(DT);
    if (i % 30 !== 0) continue;
    for (const c of m.world.characters) {
      const rec = last.get(c.id);
      const moved = dist(rec, c.pos);
      const ai = c.controller.state;
      const shouldMove = c.alive && ['seek', 'chase', 'follow', 'retreat'].includes(ai) && dist(c.pos, c.controller.goal ?? c.pos) > 60;
      rec.still = shouldMove && moved < 3 ? rec.still + 0.5 : 0;
      worst = Math.max(worst, rec.still);
      rec.x = c.pos.x;
      rec.y = c.pos.y;
    }
  }
  assert.ok(worst < 4, `um bot ficou parado por ${worst}s querendo andar`);
});

test('vitória é detectada quando a base inimiga é conquistada', () => {
  const m = new MatchManager({ playerClassId: 'warrior', seed: 5 }).start();
  for (const c of m.world.characters) {
    if (c.team === 'red') {
      c.controller = null;
      m.world.killCharacter(c, null);
      c.respawnTimer = 999;
    } else {
      c.controller = null;
      c.pos.x = m.world.map.bases.red.x;
      c.pos.y = m.world.map.bases.red.y;
    }
  }
  run(m, 60);
  assert.equal(m.state, MATCH_STATE.ENDED);
  assert.equal(m.result.outcome, 'victory');
  assert.equal(m.result.reason, 'objective');
});

test('derrota é detectada quando a própria base é conquistada', () => {
  const m = new MatchManager({ playerClassId: 'warrior', seed: 6 }).start();
  for (const c of m.world.characters) {
    c.controller = null;
    if (c.team === 'blue') {
      m.world.killCharacter(c, null);
      c.respawnTimer = 999;
    } else {
      c.pos.x = m.world.map.bases.blue.x;
      c.pos.y = m.world.map.bases.blue.y;
    }
  }
  run(m, 60);
  assert.equal(m.result.outcome, 'defeat');
});

test('reiniciar não mantém cooldowns, efeitos, tempo nem personagens da partida anterior', () => {
  const m = new MatchManager({ playerClassId: 'warrior', seed: 9 }).start();
  run(m, 30);
  const p = m.player;
  p.cooldowns.start('warrior_last_stand', 50);
  p.effects.add({ id: 'teste', duration: 99, modifiers: { speedMult: 0.1 } });
  const oldWorld = m.world;
  m.restart();
  assert.notEqual(m.world, oldWorld);
  assert.equal(m.elapsed, 0);
  assert.equal(m.state, MATCH_STATE.PLAYING);
  assert.equal(m.player.cooldowns.isReady('warrior_last_stand'), true);
  assert.equal(m.player.effects.list.length, 0);
  assert.equal(m.world.characters.length, 1 + m.config.alliesCount + m.config.enemiesCount);
  assert.equal(m.objective.bases.blue.progress, 0);
});

// Lê os nomes das animações direto do bloco JSON de um arquivo .glb.
function glbJson(url) {
  const buf = readFileSync(url);
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}

test('todos os modelos 3D usados pelo jogo existem', () => {
  const files = [
    ...CHARACTER_MODELS.map((n) => `characters/${n}.glb`),
    ...WEAPON_MODELS.map((n) => `weapons/${n}.glb`),
    ...WORLD_MODELS.map((n) => `world/${n}.glb`),
    'characters/anims.glb',
  ];
  for (const f of files) assert.ok(existsSync(new URL(`../assets/models/${f}`, import.meta.url)), `${f} não existe`);
});

test('cada classe tem aparência 3D e as animações dela existem', () => {
  const clips = new Set(glbJson(new URL('../assets/models/characters/anims.glb', import.meta.url)).animations.map((a) => a.name));
  for (const id of ALL_CLASSES) {
    const look = CLASS_LOOKS[id];
    assert.ok(look, `sem aparência para ${id}`);
    assert.ok(CHARACTER_MODELS.includes(look.model));
    for (const name of [look.idle, look.run, ...look.attack, ...look.ability, 'PickUp', 'Death_A', 'Hit_A']) {
      assert.ok(clips.has(name), `animação ${name} (${id}) ausente`);
    }
  }
});

test('todas as habilidades têm um ícone desenhado', () => {
  for (const id of ALL_CLASSES) {
    for (const a of CLASSES[id].abilities) {
      assert.ok(existsSync(new URL(`../assets/ui/icons/${a.id}.svg`, import.meta.url)), `ícone de ${a.id} ausente`);
    }
  }
});
