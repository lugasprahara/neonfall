// render.js — everything NEONFALL draws: the void arena (parallax
// starfield, grid, glowing border), gems, enemies, the warden and its
// weapons, projectiles, particles, floating text, the HUD, and the menu /
// level-up / pause / game-over overlays.
//
// Drawing is plain canvas 2D with additive glow (shadowBlur and
// 'lighter' compositing) in the synthwave palette from config.js.

import {
  PALETTE, VIEW_HEIGHT, VIEW_WIDTH, WORLD_HEIGHT, WORLD_WIDTH, formatTime,
} from './config.js';
import { WEAPON_NAMES } from './weapons.js';

// ------------------------------------------------------------ background

export function createStarfield(rng) {
  const layers = [];
  for (const [count, parallax, size] of [[150, 0.35, 1.4], [90, 0.6, 2.1]]) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rng.range(0, WORLD_WIDTH),
        y: rng.range(0, WORLD_HEIGHT),
        size: size * rng.range(0.6, 1.5),
        twinkle: rng.range(0, Math.PI * 2),
      });
    }
    layers.push({ stars, parallax });
  }
  return layers;
}

function drawBackground(ctx, game) {
  const cam = game.camera;
  ctx.fillStyle = PALETTE.voidDeep;
  ctx.fillRect(cam.x, cam.y, cam.w, cam.h);

  // Parallax star layers.
  for (const layer of game.starfield) {
    const ox = cam.x * (1 - layer.parallax);
    const oy = cam.y * (1 - layer.parallax);
    ctx.fillStyle = '#aee9ff';
    for (const star of layer.stars) {
      const x = star.x - ox;
      const y = star.y - oy;
      if (x < cam.x - 4 || x > cam.x + cam.w + 4 || y < cam.y - 4 || y > cam.y + cam.h + 4) continue;
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(game.time * 1.7 + star.twinkle));
      ctx.globalAlpha = tw * 0.8;
      ctx.fillRect(x, y, star.size, star.size);
    }
  }
  ctx.globalAlpha = 1;

  // Grid.
  const step = 110;
  ctx.lineWidth = 1;
  const startX = Math.floor(cam.x / step) * step;
  const startY = Math.floor(cam.y / step) * step;
  for (let x = startX; x <= cam.x + cam.w; x += step) {
    ctx.strokeStyle = (x / step) % 5 === 0 ? PALETTE.gridMajor : PALETTE.grid;
    ctx.beginPath();
    ctx.moveTo(x, cam.y);
    ctx.lineTo(x, cam.y + cam.h);
    ctx.stroke();
  }
  for (let y = startY; y <= cam.y + cam.h; y += step) {
    ctx.strokeStyle = (y / step) % 5 === 0 ? PALETTE.gridMajor : PALETTE.grid;
    ctx.beginPath();
    ctx.moveTo(cam.x, y);
    ctx.lineTo(cam.x + cam.w, y);
    ctx.stroke();
  }

  // The arena wall: a double neon border.
  ctx.strokeStyle = PALETTE.wall;
  ctx.lineWidth = 3;
  ctx.shadowColor = PALETTE.wall;
  ctx.shadowBlur = 18;
  ctx.strokeRect(6, 6, WORLD_WIDTH - 12, WORLD_HEIGHT - 12);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 47, 214, 0.35)';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, WORLD_WIDTH - 28, WORLD_HEIGHT - 28);
}

// ------------------------------------------------------------ entities

