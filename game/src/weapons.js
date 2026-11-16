// weapons.js — NEONFALL's four automatic weapons and the upgrade pool.
//
// The warden never aims: each weapon acquires the nearest hostile and
// fires on its own clock. Level-ups offer three choices from the pool at
// the bottom; weapon entries unlock a new weapon or strengthen one the
// player already carries, stat entries stack without limit.

import { burstParticles, damageEnemy, spawnText } from './entities.js';

export function createWeapons() {
  return {
    blaster: { level: 1, projectiles: 1, damage: 13, interval: 0.30, cooldown: 0 },
    blades: { level: 0, damage: 16, radius: 76, angle: 0 },
    lance: { level: 0, damage: 36, interval: 1.05, cooldown: 0 },
    nova: { level: 0, damage: 24, radius: 132, interval: 3.4, cooldown: 1.2 },
  };
}

export const WEAPON_NAMES = {
  blaster: 'Pulse Blaster',
  blades: 'Orbit Blades',
  lance: 'Pierce Lance',
  nova: 'Nova Pulse',
};

function nearestEnemy(game, maxDist) {
  const player = game.player;
  let best = null;
  let bestD2 = maxDist * maxDist;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = enemy;
    }
  }
  return best;
}

function fireBullet(game, angle, spec) {
  const player = game.player;
  game.bullets.push({
    x: player.x + Math.cos(angle) * (player.radius + 4),
    y: player.y + Math.sin(angle) * (player.radius + 4),
    vx: Math.cos(angle) * spec.speed,
    vy: Math.sin(angle) * spec.speed,
    speed: spec.speed,
    radius: spec.radius,
    damage: spec.damage * player.damageMul,
    pierce: spec.pierce,
    knock: spec.knock,
    color: spec.color,
    kind: spec.kind,
    hitIds: new Set(),
    life: spec.life,
    dead: false,
  });
}

function updateBlaster(game, dt) {
  const w = game.weapons.blaster;
  w.cooldown -= dt;
  if (w.cooldown > 0) return;
  const target = nearestEnemy(game, 580);
  if (!target) return;
  const player = game.player;
  const base = Math.atan2(target.y - player.y, target.x - player.x);
  const n = w.projectiles;
  for (let i = 0; i < n; i++) {
    const spread = (i - (n - 1) / 2) * 0.09;
    fireBullet(game, base + spread, {
      speed: 640, radius: 4.5, damage: w.damage, pierce: 0, knock: 130,
      color: '#40e0ff', kind: 'bolt', life: 0.95,
    });
  }
  w.cooldown = w.interval / player.fireRateMul;
  game.sound.shoot();
}

function updateLance(game, dt) {
  const w = game.weapons.lance;
  if (w.level === 0) return;
  w.cooldown -= dt;
  if (w.cooldown > 0) return;
  const target = nearestEnemy(game, 720);
  if (!target) return;
  const player = game.player;
  const angle = Math.atan2(target.y - player.y, target.x - player.x);
  fireBullet(game, angle, {
    speed: 920, radius: 6, damage: w.damage, pierce: 999, knock: 60,
    color: '#ffe93d', kind: 'lance', life: 0.8,
  });
  w.cooldown = w.interval / player.fireRateMul;
  game.sound.lance();
}

function updateBlades(game, dt) {
  const w = game.weapons.blades;
  if (w.level === 0) return;
  w.angle += dt * 2.7;
  const player = game.player;
  const count = w.level + 1;
  for (let i = 0; i < count; i++) {
    const a = w.angle + (i / count) * Math.PI * 2;
    const bx = player.x + Math.cos(a) * w.radius;
    const by = player.y + Math.sin(a) * w.radius;
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const ready = enemy.orbitCooldown.get('blades') ?? 0;
      if (game.time < ready) continue;
      const dx = enemy.x - bx;
      const dy = enemy.y - by;
      const rr = enemy.radius + 15;
      if (dx * dx + dy * dy < rr * rr) {
        enemy.orbitCooldown.set('blades', game.time + 0.38);
        const away = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        damageEnemy(game, enemy, w.damage * player.damageMul,
          Math.cos(away) * 220, Math.sin(away) * 220);
        burstParticles(game, bx, by, { count: 2, color: '#ff2fd6', speed: 110, size: 2 });
      }
    }
  }
}

function updateNova(game, dt) {
  const w = game.weapons.nova;
  if (w.level === 0) return;
  w.cooldown -= dt;
  if (w.cooldown > 0) return;
  w.cooldown = w.interval;
  const player = game.player;
  game.novaFx.push({ x: player.x, y: player.y, r: w.radius, life: 0, maxLife: 0.32 });
  game.sound.nova();
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < w.radius + enemy.radius) {
      damageEnemy(game, enemy, w.damage * player.damageMul,
        (dx / dist) * 380, (dy / dist) * 380);
    }
  }
}

