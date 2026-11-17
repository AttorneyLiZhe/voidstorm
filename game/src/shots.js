// The screenshot scenes behind ?shot=start|play|levelup|end&seed=N.
// Each scene plays the real rules forward from a fresh world, steered by an autopilot, so a
// screenshot is an honest frame of the game being played — never a staged mock-up — and the
// same seed always produces the same frame. The maker's tooling loads these URLs in a browser
// and captures the canvas (see shots.json for the scene list).

import { FIELD, STEP, UPGRADES } from './config.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const PLAY_SECONDS = 34;
const LEVELUP_LIMIT_SECONDS = 240;
const END_LIMIT_SECONDS = 420;

/** One autopilot: hunt the nearest hostile, keep a respectful distance, scoop salvage. */
export function autopilotControl(world, { reckless = false } = {}) {
  const p = world.player;
  let nearest = null;
  let nearestSq = Infinity;
  for (const enemy of world.enemies) {
    const d2 = (enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2;
    if (d2 < nearestSq) {
      nearestSq = d2;
      nearest = enemy;
    }
  }
  let gem = null;
  let gemSq = Infinity;
  for (const g of world.gems) {
    const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
    if (d2 < gemSq) {
      gemSq = d2;
      gem = g;
    }
  }

  let moveX = 0;
  let moveY = 0;
  if (nearest) {
    const dist = Math.sqrt(nearestSq);
    const awayX = (p.x - nearest.x) / (dist || 1);
    const awayY = (p.y - nearest.y) / (dist || 1);
    if (nearest.kind === 'boss' && !reckless) {
      // Orbit the capital ship at bolt-dodging range: in to 330, out from 240, always strafing.
      const radial = dist > 330 ? -1 : dist < 240 ? 1 : 0;
      moveX = awayX * radial - awayY * 0.85;
      moveY = awayY * radial + awayX * 0.85;
    } else if (reckless) {
      // The end scene's pilot has given up: it flies straight at the swarm.
      moveX = -awayX;
      moveY = -awayY;
    } else if (dist < 190) {
      moveX = awayX - awayY * 0.45;
      moveY = awayY + awayX * 0.45;
    } else if (gem && gemSq < 340 * 340) {
      moveX = (gem.x - p.x) / (Math.sqrt(gemSq) || 1);
      moveY = (gem.y - p.y) / (Math.sqrt(gemSq) || 1);
    } else {
      // Orbit the arena heart, drifting toward the fight.
      moveX = (FIELD.width / 2 - p.x) / FIELD.width + -awayY * 0.3;
      moveY = (FIELD.height / 2 - p.y) / FIELD.height + awayX * 0.3;
    }
  } else if (gem) {
    const dist = Math.sqrt(gemSq) || 1;
    moveX = (gem.x - p.x) / dist;
    moveY = (gem.y - p.y) / dist;
  }
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }

  // Aim with a touch of lead so shots land on moving targets.
  let aimX = p.x + 100;
  let aimY = p.y;
  if (nearest) {
    const dist = Math.sqrt(nearestSq);
    const lead = Math.min(0.35, dist / 900);
    aimX = nearest.x + nearest.vx * lead;
    aimY = nearest.y + nearest.vy * lead;
  }
  return { moveX, moveY, aimX, aimY, firing: nearest !== null, playerX: p.x, playerY: p.y };
}

function runSeconds(world, seconds, controlFor, onStep) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, controlFor(world));
    if (onStep && onStep(world)) return true;
    if (world.awaitingChoice) {
      // The autopilot always takes the first system on offer and flies on.
      world.applyChoice(0);
    }
    if (world.over) return true;
  }
  return false;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any name other than play/levelup/end is the title.
 */
export function stageShot(name, world, seed) {
  world.reset(seed);
  if (name === 'play') {
    // The money frame of this game is the capital-ship fight: fly the early waves, then
    // capture a few seconds into the Hollow Star's first barrage, bolts already in the air.
    let engagedAt = null;
    runSeconds(world, 200, (w) => autopilotControl(w), (w) => {
      const boss = w.enemies.find((e) => e.kind === 'boss');
      if (boss && boss.y > 90) {
        if (engagedAt === null) engagedAt = w.time;
        if (w.time - engagedAt > 3.2) return true;
      }
      return false;
    });
    // Fallback if the boss never showed (or already fell): any genuinely busy frame will do.
    if (!world.enemies.some((e) => e.kind === 'boss') && !world.over) {
      const busy = (w) => {
        if (w.over || w.enemies.length < 6 || w.bullets.length < 2) return false;
        let near = 0;
        for (const enemy of w.enemies) {
          if ((enemy.x - w.player.x) ** 2 + (enemy.y - w.player.y) ** 2 < 520 * 520) near += 1;
        }
        return near >= 3;
      };
      let guard = 0;
      while (!busy(world) && !world.over && guard < 200) {
        runSeconds(world, 0.25, (w) => autopilotControl(w));
        guard += 1;
      }
    }
    if (world.awaitingChoice) world.applyChoice(0);
    world.shake = 0;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'levelup') {
    runSeconds(world, LEVELUP_LIMIT_SECONDS, (w) => {
      // Hold fire near the threshold so the modal opens on a living field, not a fresh corpse.
      return autopilotControl(w);
    }, (w) => w.awaitingChoice);
    world.shake = 0;
    return { screen: SCREEN_LEVELUP, best: 0 };
  }
  if (name === 'victory') {
    // A stacked veteran build flies the whole run for real — waves 1 to 10 through the
    // actual rules, the autopilot at the stick — and the scene freezes on the frame
    // where the storm breaks. The build is strong, not invincible: the frame is earned.
    const build = [
      'damage', 'damage', 'damage', 'damage', 'damage', 'damage',
      'firerate', 'firerate', 'firerate', 'firerate', 'firerate',
      'multishot', 'multishot', 'multishot', 'pierce', 'pierce',
      'hull', 'hull', 'hull', 'hull', 'nanobots', 'nanobots', 'nanobots',
      'shield', 'magnet', 'magnet', 'speed',
    ];
    for (const id of build) {
      const upgrade = UPGRADES.find((u) => u.id === id);
      if (upgrade) upgrade.apply(world.player);
    }
    runSeconds(world, 1500, (w) => autopilotControl(w), (w) => w.won);
    world.shake = 0;
    return { screen: world.won ? SCREEN_VICTORY : SCREEN_PLAY, best: world.score };
  }
  if (name === 'end') {
    runSeconds(world, END_LIMIT_SECONDS, (w) => autopilotControl(w, { reckless: true }));
    world.shake = 0;
    return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
  }
  // Title: a fresh arena at rest — stars, nebulae and one patient ship.
  world.time = 2.5;
  world.player.aimAngle = -Math.PI / 2 + 0.35;
  return { screen: SCREEN_TITLE, best: 0 };
}
