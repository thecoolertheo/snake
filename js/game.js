// Game rules only. No DOM, no canvas, no timers: safe to load in tests.html or Node.
// The app calls step() on a fixed timestep and turn() on input, then drains game.events.
(function (root) {
  'use strict';
  const S = root.Snake = root.Snake || {};

  const MAX_QUEUE = 3;
  const REDO_WINDOW = 0.4;   // fraction of a step during which a turn redoes the last move
  const MIN_LEN = 3;

  // Rule flags per mode. Names/descriptions for the menu live here too so everything agrees.
  const MODES = [
    { id: 'classic',    name: 'Classic',    desc: 'Don’t hit the edge or yourself.' },
    { id: 'borderless', name: 'Borderless', desc: 'Go off one edge, come back on the other.', wrap: true },
    { id: 'walls',      name: 'Walls',      desc: 'Every apple leaves a wall behind.', walls: true },
    { id: 'portal',     name: 'Portal',     desc: 'Apples come in pairs that teleport you.', portal: true },
    { id: 'poison',     name: 'Poison',     desc: 'Purple apples shrink you.', poison: true },
    { id: 'peaceful',   name: 'Peaceful',   desc: 'You can’t die. Just relax.', wrap: true, ghost: true }
  ];
  const MODE = {}; for (const m of MODES) MODE[m.id] = m;

  class Game {
    constructor(opts = {}) {
      this.cols = opts.cols || 17;
      this.rows = opts.rows || 15;
      this.appleCount = opts.apples || 1;
      this.mode = MODE[opts.mode] ? opts.mode : 'classic';
      this.rules = MODE[this.mode];
      this.rng = opts.rng || Math.random;
      this.reset();
    }

    idx(x, y) { return y * this.cols + x; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }

    reset() {
      const y = Math.floor(this.rows / 2), hx = Math.max(2, Math.floor(this.cols / 4));
      const size = this.cols * this.rows;
      this.occ = new Uint16Array(size);    // how many body cells sit on each tile (Peaceful lets them overlap)
      this.wall = new Uint8Array(size);    // 0 none, 1 waiting for the tail to leave, 2 solid
      this.pendingWalls = [];
      this.wallCount = 0;
      this.cells = [];
      for (let i = 0; i < 3; i++) this._addCell(hx - i, y, false);
      const t = this.cells[2];
      this.prevTail = { x: t.x, y: t.y };
      this.dir = { x: 1, y: 0 };
      this.prevDir = { x: 1, y: 0 };
      this.queue = [];
      this.apples = [];
      this.pairSeq = 0;
      this.score = 0;
      this.grow = 0;
      this.steps = 0;
      this.maxLen = 3;
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
    _popTail() {
      const t = this.cells.pop();
      this.occ[this.idx(t.x, t.y)]--;
      return t;
    }

    appleAt(x, y) {
      for (let i = 0; i < this.apples.length; i++) if (this.apples[i].x === x && this.apples[i].y === y) return i;
      return -1;
    }

    isFree(x, y) { const i = this.idx(x, y); return this.occ[i] === 0 && this.wall[i] === 0 && this.appleAt(x, y) < 0; }

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

    _count(kind) { let n = 0; for (const a of this.apples) if (a.kind === kind) n++; return n; }

    fillApples() {
      const r = this.rules;
      if (r.portal) {
        while (this._count('portal') < this.appleCount * 2) {
          const a = this.randomFree(); if (!a) break;
          const pa = { x: a.x, y: a.y, kind: 'portal', pair: this.pairSeq };
          this.apples.push(pa);
          const b = this.randomFree();
          if (!b) { this.apples.pop(); break; }
          this.apples.push({ x: b.x, y: b.y, kind: 'portal', pair: this.pairSeq });
          this.pairSeq++;
        }
        return;
      }
      while (this._count('apple') < this.appleCount) {
        const c = this.randomFree(); if (!c) break;
        this.apples.push({ x: c.x, y: c.y, kind: 'apple' });
      }
      if (r.poison) {
        const want = Math.ceil(this.appleCount / 2);
        while (this._count('poison') < want) {
          const c = this.randomFree(); if (!c) break;
          this.apples.push({ x: c.x, y: c.y, kind: 'poison' });
        }
      }
    }

    // Test helper: put apples exactly where you want them.
    setApples(list) { this.apples = list.map(a => ({ x: a.x, y: a.y, kind: a.kind || 'apple', pair: a.pair })); }

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

    _die(x, y) {
      this.alive = false; this.queue.length = 0; this.undo = null; this.prevDir = this.dir;
      this.events.push({ type: 'die', x, y });
    }

    step() {
      if (!this.alive) return;
      const r = this.rules;
      const nd = this.queue.length ? this.queue.shift() : this.dir;
      const head = this.cells[0], tail = this.cells[this.cells.length - 1];
      let hx = head.x + nd.x, hy = head.y + nd.y;
      // A "jump" is a gap in the body (wrapping or a portal). The renderer draws the body in two
      // pieces: into ja on the old side, and out of jb on the new side.
      let jump = null;

      if (!this.inBounds(hx, hy)) {
        if (!r.wrap) return this._die(hx, hy);
        const wx = (hx + this.cols) % this.cols, wy = (hy + this.rows) % this.rows;
        jump = { ja: { x: hx, y: hy }, jb: { x: wx - nd.x, y: wy - nd.y } };
        hx = wx; hy = wy;
      }

      let ai = this.appleAt(hx, hy);
      const apple = ai >= 0 ? this.apples[ai] : null;
      let partner = null;
      if (apple && apple.kind === 'portal') {
        partner = this.apples.find(a => a !== apple && a.kind === 'portal' && a.pair === apple.pair);
        if (partner) { jump = { ja: { x: hx, y: hy }, jb: { x: partner.x, y: partner.y } }; hx = partner.x; hy = partner.y; }
      }

      const feeds = apple && apple.kind !== 'poison';
      const tailMoves = this.grow === 0 && !feeds;
      const i = this.idx(hx, hy);
      if (this.wall[i] === 2) return this._die(hx, hy);
      if (!r.ghost && this.occ[i] > 0 && !(tailMoves && tail.x === hx && tail.y === hy)) return this._die(hx, hy);

      const u = { prevTail: this.prevTail, dir: this.dir, prevDir: this.prevDir, grow: this.grow, popped: null };
      this.prevDir = this.dir; this.dir = nd;
      this.prevTail = { x: tail.x, y: tail.y };
      const c = this._addCell(hx, hy, true);
      if (jump) { c.ja = jump.ja; c.jb = jump.jb; }
      this.undo = u;

      let shrink = 0;
      if (apple) {
        this.undo = null;
        if (apple.kind === 'poison') {
          this.apples.splice(ai, 1);
          shrink = Math.max(0, Math.min(2, this.cells.length - 1 - MIN_LEN));
          this.events.push({ type: 'poison', x: hx, y: hy });
        } else {
          if (partner) {
            this.apples = this.apples.filter(a => a !== apple && a !== partner);
            this.events.push({ type: 'portal', x: apple.x, y: apple.y, tx: hx, ty: hy, pair: apple.pair });
          } else this.apples.splice(ai, 1);
          this.score++; this.grow++;
          this.events.push({ type: 'eat', x: hx, y: hy, kind: apple.kind });
          if (r.walls) { this.wall[i] = 1; this.pendingWalls.push(i); }
        }
      }

      if (this.grow > 0) this.grow--;
      else {
        const t = this._popTail();
        if (this.undo) this.undo.popped = t;
      }
      for (let s = 0; s < shrink; s++) {
        const t = this._popTail();
        this.prevTail = { x: t.x, y: t.y };
        this.events.push({ type: 'shrink', x: t.x, y: t.y });
      }

      // Walls become solid once the tail has left the tile.
      for (let k = this.pendingWalls.length - 1; k >= 0; k--) {
        const w = this.pendingWalls[k];
        if (this.occ[w] === 0) {
          this.wall[w] = 2; this.wallCount++; this.pendingWalls.splice(k, 1);
          this.events.push({ type: 'wall', x: w % this.cols, y: (w / this.cols) | 0 });
        }
      }

      this.steps++;
      if (this.cells.length > this.maxLen) this.maxLen = this.cells.length;
      if (apple) this.fillApples();
      const food = r.portal ? this._count('portal') : this._count('apple');
      if (food === 0) {
        this.alive = false; this.won = true; this.undo = null;
        this.events.push({ type: 'win' });
      }
    }
  }

  S.Game = Game;
  S.MODES = MODES;
  S.MODE = MODE;
})(typeof window !== 'undefined' ? window : globalThis);
