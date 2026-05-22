const SKILLS = [
  {
    id: 'power_strike',
    name: 'Power Strike',
    description: 'A strong attack that can deal extra damage.',
    power: 14,
    cooldown: 3,
    effect: { type: 'damage' },
  },
  {
    id: 'flame_surge',
    name: 'Flame Surge',
    description: 'A fiery blow that burns the enemy.',
    power: 8,
    cooldown: 4,
    effect: { type: 'damage', status: { type: 'burn', strength: 3, duration: 3 } },
  },
  {
    id: 'guard_shout',
    name: 'Guard Shout',
    description: 'Boost defense for one turn.',
    power: 0,
    cooldown: 4,
    effect: { type: 'defend' },
  },
];