export function updateWeapons(game, dt) {
  updateBlaster(game, dt);
  updateLance(game, dt);
  updateBlades(game, dt);
  updateNova(game, dt);
}

// ------------------------------------------------------------- upgrades

// The pool is rebuilt for every level-up so names and descriptions match
// what the choice would actually do right now.
export function buildUpgradePool(game) {
  const w = game.weapons;
  const pool = [
    {
      id: 'dmg', name: 'Overcharge', color: '#ff3d71',
      desc: 'All weapons deal +20% damage.',
      apply(g) { g.player.damageMul *= 1.2; },
    },
    {
      id: 'rate', name: 'Rapid Cycler', color: '#40e0ff',
      desc: 'Blaster and lance cycle +15% faster.',
      apply(g) { g.player.fireRateMul *= 1.15; },
    },
    {
      id: 'speed', name: 'Ion Thrusters', color: '#3dff8e',
      desc: 'Move +10% faster.',
      apply(g) { g.player.speed *= 1.1; },
    },
    {
      id: 'hp', name: 'Hull Plating', color: '#ff3d71',
      desc: '+25 max HP, and repair 25 HP now.',
      apply(g) {
        g.player.maxHp += 25;
        g.player.hp = Math.min(g.player.maxHp, g.player.hp + 25);
      },
    },
    {
      id: 'magnet', name: 'Tractor Field', color: '#3dff8e',
      desc: 'XP gems are pulled from +45% farther away.',
      apply(g) { g.player.magnet *= 1.45; },
    },
    {
      id: 'regen', name: 'Nano Repair', color: '#b26bff',
      desc: 'Regenerate +0.7 HP every second.',
      apply(g) { g.player.regen += 0.7; },
    },
  ];

  if (w.blaster.projectiles < 4) {
    pool.push({
      id: 'split', name: 'Split Cannon', color: '#40e0ff',
      desc: `Blaster fires ${w.blaster.projectiles + 1} bolts per volley.`,
      apply(g) { g.weapons.blaster.projectiles += 1; },
    });
  }
  if (w.blades.level === 0) {
    pool.push({
      id: 'blades', name: 'Orbit Blades', color: '#ff2fd6',
      desc: 'Unlock: two energy blades circle you, shredding what they touch.',
      apply(g) { g.weapons.blades.level = 1; },
    });
  } else if (w.blades.level < 5) {
    pool.push({
      id: 'blades', name: 'Blade Array', color: '#ff2fd6',
      desc: `Orbit Blades +1 blade, +5 damage (now Lv ${w.blades.level}).`,
      apply(g) { g.weapons.blades.level += 1; g.weapons.blades.damage += 5; },
    });
  }
  if (w.lance.level === 0) {
    pool.push({
      id: 'lance', name: 'Pierce Lance', color: '#ffe93d',
      desc: 'Unlock: a heavy bolt that spears through every enemy in its line.',
      apply(g) { g.weapons.lance.level = 1; },
    });
  } else if (w.lance.level < 5) {
    pool.push({
      id: 'lance', name: 'Lance Amplifier', color: '#ffe93d',
      desc: `Pierce Lance +14 damage, cycles faster (now Lv ${w.lance.level}).`,
      apply(g) {
        g.weapons.lance.level += 1;
        g.weapons.lance.damage += 14;
        g.weapons.lance.interval *= 0.9;
      },
    });
  }
  if (w.nova.level === 0) {
    pool.push({
      id: 'nova', name: 'Nova Pulse', color: '#b26bff',
      desc: 'Unlock: a shockwave bursts out of you every few seconds, knocking swarms back.',
      apply(g) { g.weapons.nova.level = 1; },
    });
  } else if (w.nova.level < 5) {
    pool.push({
      id: 'nova', name: 'Nova Expansion', color: '#b26bff',
      desc: `Nova Pulse +20 radius, +8 damage (now Lv ${w.nova.level}).`,
      apply(g) {
        g.weapons.nova.level += 1;
        g.weapons.nova.radius += 20;
        g.weapons.nova.damage += 8;
      },
    });
  }
  return pool;
}

// Draw three distinct choices from the pool.
export function rollUpgrades(game) {
  const pool = buildUpgradePool(game);
  const picks = [];
  const used = new Set();
  while (picks.length < 3 && used.size < pool.length) {
    const entry = game.rng.pick(pool);
    if (used.has(entry.id)) continue;
    used.add(entry.id);
    picks.push(entry);
  }
  return picks;
}

export function applyUpgrade(game, upgrade) {
  upgrade.apply(game);
  spawnText(game, game.player.x, game.player.y - 34, upgrade.name, upgrade.color, 17);
}
