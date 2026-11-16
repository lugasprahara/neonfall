// entities.js — NEONFALL's living things: the warden (player), the enemy
// roster, projectiles, XP gems, particles and floating combat text.
//
// Each factory builds a plain object; each update function advances one
// family for a frame. The shared `game` object (owned by main.js) carries
// the arrays, the RNG and the sound board, and provides the hooks
// onPlayerDeath / onBossKilled that the state machine fills in.

import {
  ENEMY_TYPES, PLAYER_BASE, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';

// ---------------------------------------------------------------- player

export function createPlayer() {
  return {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER_BASE.radius,
    hp: PLAYER_BASE.maxHp,
    maxHp: PLAYER_BASE.maxHp,
    speed: PLAYER_BASE.speed,
    magnet: PLAYER_BASE.magnet,
    regen: PLAYER_BASE.regen,
    damageMul: PLAYER_BASE.damageMul,
    fireRateMul: PLAYER_BASE.fireRateMul,
    invuln: 0,
    face: 1,
    walkCycle: 0,
  };
}

export function damagePlayer(game, amount) {
  const player = game.player;
  if (player.invuln > 0 || game.state !== 'playing') return;
  player.hp -= amount;
  player.invuln = 0.38;
  game.shake = Math.min(14, game.shake + 7);
  game.sound.hurt();
  burstParticles(game, player.x, player.y, { count: 10, color: '#ff3d71', speed: 190, size: 3 });
  if (player.hp <= 0) {
    player.hp = 0;
    game.onPlayerDeath();
  }
}

// ---------------------------------------------------------------- enemies

let nextEnemyId = 1;

export function spawnEnemy(game, type, x, y) {
  const def = ENEMY_TYPES[type];
  const hpScale = type === 'boss' ? 1 : game.enemyHpScale;
  const enemy = {
    id: nextEnemyId++,
    type,
    def,
    x, y,
    vx: 0, vy: 0,
    radius: def.radius,
    hp: def.hp * hpScale,
    maxHp: def.hp * hpScale,
    speed: def.speed * game.rng.range(0.88, 1.12),
    damage: def.damage,
    flash: 0,
    wobble: game.rng.range(0, Math.PI * 2),
    orbitCooldown: new Map(),
    // Boss state machine timers.
    burstTimer: 2.2,
    chargeTimer: 4.2,
    chargeState: 'stalk', // stalk | telegraph | dash
    chargeTime: 0,
    chargeDir: { x: 0, y: 0 },
    dead: false,
  };
  game.enemies.push(enemy);
  return enemy;
}

// A spawn point just outside the camera view, clamped inside the world.
export function spawnPointNear(game) {
  const cam = game.camera;
  const side = game.rng.int(0, 3);
  const margin = 46;
  let x;
  let y;
  if (side === 0) { x = game.rng.range(cam.x - margin, cam.x + cam.w + margin); y = cam.y - margin; }
  if (side === 1) { x = game.rng.range(cam.x - margin, cam.x + cam.w + margin); y = cam.y + cam.h + margin; }
  if (side === 2) { x = cam.x - margin; y = game.rng.range(cam.y - margin, cam.y + cam.h + margin); }
  if (side === 3) { x = cam.x + cam.w + margin; y = game.rng.range(cam.y - margin, cam.y + cam.h + margin); }
  return {
    x: Math.max(24, Math.min(WORLD_WIDTH - 24, x)),
    y: Math.max(24, Math.min(WORLD_HEIGHT - 24, y)),
  };
}

export function damageEnemy(game, enemy, amount, kx, ky) {
  if (enemy.dead) return;
  enemy.hp -= amount;
  enemy.flash = 0.09;
  const resist = enemy.def.knockResist;
  enemy.vx += kx * (1 - resist);
  enemy.vy += ky * (1 - resist);
  spawnText(game, enemy.x + game.rng.range(-6, 6), enemy.y - enemy.radius - 4,
    String(Math.round(amount)), amount >= 40 ? '#ffe93d' : '#d9f6ff', amount >= 40 ? 17 : 13);
  game.sound.hit();
  if (enemy.hp <= 0) killEnemy(game, enemy);
}

export function killEnemy(game, enemy) {
  enemy.dead = true;
  game.kills += 1;
  const big = enemy.type === 'brute' || enemy.type === 'elite' || enemy.type === 'boss';
  burstParticles(game, enemy.x, enemy.y, {
    count: big ? 30 : 13,
    color: enemy.def.color,
    speed: big ? 300 : 210,
    size: big ? 4 : 3,
  });
  game.sound.enemyDie();

  if (enemy.type === 'splitter') {
    for (let i = 0; i < enemy.def.splits; i++) {
      const dir = game.rng.direction();
      const child = spawnEnemy(game, 'dart', enemy.x + dir.x * 14, enemy.y + dir.y * 14);
      child.vx = dir.x * 240;
      child.vy = dir.y * 240;
    }
  }

  if (enemy.type === 'boss') {
    game.hitStop = Math.max(game.hitStop, 0.12);
    game.shake = Math.min(20, game.shake + 12);
    for (let i = 0; i < 14; i++) {
      const dir = game.rng.direction();
      dropGem(game, enemy.x + dir.x * 40, enemy.y + dir.y * 40, 3);
    }
    game.onBossKilled(enemy);
  } else {
    dropGem(game, enemy.x, enemy.y, enemy.def.xp);
    if (big) game.hitStop = Math.max(game.hitStop, 0.045);
  }
}

// ---------------------------------------------------------------- pickups

export function dropGem(game, x, y, value) {
  game.gems.push({
    x, y,
    vx: game.rng.range(-30, 30),
    vy: game.rng.range(-30, 30),
    value,
    radius: value >= 10 ? 8 : value >= 3 ? 6.5 : 5,
    pulse: game.rng.range(0, Math.PI * 2),
    magnetized: false,
  });
}

export function dropHeart(game, x, y) {
  game.gems.push({
    x, y, vx: 0, vy: 0, value: 0, heart: true, radius: 9,
    pulse: 0, magnetized: false,
  });
}

// ---------------------------------------------------------------- fx

export function burstParticles(game, x, y, { count, color, speed, size }) {
  for (let i = 0; i < count; i++) {
    const dir = game.rng.direction();
    const v = speed * game.rng.range(0.25, 1);
    game.particles.push({
      x, y,
      vx: dir.x * v,
      vy: dir.y * v,
      life: 0,
      maxLife: game.rng.range(0.25, 0.6),
      size: size * game.rng.range(0.6, 1.4),
      color,
    });
  }
}

export function spawnText(game, x, y, str, color, size = 13) {
  if (game.texts.length > 60) game.texts.shift();
  game.texts.push({ x, y, str, color, size, life: 0, maxLife: 0.7 });
}

// ---------------------------------------------------------------- updates

export function updatePlayer(game, dt) {
  const player = game.player;
  const move = game.autopilot ? game.autopilotMove() : game.input.moveVector();
  player.vx = move.x * player.speed;
  player.vy = move.y * player.speed;
  player.x = Math.max(player.radius, Math.min(WORLD_WIDTH - player.radius, player.x + player.vx * dt));
  player.y = Math.max(player.radius, Math.min(WORLD_HEIGHT - player.radius, player.y + player.vy * dt));
  if (move.x !== 0) player.face = Math.sign(move.x);
  player.walkCycle += dt * (move.x !== 0 || move.y !== 0 ? 10 : 2);
  if (player.invuln > 0) player.invuln -= dt;
  if (player.regen > 0) player.hp = Math.min(player.maxHp, player.hp + player.regen * dt);
}

function updateBoss(game, enemy, dt, toPlayer) {
  enemy.burstTimer -= dt;
  enemy.chargeTimer -= dt;
  if (enemy.chargeState === 'stalk') {
    enemy.x += toPlayer.x * enemy.speed * dt;
    enemy.y += toPlayer.y * enemy.speed * dt;
    if (enemy.burstTimer <= 0) {
      enemy.burstTimer = 2.6;
      const base = game.rng.range(0, Math.PI * 2);
      for (let i = 0; i < 16; i++) {
        const a = base + (i / 16) * Math.PI * 2;
        game.enemyBullets.push({
          x: enemy.x, y: enemy.y,
          vx: Math.cos(a) * 168, vy: Math.sin(a) * 168,
          radius: 6, damage: 12, life: 3.4,
        });
      }
      game.sound.lance();
    }
    if (enemy.chargeTimer <= 0) {
      enemy.chargeState = 'telegraph';
      enemy.chargeTime = 0.6;
      enemy.chargeDir = { ...toPlayer };
    }
  } else if (enemy.chargeState === 'telegraph') {
    enemy.chargeTime -= dt;
    if (enemy.chargeTime <= 0) {
      enemy.chargeState = 'dash';
      enemy.chargeTime = 0.55;
    }
  } else if (enemy.chargeState === 'dash') {
    enemy.x += enemy.chargeDir.x * 430 * dt;
    enemy.y += enemy.chargeDir.y * 430 * dt;
    enemy.chargeTime -= dt;
    if (enemy.chargeTime <= 0) {
      enemy.chargeState = 'stalk';
      enemy.chargeTimer = 4.4;
    }
  }
}

export function updateEnemies(game, dt) {
  const player = game.player;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toPlayer = { x: dx / dist, y: dy / dist };

    if (enemy.type === 'boss') {
      updateBoss(game, enemy, dt, toPlayer);
    } else {
      // Steering: home in, with a slight per-enemy wobble so packs swirl.
      enemy.wobble += dt * 2.2;
      const wob = Math.sin(enemy.wobble) * 0.25;
      const cos = Math.cos(wob);
      const sin = Math.sin(wob);
      const sx = toPlayer.x * cos - toPlayer.y * sin;
      const sy = toPlayer.x * sin + toPlayer.y * cos;
      enemy.x += (sx * enemy.speed + enemy.vx) * dt;
      enemy.y += (sy * enemy.speed + enemy.vy) * dt;
    }
    enemy.vx *= Math.pow(0.0015, dt); // knockback decays fast
    enemy.vy *= Math.pow(0.0015, dt);
    if (enemy.flash > 0) enemy.flash -= dt;
    enemy.x = Math.max(enemy.radius, Math.min(WORLD_WIDTH - enemy.radius, enemy.x));
    enemy.y = Math.max(enemy.radius, Math.min(WORLD_HEIGHT - enemy.radius, enemy.y));

    // Contact damage.
    if (dist < enemy.radius + player.radius) damagePlayer(game, enemy.damage);
  }

  // Light separation so packs do not stack into a single blob.
  const list = game.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.5 * dt * 30;
        a.x -= dx * push * 0.5;
        a.y -= dy * push * 0.5;
        b.x += dx * push * 0.5;
        b.y += dy * push * 0.5;
      }
    }
  }

  game.enemies = list.filter((e) => !e.dead);
}

