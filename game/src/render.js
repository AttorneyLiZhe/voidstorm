// Everything VOIDSTORM draws. Canvas 2D, neon vector art only — no image assets, so the game
// is its own art department: gradient space, glowing hostiles with a silhouette per kind, a
// sleek pilot ship, particle bursts, floating damage numbers and a full HUD. The renderer
// reads the world and the shell's screen state; it never mutates either.

import { COLORS, ENEMY_KINDS, FIELD, isBossWave } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_OVER = 'over';
export const SCREEN_PAUSE = 'pause';

const TAU = Math.PI * 2;
const FONT = '"Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bar(ctx, x, y, w, h, fraction, fill, back = 'rgba(120, 150, 210, 0.22)') {
  const f = Math.max(0, Math.min(1, fraction));
  ctx.fillStyle = back;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (f > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w * f, h, h / 2);
    ctx.fill();
  }
}

function polygon(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i / sides) * TAU;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---- the world ---------------------------------------------------------------

function drawBackground(ctx, world) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, '#070b1d');
  gradient.addColorStop(0.55, '#05070f');
  gradient.addColorStop(1, '#0a0618');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  for (const nebula of world.nebulae) {
    const glow = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.radius);
    glow.addColorStop(0, nebula.color + '55');
    glow.addColorStop(1, nebula.color + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(nebula.x - nebula.radius, nebula.y - nebula.radius, nebula.radius * 2, nebula.radius * 2);
  }

  // A faint tactical grid, drifting almost imperceptibly against the stars.
  ctx.strokeStyle = 'rgba(70, 110, 190, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= FIELD.width; x += 64) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD.height);
  }
  for (let y = 0; y <= FIELD.height; y += 64) {
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.width, y);
  }
  ctx.stroke();

  for (const star of world.stars) {
    const tw = 0.55 + 0.45 * Math.sin(world.time * 1.7 + star.twinkle);
    ctx.globalAlpha = 0.35 + 0.55 * tw * star.depth;
    ctx.fillStyle = '#cfe4ff';
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;

  // The arena rim.
  ctx.strokeStyle = 'rgba(57, 213, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, FIELD.width - 2, FIELD.height - 2);
  ctx.strokeStyle = 'rgba(57, 213, 255, 0.08)';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, FIELD.width - 8, FIELD.height - 8);
}

function drawGem(ctx, gem, time) {
  const pulse = 1 + 0.18 * Math.sin(time * 5 + gem.bob);
  const r = gem.radius * pulse;
  ctx.save();
  ctx.translate(gem.x, gem.y + Math.sin(time * 2.4 + gem.bob) * 2);
  ctx.rotate(Math.PI / 4);
  ctx.shadowColor = COLORS.xp;
  ctx.shadowBlur = 10;
  ctx.fillStyle = gem.value >= 5 ? '#7df0ff' : '#39d5ff';
  ctx.fillRect(-r / 1.6, -r / 1.6, r * 1.25, r * 1.25);
  ctx.restore();
}

