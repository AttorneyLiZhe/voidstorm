// The VOIDSTORM world: one pilot ship against escalating waves in a neon arena.
// The world is pure simulation — it owns every entity and rule, advances in fixed steps, and
// reports what happened as event bits so the shell can play sounds and shake the screen.
// Rendering reads the world; it never writes it.

import { ENEMY_KINDS, FIELD, GEM, PLAYER, UPGRADES, WIN_BONUS, WIN_WAVE, isBossWave, waveHpScale, waveSize, xpForLevel } from './config.js';
import { Random } from './random.js';

export const EVENT_OVER = 1;
export const EVENT_LEVELUP = 2;
export const EVENT_WAVE = 4;
export const EVENT_BOSS = 8;
export const EVENT_HURT = 16;
export const EVENT_SHOOT = 32;
export const EVENT_KILL = 64;
export const EVENT_PICKUP = 128;
export const EVENT_SHIELD_BREAK = 256;
export const EVENT_BOSS_DOWN = 512;
export const EVENT_WIN = 1024;

const TAU = Math.PI * 2;

function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export class World {
  constructor() {
    this.rng = new Random(1);
    this.reset(1);
  }

  reset(seed) {
    this.rng = new Random(seed);
    this.time = 0;
    this.score = 0;
    this.kills = 0;
    this.wave = 0;
    this.waveState = 'intermission';
    this.waveTimer = 1.6;
    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.bossAlive = false;
    this.over = false;
    this.won = false;
    this.awaitingChoice = false;
    this.choices = [];
    this.pickupCombo = 0;
    this.pickupComboTimer = 0;
    this.shake = 0;

    this.player = {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      radius: PLAYER.radius,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      level: 1,
      xp: 0,
      xpNext: xpForLevel(1),
      speed: PLAYER.speed,
      accel: PLAYER.accel,
      damage: PLAYER.bulletDamageStart,
      fireInterval: PLAYER.fireCooldownStart,
      fireTimer: 0,
      projectiles: 1,
      pierce: 0,
      bulletSpeed: PLAYER.bulletSpeed,
      bulletLife: PLAYER.bulletLifeSeconds,
      magnet: PLAYER.magnetStart,
      regen: 0,
      shield: 0,
      shieldMax: 0,
      shieldTimer: 0,
      shieldRecharge: 14,
      invuln: 0,
      aimAngle: -Math.PI / 2,
      thrust: 0,
    };

    this.enemies = [];
    this.bullets = [];
    this.bolts = [];
    this.gems = [];
    this.particles = [];
    this.floaters = [];
    this.stars = [];
    this.nebulae = [];
    for (let i = 0; i < 150; i += 1) {
      this.stars.push({
        x: this.rng.range(0, FIELD.width),
        y: this.rng.range(0, FIELD.height),
        size: this.rng.range(0.6, 2.2),
        depth: this.rng.range(0.25, 1),
        twinkle: this.rng.range(0, TAU),
      });
    }
    const nebulaColors = ['#173a6e', '#3d1658', '#0d4d56', '#4d1030'];
    for (let i = 0; i < 5; i += 1) {
      this.nebulae.push({
        x: this.rng.range(0, FIELD.width),
        y: this.rng.range(0, FIELD.height),
        radius: this.rng.range(180, 380),
        color: nebulaColors[i % nebulaColors.length],
      });
    }
  }

  // ---- waves ---------------------------------------------------------------

  startWave() {
    this.wave += 1;
    this.waveState = 'active';
    this.bossAlive = false;
    if (isBossWave(this.wave)) {
      this.toSpawn = Math.floor(waveSize(this.wave) / 2);
      this.spawnBoss();
    } else {
      this.toSpawn = waveSize(this.wave);
    }
    this.spawnTimer = 0.4;
  }

  spawnPoint() {
    // Hostiles pour in over the arena rim, never on top of the pilot.
    for (let tries = 0; tries < 12; tries += 1) {
      const side = this.rng.int(0, 3);
      const margin = 30;
      let x = margin;
      let y = margin;
      if (side === 0) { x = this.rng.range(margin, FIELD.width - margin); y = -margin; }
      if (side === 1) { x = this.rng.range(margin, FIELD.width - margin); y = FIELD.height + margin; }
      if (side === 2) { x = -margin; y = this.rng.range(margin, FIELD.height - margin); }
      if (side === 3) { x = FIELD.width + margin; y = this.rng.range(margin, FIELD.height - margin); }
      if (distanceSq(x, y, this.player.x, this.player.y) > 260 * 260) return { x, y };
    }
    return { x: -30, y: -30 };
  }

  spawnEnemy(kind) {
    const base = ENEMY_KINDS[kind];
    const { x, y } = this.spawnPoint();
    const scale = waveHpScale(this.wave);
    this.enemies.push({
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: base.radius,
      hp: base.hp * scale,
      maxHp: base.hp * scale,
      speed: base.speed * this.rng.range(0.9, 1.1),
      damage: base.damage,
      score: base.score,
      xp: base.xp,
      angle: 0,
      wobble: this.rng.range(0, TAU),
      shotTimer: this.rng.range(0.8, base.shotCooldown ?? 2),
      flash: 0,
      bornAt: this.time,
    });
  }

  spawnBoss() {
    const base = ENEMY_KINDS.boss;
    const scale = 1 + (this.wave / 5 - 1) * 0.55;
    this.enemies.push({
      kind: 'boss',
      x: FIELD.width / 2,
      y: -60,
      vx: 0,
      vy: 0,
      radius: base.radius,
      hp: base.hp * scale,
      maxHp: base.hp * scale,
      speed: base.speed,
      damage: base.damage,
      score: base.score,
      xp: base.xp,
      angle: 0,
      wobble: 0,
      shotTimer: 1.2,
      flash: 0,
      bornAt: this.time,
    });
    this.bossAlive = true;
  }

  pickKind() {
    const wave = this.wave;
    const roll = this.rng.next();
    if (wave >= 2 && roll < 0.16) return 'splitter';
    if (wave >= 3 && roll < 0.36) return 'spitter';
    if (wave >= 2 && roll < 0.62) return 'weaver';
    return 'drifter';
  }

  // ---- combat --------------------------------------------------------------

  fireBullets() {
    const p = this.player;
    const count = p.projectiles;
    const spreadStep = 0.09;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spreadStep;
      const angle = p.aimAngle + offset;
      this.bullets.push({
        x: p.x + Math.cos(p.aimAngle) * (p.radius + 6),
        y: p.y + Math.sin(p.aimAngle) * (p.radius + 6),
        vx: Math.cos(angle) * p.bulletSpeed,
        vy: Math.sin(angle) * p.bulletSpeed,
        radius: PLAYER.bulletRadius,
        damage: p.damage,
        pierceLeft: p.pierce,
        life: p.bulletLife,
        hitIds: null,
      });
    }
    this.burst(p.x + Math.cos(p.aimAngle) * (p.radius + 10), p.y + Math.sin(p.aimAngle) * (p.radius + 10), 2, '#9be8ff', 90, 0.12);
  }

  burst(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i += 1) {
      const angle = this.rng.angle();
      const v = this.rng.range(speed * 0.3, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: this.rng.range(life * 0.5, life),
        maxLife: life,
        size: this.rng.range(1.5, 3.4),
        color,
      });
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  }

  floater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 0.8, maxLife: 0.8 });
    if (this.floaters.length > 40) this.floaters.shift();
  }

  dropGems(enemy) {
    let remaining = enemy.xp;
    while (remaining > 0) {
      const large = remaining >= GEM.valueLarge && this.rng.chance(0.7);
      const value = large ? GEM.valueLarge : GEM.valueSmall;
      remaining -= value;
      const angle = this.rng.angle();
      const dist = this.rng.range(0, 18);
      this.gems.push({
        x: enemy.x + Math.cos(angle) * dist,
        y: enemy.y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * 40,
        vy: Math.sin(angle) * 40,
        value,
        radius: large ? GEM.radius + 2.5 : GEM.radius,
        bob: this.rng.range(0, TAU),
      });
    }
  }

  killEnemy(enemy, events) {
    const base = ENEMY_KINDS[enemy.kind];
    this.score += enemy.score;
    this.kills += 1;
    this.dropGems(enemy);
    this.burst(enemy.x, enemy.y, enemy.kind === 'boss' ? 90 : 16, base.color, enemy.kind === 'boss' ? 340 : 210, 0.55);
    this.burst(enemy.x, enemy.y, 8, '#ffffff', 120, 0.25);
    this.floater(enemy.x, enemy.y - enemy.radius, `+${enemy.score}`, '#ffe9a8');
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < ENEMY_KINDS.splitter.children; i += 1) {
        const child = ENEMY_KINDS.mite;
        const angle = this.rng.angle();
        this.enemies.push({
          kind: 'mite',
          x: enemy.x + Math.cos(angle) * 14,
          y: enemy.y + Math.sin(angle) * 14,
          vx: Math.cos(angle) * 130,
          vy: Math.sin(angle) * 130,
          radius: child.radius,
          hp: child.hp * waveHpScale(this.wave),
          maxHp: child.hp * waveHpScale(this.wave),
          speed: child.speed,
          damage: child.damage,
          score: child.score,
          xp: child.xp,
          angle: 0,
          wobble: this.rng.range(0, TAU),
          shotTimer: 0,
          flash: 0,
          bornAt: this.time,
        });
      }
    }
    if (enemy.kind === 'boss') {
      this.bossAlive = false;
      this.shake = Math.min(14, this.shake + 10);
      events |= EVENT_BOSS_DOWN;
    } else {
      this.shake = Math.min(6, this.shake + 1.2);
    }
    return events | EVENT_KILL;
  }

  hurtPlayer(amount, events) {
    const p = this.player;
    if (p.invuln > 0 || this.over) return events;
    if (p.shield > 0) {
      p.shield -= 1;
      p.shieldTimer = p.shieldRecharge;
      p.invuln = PLAYER.contactInvulnSeconds;
      this.burst(p.x, p.y, 18, '#39d5ff', 200, 0.4);
      return events | EVENT_SHIELD_BREAK;
    }
    p.hp -= amount;
    p.invuln = PLAYER.contactInvulnSeconds;
    this.shake = Math.min(12, this.shake + 5);
    this.burst(p.x, p.y, 14, '#ff5d7a', 190, 0.4);
    if (p.hp <= 0) {
      p.hp = 0;
      this.over = true;
      this.burst(p.x, p.y, 110, '#39d5ff', 360, 0.9);
      this.burst(p.x, p.y, 60, '#ffd166', 260, 0.7);
      return events | EVENT_OVER | EVENT_HURT;
    }
    return events | EVENT_HURT;
  }

  gainXp(amount, events) {
    const p = this.player;
    p.xp += amount;
    if (p.xp >= p.xpNext && !this.awaitingChoice) {
      p.xp -= p.xpNext;
      p.level += 1;
      p.xpNext = xpForLevel(p.level);
      this.awaitingChoice = true;
      const pool = [...UPGRADES];
      this.choices = [];
      for (let i = 0; i < 3 && pool.length > 0; i += 1) {
        const index = Math.floor(this.rng.next() * pool.length);
        this.choices.push(pool.splice(index, 1)[0]);
      }
      this.burst(p.x, p.y, 42, '#39d5ff', 240, 0.6);
      events |= EVENT_LEVELUP;
    }
    return events;
  }

  applyChoice(index) {
    const choice = this.choices[index];
    if (!choice) return;
    choice.apply(this.player);
    this.awaitingChoice = false;
    this.choices = [];
    // A fat salvage haul can chain straight into another level.
    if (this.player.xp >= this.player.xpNext) {
      this.gainXp(0, 0);
    }
  }

  // ---- the step --------------------------------------------------------------

  step(dt, control) {
    let events = 0;
    if (this.over || this.awaitingChoice) return events;
    this.time += dt;
    const p = this.player;

    // Waves
    if (this.waveState === 'intermission') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.startWave();
        events |= isBossWave(this.wave) ? EVENT_BOSS : EVENT_WAVE;
      }
    } else if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      const interval = Math.max(0.18, 0.85 - this.wave * 0.045);
      if (this.spawnTimer <= 0) {
        this.spawnTimer = interval;
        const batch = this.wave >= 6 ? 2 : 1;
        for (let i = 0; i < batch && this.toSpawn > 0; i += 1) {
          this.spawnEnemy(this.pickKind());
          this.toSpawn -= 1;
        }
      }
    } else if (this.enemies.length === 0) {
      this.waveState = 'intermission';
      this.waveTimer = 2.4;
      this.score += 50 * this.wave;
      this.floater(p.x, p.y - 44, `WAVE BONUS +${50 * this.wave}`, '#51e07a');
      if (this.wave === WIN_WAVE && !this.won) {
        // The second Hollow Star is wreckage and the arena is clear: the run is won.
        // The shell pauses on the victory screen; the waves resume if the pilot stays.
        this.won = true;
        this.score += WIN_BONUS;
        this.burst(p.x, p.y, 90, '#ffd166', 320, 0.9);
        this.burst(p.x, p.y, 60, '#51e07a', 240, 0.7);
        events |= EVENT_WIN;
      }
    }

    // Pilot movement: thrust toward the held direction, drag against drift.
    const thrustX = control.moveX * p.accel;
    const thrustY = control.moveY * p.accel;
    p.vx += thrustX * dt;
    p.vy += thrustY * dt;
    const drag = Math.max(0, 1 - PLAYER.friction * dt * (control.moveX || control.moveY ? 0.35 : 1));
    p.vx *= drag;
    p.vy *= drag;
    const speedNow = Math.hypot(p.vx, p.vy);
    if (speedNow > p.speed) {
      p.vx = (p.vx / speedNow) * p.speed;
      p.vy = (p.vy / speedNow) * p.speed;
    }
    p.x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
    p.y = Math.min(FIELD.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));
    p.thrust = Math.min(1, speedNow / p.speed);
    p.aimAngle = Math.atan2(control.aimY - p.y, control.aimX - p.x);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    if (p.shieldMax > 0 && p.shield < p.shieldMax) {
      p.shieldTimer -= dt;
      if (p.shieldTimer <= 0) p.shield = p.shieldMax;
    }

    // Firing
    p.fireTimer -= dt;
    if (control.firing && p.fireTimer <= 0) {
      p.fireTimer = p.fireInterval;
      this.fireBullets();
      events |= EVENT_SHOOT;
    }

    // Hostiles
    for (const enemy of this.enemies) {
      const base = ENEMY_KINDS[enemy.kind];
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / dist;
      const uy = dy / dist;
      enemy.wobble += dt * (base.weaveFrequency ?? 2);
      let moveX = ux;
      let moveY = uy;
      if (enemy.kind === 'weaver') {
        moveX = ux + -uy * Math.sin(enemy.wobble) * 0.9;
        moveY = uy + ux * Math.sin(enemy.wobble) * 0.9;
      }
      if (enemy.kind === 'spitter' && dist < base.keepDistance) {
        moveX = -ux * 0.7 + -uy * 0.4;
        moveY = -uy * 0.7 + ux * 0.4;
      }
      if (enemy.kind === 'boss') {
        moveX = ux * 0.6;
        moveY = uy * 0.6 + Math.sin(this.time * 0.7) * 0.3;
        if (enemy.y < 110) { moveX = 0; moveY = 1; }
      }
      enemy.vx += (moveX * enemy.speed - enemy.vx) * Math.min(1, dt * 2.4);
      enemy.vy += (moveY * enemy.speed - enemy.vy) * Math.min(1, dt * 2.4);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.angle = Math.atan2(enemy.vy, enemy.vx);
      if (enemy.flash > 0) enemy.flash -= dt;

      if (enemy.kind === 'spitter' || enemy.kind === 'boss') {
        enemy.shotTimer -= dt;
        if (enemy.shotTimer <= 0 && dist < 560 && enemy.y > 0) {
          enemy.shotTimer = base.shotCooldown * this.rng.range(0.85, 1.15) * (enemy.kind === 'boss' && enemy.hp < enemy.maxHp * 0.3 ? 0.62 : 1);
          if (enemy.kind === 'boss') {
            for (let i = 0; i < base.radialShots; i += 1) {
              const angle = (i / base.radialShots) * TAU + this.time;
              this.bolts.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * base.boltSpeed, vy: Math.sin(angle) * base.boltSpeed, radius: 5, damage: base.boltDamage, life: 3.4 });
            }
            const aimed = Math.atan2(dy, dx);
            for (const off of [-0.16, 0, 0.16]) {
              this.bolts.push({ x: enemy.x, y: enemy.y, vx: Math.cos(aimed + off) * base.boltSpeed * 1.25, vy: Math.sin(aimed + off) * base.boltSpeed * 1.25, radius: 5, damage: base.boltDamage, life: 3 });
            }
          } else {
            this.bolts.push({ x: enemy.x, y: enemy.y, vx: ux * base.boltSpeed, vy: uy * base.boltSpeed, radius: 5, damage: base.boltDamage, life: 3 });
          }
        }
      }

      // Contact
      const touch = p.radius + enemy.radius - 2;
      if (distanceSq(enemy.x, enemy.y, p.x, p.y) < touch * touch) {
        events = this.hurtPlayer(enemy.damage, events);
        const push = 190;
        enemy.vx -= ux * push;
        enemy.vy -= uy * push;
      }
    }

    // Keep hostiles from stacking into one blob.
    for (let i = 0; i < this.enemies.length; i += 1) {
      for (let j = i + 1; j < this.enemies.length; j += 1) {
        const a = this.enemies[i];
        const b = this.enemies[j];
        const min = a.radius + b.radius;
        const d2 = distanceSq(a.x, a.y, b.x, b.y);
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 14 * dt;
          const px = (a.x - b.x) * push;
          const py = (a.y - b.y) * push;
          a.x += px; a.y += py;
          b.x -= px; b.y -= py;
        }
      }
    }

    // Player bullets
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        if (bullet.hitIds && bullet.hitIds.has(enemy)) continue;
        const touch = bullet.radius + enemy.radius;
        if (distanceSq(bullet.x, bullet.y, enemy.x, enemy.y) < touch * touch) {
          enemy.hp -= bullet.damage;
          enemy.flash = 0.07;
          this.floater(enemy.x + this.rng.range(-8, 8), enemy.y - enemy.radius - 4, `${Math.round(bullet.damage)}`, '#cfe9ff');
          this.burst(bullet.x, bullet.y, 3, ENEMY_KINDS[enemy.kind].color, 130, 0.2);
          if (bullet.pierceLeft > 0) {
            bullet.pierceLeft -= 1;
            if (!bullet.hitIds) bullet.hitIds = new Set();
            bullet.hitIds.add(enemy);
          } else {
            bullet.life = 0;
          }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -30 && b.x < FIELD.width + 30 && b.y > -30 && b.y < FIELD.height + 30);

    // Hostile bolts
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      const touch = bolt.radius + p.radius;
      if (distanceSq(bolt.x, bolt.y, p.x, p.y) < touch * touch) {
        bolt.life = 0;
        events = this.hurtPlayer(bolt.damage, events);
      }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0 && b.x > -40 && b.x < FIELD.width + 40 && b.y > -40 && b.y < FIELD.height + 40);

    // Reap the dead (a splitter's children arrive with hp > 0 and survive the filter).
    let anyDead = false;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        events = this.killEnemy(enemy, events);
        anyDead = true;
      }
    }
    if (anyDead) this.enemies = this.enemies.filter((e) => e.hp > 0);

    // Salvage gems drift, magnetise and collect.
    if (this.pickupComboTimer > 0) {
      this.pickupComboTimer -= dt;
    } else {
      this.pickupCombo = 0;
    }
    for (const gem of this.gems) {
      gem.bob += dt * 3;
      const d2 = distanceSq(gem.x, gem.y, p.x, p.y);
      if (d2 < p.magnet * p.magnet) {
        const d = Math.max(1, Math.sqrt(d2));
        gem.vx = ((p.x - gem.x) / d) * GEM.magnetSpeed;
        gem.vy = ((p.y - gem.y) / d) * GEM.magnetSpeed;
      } else {
        gem.vx *= 0.9;
        gem.vy *= 0.9;
      }
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      const touch = gem.radius + p.radius + 4;
      if (d2 < touch * touch) {
        gem.taken = true;
        this.pickupCombo += 1;
        this.pickupComboTimer = 1.4;
        this.score += 5;
        events = this.gainXp(gem.value, events) | EVENT_PICKUP;
      }
    }
    this.gems = this.gems.filter((g) => !g.taken);

    // Particles and floaters are cosmetic but live here so a screenshot scene can freeze them.
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const floater of this.floaters) {
      floater.y -= 34 * dt;
      floater.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    this.shake *= Math.pow(0.0015, dt);
    if (this.shake < 0.05) this.shake = 0;
    return events;
  }
}