export function updateProjectiles(game, dt) {
  // Player projectiles.
  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || bullet.x < 0 || bullet.x > WORLD_WIDTH || bullet.y < 0 || bullet.y > WORLD_HEIGHT) {
      bullet.dead = true;
      continue;
    }
    for (const enemy of game.enemies) {
      if (enemy.dead || bullet.hitIds.has(enemy.id)) continue;
      const dx = enemy.x - bullet.x;
      const dy = enemy.y - bullet.y;
      const rr = enemy.radius + bullet.radius;
      if (dx * dx + dy * dy < rr * rr) {
        bullet.hitIds.add(enemy.id);
        damageEnemy(game, enemy, bullet.damage,
          (bullet.vx / bullet.speed) * bullet.knock, (bullet.vy / bullet.speed) * bullet.knock);
        burstParticles(game, bullet.x, bullet.y, { count: 3, color: bullet.color, speed: 120, size: 2 });
        if (bullet.pierce > 0) {
          bullet.pierce -= 1;
        } else {
          bullet.dead = true;
        }
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);

  // Enemy projectiles (boss rings).
  for (const shot of game.enemyBullets) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    if (shot.life <= 0) {
      shot.dead = true;
      continue;
    }
    const player = game.player;
    const dx = player.x - shot.x;
    const dy = player.y - shot.y;
    const rr = player.radius + shot.radius;
    if (dx * dx + dy * dy < rr * rr) {
      shot.dead = true;
      damagePlayer(game, shot.damage);
    }
  }
  game.enemyBullets = game.enemyBullets.filter((s) => !s.dead);
}

