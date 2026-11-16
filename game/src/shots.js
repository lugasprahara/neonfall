// shots.js — deterministic demo poses for screenshots: ?shot=menu|action|
// levelup|boss, with &seed=N.
//
// Each pose reseeds the RNG, scripts a scene, and fast-forwards the real
// simulation in fixed steps so the frame the maker captures is genuine
// gameplay — the warden mid-fight, gems in flight, a boss mid-burst. The
// autopilot then keeps the scene alive (and the warden standing) until
// the screenshot is taken. Audio is never unlocked in a pose.

import { VIEW_HEIGHT, VIEW_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { Rng } from './random.js';
import {
  createPlayer, dropGem, spawnEnemy,
  updateEnemies, updateFx, updatePickups, updatePlayer, updateProjectiles,
} from './entities.js';
import { createWeapons, rollUpgrades, updateWeapons } from './weapons.js';
import { createStarfield } from './render.js';

const STEP = 1 / 60;

function resetRun(game) {
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
  game.kills = 0;
  game.bossesKilled = 0;
  game.time = 0;
  game.shake = 0;
  game.hitStop = 0;
  game.bossWarn = 0;
  game.autopilot = true;
  game.poseLock = true;
  game.state = 'playing';
}

function followCamera(game) {
  game.camera.x = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, game.player.x - VIEW_WIDTH / 2));
  game.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - VIEW_HEIGHT, game.player.y - VIEW_HEIGHT / 2));
}

// One fixed simulation step, mirroring the live loop's update order.
function stepSim(game, dt, spawnEvery) {
  game.time += dt;
  if (spawnEvery > 0 && Math.round(game.time / dt) % Math.round(spawnEvery / dt) === 0) {
    const angle = game.rng.range(0, Math.PI * 2);
    const dist = game.rng.range(320, 460);
    const x = Math.max(30, Math.min(WORLD_WIDTH - 30, game.player.x + Math.cos(angle) * dist));
    const y = Math.max(30, Math.min(WORLD_HEIGHT - 30, game.player.y + Math.sin(angle) * dist));
    spawnEnemy(game, game.rng.pick(['chaser', 'chaser', 'dart', 'splitter']), x, y);
  }
  game.player.invuln = 5; // poses rehearse; the warden does not fall
  updatePlayer(game, dt);
  updateWeapons(game, dt);
  updateEnemies(game, dt);
  updateProjectiles(game, dt);
  updatePickups(game, dt);
  updateFx(game, dt);
  for (const fx of game.novaFx) fx.life += dt;
  game.novaFx = game.novaFx.filter((fx) => fx.life < fx.maxLife);
  followCamera(game);
}

function runSim(game, seconds, spawnEvery) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) stepSim(game, STEP, spawnEvery);
  game.player.invuln = 0;
  game.player.hp = game.player.maxHp;
}

function scatterGems(game, count) {
  for (let i = 0; i < count; i++) {
    const angle = game.rng.range(0, Math.PI * 2);
    const dist = game.rng.range(60, 300);
    dropGem(game,
      Math.max(20, Math.min(WORLD_WIDTH - 20, game.player.x + Math.cos(angle) * dist)),
      Math.max(20, Math.min(WORLD_HEIGHT - 20, game.player.y + Math.sin(angle) * dist)),
      game.rng.pick([1, 1, 1, 3]));
  }
}

function poseMenu(game) {
  resetRun(game);
  game.state = 'menu';
  game.autopilot = false;
  game.weapons.blades.level = 2;
  game.player.x = WORLD_WIDTH / 2;
  game.player.y = WORLD_HEIGHT / 2 + 60;
  scatterGems(game, 16);
  followCamera(game);
}

function poseAction(game) {
  resetRun(game);
  game.weapons.blaster.projectiles = 2;
  game.weapons.blades.level = 2;
  game.weapons.lance.level = 1;
  game.enemyHpScale = 1.5;
  runSim(game, 11, 0.55);
  scatterGems(game, 10);
  // A scripted ring so the captured frame is mid-battle, not a lull.
  const ring = ['chaser', 'dart', 'splitter', 'chaser', 'brute', 'dart', 'chaser', 'splitter', 'chaser', 'dart'];
  ring.forEach((type, i) => {
    const a = (i / ring.length) * Math.PI * 2 + 0.35;
    const dist = 250 + (i % 3) * 60;
    spawnEnemy(game, type,
      Math.max(30, Math.min(WORLD_WIDTH - 30, game.player.x + Math.cos(a) * dist)),
      Math.max(30, Math.min(WORLD_HEIGHT - 30, game.player.y + Math.sin(a) * dist)));
  });
  runSim(game, 0.5, 0);
  game.level = 4;
  game.xp = 3;
  game.xpNext = 26;
  game.state = 'playing';
  game.kills = 148;
  game.time = 96;
}

function poseLevelup(game) {
  resetRun(game);
  game.level = 4;
  game.weapons.blades.level = 1;
  game.weapons.nova.level = 1;
  game.enemyHpScale = 1.4;
  runSim(game, 7, 0.8);
  game.level = 5;
  game.choices = rollUpgrades(game);
  game.state = 'levelup';
  game.kills = 121;
  game.time = 88;
}

function poseBoss(game) {
  resetRun(game);
  game.level = 6;
  game.xp = 2;
  game.weapons.blaster.projectiles = 3;
  game.weapons.blades.level = 3;
  game.weapons.lance.level = 2;
  game.weapons.nova.level = 1;
  game.enemyHpScale = 1.6;
  runSim(game, 5, 1.1);
  const boss = spawnEnemy(game, 'boss',
    game.player.x + 300, Math.max(80, game.player.y - 170));
  boss.hp = boss.maxHp * 0.62;
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    spawnEnemy(game, i % 2 ? 'dart' : 'chaser',
      game.player.x + Math.cos(angle) * 260, game.player.y + Math.sin(angle) * 200);
  }
  runSim(game, 2.6, 0);
  // Pin the boss in frame for the capture: up and right of the warden,
  // stalking (no dash), with a bullet ring about to leave it.
  boss.x = Math.min(WORLD_WIDTH - 70, game.player.x + 252);
  boss.y = Math.max(70, game.player.y - 132);
  boss.chargeState = 'stalk';
  boss.chargeTimer = 30;
  boss.burstTimer = 0.9;
  // Fresh escorts converging, and gems strewn close so the autopilot
  // warden fights here instead of wandering off after a distant gem.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    spawnEnemy(game, i % 2 ? 'chaser' : 'dart',
      Math.max(30, Math.min(WORLD_WIDTH - 30, game.player.x + Math.cos(a) * 340)),
      Math.max(30, Math.min(WORLD_HEIGHT - 30, game.player.y + Math.sin(a) * 280)));
  }
  scatterGems(game, 8);
  followCamera(game);
  game.state = 'playing';
  game.kills = 233;
  game.bossesKilled = 1;
  game.time = 187;
}

const POSES = { menu: poseMenu, action: poseAction, levelup: poseLevelup, boss: poseBoss };

export function setupShot(game, name, seed) {
  game.rng = new Rng(seed * 7919 + 101);
  game.starfield = createStarfield(game.rng);
  const pose = POSES[name] ?? POSES.menu;
  pose(game);
}
