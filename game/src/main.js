// main.js — NEONFALL's state machine and game loop.
//
// States: menu -> playing <-> levelup / paused -> gameover -> menu again.
// This file owns the shared `game` object every other module reads: the
// entity arrays, the camera, the spawn director's clocks, and the hooks
// (gainXp, onPlayerDeath, onBossKilled) that entities.js calls back into.

import {
  BOSS_PERIOD, ELITE_PERIOD, MAX_ALIVE, VIEW_HEIGHT, VIEW_WIDTH,
  WORLD_HEIGHT, WORLD_WIDTH, enemyHpScaleAt, spawnIntervalAt, spawnWeightsAt, xpForLevel,
} from './config.js';
import { Input } from './input.js';
import { SoundFX } from './audio.js';
import { Rng } from './random.js';
import {
  createPlayer, dropHeart, spawnEnemy, spawnPointNear,
  updateEnemies, updateFx, updatePickups, updatePlayer, updateProjectiles,
} from './entities.js';
import { applyUpgrade, createWeapons, rollUpgrades, updateWeapons } from './weapons.js';
import { createStarfield, drawGame, upgradeCardRects } from './render.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function storedBest() {
  try {
    return {
      time: Number(localStorage.getItem('neonfall.bestTime') ?? 0) || 0,
      level: Number(localStorage.getItem('neonfall.bestLevel') ?? 0) || 0,
    };
  } catch {
    return { time: 0, level: 0 };
  }
}

function saveBest(game) {
  try {
    if (game.time > game.bestTime) localStorage.setItem('neonfall.bestTime', String(Math.floor(game.time)));
    if (game.level > game.bestLevel) localStorage.setItem('neonfall.bestLevel', String(game.level));
  } catch {
    // Storage is a nicety, never a requirement.
  }
}

const best = storedBest();

const game = {
  state: 'menu',
  time: 0,
  menuTime: 0,
  rng: new Rng((Date.now() % 2147483647) + 1),
  input: null,
  sound: new SoundFX(),
  player: createPlayer(),
  weapons: createWeapons(),
  enemies: [],
  bullets: [],
  enemyBullets: [],
  gems: [],
  particles: [],
  texts: [],
  novaFx: [],
  camera: { x: WORLD_WIDTH / 2 - VIEW_WIDTH / 2, y: WORLD_HEIGHT / 2 - VIEW_HEIGHT / 2, w: VIEW_WIDTH, h: VIEW_HEIGHT },
  starfield: [],
  level: 1,
  xp: 0,
  xpNext: xpForLevel(1),
  kills: 0,
  bossesKilled: 0,
  pickupCombo: 0,
  enemyHpScale: 1,
  spawnTimer: 0.6,
  eliteTimer: ELITE_PERIOD,
  bossTimer: BOSS_PERIOD,
  bossWarn: 0,
  shake: 0,
  hitStop: 0,
  choices: [],
  autopilot: false,
  bestTime: best.time,
  bestLevel: best.level,

  gainXp(amount) {
    this.xp += amount;
    // Screenshot poses lock level-ups out: the demo must not be interrupted.
    if (!this.poseLock && this.xp >= this.xpNext && this.state === 'playing') this.enterLevelUp();
  },

  enterLevelUp() {
    this.xp -= this.xpNext;
    this.level += 1;
    this.xpNext = xpForLevel(this.level);
    this.choices = rollUpgrades(this);
    this.state = 'levelup';
    this.sound.levelUp();
  },

  onPlayerDeath() {
    this.state = 'gameover';
    this.menuTime = 0;
    this.sound.gameOver();
    this.sound.stopMusic();
    saveBest(this);
    if (this.time > this.bestTime) this.bestTime = Math.floor(this.time);
    if (this.level > this.bestLevel) this.bestLevel = this.level;
  },

  onBossKilled(enemy) {
    this.bossesKilled += 1;
    this.sound.bossDie();
    dropHeart(this, enemy.x, enemy.y);
  },

  autopilotMove() {
    // Screenshot-pose driver: drift toward gems, shy away from crowds.
    const player = this.player;
    let x = 0;
    let y = 0;
    let nearestGem = null;
    let gemD2 = Infinity;
    for (const gem of this.gems) {
      const dx = gem.x - player.x;
      const dy = gem.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < gemD2) { gemD2 = d2; nearestGem = gem; }
    }
    if (nearestGem) {
      // Seek, but capped: a distant gem must not drag the demo warden
      // clear across the arena and out of its staged scene.
      const gx = (nearestGem.x - player.x) * 0.012;
      const gy = (nearestGem.y - player.y) * 0.012;
      const gl = Math.hypot(gx, gy);
      const cap = gl > 0.85 ? 0.85 / gl : 1;
      x += gx * cap;
      y += gy * cap;
    }
    for (const enemy of this.enemies) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 150 * 150 && d2 > 1) {
        const d = Math.sqrt(d2);
        x += (dx / d) * (1 - d / 150) * 1.6;
        y += (dy / d) * (1 - d / 150) * 1.6;
      }
    }
    x += Math.cos(this.time * 0.35) * 0.25;
    y += Math.sin(this.time * 0.5) * 0.25;
    const len = Math.hypot(x, y);
    if (len < 0.05) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  },
};

game.starfield = createStarfield(game.rng);
game.input = new Input(canvas);

// ------------------------------------------------------------- run control