function drawEnemy(ctx, enemy) {
  const base = ENEMY_KINDS[enemy.kind];
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const flash = enemy.flash > 0;
  const fill = flash ? '#ffffff' : base.color;
  const dim = flash ? '#ffffff' : base.colorDim;
  ctx.shadowColor = base.color;
  ctx.shadowBlur = enemy.kind === 'boss' ? 26 : 13;

  if (enemy.kind === 'drifter' || enemy.kind === 'mite') {
    ctx.rotate(enemy.angle);
    ctx.beginPath();
    ctx.moveTo(enemy.radius, 0);
    ctx.lineTo(-enemy.radius * 0.8, enemy.radius * 0.75);
    ctx.lineTo(-enemy.radius * 0.45, 0);
    ctx.lineTo(-enemy.radius * 0.8, -enemy.radius * 0.75);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = dim;
    ctx.beginPath();
    ctx.arc(enemy.radius * 0.15, 0, enemy.radius * 0.3, 0, TAU);
    ctx.fill();
  } else if (enemy.kind === 'weaver') {
    ctx.rotate(enemy.wobble * 0.7);
    polygon(ctx, 0, 0, enemy.radius, 4, 0);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    polygon(ctx, 0, 0, enemy.radius * 0.5, 4, Math.PI / 4);
    ctx.fillStyle = dim;
    ctx.fill();
  } else if (enemy.kind === 'spitter') {
    polygon(ctx, 0, 0, enemy.radius, 6, enemy.wobble * 0.3);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#06130a';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#baffd2';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.2, 0, TAU);
    ctx.fill();
  } else if (enemy.kind === 'splitter') {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = dim;
    for (let i = 0; i < 3; i += 1) {
      const angle = enemy.wobble + (i / 3) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * enemy.radius * 0.45, Math.sin(angle) * enemy.radius * 0.45, enemy.radius * 0.34, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius - 2, 0, TAU);
    ctx.stroke();
  } else if (enemy.kind === 'boss') {
    ctx.rotate(enemy.wobble * 0.15 + 0.4);
    polygon(ctx, 0, 0, enemy.radius, 6, 0);
    ctx.fillStyle = dim;
    ctx.fill();
    polygon(ctx, 0, 0, enemy.radius * 0.78, 6, Math.PI / 6);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    const corePulse = 0.75 + 0.25 * Math.sin(enemy.bornAt * 2 + performance.now() / 240);
    ctx.fillStyle = '#ffe3ec';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.3 * corePulse + 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    polygon(ctx, 0, 0, enemy.radius * 0.55, 6, -0.2);
    ctx.stroke();
  }
  ctx.restore();

  // A slim health arc over anything that has taken a beating.
  if (enemy.hp < enemy.maxHp && enemy.kind !== 'boss') {
    const w = enemy.radius * 2;
    bar(ctx, enemy.x - enemy.radius, enemy.y - enemy.radius - 10, w, 3.5, enemy.hp / enemy.maxHp, base.color, 'rgba(255,255,255,0.14)');
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (world.over) return;
  ctx.save();
  ctx.translate(p.x, p.y);

  // Engine flame, sized by how hard the ship is pushing.
  if (p.thrust > 0.05) {
    ctx.save();
    ctx.rotate(p.aimAngle + Math.PI);
    const flame = 12 + p.thrust * 16 + Math.sin(world.time * 41) * 3;
    const grad = ctx.createLinearGradient(p.radius, 0, p.radius + flame, 0);
    grad.addColorStop(0, 'rgba(125, 240, 255, 0.9)');
    grad.addColorStop(1, 'rgba(125, 240, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p.radius - 2, -4.5);
    ctx.lineTo(p.radius + flame, 0);
    ctx.lineTo(p.radius - 2, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const blink = p.invuln > 0 && Math.floor(world.time * 18) % 2 === 0;
  ctx.rotate(p.aimAngle);
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 15;
  ctx.globalAlpha = blink ? 0.35 : 1;
  const hull = ctx.createLinearGradient(-p.radius, 0, p.radius, 0);
  hull.addColorStop(0, '#1b6f9e');
  hull.addColorStop(0.6, '#39d5ff');
  hull.addColorStop(1, '#b8f4ff');
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(p.radius + 5, 0);
  ctx.lineTo(-p.radius * 0.4, p.radius * 0.52);
  ctx.lineTo(-p.radius - 3, p.radius * 0.95);
  ctx.lineTo(-p.radius * 0.72, 0);
  ctx.lineTo(-p.radius - 3, -p.radius * 0.95);
  ctx.lineTo(-p.radius * 0.4, -p.radius * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#eafcff';
  ctx.beginPath();
  ctx.arc(p.radius * 0.25, 0, 4.2, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  if (p.shield > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(125, 240, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -world.time * 30;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 9, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawWorld(ctx, world) {
  drawBackground(ctx, world);
  for (const gem of world.gems) drawGem(ctx, gem, world.time);
  for (const enemy of world.enemies) drawEnemy(ctx, enemy);

  // Hostile bolts: hot little suns.
  for (const bolt of world.bolts) {
    ctx.save();
    ctx.shadowColor = '#ff3860';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff7d9c';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff0f4';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius * 0.45, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Pilot rounds: bright capsules along their line of flight.
  for (const bullet of world.bullets) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 9;
    ctx.fillStyle = '#c9f6ff';
    roundRect(ctx, -7, -2.2, 14, 4.4, 2.2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, world);

  for (const particle of world.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  for (const floater of world.floaters) {
    ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.globalAlpha = 1;
}

// ---- HUD and screens -----------------------------------------------------------

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawHud(ctx, world) {
  const p = world.player;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('HULL', 22, 30);
  bar(ctx, 22, 38, 230, 13, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? COLORS.bad : COLORS.hp);
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 260, 49);
  if (p.shieldMax > 0) {
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(p.shield > 0 ? 'AEGIS READY' : `AEGIS ${Math.max(0, p.shieldTimer).toFixed(0)}s`, 22, 68);
  }

  ctx.textAlign = 'center';
  ctx.font = `800 15px ${FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(world.bossAlive ? '⚠ CAPITAL SIGNATURE ⚠' : `WAVE ${Math.max(1, world.wave)}`, FIELD.width / 2, 30);
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`${world.score.toLocaleString('en-US')}`, FIELD.width / 2, 62);

  const boss = world.enemies.find((e) => e.kind === 'boss');
  if (boss) {
    bar(ctx, FIELD.width / 2 - 190, 74, 380, 8, boss.hp / boss.maxHp, COLORS.bad, 'rgba(255,255,255,0.13)');
  }

  ctx.textAlign = 'right';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`KILLS ${world.kills}    TIME ${formatTime(world.time)}    LV ${p.level}`, FIELD.width - 22, 34);
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`HOSTILES ${world.enemies.length + world.toSpawn}`, FIELD.width - 22, 54);

  // XP ribbon along the very bottom.
  bar(ctx, 0, FIELD.height - 6, FIELD.width, 6, p.xp / p.xpNext, COLORS.xp, 'rgba(57, 213, 255, 0.15)');
  ctx.restore();
}

function drawWaveBanner(ctx, world) {
  if (world.waveState !== 'intermission' || world.over) return;
  const next = world.wave + 1;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.globalAlpha = Math.min(1, world.waveTimer);
  ctx.font = `800 44px ${FONT}`;
  ctx.shadowColor = isBossWave(next) ? COLORS.bad : COLORS.accent;
  ctx.shadowBlur = 24;
  ctx.fillStyle = isBossWave(next) ? '#ffb3c2' : '#dff6ff';
  ctx.fillText(isBossWave(next) ? `WAVE ${next} — THE HOLLOW STAR` : `WAVE ${next}`, FIELD.width / 2, FIELD.height / 2 - 60);
  ctx.shadowBlur = 0;
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(isBossWave(next) ? 'A capital-class hostile is folding into the arena' : 'Hostiles inbound', FIELD.width / 2, FIELD.height / 2 - 28);
  ctx.restore();
}

/** The three upgrade cards of the level-up screen; main.js hit-tests clicks with this too. */
export function choiceCardRects() {
  const w = 264;
  const h = 196;
  const gap = 26;
  const total = w * 3 + gap * 2;
  const x0 = (FIELD.width - total) / 2;
  const y = FIELD.height / 2 - 78;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

function drawLevelUp(ctx, world, ui) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 6, 16, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.font = `800 34px ${FONT}`;
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#dff6ff';
  ctx.fillText('SALVAGE INTEGRATED — CHOOSE AN UPGRADE', FIELD.width / 2, FIELD.height / 2 - 148);
  ctx.shadowBlur = 0;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`Pilot level ${world.player.level} · click a system, or press 1 · 2 · 3`, FIELD.width / 2, FIELD.height / 2 - 118);

  const rects = choiceCardRects();
  world.choices.forEach((choice, i) => {
    const rect = rects[i];
    const hover = ui.mouseX >= rect.x && ui.mouseX <= rect.x + rect.w && ui.mouseY >= rect.y && ui.mouseY <= rect.y + rect.h;
    ctx.fillStyle = hover ? 'rgba(24, 44, 86, 0.95)' : COLORS.panel;
    ctx.strokeStyle = hover ? COLORS.accent : COLORS.line;
    ctx.lineWidth = hover ? 2.5 : 1.5;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = hover ? COLORS.accent : '#16264d';
    roundRect(ctx, rect.x + rect.w / 2 - 30, rect.y + 22, 60, 44, 10);
    ctx.fill();
    ctx.fillStyle = hover ? '#06222e' : COLORS.accent;
    ctx.font = `800 17px ${FONT}`;
    ctx.fillText(choice.icon, rect.x + rect.w / 2, rect.y + 51);

    ctx.fillStyle = COLORS.text;
    ctx.font = `800 19px ${FONT}`;
    ctx.fillText(choice.name, rect.x + rect.w / 2, rect.y + 102);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `600 14.5px ${FONT}`;
    const words = choice.blurb.split(' ');
    let line = '';
    let lineY = rect.y + 130;
    for (const word of words) {
      if ((line + ' ' + word).trim().length > 26 && line) {
        ctx.fillText(line.trim(), rect.x + rect.w / 2, lineY);
        lineY += 20;
        line = '';
      }
      line += ' ' + word;
    }
    if (line.trim()) ctx.fillText(line.trim(), rect.x + rect.w / 2, lineY);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText(`[ ${i + 1} ]`, rect.x + rect.w / 2, rect.y + rect.h - 14);
  });
  ctx.restore();
}

function drawTitle(ctx, world, ui) {
  drawWorld(ctx, world);
  ctx.save();
  ctx.fillStyle = 'rgba(3, 6, 16, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';

  ctx.font = `900 96px ${FONT}`;
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#eafcff';
  ctx.fillText('VOIDSTORM', FIELD.width / 2, 218);
  ctx.shadowBlur = 0;
  ctx.font = `700 19px ${FONT}`;
  ctx.fillStyle = COLORS.accentWarm;
  ctx.fillText('HOLD THE ARENA · HARVEST THE WRECKS · OUTGUN THE HOLLOW STAR', FIELD.width / 2, 258);

  ctx.font = `600 16.5px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  const lines = [
    'WASD or arrow keys to fly — mouse to aim, hold click or Space to fire.',
    'Downed hostiles drop salvage: fly over it to level up and bolt on new systems.',
    'Survive the waves. Every fifth wave, something capital-sized comes for you.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 330 + i * 26));

  const pulse = 0.72 + 0.28 * Math.sin(ui.time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.font = `800 25px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 452);
  ctx.globalAlpha = 1;

  ctx.font = `600 13.5px ${FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('P pause · M mute · An original game built for make.fun best-game-01', FIELD.width / 2, FIELD.height - 30);
  if (ui.best > 0) {
    ctx.fillStyle = COLORS.accentWarm;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(`BEST SCORE ${ui.best.toLocaleString('en-US')}`, FIELD.width / 2, 492);
  }
  ctx.restore();
}

function drawOver(ctx, world, ui) {
  drawWorld(ctx, world);
  ctx.save();
  ctx.fillStyle = 'rgba(10, 3, 10, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.font = `900 64px ${FONT}`;
  ctx.shadowColor = COLORS.bad;
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#ffe3ec';
  ctx.fillText('SHIP DESTROYED', FIELD.width / 2, 190);
  ctx.shadowBlur = 0;
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('The arena keeps your salvage. The next pilot is already launching.', FIELD.width / 2, 226);

  const stats = [
    ['FINAL SCORE', world.score.toLocaleString('en-US')],
    ['WAVE REACHED', `${Math.max(1, world.wave)}`],
    ['KILLS', `${world.kills}`],
    ['TIME SURVIVED', formatTime(world.time)],
    ['PILOT LEVEL', `${world.player.level}`],
    ['BEST SCORE', Math.max(ui.best, world.score).toLocaleString('en-US')],
  ];
  ctx.font = `700 15px ${FONT}`;
  stats.forEach(([label, value], i) => {
    const colX = FIELD.width / 2 - 250 + (i % 3) * 250;
    const rowY = 300 + Math.floor(i / 3) * 74;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(label, colX, rowY);
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(value, colX, rowY + 36);
    ctx.font = `700 15px ${FONT}`;
  });

  const pulse = 0.72 + 0.28 * Math.sin(ui.time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.font = `800 23px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('CLICK OR PRESS R TO FLY AGAIN', FIELD.width / 2, 520);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawPause(ctx, world) {
  drawWorld(ctx, world);
  ctx.save();
  ctx.fillStyle = 'rgba(3, 6, 16, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2);
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('Press P or Esc to resume', FIELD.width / 2, FIELD.height / 2 + 34);
  ctx.restore();
}

/** Draw one frame. `screen` is the shell's state; `ui` carries mouse, clock and best score. */
export function render(ctx, world, screen, ui) {
  if (screen === SCREEN_TITLE) {
    drawTitle(ctx, world, ui);
    return;
  }
  if (screen === SCREEN_OVER) {
    drawOver(ctx, world, ui);
    return;
  }
  if (screen === SCREEN_PAUSE) {
    drawPause(ctx, world);
    return;
  }
  drawWorld(ctx, world);
  drawHud(ctx, world);
  drawWaveBanner(ctx, world);
  if (screen === SCREEN_LEVELUP) drawLevelUp(ctx, world, ui);
}
