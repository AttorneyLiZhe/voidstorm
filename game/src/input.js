// Keyboard and mouse, gathered in one place. The game reads a plain control object each step
// ({ moveX, moveY, aimX, aimY, firing }), so live input, the screenshot autopilot and any
// future replay all drive the world through exactly the same shape.

import { FIELD } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = FIELD.width / 2;
    this.mouseY = FIELD.height / 3;
    this.mouseDown = false;
    this.pressed = new Set(); // keys that went down since the last read (for menus and pause)
    this.onFirstGesture = null; // audio unlock hook, fired once

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
      this.gesture();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('pointermove', (event) => this.trackMouse(event));
    canvas.addEventListener('pointerdown', (event) => {
      this.trackMouse(event);
      if (event.button === 0) this.mouseDown = true;
      this.pressed.add('PointerLeft');
      this.gesture();
    });
    window.addEventListener('pointerup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  gesture() {
    if (this.onFirstGesture) {
      const hook = this.onFirstGesture;
      this.onFirstGesture = null;
      hook();
    }
  }

  trackMouse(event) {
    const rect = this.canvas.getBoundingClientRect();
    // The canvas letterboxes the field: undo the letterbox so aim matches what is drawn.
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const drawnWidth = FIELD.width * scale;
    const drawnHeight = FIELD.height * scale;
    const offsetX = (rect.width - drawnWidth) / 2;
    const offsetY = (rect.height - drawnHeight) / 2;
    this.mouseX = (event.clientX - rect.left - offsetX) / scale;
    this.mouseY = (event.clientY - rect.top - offsetY) / scale;
  }

  /** The control object for the world, from whatever the player is holding right now. */
  control(player) {
    let moveX = 0;
    let moveY = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveY -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveY += 1;
    const length = Math.hypot(moveX, moveY);
    if (length > 0) {
      moveX /= length;
      moveY /= length;
    }
    return {
      moveX,
      moveY,
      aimX: this.mouseX,
      aimY: this.mouseY,
      firing: this.mouseDown || this.keys.has('Space'),
      playerX: player.x,
      playerY: player.y,
    };
  }

  /** True once per physical press of `code` since the last frame; reading consumes it. */
  takePressed(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  clearPressed() {
    this.pressed.clear();
  }
}
