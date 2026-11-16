// config.js — NEONFALL's tuning constants and synthwave palette.
//
// Everything balance-shaped lives here: the arena, the player's base
// stats, the enemy roster and the difficulty ramp. The rest of the game
// reads these numbers and never hard-codes its own.

export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;

export const WORLD_WIDTH = 2200;
export const WORLD_HEIGHT = 1650;

export const PALETTE = {
  void: '#070313',
  voidDeep: '#04020a',
  grid: 'rgba(64, 224, 255, 0.07)',
  gridMajor: 'rgba(255, 47, 214, 0.10)',
  wall: '#ff2fd6',
  player: '#40e0ff',
  playerCore: '#eafcff',
  xp: '#3dff8e',
  hp: '#ff3d71',
  hpBack: 'rgba(255, 61, 113, 0.25)',
  amber: '#ffb020',
  text: '#d9f6ff',
  textDim: '#7d8fb3',
  panel: 'rgba(10, 6, 32, 0.88)',
  panelEdge: '#40e0ff',
};

export const PLAYER_BASE = {
  radius: 13,
  maxHp: 100,
  speed: 232,
  magnet: 74,
  regen: 0,
  damageMul: 1,
  fireRateMul: 1,
};

// Enemy roster. `score` is XP value carried by the gem the enemy drops.
// hp/speed/damage are base values; the director scales hp with elapsed time.
export const ENEMY_TYPES = {
  chaser: {
    radius: 15, hp: 22, speed: 96, damage: 10, xp: 1,
    color: '#ff2fd6', shape: 'diamond', knockResist: 0.1,
  },
  dart: {
    radius: 10, hp: 10, speed: 196, damage: 7, xp: 1,
    color: '#ffb020', shape: 'dart', knockResist: 0,
  },
  brute: {
    radius: 30, hp: 150, speed: 52, damage: 20, xp: 3,
    color: '#ff3d5e', shape: 'hex', knockResist: 0.65,
  },
  splitter: {
    radius: 19, hp: 40, speed: 74, damage: 12, xp: 2,
    color: '#b26bff', shape: 'tri', knockResist: 0.25, splits: 3,
  },
  elite: {
    radius: 24, hp: 320, speed: 84, damage: 16, xp: 10,
    color: '#ffe93d', shape: 'diamond', knockResist: 0.5,
  },
  boss: {
    radius: 58, hp: 2600, speed: 46, damage: 26, xp: 0,
    color: '#ff3860', shape: 'boss', knockResist: 0.9,
  },
};

// Difficulty ramp: spawn interval shrinks and enemy hp grows with time.
export function spawnIntervalAt(t) {
  return Math.max(0.32, 1.15 - t * 0.011);
}

export function enemyHpScaleAt(t) {
  return 1 + t / 75;
}

// Which enemy types may spawn at time t, with relative weights.
export function spawnWeightsAt(t) {
  const weights = { chaser: 10, dart: 0, splitter: 0, brute: 0 };
  if (t > 25) weights.dart = 5;
  if (t > 55) weights.splitter = 4;
  if (t > 95) weights.brute = 3;
  if (t > 150) weights.dart = 7;
  return weights;
}

export const BOSS_PERIOD = 90; // seconds between boss arrivals
export const ELITE_PERIOD = 37; // seconds between elite arrivals
export const MAX_ALIVE = 230; // soft cap so the frame rate holds

// XP needed to go from `level` to `level + 1`.
export function xpForLevel(level) {
  return 6 + (level - 1) * 5;
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
