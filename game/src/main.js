// VOIDSTORM's shell: owns the canvas, the clock and the screen state machine, feeds live
// input to the world in fixed steps, and turns world events into sound and screen shake.
// With ?shot=<scene>&seed=<n> it instead stages one deterministic frame for the maker's
// screenshot tooling and raises window.__shotReady when it is on the canvas.

import { FIELD, STEP } from './config.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import {
  EVENT_BOSS,
  EVENT_BOSS_DOWN,
  EVENT_HURT,
  EVENT_KILL,
  EVENT_LEVELUP,
  EVENT_OVER,
  EVENT_SHIELD_BREAK,
  EVENT_SHOOT,
  EVENT_WAVE,
  EVENT_WIN,
  World,
} from './world.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY, choiceCardRects, render } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const params = new URLSearchParams(window.location.search);
const world = new World();
const sound = new SoundEngine();

let best = 0;
try {
  best = Number(window.localStorage.getItem('voidstorm-best') ?? 0) || 0;
} catch {
  best = 0;
}

function saveBest() {
  best = Math.max(best, world.score);
  try {
    window.localStorage.setItem('voidstorm-best', String(best));
  } catch {
    // Private mode and friends: the best score just lives for the session.
  }
}

// ---- screenshot mode -----------------------------------------------------------

if (params.has('shot')) {
  const seed = Number(params.get('seed') ?? 1) || 1;
  const { screen, best: shotBest } = stageShot(params.get('shot'), world, seed);
  const ui = { mouseX: FIELD.width / 2, mouseY: FIELD.height / 2, time: 2.5, best: shotBest };
  if (screen === SCREEN_LEVELUP) {
    // Park the pointer over the middle card, the way a player choosing would.
    const rect = choiceCardRects()[1];
    ui.mouseX = rect.x + rect.w / 2;
    ui.mouseY = rect.y + rect.h / 2;
  }
  render(ctx, world, screen, ui);
  window.__shotReady = { screen, score: world.score, wave: world.wave, kills: world.kills };
} else {
  live();
}

// ---- live play -------------------------------------------------------------------

function live() {
  const input = new Input(canvas);
  input.onFirstGesture = () => sound.unlock();

  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let lastStamp = performance.now();
  let shootSoundCooldown = 0;
  world.reset((Date.now() % 2147483646) + 1);

  function announce(text) {
    if (status) status.textContent = text;
  }

  function startRun() {
    world.reset((Date.now() % 2147483646) + 1);
    screen = SCREEN_PLAY;
    sound.unlock();
    sound.uiClick();
    announce('Run started. Wave 1 incoming.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) {
      if (shootSoundCooldown <= 0) {
        sound.shoot();
        shootSoundCooldown = 0.09;
      }
    }
    if (events & EVENT_KILL) sound.explosion(false);
    if (events & EVENT_BOSS_DOWN) sound.explosion(true);
    if (events & EVENT_HURT) sound.playerHurt();
    if (events & EVENT_SHIELD_BREAK) sound.shieldBreak();
    if (events & EVENT_WAVE) sound.waveHorn();
    if (events & EVENT_BOSS) sound.bossAlarm();
    if (events & EVENT_LEVELUP) {
      sound.levelUp();
      screen = SCREEN_LEVELUP;
      announce(`Level ${world.player.level}. Choose an upgrade.`);
    }
    if (events & EVENT_WIN) {
      sound.levelUp();
      sound.explosion(true);
      saveBest();
      screen = SCREEN_VICTORY;
      announce(`Storm broken. Wave ${world.wave} cleared with score ${world.score}. Press C to keep flying endless, or R for a new run.`);
    }
    if (events & EVENT_OVER) {
      sound.gameOver();
      saveBest();
      screen = SCREEN_OVER;
      announce(`Ship destroyed. Final score ${world.score}.`);
    }
  }

  function choose(index) {
    if (!world.choices[index]) return;
    world.applyChoice(index);
    sound.uiClick();
    if (!world.awaitingChoice) {
      screen = SCREEN_PLAY;
      announce('Upgrade installed. Back to the fight.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - lastStamp) / 1000;
    lastStamp = now;
    if (dt > 0.1) dt = 0.1;
    shootSoundCooldown = Math.max(0, shootSoundCooldown - dt);

    const ui = { mouseX: input.mouseX, mouseY: input.mouseY, time: now / 1000, best };

    if (screen === SCREEN_TITLE) {
      world.time += dt; // starlight only: the arena idles behind the title
      world.player.aimAngle = -Math.PI / 2 + Math.sin(now / 1600) * 0.35;
      if (input.takePressed('Enter') || input.takePressed('PointerLeft')) startRun();
    } else if (screen === SCREEN_PLAY) {
      if (input.takePressed('KeyP') || input.takePressed('Escape')) {
        screen = SCREEN_PAUSE;
        announce('Paused.');
      } else {
        accumulator += dt;
        let events = 0;
        let steps = 0;
        while (accumulator >= STEP && steps < 40) {
          events |= world.step(STEP, input.control(world.player));
          accumulator -= STEP;
          steps += 1;
          if (world.awaitingChoice || world.over || (events & EVENT_WIN)) {
            accumulator = 0;
            break;
          }
        }
        handleEvents(events);
      }
    } else if (screen === SCREEN_LEVELUP) {
      if (input.takePressed('Digit1')) choose(0);
      else if (input.takePressed('Digit2')) choose(1);
      else if (input.takePressed('Digit3')) choose(2);
      else if (input.takePressed('PointerLeft')) {
        const rects = choiceCardRects();
        const index = rects.findIndex((r) => input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h);
        if (index >= 0) choose(index);
      }
    } else if (screen === SCREEN_PAUSE) {
      if (input.takePressed('KeyP') || input.takePressed('Escape')) {
        screen = SCREEN_PLAY;
        announce('Resumed.');
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      // Let the wreckage drift: particles still live in the world, so keep stepping gently
      // with no pilot input until they settle, then freeze on the stats.
      accumulator += dt;
      while (accumulator >= STEP) {
        world.time += STEP;
        for (const particle of world.particles) {
          particle.x += particle.vx * STEP;
          particle.y += particle.vy * STEP;
          particle.life -= STEP;
        }
        world.particles = world.particles.filter((pt) => pt.life > 0);
        accumulator -= STEP;
      }
      if (screen === SCREEN_VICTORY && (input.takePressed('KeyC') || input.takePressed('Enter') || input.takePressed('PointerLeft'))) {
        screen = SCREEN_PLAY;
        sound.uiClick();
        announce('Endless flight. The waves keep coming.');
      } else if (input.takePressed('KeyR')) {
        startRun();
      } else if (screen === SCREEN_OVER && (input.takePressed('Enter') || input.takePressed('PointerLeft'))) {
        startRun();
      }
    }

    if (input.takePressed('KeyM')) {
      sound.setMuted(!sound.muted);
      announce(sound.muted ? 'Sound muted.' : 'Sound on.');
    }
    input.clearPressed();

    ctx.save();
    if (world.shake > 0.1) {
      ctx.translate((Math.random() * 2 - 1) * world.shake, (Math.random() * 2 - 1) * world.shake);
    }
    render(ctx, world, screen, ui);
    ctx.restore();
  }

  requestAnimationFrame(frame);
}