function polygon(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawGem(ctx, game, gem) {
  const bob = Math.sin(gem.pulse) * 2;
  ctx.save();
  ctx.translate(gem.x, gem.y + bob);
  if (gem.heart) {
    ctx.fillStyle = '#ff3d71';
    ctx.shadowColor = '#ff3d71';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.bezierCurveTo(-11, -2, -7, -10, 0, -4);
    ctx.bezierCurveTo(7, -10, 11, -2, 0, 7);
    ctx.fill();
  } else {
    const color = gem.value >= 10 ? '#ffe93d' : gem.value >= 3 ? '#3dffc8' : PALETTE.xp;
    ctx.rotate(Math.PI / 4 + gem.pulse * 0.4);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    const r = gem.radius;
    ctx.fillRect(-r / 1.4, -r / 1.4, r * 1.43, r * 1.43);
  }
  ctx.restore();
}

function drawEnemy(ctx, game, enemy) {
  const { def } = enemy;
  const angle = Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : def.color;
  ctx.shadowColor = def.color;
  ctx.shadowBlur = 13;
  const r = enemy.radius;
  switch (def.shape) {
    case 'diamond':
      polygon(ctx, 0, 0, r, 4, angle);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      polygon(ctx, 0, 0, r * 0.5, 4, angle + Math.PI / 4);
      ctx.fill();
      break;
    case 'dart':
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(r * 1.3, 0);
      ctx.lineTo(-r, r * 0.8);
      ctx.lineTo(-r * 0.5, 0);
      ctx.lineTo(-r, -r * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    case 'hex':
      polygon(ctx, 0, 0, r, 6, game.time * 0.7 + enemy.wobble);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      polygon(ctx, 0, 0, r * 0.6, 6, -game.time * 0.7);
      ctx.fill();
      break;
    case 'tri':
      polygon(ctx, 0, 0, r, 3, angle + Math.PI / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      polygon(ctx, 0, 0, r * 0.35, 3, angle + Math.PI / 2);
      ctx.fill();
      break;
    case 'boss': {
      const spin = game.time * 0.9;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = spin + (i / 16) * Math.PI * 2;
        const rad = i % 2 === 0 ? r : r * 0.72;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = enemy.chargeState === 'telegraph' ? '#ffffff' : '#2a0212';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();

  // HP sliver for the tough enemies.
  if (enemy.hp < enemy.maxHp && (enemy.type === 'brute' || enemy.type === 'elite')) {
    const w = enemy.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 11, w, 4);
    ctx.fillStyle = '#ff3d71';
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 11, w * Math.max(0, enemy.hp / enemy.maxHp), 4);
  }
}

function drawPlayer(ctx, game) {
  const player = game.player;
  if (player.invuln > 0 && Math.floor(game.time * 18) % 2 === 0 && game.state === 'playing') {
    ctx.globalAlpha = 0.35;
  }
  ctx.save();
  ctx.translate(player.x, player.y);

  // Orbit blades and their path.
  const blades = game.weapons.blades;
  if (blades.level > 0) {
    ctx.strokeStyle = 'rgba(255, 47, 214, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, blades.radius, 0, Math.PI * 2);
    ctx.stroke();
    const count = blades.level + 1;
    for (let i = 0; i < count; i++) {
      const a = blades.angle + (i / count) * Math.PI * 2;
      const bx = Math.cos(a) * blades.radius;
      const by = Math.sin(a) * blades.radius;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#ff2fd6';
      ctx.shadowColor = '#ff2fd6';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 11);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // The warden: a ringed core with a facing spike.
  const spin = game.time * 2.4;
  ctx.strokeStyle = PALETTE.player;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, spin, spin + Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, player.radius * 0.62, -spin * 1.4, -spin * 1.4 + Math.PI * 1.2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.moveTo(player.face * (player.radius + 7), 0);
  ctx.lineTo(player.face * player.radius * 0.4, -5);
  ctx.lineTo(player.face * player.radius * 0.4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawProjectiles(ctx, game) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bullet of game.bullets) {
    ctx.strokeStyle = bullet.color;
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = bullet.kind === 'lance' ? 5 : 3;
    const tail = bullet.kind === 'lance' ? 30 : 13;
    const len = Math.hypot(bullet.vx, bullet.vy) || 1;
    ctx.beginPath();
    ctx.moveTo(bullet.x - (bullet.vx / len) * tail, bullet.y - (bullet.vy / len) * tail);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
  }
  for (const shot of game.enemyBullets) {
    ctx.fillStyle = '#ff5e8a';
    ctx.shadowColor = '#ff3860';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFx(ctx, game) {
  // Nova shockwaves.
  for (const fx of game.novaFx) {
    const k = fx.life / fx.maxLife;
    ctx.strokeStyle = `rgba(178, 107, 255, ${0.75 * (1 - k)})`;
    ctx.lineWidth = 5 * (1 - k) + 1;
    ctx.shadowColor = '#b26bff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, fx.r * (0.25 + 0.75 * k), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Particles.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of game.particles) {
    const k = 1 - p.life / p.maxLife;
    ctx.globalAlpha = k;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // Floating combat text.
  ctx.textAlign = 'center';
  for (const t of game.texts) {
    const k = 1 - t.life / t.maxLife;
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.font = `bold ${t.size}px system-ui, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ HUD

function bar(ctx, x, y, w, h, frac, fill, back) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function drawHud(ctx, game) {
  const player = game.player;
  ctx.textAlign = 'left';

  // XP bar across the very top, level badge at its left.
  bar(ctx, 0, 0, VIEW_WIDTH, 9, game.xp / game.xpNext, PALETTE.xp, 'rgba(61, 255, 142, 0.18)');
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.xp;
  ctx.fillText(`LV ${game.level}`, 12, 30);

  // HP bar under the level.
  bar(ctx, 12, 38, 218, 14, player.hp / player.maxHp, PALETTE.hp, PALETTE.hpBack);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 38, 218, 14);
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 18, 49);

  // Weapon roster.
  ctx.font = '12px system-ui, sans-serif';
  let wy = 74;
  for (const key of ['blaster', 'blades', 'lance', 'nova']) {
    const w = game.weapons[key];
    if (w.level === 0) continue;
    ctx.fillStyle = PALETTE.textDim;
    const extra = key === 'blaster' ? ` x${w.projectiles}` : ` Lv${w.level}`;
    ctx.fillText(`${WEAPON_NAMES[key]}${extra}`, 12, wy);
    wy += 16;
  }

  // Timer and kills.
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 10;
  ctx.fillText(formatTime(game.time), VIEW_WIDTH / 2, 36);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`KILLS ${game.kills}`, VIEW_WIDTH - 12, 30);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(game.sound.muted ? 'MUTED (M)' : 'SOUND ON (M)', VIEW_WIDTH - 12, 48);

  // Boss health.
  const boss = game.enemies.find((e) => e.type === 'boss' && !e.dead);
  if (boss) {
    const w = 520;
    const x = (VIEW_WIDTH - w) / 2;
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ff5e8a';
    ctx.fillText('— THE HOLLOW STAR —', VIEW_WIDTH / 2, VIEW_HEIGHT - 34);
    bar(ctx, x, VIEW_HEIGHT - 26, w, 11, boss.hp / boss.maxHp, '#ff3860', 'rgba(255,56,96,0.22)');
  }

  // Boss warning banner.
  if (game.bossWarn > 0 && Math.floor(game.time * 3) % 2 === 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#ff3860';
    ctx.shadowColor = '#ff3860';
    ctx.shadowBlur = 18;
    ctx.fillText('SOMETHING VAST APPROACHES', VIEW_WIDTH / 2, 92);
    ctx.shadowBlur = 0;
  }

  // Low-HP pulse.
  if (player.hp / player.maxHp < 0.3 && game.state === 'playing') {
    const a = 0.12 + 0.1 * Math.sin(game.time * 6);
    const grad = ctx.createRadialGradient(
      VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.42,
      VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.78);
    grad.addColorStop(0, 'rgba(255,0,60,0)');
    grad.addColorStop(1, `rgba(255,0,60,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }
}

// ------------------------------------------------------------ overlays

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

export function upgradeCardRects() {
  const rects = [];
  const w = 252;
  const h = 168;
  const gap = 22;
  const total = w * 3 + gap * 2;
  const x0 = (VIEW_WIDTH - total) / 2;
  for (let i = 0; i < 3; i++) rects.push({ x: x0 + i * (w + gap), y: 196, w, h });
  return rects;
}

function drawMenu(ctx, game) {
  ctx.fillStyle = 'rgba(4, 2, 12, 0.45)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';

  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.shadowColor = '#ff2fd6';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ff2fd6';
  ctx.fillText('NEON', VIEW_WIDTH / 2, 168);
  ctx.shadowColor = PALETTE.player;
  ctx.fillStyle = PALETTE.player;
  ctx.fillText('FALL', VIEW_WIDTH / 2, 258);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText('A R E N A   S U R V I V A L', VIEW_WIDTH / 2, 296);

  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  const lines = [
    'Move with WASD or the arrow keys — your weapons fire on their own.',
    'Shatter the swarm, gather their light, and choose how you evolve.',
    'Every 90 seconds the Hollow Star comes for you. Break it.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_WIDTH / 2, 348 + i * 24));

  if (Math.floor(game.menuTime * 1.6) % 2 === 0) {
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CLICK OR PRESS ENTER TO ENTER THE VOID', VIEW_WIDTH / 2, 452);
  }
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('Esc / P pause · M mute · 1-3 choose upgrades', VIEW_WIDTH / 2, 492);
  if (game.bestTime > 0) {
    ctx.fillText(`Best survival: ${formatTime(game.bestTime)} · Best level: ${game.bestLevel}`, VIEW_WIDTH / 2, 514);
  }
}

function drawLevelUp(ctx, game) {
  ctx.fillStyle = 'rgba(4, 2, 12, 0.62)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.xp;
  ctx.shadowColor = PALETTE.xp;
  ctx.shadowBlur = 16;
  ctx.fillText(`LEVEL ${game.level}`, VIEW_WIDTH / 2, 128);
  ctx.shadowBlur = 0;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('The void offers three gifts. Choose one.', VIEW_WIDTH / 2, 156);

  const rects = upgradeCardRects();
  game.choices.forEach((choice, i) => {
    const r = rects[i];
    const hover = game.input.mouse.x >= r.x && game.input.mouse.x <= r.x + r.w
      && game.input.mouse.y >= r.y && game.input.mouse.y <= r.y + r.h;
    ctx.fillStyle = hover ? 'rgba(24, 16, 54, 0.95)' : PALETTE.panel;
    ctx.strokeStyle = hover ? '#ffffff' : choice.color;
    ctx.lineWidth = hover ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = choice.color;
    ctx.fillRect(r.x, r.y, r.w, 7);
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(choice.name, r.x + r.w / 2, r.y + 44);
    ctx.font = '13.5px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    wrapText(ctx, choice.desc, r.x + r.w / 2, r.y + 74, r.w - 28, 19);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + r.h - 14);
  });
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4, 2, 12, 0.6)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('PAUSED', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 8);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('Esc / P to resume', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 26);
}

function drawGameOver(ctx, game) {
  ctx.fillStyle = 'rgba(10, 2, 10, 0.68)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillStyle = '#ff3860';
  ctx.shadowColor = '#ff3860';
  ctx.shadowBlur = 24;
  ctx.fillText('THE VOID CLAIMS YOU', VIEW_WIDTH / 2, 158);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  const stats = [
    `Survived  ${formatTime(game.time)}`,
    `Level  ${game.level}`,
    `Kills  ${game.kills}`,
    `Bosses broken  ${game.bossesKilled}`,
  ];
  stats.forEach((line, i) => ctx.fillText(line, VIEW_WIDTH / 2, 226 + i * 34));

  if (Math.floor(game.menuTime * 1.6) % 2 === 0) {
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PRESS R OR CLICK TO RISE AGAIN', VIEW_WIDTH / 2, 402);
  }
}

// ------------------------------------------------------------ frame

export function drawGame(ctx, game) {
  const cam = game.camera;
  const shakeX = game.shake > 0 ? game.rng.range(-game.shake, game.shake) : 0;
  const shakeY = game.shake > 0 ? game.rng.range(-game.shake, game.shake) : 0;

  ctx.save();
  ctx.translate(-Math.round(cam.x + shakeX), -Math.round(cam.y + shakeY));
  drawBackground(ctx, game);
  for (const gem of game.gems) drawGem(ctx, game, gem);
  for (const enemy of game.enemies) drawEnemy(ctx, game, enemy);
  drawPlayer(ctx, game);
  drawProjectiles(ctx, game);
  drawFx(ctx, game);
  ctx.restore();

  if (game.state !== 'menu') drawHud(ctx, game);
  if (game.state === 'menu') drawMenu(ctx, game);
  if (game.state === 'levelup') drawLevelUp(ctx, game);
  if (game.state === 'paused') drawPaused(ctx, game);
  if (game.state === 'gameover') drawGameOver(ctx, game);
}
