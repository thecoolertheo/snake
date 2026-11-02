// Game rules only. No DOM, no canvas, no timers: safe to load in tests.html or Node.
// The app calls step() on a fixed timestep and turn() on input, then drains game.events.
(function (root) {
  'use strict';
  const S = root.Snake = root.Snake || {};

  const MAX_QUEUE = 3;
  const REDO_WINDOW = 0.4;   // fraction of a step during which a turn redoes the last move

  class Game {
    constructor(opts = {}) {
      this.cols = opts.cols || 17;
      this.rows = opts.rows || 15;
      this.appleCount = opts.apples || 1;
      this.mode = opts.mode || 'classic';
      this.rng = opts.rng || Math.random;
      this.reset();
    }

    idx(x, y) { return y * this.cols + x; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }

    reset() {
      const y = Math.floor(this.rows / 2), hx = Math.max(2, Math.floor(this.cols / 4));
      this.occ = new Uint16Array(this.cols * this.rows);   // how many body cells sit on each tile
      this.cells = [];
      for (let i = 0; i < 3; i++) this._addCell(hx - i, y, false);
      const t = this.cells[2];
      this.prevTail = { x: t.x, y: t.y };
      this.dir = { x: 1, y: 0 };
      this.prevDir = { x: 1, y: 0 };
      this.queue = [];
      this.apples = [];
      this.score = 0;
      this.grow = 0;
      this.steps = 0;
      this.alive = true;
      this.won = false;
      this.undo = null;
      this.events = [];
      this.fillApples();
    }

    _addCell(x, y, front) {
      const c = { x, y };
      if (front) this.cells.unshift(c); else this.cells.push(c);
      this.occ[this.idx(x, y)]++;
      return c;
    }

    appleAt(x, y) {
      for (let i = 0; i < this.apples.length; i++) if (this.apples[i].x === x && this.apples[i].y === y) return i;
      return -1;
    }

    isFree(x, y) { return this.occ[this.idx(x, y)] === 0 && this.appleAt(x, y) < 0; }

    // Picks a random free tile without building a list of every free tile.
    randomFree() {
      let free = 0;
      for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (this.isFree(x, y)) free++;
      if (!free) return null;
      let k = Math.floor(this.rng() * free);
      for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
        if (this.isFree(x, y) && k-- === 0) return { x, y };
      }
      return null;
    }

    fillApples() {
      while (this.apples.length < this.appleCount) {
        const c = this.randomFree();
        if (!c) break;
        this.apples.push(c);
      }
    }

    // Test helper: put apples exactly where you want them.
    setApples(list) { this.apples = list.map(a => ({ x: a.x, y: a.y })); }

    // progress = how far (0..1) the head is through the current step; enables the instant-turn redo.
    // Returns false (ignored), true (queued) or 'redo' (last move was redone in the new direction).
    turn(nx, ny, progress = 1) {
      if (!this.alive) return false;
      const d = this.dir, u = this.undo;
      if (this.queue.length === 0 && u && progress < REDO_WINDOW &&
          d.x === u.dir.x && d.y === u.dir.y && nx * d.x + ny * d.y === 0) {
        this._revert();
        this.queue.push({ x: nx, y: ny });
        this.step();
        return 'redo';
      }
      const ref = this.queue.length ? this.queue[this.queue.length - 1] : d;
      if (nx * ref.x + ny * ref.y !== 0) return false;   // same direction or a reversal
      if (this.queue.length >= MAX_QUEUE) return false;
      this.queue.push({ x: nx, y: ny });
      return true;
    }

    _revert() {
      const u = this.undo;
      const h = this.cells.shift();
      this.occ[this.idx(h.x, h.y)]--;
      if (u.popped) { this.cells.push(u.popped); this.occ[this.idx(u.popped.x, u.popped.y)]++; }
      this.prevTail = u.prevTail; this.dir = u.dir; this.prevDir = u.prevDir; this.grow = u.grow;
      this.steps--;
      this.undo = null;
    }

    step() {
      if (!this.alive) return;
      const nd = this.queue.length ? this.queue.shift() : this.dir;
      const head = this.cells[0], tail = this.cells[this.cells.length - 1];
      const hx = head.x + nd.x, hy = head.y + nd.y;
      const inside = this.inBounds(hx, hy);
      const ai = inside ? this.appleAt(hx, hy) : -1;
      const tailMoves = this.grow === 0 && ai < 0;
      const hitSelf = inside && this.occ[this.idx(hx, hy)] > 0 && !(tailMoves && tail.x === hx && tail.y === hy);
      if (!inside || hitSelf) {
        this.alive = false; this.queue.length = 0; this.undo = null; this.prevDir = this.dir;
        this.events.push({ type: 'die', x: hx, y: hy });
        return;
      }

      const u = { prevTail: this.prevTail, dir: this.dir, prevDir: this.prevDir, grow: this.grow, popped: null };
      this.prevDir = this.dir; this.dir = nd;
      this.prevTail = { x: tail.x, y: tail.y };
      this._addCell(hx, hy, true);
      this.undo = u;

      if (ai >= 0) {
        this.apples.splice(ai, 1);
        this.score++; this.grow++; this.undo = null;
        this.events.push({ type: 'eat', x: hx, y: hy });
      }
      if (this.grow > 0) this.grow--;
      else {
        const t = this.cells.pop();
        this.occ[this.idx(t.x, t.y)]--;
        if (this.undo) this.undo.popped = t;
      }
      this.steps++;
      if (ai >= 0) this.fillApples();
      if (this.apples.length === 0) {
        this.alive = false; this.won = true; this.undo = null;
        this.events.push({ type: 'win' });
      }
    }
  }

  S.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
