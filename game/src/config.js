// VOIDSTORM configuration: the arena, the pilot, the hostiles and the arsenal.
// Every number the game runs on lives here, so tuning a run never means hunting through logic.

/** The arena, in world units. The canvas letterboxes this field into any desktop window. */
export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step (seconds). The world advances in these slices and nothing else. */
export const STEP = 1 / 120;

export const PLAYER = {
  radius: 14,
  speed: 265,
  accel: 2400,
  friction: 6.5,
  maxHp: 100,
  contactInvulnSeconds: 0.55,
  fireCooldownStart: 0.24,
  bulletSpeed: 640,
  bulletDamageStart: 12,
  bulletRadius: 4,
  bulletLifeSeconds: 0.95,
  magnetStart: 74,
  gemHealEvery: 0, // set by the Nanobots upgrade
};

export const GEM = {
  radius: 6,
  valueSmall: 1,
  valueLarge: 5,
  magnetSpeed: 520,
  bobSeconds: 0.9,
};

/** XP needed to go from `level` to `level + 1` grows a little steeper each time. */
export function xpForLevel(level) {
  return Math.round(6 + (level - 1) * 4.5 + Math.pow(level - 1, 1.62));
}

export const ENEMY_KINDS = {
  drifter: {
    name: 'Drifter',
    radius: 15,
    hp: 22,
    speed: 96,
    damage: 12,
    score: 25,
    xp: 1,
    color: '#ff4d8d',
    colorDim: '#8f2350',
  },
  weaver: {
    name: 'Weaver',
    radius: 13,
    hp: 16,
    speed: 128,
    damage: 10,
    score: 35,
    xp: 1,
    color: '#ffb02e',
    colorDim: '#8f5f10',
    weaveAmplitude: 120,
    weaveFrequency: 2.6,
  },
  spitter: {
    name: 'Spitter',
    radius: 14,
    hp: 26,
    speed: 74,
    damage: 9,
    score: 45,
    xp: 2,
    color: '#51e07a',
    colorDim: '#1f6b36',
    keepDistance: 300,
    shotCooldown: 2.1,
    boltSpeed: 265,
    boltDamage: 11,
  },
  splitter: {
    name: 'Splitter',
    radius: 24,
    hp: 52,
    speed: 56,
    damage: 14,
    score: 60,
    xp: 3,
    color: '#b46bff',
    colorDim: '#54248f',
    children: 3,
  },
  mite: {
    name: 'Mite',
    radius: 9,
    hp: 9,
    speed: 168,
    damage: 7,
    score: 15,
    xp: 1,
    color: '#e08fff',
    colorDim: '#6e2a8f',
  },
  boss: {
    name: 'The Hollow Star',
    radius: 46,
    hp: 1150,
    speed: 42,
    damage: 22,
    score: 1500,
    xp: 24,
    color: '#ff3860',
    colorDim: '#7a1030',
    shotCooldown: 1.55,
    boltSpeed: 235,
    boltDamage: 13,
    radialShots: 14,
  },
};

/** Wave `n` fields this many hostiles; every fifth wave is a boss wave. */
export function waveSize(wave) {
  return Math.min(6 + wave * 3, 46);
}

/** Hit points scale so a levelled arsenal stays challenged without becoming a wall. */
export function waveHpScale(wave) {
  return 1 + (wave - 1) * 0.16 + Math.pow(Math.max(0, wave - 6), 1.35) * 0.05;
}

export function isBossWave(wave) {
  return wave % 5 === 0;
}

/** The upgrade deck. `apply` mutates the pilot's stats; `blurb` is what the card promises. */
export const UPGRADES = [
  {
    id: 'damage',
    name: 'Heavy Rounds',
    icon: 'DMG',
    blurb: '+22% bullet damage',
    apply: (p) => { p.damage *= 1.22; },
  },
  {
    id: 'firerate',
    name: 'Overclocked Cycler',
    icon: 'RPM',
    blurb: '+16% fire rate',
    apply: (p) => { p.fireInterval *= 0.86; },
  },
  {
    id: 'multishot',
    name: 'Split Cannon',
    icon: 'SPL',
    blurb: '+1 projectile per shot',
    apply: (p) => { p.projectiles += 1; },
  },
  {
    id: 'speed',
    name: 'Ion Thrusters',
    icon: 'SPD',
    blurb: '+9% move speed, snappier handling',
    apply: (p) => { p.speed *= 1.09; p.accel *= 1.12; },
  },
  {
    id: 'hull',
    name: 'Plated Hull',
    icon: 'HUL',
    blurb: '+25 max hull and repair 25 now',
    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); },
  },
  {
    id: 'magnet',
    name: 'Tractor Array',
    icon: 'MAG',
    blurb: '+55% salvage magnet range',
    apply: (p) => { p.magnet *= 1.55; },
  },
  {
    id: 'pierce',
    name: 'Lance Rounds',
    icon: 'PIR',
    blurb: 'Shots pierce +1 hostile',
    apply: (p) => { p.pierce += 1; },
  },
  {
    id: 'nanobots',
    name: 'Repair Nanobots',
    icon: 'NAN',
    blurb: 'Regenerate 0.8 hull per second',
    apply: (p) => { p.regen += 0.8; },
  },
  {
    id: 'velocity',
    name: 'Rail Driver',
    icon: 'RAL',
    blurb: '+18% bullet speed and range',
    apply: (p) => { p.bulletSpeed *= 1.18; p.bulletLife *= 1.12; },
  },
  {
    id: 'shield',
    name: 'Aegis Cell',
    icon: 'AEG',
    blurb: 'A shield that eats one hit, recharging every 14 s',
    apply: (p) => { p.shieldMax = Math.max(p.shieldMax, 1); p.shield = p.shieldMax; p.shieldRecharge = Math.min(p.shieldRecharge || 14, 14); },
  },
];

export const COLORS = {
  ink: '#05070f',
  panel: 'rgba(10, 16, 34, 0.82)',
  line: '#2b3f6e',
  text: '#dfe9ff',
  textDim: '#8fa5cc',
  accent: '#39d5ff',
  accentWarm: '#ffd166',
  good: '#51e07a',
  bad: '#ff3860',
  xp: '#39d5ff',
  hp: '#ff5d7a',
};
