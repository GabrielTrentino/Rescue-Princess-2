// Aparência 3D de cada classe: modelo, peças visíveis (além do corpo), arma extra e animações.
export const CLASS_LOOKS = {
  villager: {
    model: 'Rogue', show: [], idle: 'Unarmed_Idle', run: 'Running_A',
    attack: ['Unarmed_Melee_Attack_Punch_A'], ability: ['Throw', 'Running_B'],
  },
  warrior: {
    model: 'Knight', show: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', 'Round_Shield'], cape: 'Knight_Cape',
    idle: 'Idle', run: 'Running_A',
    attack: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop'], ability: ['1H_Melee_Attack_Slice_Horizontal', 'Dodge_Forward', 'Block', 'Cheer', 'Block'],
  },
  barbarian: {
    model: 'Barbarian', show: ['Barbarian_Hat', 'Barbarian_Cape', '2H_Axe'], cape: 'Barbarian_Cape',
    idle: '2H_Melee_Idle', run: 'Running_A',
    attack: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'], ability: ['Cheer', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Slice', 'Cheer'],
  },
  mage: {
    model: 'Mage', show: ['Mage_Hat', 'Mage_Cape', '2H_Staff'], cape: 'Mage_Cape',
    idle: 'Idle', run: 'Running_A',
    attack: ['Spellcast_Shoot'], ability: ['Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Shoot', 'Spellcast_Long', 'Spellcast_Long'],
  },
  archer: {
    model: 'Rogue', show: ['Rogue_Cape', '2H_Crossbow'], cape: 'Rogue_Cape',
    idle: 'Idle', run: 'Running_A',
    attack: ['2H_Ranged_Shoot'], ability: ['2H_Ranged_Shoot', 'Spellcast_Raise', '2H_Ranged_Shoot', '2H_Ranged_Shoot', '2H_Ranged_Shoot'],
  },
  mercenary: {
    model: 'Rogue_Hooded', show: ['Rogue_Cape', 'Knife', 'Knife_Offhand'], cape: 'Rogue_Cape',
    idle: 'Idle', run: 'Running_B',
    attack: ['Dualwield_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Slice'], ability: ['Dualwield_Melee_Attack_Slice', 'Dodge_Forward', 'Dualwield_Melee_Attack_Chop', 'Throw', 'Dualwield_Melee_Attack_Stab'],
  },
  halberdier: {
    model: 'Knight', show: ['Knight_Helmet', 'Knight_Cape'], cape: 'Knight_Cape', extra: 'halberd',
    idle: '2H_Melee_Idle', run: 'Running_A',
    attack: ['2H_Melee_Attack_Stab'], ability: ['2H_Melee_Attack_Stab', '2H_Melee_Attack_Slice', 'Throw', 'Block', '2H_Melee_Attack_Spin'],
  },
  engineer: {
    model: 'Barbarian', show: ['Barbarian_Cape'], cape: 'Barbarian_Cape', extra: 'blunderbuss',
    idle: '2H_Ranged_Aiming', run: 'Running_A',
    attack: ['2H_Ranged_Shoot'], ability: ['2H_Ranged_Shoot', 'Use_Item', 'Use_Item', 'Interact', 'Interact'],
  },
};