function startRun() {
  game.player = createPlayer();
  game.weapons = createWeapons();
  game.enemies = [];
  game.bullets = [];
  game.enemyBullets = [];
  game.gems = [];
  game.particles = [];
  game.texts = [];
  game.novaFx = [];
  game.level = 1;
  game.xp = 0;
  game.xpNext = xpForLevel(1);
  game.kills = 0;
  game.bossesKilled = 0;
  game.pickupCombo = 0;
  game.time = 0;
  game.spawnTimer = 0.8;
  game.eliteTimer = ELITE_PERIOD;
  game.bossTimer = BOSS_PERIOD;
  game.bossWarn = 0;
  game.shake = 0;
  game.hitStop = 0;
  game.enemyHpScale = 1;
  game.state = 'playing';
  game.sound.unlock();
  game.sound.startMusic();
}

function chooseUpgrade(index) {
  const choice = game.choices[index];
  if (!choice) return;
  applyUpgrade(game, choice);
  game.choices = [];
  if (game.xp >= game.xpNext) {
    game.enterLevelUp();
  } else {
    game.state = 'playing';
  }
}

game.input.onAction = (action) => {
  if (action === 'mute') {
    game.sound.unlock();
    game.sound.setMuted(!game.sound.muted);
    return;
  }
  if (game.state === 'menu') {
    if (action === 'confirm' || action === 'click') startRun();
    return;
  }
  if (game.state === 'gameover') {
    if (action === 'restart' || action === 'confirm' || action === 'click') startRun();
    return;
  }
  if (game.state === 'levelup') {
    if (action === 'pick1') chooseUpgrade(0);
    if (action === 'pick2') chooseUpgrade(1);
    if (action === 'pick3') chooseUpgrade(2);
    if (action === 'click') {
      const rects = upgradeCardRects();
      const { x, y } = game.input.mouse;
      rects.forEach((r, i) => {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) chooseUpgrade(i);
      });
    }
    return;
  }
  if (action === 'pause') {
    if (game.state === 'playing') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'playing';
  }
  if (action === 'restart' && game.state === 'paused') startRun();
};

// ------------------------------------------------------------- director

function director(dt) {
  game.enemyHpScale = enemyHpScaleAt(game.time);

  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0 && game.enemies.length < MAX_ALIVE) {
    game.spawnTimer = spawnIntervalAt(game.time);
    const weights = spawnWeightsAt(game.time);
    const table = [];
    for (const [type, w] of Object.entries(weights)) {
      for (let i = 0; i < w; i++) table.push(type);
    }
    const batch = 1 + Math.floor(game.time / 55);
    for (let i = 0; i < batch; i++) {
      const at = spawnPointNear(game);
      spawnEnemy(game, game.rng.pick(table), at.x, at.y);
    }
  }

  game.eliteTimer -= dt;
  if (game.eliteTimer <= 0) {
    game.eliteTimer = ELITE_PERIOD;
    const at = spawnPointNear(game);
    spawnEnemy(game, 'elite', at.x, at.y);
  }

  game.bossTimer -= dt;
  if (game.bossTimer <= 0) {
    game.bossTimer = BOSS_PERIOD;
    game.bossWarn = 2.4;
    game.sound.bossWarn();
    const angle = game.rng.range(0, Math.PI * 2);
    const bx = Math.max(70, Math.min(WORLD_WIDTH - 70, game.player.x + Math.cos(angle) * 540));
    const by = Math.max(70, Math.min(WORLD_HEIGHT - 70, game.player.y + Math.sin(angle) * 540));
    spawnEnemy(game, 'boss', bx, by);
  }
  if (game.bossWarn > 0) game.bossWarn -= dt;
}

// ------------------------------------------------------------- frame

function updatePlaying(dt) {
  game.time += dt;
  director(dt);
  updatePlayer(game, dt);
  updateWeapons(game, dt);
  updateEnemies(game, dt);
  updateProjectiles(game, dt);
  updatePickups(game, dt);
  updateFx(game, dt);
  for (const fx of game.novaFx) fx.life += dt;
  game.novaFx = game.novaFx.filter((fx) => fx.life < fx.maxLife);

  // Camera follows the warden, clamped to the arena.
  const cam = game.camera;
  cam.x = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, game.player.x - VIEW_WIDTH / 2));
  cam.y = Math.max(0, Math.min(WORLD_HEIGHT - VIEW_HEIGHT, game.player.y - VIEW_HEIGHT / 2));
  game.shake = Math.max(0, game.shake - dt * 34);
}

let lastStamp = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.033, (now - lastStamp) / 1000);
  lastStamp = now;
  if (dt <= 0) return;

  if (game.hitStop > 0) {
    game.hitStop -= dt;
    dt = 0;
  }

  if (dt > 0) {
    if (game.state === 'playing') {
      updatePlaying(dt);
    } else if (game.state === 'menu' || game.state === 'gameover') {
      game.menuTime += dt;
      game.weapons.blades.angle += dt * 1.4;
      updateFx(game, dt);
      if (game.state === 'menu') {
        // A slow drift over the arena behind the title.
        game.camera.x = WORLD_WIDTH / 2 - VIEW_WIDTH / 2 + Math.cos(game.menuTime * 0.11) * 180;
        game.camera.y = WORLD_HEIGHT / 2 - VIEW_HEIGHT / 2 + Math.sin(game.menuTime * 0.09) * 120;
      }
    }
  }

  drawGame(ctx, game);
  game.input.endFrame();
}
requestAnimationFrame(frame);

// ------------------------------------------------------------- boot / poses

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  const seed = Number(params.get('seed') ?? 1) || 1;
  setupShot(game, shotName, seed);
}

window.__game = {
  game,
  startRun,
  version: '1.0.0',
};
