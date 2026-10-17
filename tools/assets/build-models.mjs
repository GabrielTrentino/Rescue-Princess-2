// Prepara os modelos da KayKit para o jogo (assets/models/):
//  - personagens sem animações (as animações ficam numa biblioteca compartilhada, anims.glb);
//  - armas, construções e cenário convertidos de .gltf para .glb (um arquivo cada).
// Precisa de @gltf-transform/core e @gltf-transform/functions (npm i -D).
// Uso: node tools/assets/fetch-kaykit.mjs && node tools/assets/build-models.mjs
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = join(ROOT, 'assets/vendor/kaykit');
const OUT = join(ROOT, 'assets/models');
const io = new NodeIO();

// Animações usadas pelo jogo (o pacote tem 76).
export const ANIMATIONS = [
  'Idle', 'Unarmed_Idle', '2H_Melee_Idle', 'Running_A', 'Running_B', 'Walking_A',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Stab',
  'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Chop',
  '2H_Ranged_Shoot', '2H_Ranged_Aiming', '1H_Ranged_Shoot', 'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Long',
  'Hit_A', 'Hit_B', 'Death_A', 'Death_B', 'PickUp', 'Cheer', 'Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Kick',
  'Use_Item', 'Interact', 'Block', 'Dodge_Forward', 'Throw',
];

function files(dir, ext) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p, ext);
    return p.endsWith(ext) ? [p] : [];
  });
}

function dropAnimation(anim) {
  // Os acessores de tempo podem ser compartilhados entre animações: quem limpa os órfãos é o prune().
  for (const s of anim.listSamplers()) s.dispose();
  for (const c of anim.listChannels()) c.dispose();
  anim.dispose();
}

async function save(doc, dest) {
  await doc.transform(prune(), dedup());
  mkdirSync(join(dest, '..'), { recursive: true });
  await io.write(dest, doc);
}

// Personagens
mkdirSync(join(OUT, 'characters'), { recursive: true });
for (const file of files(join(SRC, 'adventurers/Characters'), '.glb')) {
  const name = basename(file, '.glb');
  const doc = await io.read(file);
  if (name === 'Knight') {
    // Biblioteca de animações: o esqueleto é o mesmo em todos os personagens do pacote.
    const lib = await io.read(file);
    for (const anim of lib.getRoot().listAnimations()) if (!ANIMATIONS.includes(anim.getName())) dropAnimation(anim);
    for (const node of lib.getRoot().listNodes()) {
      node.setMesh(null);
      node.setSkin(null);
    }
    for (const skin of lib.getRoot().listSkins()) skin.dispose();
    for (const mesh of lib.getRoot().listMeshes()) mesh.dispose();
    for (const tex of lib.getRoot().listTextures()) tex.dispose();
    await save(lib, join(OUT, 'characters/anims.glb'));
  }
  for (const anim of doc.getRoot().listAnimations()) dropAnimation(anim);
  await save(doc, join(OUT, `characters/${name}.glb`));
}

// Armas e cenário: .gltf -> .glb
for (const [sub, out] of [['adventurers/Assets/gltf', 'weapons'], ['hexagon', 'world']]) {
  for (const file of files(join(SRC, sub), '.gltf')) {
    const doc = await io.read(file);
    await save(doc, join(OUT, out, `${basename(file, '.gltf')}.glb`));
  }
}
console.log('modelos prontos em assets/models/');