export function updatePickups(game, dt) {
  const player = game.player;
  game.pickupCombo = Math.max(0, game.pickupCombo - dt * 2);
  for (const gem of game.gems) {
    gem.pulse += dt * 5;
    const dx = player.x - gem.x;
    const dy = player.y - gem.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < player.magnet) gem.magnetized = true;
    if (gem.magnetized) {
      const pull = 560;
      gem.vx = (dx / dist) * pull;
      gem.vy = (dy / dist) * pull;
    } else {
      gem.vx *= Math.pow(0.01, dt);
      gem.vy *= Math.pow(0.01, dt);
    }
    gem.x += gem.vx * dt;
    gem.y += gem.vy * dt;
    if (dist < player.radius + gem.radius + 6) {
      gem.dead = true;
      if (gem.heart) {
        player.hp = Math.min(player.maxHp, player.hp + 30);
        spawnText(game, player.x, player.y - 26, '+30 HP', '#3dff8e', 16);
        game.sound.levelUp();
      } else {
        game.pickupCombo += 1;
        game.sound.pickup(Math.floor(game.pickupCombo));
        game.gainXp(gem.value);
      }
    }
  }
  game.gems = game.gems.filter((g) => !g.dead);
}

export function updateFx(game, dt) {
  for (const p of game.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.05, dt);
    p.vy *= Math.pow(0.05, dt);
  }
  game.particles = game.particles.filter((p) => p.life < p.maxLife);
  for (const t of game.texts) {
    t.life += dt;
    t.y -= 42 * dt;
  }
  game.texts = game.texts.filter((t) => t.life < t.maxLife);
}
