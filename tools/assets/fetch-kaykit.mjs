// Baixa os modelos CC0 da KayKit (Kay Lousberg) usados pelo jogo para assets/vendor/kaykit/.
// Fonte: repositórios públicos github.com/KayKit-Game-Assets (licença CC0 1.0).
// Uso: node tools/assets/fetch-kaykit.mjs   (depois: node tools/assets/build-models.mjs)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = join(ROOT, 'assets/vendor/kaykit');
const RAW = 'https://raw.githubusercontent.com/KayKit-Game-Assets';

const PACKS = {
  adventurers: {
    repo: 'KayKit-Character-Pack-Adventures-1.0',
    base: 'addons/kaykit_character_pack_adventures',
    files: [
      ...['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'].map((n) => `Characters/gltf/${n}.glb`),
      ...['sword_1handed', 'sword_2handed', 'axe_1handed', 'axe_2handed', 'staff', 'wand', 'dagger', 'crossbow_2handed',
        'crossbow_1handed', 'shield_round', 'shield_square', 'spellbook_open', 'quiver', 'arrow'].map((n) => `Assets/gltf/${n}.gltf`),
    ],
  },
  hexagon: {
    repo: 'KayKit-Medieval-Hexagon-Pack-1.0',
    base: 'addons/kaykit_medieval_hexagon_pack/Assets/gltf',
    files: [
      ...['archeryrange', 'barracks', 'blacksmith', 'castle', 'church', 'home_A', 'home_B', 'lumbermill', 'market', 'mine',
        'tavern', 'tower_A', 'tower_B', 'tower_base', 'tower_catapult', 'well', 'windmill'].flatMap((n) => [
        `buildings/blue/building_${n}_blue.gltf`, `buildings/red/building_${n}_red.gltf`]),
      ...['destroyed', 'grain', 'scaffolding', 'stage_A', 'stage_B', 'stage_C', 'dirt'].map((n) => `buildings/neutral/building_${n}.gltf`),
      ...['tree_single_A', 'tree_single_B', 'trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large', 'rock_single_A',
        'rock_single_B', 'mountain_A', 'mountain_B', 'hill_single_A'].map((n) => `decoration/nature/${n}.gltf`),
      ...['barrel', 'crate_A_big', 'crate_B_small', 'flag_blue', 'flag_red', 'sack', 'resource_lumber', 'resource_stone', 'target',
        'tent', 'weaponrack', 'wheelbarrow'].map((n) => `decoration/props/${n}.gltf`),
    ],
  },
};

async function get(url) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 404) throw new Error(`404 ${url}`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`falha ao baixar ${url}`);
}

const done = new Set();
async function fetchFile(pack, rel) {
  const key = `${pack.repo}/${rel}`;
  if (done.has(key)) return;
  done.add(key);
  const dest = join(OUT, pack.name, rel);
  if (!existsSync(dest)) {
    const buf = await get(`${RAW}/${pack.repo}/main/${pack.base}/${rel}`);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
  }
  if (rel.endsWith('.gltf')) {
    const { readFileSync } = await import('node:fs');
    const json = JSON.parse(readFileSync(dest, 'utf8'));
    const uris = [...(json.buffers ?? []), ...(json.images ?? [])].map((x) => x.uri).filter((u) => u && !u.startsWith('data:'));
    for (const u of uris) await fetchFile(pack, join(dirname(rel), decodeURIComponent(u)));
  }
}

for (const [name, pack] of Object.entries(PACKS)) {
  pack.name = name;
  const results = await Promise.allSettled(pack.files.map((f) => fetchFile(pack, f)));
  results.filter((r) => r.status === 'rejected').forEach((r) => console.warn('  !', r.reason.message));
  console.log(`${name}: ${results.filter((r) => r.status === 'fulfilled').length}/${pack.files.length}`);
}
for (const pack of Object.values(PACKS)) {
  const lic = await get(`${RAW}/${pack.repo}/main/LICENSE.txt`).catch(() => null);
  if (lic) writeFileSync(join(OUT, pack.name, 'LICENSE.txt'), lic);
}
