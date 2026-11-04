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
    { id: 'peaceful',   name: 'Peaceful',   desc: 'You can’t die. Just relax.', wrap: true, ghost: true },
    // Unlockable modes (see skins.js for what unlocks them)
    { id: 'turbo',      name: 'Turbo',      desc: 'Gets faster with every apple. No speed limit… almost.', turbo: true },
    { id: 'mirror',     name: 'Mirror',     desc: 'Controls are flipped: left is right, up is down.', mirror: true },
    { id: 'dark',       name: 'Dark',       desc: 'You can only see what’s near your head.', dark: true },
    { id: 'gold',       name: 'Gold Rush',  desc: 'Golden apples are worth 3, but they don’t stay long.', gold: true },
    { id: 'hunger',     name: 'Hunger',     desc: 'Keep eating! You shrink when hungry and starve at length 1.', hunger: true },
    { id: 'runaway',    name: 'Runaway',    desc: 'Apples hop away when you get close.', runaway: true }
  ];
  const HUNGER_START = 30, HUNGER_EVERY = 8;   // steps without food before shrinking, then one cell per 8 steps
  const GOLD_CHANCE = 0.3, GOLD_LIFE = 45;   // steps a golden apple stays before turning normal
  const MODE = {}; for (const m of MODES) MODE[m.id] = m;

  class Game {
    constructor(opts = {}) {
      this.cols = opts.cols || 17;
      this.rows = opts.rows || 15;
      this.appleCount = opts.apples || 1;
      this.mode = MODE[opts.mode] ? opts.mode : 'classic';
      this.rules = MODE[this.mode];
      this.rng = opts.rng || Math.random;
      this.useGrace = opts.grace !== false;   // Google-style beat of grace before a crash
      this.seed = opts.seed;                  // Daily Challenge: apples land in the same order for everyone
      this.blocks = opts.blocks || [];        // walls already on the board at the start
      this.start = opts.start;                // { x, y, dx }: where the snake begins, if not the usual spot
      this.share = opts.share;                // two-player: share this game's board, so the snakes can hit each other
      this.waitApples = !!opts.waitApples;    // two-player: apples go down once both snakes are on the board
      this.reset();
    }

    idx(x, y) { return y * this.cols + x; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }

    reset() {
      const o = this.start, s = this.share, size = this.cols * this.rows;
      const y = o ? o.y : Math.floor(this.rows / 2), hx = o ? o.x : Math.max(2, Math.floor(this.cols / 4)), dx = o ? o.dx : 1;
      this.occ = s ? s.occ : new Uint16Array(size);    // how many body cells sit on each tile (Peaceful lets them overlap)
      this.wall = s ? s.wall : new Uint8Array(size);   // 0 none, 1 waiting for the tail to leave, 2 solid
      this.pendingWalls = [];
      this.wallCount = 0;
      this.spawned = 0;
      for (const [bx, by] of this.blocks) { this.wall[this.idx(bx, by)] = 2; this.wallCount++; }
      this.cells = [];
      for (let i = 0; i < 3; i++) this._addCell(hx - i * dx, y, false);
      const t = this.cells[2];
      this.prevTail = { x: t.x, y: t.y };
      this.dir = { x: dx, y: 0 };
      this.prevDir = { x: dx, y: 0 };
      this.queue = [];
      this.apples = s ? s.apples : [];
      this.pairSeq = 0;
      this.score = 0;
      this.eaten = 0;      // apples eaten (a golden apple scores 3 but is still one apple)
      this.grow = 0;
      this.steps = 0;
      this.maxLen = 3;
      this.alive = true;
      this.inGrace = false;
      this.hungry = 0;
      this.won = false;
      this.undo = null;
      this.events = [];
      if (!this.waitApples) this.fillApples();
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
      // Seeded: apple number n is worked out from n alone, so where your snake happens to be doesn't change
      // the order. If that exact tile is taken it tries the next one in the same fixed list.
      if (this.seed !== undefined) {
        this.rng = S.util.rng(this.seed + ++this.spawned * 7919);
        for (let i = 0; i < 200; i++) {
          const x = Math.floor(this.rng() * this.cols), y = Math.floor(this.rng() * this.rows);
          if (this.isFree(x, y)) return { x, y };
        }
      }
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
      while (this._count('apple') + this._count('gold') < this.appleCount) {
        const c = this.randomFree(); if (!c) break;
        if (r.gold && this.steps > 0 && this.rng() < GOLD_CHANCE) this.apples.push({ x: c.x, y: c.y, kind: 'gold', until: this.steps + GOLD_LIFE });
        else this.apples.push({ x: c.x, y: c.y, kind: 'apple' });
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
      if (this.rules.mirror) { nx = -nx; ny = -ny; }
      const d = this.dir, u = this.undo;
      if (this.queue.length === 0 && u && !this.inGrace && progress < REDO_WINDOW &&
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

    // About to crash. The first time, the snake waits one step at the edge (like Google Snake)
    // so you can still turn away. If it's still heading into trouble next step, it dies.
    _crash(x, y, nd) {
      if (this.useGrace && !this.inGrace) {
        this.inGrace = true; this.undo = null; this.prevDir = nd; this.dir = nd;
        this.events.push({ type: 'grace', x, y });
        return;
      }
      this.dir = nd;   // it dies heading the way it was going, even if that turn is what killed it
      this._die(x, y);
    }

    _die(x, y, meet) {
      this.inGrace = false;
      this.alive = false; this.queue.length = 0; this.undo = null; this.prevDir = this.dir;
      this.events.push({ type: 'die', x, y, meet: !!meet });
    }

    // Where the head goes next, without moving it.
    peek() {
      const d = this.queue.length ? this.queue[0] : this.dir, h = this.cells[0];
      let x = h.x + d.x, y = h.y + d.y;
      if (!this.inBounds(x, y) && this.rules.wrap) { x = (x + this.cols) % this.cols; y = (y + this.rows) % this.rows; }
      return { x, y };
    }

    // Two-player: this snake and the other one collided, so it dies on this step. meet = they met in an empty tile.
    clash(x, y, meet) {
      if (this.queue.length) this.dir = this.queue.shift();
      this._die(x, y, meet);
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
        if (!r.wrap) return this._crash(hx, hy, nd);
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
      if (this.wall[i] === 2) return this._crash(hx, hy, nd);
      if (!r.ghost && this.occ[i] > 0 && !(tailMoves && tail.x === hx && tail.y === hy)) return this._crash(hx, hy, nd);
      this.inGrace = false;

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
          const worth = apple.kind === 'gold' ? 3 : 1;
          this.score += worth; this.grow += worth; this.eaten++;
          this.events.push({ type: 'eat', x: hx, y: hy, kind: apple.kind, worth });
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

      // Hunger: after a while without food you lose a cell every few steps; at length 1 you starve.
      if (r.hunger) {
        this.hungry = feeds ? 0 : this.hungry + 1;
        if (this.hungry >= HUNGER_START && (this.hungry - HUNGER_START) % HUNGER_EVERY === 0) {
          if (this.cells.length <= 2) { this.events.push({ type: 'starve' }); return this._die(hx, hy); }
          const t = this._popTail();
          this.prevTail = { x: t.x, y: t.y }; this.undo = null;
          this.events.push({ type: 'shrink', x: t.x, y: t.y });
        }
      }

      this.steps++;
      if (this.cells.length > this.maxLen) this.maxLen = this.cells.length;
      if (r.runaway && this.steps % 3 === 0) this._flee();
      // Golden apples that weren't eaten in time turn back into normal ones.
      for (const a of this.apples) if (a.kind === 'gold' && this.steps >= a.until) {
        a.kind = 'apple'; delete a.until;
        this.events.push({ type: 'expire', x: a.x, y: a.y });
      }
      if (apple) this.fillApples();
      const food = r.portal ? this._count('portal') : this._count('apple') + this._count('gold');
      if (food === 0) {
        this.alive = false; this.won = true; this.undo = null;
        this.events.push({ type: 'win' });
      }
    }
  }

  // Two-player: one step for both snakes, played so that neither gets an advantage from moving first.
  // Both step even if the first one dies, so a shared death is a draw.
  S.duelStep = function (a, b) {
    const ta = a.peek(), tb = b.peek(), ha = a.cells[0], hb = b.cells[0];
    const at = (p, c) => p.x === c.x && p.y === c.y;
    const tailA = a.cells[a.cells.length - 1], tailB = b.cells[b.cells.length - 1];
    const aOnTail = at(ta, tailB), bOnTail = at(tb, tailA);
    if (at(ta, tb)) { a.clash(ta.x, ta.y, true); b.clash(tb.x, tb.y, true); return; }   // both went for the same tile
    if ((at(ta, hb) && at(tb, ha)) || (aOnTail && bOnTail)) { a.clash(ta.x, ta.y); b.clash(tb.x, tb.y); return; }   // head to head, or chasing each other's tails
    // Whoever is following the other's tail moves second, so that tail has already moved out of the way.
    if (aOnTail) { b.step(); a.step(); } else { a.step(); b.step(); }
  };

  // 0..1: how close a Hunger snake is to its next shrink (0 = just ate).
  // p = how far through the current step we are, so the meter can fill smoothly between steps.
  Game.prototype.hungerLevel = function (p = 0) {
    if (!this.rules.hunger) return 0;
    return Math.min(1, (this.hungry + p) / HUNGER_START);
  };

  // Runaway: apples near your head hop to a neighbouring free tile that's further from you.
  Game.prototype._flee = function () {
    const h = this.cells[0];
    for (const a of this.apples) {
      if (a.kind !== 'apple') continue;
      const d0 = Math.abs(a.x - h.x) + Math.abs(a.y - h.y);
      if (d0 > 5 || this.rng() > 0.7) continue;
      let best = null, bestD = d0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = a.x + dx, y = a.y + dy;
        if (!this.inBounds(x, y) || !this.isFree(x, y)) continue;
        const d = Math.abs(x - h.x) + Math.abs(y - h.y);
        if (d > bestD) { bestD = d; best = { x, y }; n = 1; }
        else if (d === bestD && best && this.rng() < 1 / ++n) best = { x, y };
      }
      if (best) {
        a.fx = a.x; a.fy = a.y; a.movedAt = this.steps;
        a.x = best.x; a.y = best.y;
        this.events.push({ type: 'hop', x: a.x, y: a.y });
      }
    }
  };

  // Used by the menu preview: drop the tail cell (the preview snake shrinks back down).
  Game.prototype.trimTail = function () {
    if (this.cells.length <= 3) return false;
    const t = this._popTail(); this.prevTail = { x: t.x, y: t.y }; this.undo = null;
    return true;
  };

  S.Game = Game;
  S.MODES = MODES;
  S.MODE = MODE;
})(typeof window !== 'undefined' ? window : globalThis);
