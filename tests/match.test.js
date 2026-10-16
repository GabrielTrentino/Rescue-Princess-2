import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { MatchManager, MATCH_STATE } from '../src/systems/MatchManager.js';
import { CLASS_ORDER } from '../src/classes/classDefinitions.js';
import { selectTarget } from '../src/ai/TargetSelector.js';
import { validateManifest } from '../src/render/SpriteManager.js';
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

test('bots encontram alvos, causam dano e participam do objetivo', () => {
  const m = new MatchManager({ playerClassId: 'warrior', seed: 7, config: { matchDuration: 120 } }).start();
  let damage = 0;
  let maxProgress = 0;
  m.events.on('damage', (e) => (damage += e.amount));
  for (let i = 0; i < 120 / DT && m.state === MATCH_STATE.PLAYING; i++) {
    m.update(DT);
    for (const b of Object.values(m.objective.bases)) maxProgress = Math.max(maxProgress, b.attackers);
  }
  assert.ok(damage > 0);
  assert.ok(maxProgress > 0, 'algum bot deve entrar na base adversária');
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

test('o manifesto de sprites é válido e aponta para arquivos existentes quando pronto', () => {
  const manifest = JSON.parse(readFileSync(new URL('../assets/manifests/characters.json', import.meta.url)));
  assert.deepEqual(validateManifest(manifest), []);
  assert.deepEqual(Object.keys(manifest.characters).sort(), [...CLASS_ORDER].sort());
  for (const entry of Object.values(manifest.characters)) {
    if (entry.status !== 'ready') continue;
    for (const anim of Object.values(entry.animations)) {
      assert.ok(existsSync(new URL(`../${anim.src}`, import.meta.url)), `${anim.src} não existe`);
    }
  }
});
