// input.js — keyboard and mouse state for NEONFALL.
//
// Movement keys are polled each frame through `moveVector()`; discrete
// actions (pause, mute, confirm, upgrade picks, restart) are delivered as
// events through the `onAction` callback the game registers. Mouse position
// is tracked in canvas coordinates for menu and upgrade-card clicks.

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

const ACTION_KEYS = {
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
  Enter: 'confirm', Space: 'confirm',
  KeyR: 'restart',
  Digit1: 'pick1', Digit2: 'pick2', Digit3: 'pick3',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.onAction = null;

    window.addEventListener('keydown', (event) => {
      if (MOVE_KEYS[event.code]) {
        this.held.add(MOVE_KEYS[event.code]);
        event.preventDefault();
      }
      const action = ACTION_KEYS[event.code];
      if (action && !event.repeat && this.onAction) this.onAction(action);
      if (event.code === 'Space') event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      if (MOVE_KEYS[event.code]) this.held.delete(MOVE_KEYS[event.code]);
    });
    window.addEventListener('blur', () => this.held.clear());

    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', () => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      if (this.onAction) this.onAction('click');
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
  }

  // Normalized WASD/arrow direction; {x: 0, y: 0} when idle.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y -= 1;
    if (this.held.has('down')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  // Consume the click flag at the end of a frame.
  endFrame() {
    this.mouse.clicked = false;
  }
}
