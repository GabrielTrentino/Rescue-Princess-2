// Lista dos modelos 3D carregados pelo jogo (arquivos em assets/models/). Sem dependências,
// para que os testes possam conferir se todos os arquivos existem.
export const CHARACTER_MODELS = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'];
export const WEAPON_MODELS = ['sword_1handed', 'shield_round', 'axe_2handed', 'staff', 'crossbow_2handed', 'dagger', 'arrow'];
export const WORLD_MODELS = [
  ...['castle', 'barracks', 'lumbermill', 'tower_B', 'archeryrange', 'tavern', 'blacksmith', 'mine', 'market', 'tower_A', 'tower_catapult', 'home_A', 'home_B', 'well', 'windmill']
    .flatMap((n) => [`building_${n}_blue`, `building_${n}_red`]),
  'building_destroyed', 'building_scaffolding', 'building_stage_A',
  'tree_single_A', 'tree_single_B', 'trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large',
  'rock_single_A', 'rock_single_B', 'mountain_A', 'mountain_B', 'hill_single_A',
  'barrel', 'crate_A_big', 'crate_B_small', 'flag_blue', 'flag_red', 'sack', 'resource_lumber', 'resource_stone', 'target', 'tent', 'weaponrack', 'wheelbarrow',
];
