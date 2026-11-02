// Drawing only. Reads game state, never changes it.
// All drawing is in "board units" (40 per cell); the canvas transform maps that to device pixels.
(function (root) {
  'use strict';
  const S = root.Snake, U = S.util, SK = S.skins;

  const CELL = 40, STEP = 4;
  const TILE_A = '#1c2a22', TILE_B = '#18241d', GREY = [86, 96, 90];
  const HUE_Q = 8;        // rainbow hue is bucketed in 8° steps so neighbouring points share one stroke
  const SHADE_GROUP = 3;  // the shadow (mostly hidden) uses 3× coarser buckets: half the strokes
  const PORTAL_COLORS = ['#4fc3ff', '#ff9f43', '#c77dff', '#5be37d', '#ff6fb1'];
  const TAU = Math.PI * 2;

  const R = { CELL, TILE_A, TILE_B, PORTAL_COLORS, reduced: false };

  // Growable buffers, reused every frame instead of allocating point objects.
  class Buf {
    constructor(cap) { this.n = 0; this._alloc(cap || 256); }
    _alloc(cap) {
      const o = this, F = Float32Array;
      const nx = new F(cap), ny = new F(cap), nm = new F(cap), nw = new F(cap);
      const nk = new Int32Array(cap), nks = new Int32Array(cap), nb = new Uint8Array(cap);
      if (o.x) { nx.set(o.x); ny.set(o.y); nm.set(o.m); nw.set(o.w); nk.set(o.k); nks.set(o.ks); nb.set(o.b); }
      o.cap = cap; o.x = nx; o.y = ny; o.m = nm; o.w = nw; o.k = nk; o.ks = nks; o.b = nb;
    }
    // brk = 1 starts a new piece (a gap from wrapping or a portal)
    push(x, y, m, brk) {
      if (this.n >= this.cap) this._alloc(this.cap * 2);
      const i = this.n++; this.x[i] = x; this.y[i] = y; this.m[i] = m; this.b[i] = brk ? 1 : 0;
    }
  }

  function dot(g, cx, cy, r) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); }

  // Draws one snake. Each canvas that shows a snake owns one of these (they cache colours).
  class SnakeDrawer {
    constructor() {
      this.path = new Buf(512);
      this.verts = new Buf(64);
      this.sig = '';
      this.body = []; this.shade = [];
    }

    // Smooth path from tail to head with rounded corners.
    // m = distance from the tail along the path, so patterns stay stuck to the body.
    build(cells, prevTail, p, cell) {
      const v = this.verts, out = this.path, h = cell / 2, n = cells.length;
      v.n = 0; out.n = 0;
      let brk = false;
      const addV = (x, y) => {   // x, y in cell units
        x = x * cell + h; y = y * cell + h;
        const i = v.n - 1;
        if (!brk && i >= 0 && Math.abs(v.x[i] - x) + Math.abs(v.y[i] - y) <= 0.01) return;
        v.push(x, y, 0, brk); brk = false;
      };
      const lerpV = (a, b, t) => addV(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

      // Tail end. If the tail cell was entered through a gap, part of the tail is still on the old side.
      const tl = cells[n - 1];
      if (tl.ja) { lerpV(prevTail, tl.ja, p); addV(tl.ja.x, tl.ja.y); brk = true; addV(tl.jb.x, tl.jb.y); }
      else lerpV(prevTail, tl, p);
      for (let i = n - 1; i >= 1; i--) {
        addV(cells[i].x, cells[i].y);
        const nx = cells[i - 1];
        if (i - 1 >= 1 && nx.ja) { addV(nx.ja.x, nx.ja.y); brk = true; addV(nx.jb.x, nx.jb.y); }
      }
      // Head end: slides from cells[1] towards cells[0] (through the gap if there is one).
      const c0 = cells[0], c1 = cells[1];
      if (c0.ja) { lerpV(c1, c0.ja, p); brk = true; addV(c0.jb.x, c0.jb.y); lerpV(c0.jb, c0, p); }
      else lerpV(c1, c0, p);

      let cx0 = v.x[0], cy0 = v.y[0], m = 0;
      out.push(cx0, cy0, 0, 1);
      const line = (tx, ty) => {
        const len = Math.hypot(tx - cx0, ty - cy0); if (len < 0.01) return;
        const steps = Math.ceil(len / STEP);
        for (let j = 1; j <= steps; j++) out.push(cx0 + (tx - cx0) * j / steps, cy0 + (ty - cy0) * j / steps, m + len * j / steps, 0);
        m += len; cx0 = tx; cy0 = ty;
      };
      for (let i = 1; i < v.n; i++) {
        const Vx = v.x[i], Vy = v.y[i];
        if (v.b[i]) { cx0 = Vx; cy0 = Vy; out.push(Vx, Vy, m, 1); continue; }
        const Ax = v.x[i - 1], Ay = v.y[i - 1];
        if (i + 1 < v.n && !v.b[i + 1]) {
          const Bx = v.x[i + 1], By = v.y[i + 1];
          const ux = Math.sign(Vx - Ax), uy = Math.sign(Vy - Ay), wx = Math.sign(Bx - Vx), wy = Math.sign(By - Vy);
          const r = Math.min(cell / 2, Math.hypot(Vx - Ax, Vy - Ay), Math.hypot(Bx - Vx, By - Vy));
          if ((ux !== wx || uy !== wy) && r > 0.5) {
            const sx = Vx - ux * r, sy = Vy - uy * r; line(sx, sy);
            const ccx = sx + wx * r, ccy = sy + wy * r, m0 = m, steps = Math.max(2, Math.ceil(Math.PI / 2 * r / STEP));
            for (let j = 1; j <= steps; j++) {
              const f = Math.PI / 2 * j / steps, c = Math.cos(f), s = Math.sin(f);
              out.push(ccx + r * (-wx * c + ux * s), ccy + r * (-wy * c + uy * s), m0 + 2 * r * j / steps, 0);
            }
            m = m0 + 2 * r; cx0 = Vx + wx * r; cy0 = Vy + wy * r;
            continue;
          }
        }
        line(Vx, Vy);
      }
    }

    // Colour strings are cached by key = patternKey*17 + greyLevel, so a frame creates no new strings.
    _palette(skin, flash) {
      const sig = skin.color + '|' + skin.pattern + '|' + flash;
      if (sig === this.sig) return;
      this.sig = sig; this.body.length = 0; this.shade.length = 0;
      const base = U.hexRgb((SK.COLORS[skin.color] || SK.COLORS[0])[1]);
      this.base = base;
      this.dark = U.mix(base, [0, 0, 0], 0.3);
      this.light = U.mix(base, [255, 255, 255], 0.38);
      this.zebra = U.mix(base, [0, 0, 0], 0.55);
      this.shadow = U.mix(base, [0, 0, 0], 0.5);
      this.fadeTo = U.mix(base, [15, 22, 18], 0.6);
      this.pat = SK.PATTERNS[skin.pattern] || 'Solid';
      this.stops = SK.GRADIENTS[this.pat] || null;
      this.flash = flash;
    }
    _grad(t) {   // gradient patterns: t 0..1 tail→head across three colour stops
      const G = this.stops, s = t * 2, i = Math.min(1, s | 0), f = s - i;
      return U.mix(G[i], G[i + 1], f);
    }
    _color(key, shade) {
      const cache = shade ? this.shade : this.body;
      let s = cache[key];
      if (s) return s;
      const raw = (key / 17) | 0, gl = key % 17, pat = this.pat;
      let c;
      if (shade) {
        if (pat === 'Rainbow') c = U.hsl(raw * HUE_Q * SHADE_GROUP, 60, 32);
        else if (this.stops) c = U.mix(this._grad(Math.min(1, raw * SHADE_GROUP / 32)), [0, 0, 0], 0.5);
        else c = this.shadow;
      }
      else if (pat === 'Stripes') c = raw === 0 ? this.dark : this.base;
      else if (pat === 'Duo') c = raw === 0 ? this.light : this.base;
      else if (pat === 'Zebra') c = raw === 0 ? this.zebra : this.base;
      else if (pat === 'Fade') c = U.mix(this.base, this.fadeTo, raw / 32);
      else if (pat === 'Rainbow') c = U.hsl(raw * HUE_Q, 85, 62);
      else if (this.stops) c = this._grad(raw / 32);
      else c = this.base;
      if (gl) c = U.mix(c, GREY, gl / 16 * 0.85);
      if (!shade && this.flash) c = U.mix(c, [255, 255, 255], this.flash);
      return (cache[key] = U.rgb(c));
    }

    // fx: {dead, flash, grey, bulges, nBulges, mouth, blink 0..1, squash 0..1}
    draw(g, cells, prevTail, p, cell, headAng, skin, fx) {
      this.build(cells, prevTail, p, cell);
      const P = this.path, n = P.n;
      const M = P.m[n - 1] || 1, k = cell / 40, W = cell * 0.72;
      this._palette(skin, fx.flash || 0);
      const pat = this.pat, tapered = SK.SHAPES[skin.shape] === 'Tapered';
      const sig2 = 2 * (cell * 0.45) ** 2, grey = fx.grey || 0;
      const nb = fx.nBulges || 0, bulges = fx.bulges;
      const hueN = 360 / HUE_Q, grad = !!this.stops, coarse = pat === 'Rainbow' || grad;

      // Per-point colour key and width, computed once and shared by every pass.
      for (let i = 0; i < n; i++) {
        const m = P.m[i];
        let raw = 0;
        if (pat === 'Stripes') raw = ((m % cell) + cell) % cell < cell * 0.4 ? 0 : 1;
        else if (pat === 'Zebra') raw = ((m % cell) + cell) % cell < cell * 0.2 ? 0 : 1;
        else if (pat === 'Duo') raw = ((m % (cell * 2)) + cell * 2) % (cell * 2) < cell ? 0 : 1;
        else if (pat === 'Fade') raw = Math.round((1 - m / M) * 32);
        else if (pat === 'Rainbow') raw = Math.round(m / cell * 28 / HUE_Q) % hueN;
        else if (grad) raw = Math.round(m / M * 32);
        let gl = 0;
        if (grey) { const f = (M - m) / M; gl = Math.round(U.clamp((grey * 1.4 - f) / 0.4, 0, 1) * 16); }
        P.k[i] = raw * 17 + gl;
        P.ks[i] = (coarse ? (raw / SHADE_GROUP | 0) : 0) * 17 + gl;
        let w = tapered ? W * (0.4 + 0.6 * U.ease(Math.min(1, m / (cell * 3)))) : W;
        for (let b = 0; b < nb; b++) { const x = (M - m) - bulges[b]; w *= 1 + 0.32 * Math.exp(-x * x / sig2); }
        P.w[i] = Math.round(w * 2) / 2;
      }

      this._strokeRuns(g, true, 3 * k);
      this._strokeRuns(g, false, 0);
      if (pat === 'Spots') this._spots(g, cell, M);
      this._gloss(g, W);

      // Banded patterns keep the head the main colour, so it doesn't flicker as bands slide past.
      const banded = pat === 'Stripes' || pat === 'Zebra' || pat === 'Duo';
      const hk = banded ? 17 + P.k[n - 1] % 17 : P.k[n - 1];
      const hx = P.x[n - 1], hy = P.y[n - 1], hc = this._color(hk, false);
      drawHead(g, hx, hy, headAng, k, fx, hc, skin, P.w[n - 1] / 2 * 1.06);
    }

    // Strokes the path in runs of identical colour/width so it stays fast.
    _strokeRuns(g, shade, dy) {
      const P = this.path, n = P.n, X = P.x, Y = P.y, K = shade ? P.ks : P.k, Wd = P.w, B = P.b;
      g.lineCap = 'round'; g.lineJoin = 'round';
      let i = 1;
      while (i < n) {
        if (B[i]) { i++; continue; }
        const key = K[i], w = Wd[i];
        g.strokeStyle = this._color(key, shade); g.lineWidth = w;
        g.beginPath(); g.moveTo(X[i - 1], Y[i - 1] + dy);
        while (i < n && !B[i] && K[i] === key && Wd[i] === w) { g.lineTo(X[i], Y[i] + dy); i++; }
        g.stroke();
      }
    }

    // Soft highlight along the top of the body: one stroke for the whole snake.
    _gloss(g, W) {
      const P = this.path, n = P.n, dy = -W * 0.17;
      g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = W * 0.26;
      g.beginPath();
      for (let i = 0; i < n; i++) { if (P.b[i]) g.moveTo(P.x[i], P.y[i] + dy); else g.lineTo(P.x[i], P.y[i] + dy); }
      g.stroke();
    }

    // Two rows of dots, one every half cell, alternating sides.
    _spots(g, cell, M) {
      const P = this.path, n = P.n;
      g.fillStyle = 'rgba(0,0,0,0.22)';
      let next = cell * 0.5, side = 1;
      for (let i = 1; i < n && next < M - cell * 0.8; i++) {
        if (P.m[i] < next || P.b[i]) continue;
        const dx = P.x[i] - P.x[i - 1], dy = P.y[i] - P.y[i - 1], len = Math.hypot(dx, dy) || 1;
        const off = P.w[i] * 0.2 * side;
        dot(g, P.x[i] - dy / len * off, P.y[i] + dx / len * off, P.w[i] * 0.13);
        next += cell * 0.5; side = -side;
      }
    }
  }

  // Head circle + face, with a squash when turning and blinking eyes.
  function drawHead(g, x, y, a, k, fx, bodyCol, skin, r) {
    const style = SK.EYES[skin.eyes], ink = '#0f1512', dead = !!fx.dead;
    const sq = fx.squash || 0, blink = dead ? 0 : (fx.blink || 0);
    g.save(); g.translate(x, y); g.rotate(a);
    if (sq) g.scale(1 - 0.14 * sq, 1 + 0.1 * sq);
    g.fillStyle = bodyCol; dot(g, 0, 0, r);
    const o = fx.mouth || 0;
    if (o > 0.03 && !dead) {
      g.fillStyle = '#3b1016'; g.beginPath(); g.ellipse(11 * k, 0, 4.5 * k * o + 0.5, 8 * k * o, 0, 0, TAU); g.fill();
      g.fillStyle = '#ff6b7a'; g.beginPath(); g.ellipse(12.5 * k, 0, 2 * k * o, 3.4 * k * o, 0, 0, TAU); g.fill();
    }
    if (style === 'Shades' && !dead) {
      g.fillStyle = '#111518';
      for (let s = -1; s <= 1; s += 2) { g.beginPath(); g.ellipse(5 * k, s * 8 * k, 5 * k, 6.5 * k, 0, 0, TAU); g.fill(); }
      g.fillRect(3.5 * k, -8 * k, 2.5 * k, 16 * k);
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let s = -1; s <= 1; s += 2) g.fillRect(6.5 * k, s * 8 * k - 4 * k, 1.6 * k, 3 * k);
    } else {
      const big = style === 'Big', one = style === 'Cyclops';
      for (let s = one ? 0 : -1; s <= (one ? 0 : 1); s += 2) {
        const ex = (big ? 3 : one ? 3 : 4) * k, ey = s * (big ? 9.5 : 8) * k, rr = (big ? 7.5 : one ? 8.5 : 5.5) * k;
        if (dead) {
          g.fillStyle = '#fff'; dot(g, ex, ey, rr);
          g.strokeStyle = ink; g.lineWidth = 1.8 * k; g.lineCap = 'round'; const q = rr * 0.5;
          g.beginPath(); g.moveTo(ex - q, ey - q); g.lineTo(ex + q, ey + q); g.moveTo(ex + q, ey - q); g.lineTo(ex - q, ey + q); g.stroke();
          continue;
        }
        // Blink: the eye squashes shut across the head, then a lid line shows briefly.
        const open = 1 - blink;
        g.save(); g.translate(ex, ey); g.scale(Math.max(0.08, open), 1);
        g.fillStyle = '#fff'; dot(g, 0, 0, rr);
        if (style === 'Star') { g.fillStyle = '#f0a500'; star(g, 2 * k, 0, 3.6 * k); }
        else if (style === 'Heart') { g.fillStyle = '#ff4d7a'; heart(g, 2 * k, 0, 3.4 * k); }
        else {
          const pr = (big ? 3.8 : one ? 4.4 : 2.8) * k;
          g.fillStyle = ink; dot(g, (big ? 2.6 : one ? 3 : 2) * k, 0, pr);
          if (big || one) { g.fillStyle = '#fff'; dot(g, (one ? 4.2 : 3.4) * k, -1.5 * k, 1.3 * k); }
        }
        g.restore();
        if (open < 0.25) { g.strokeStyle = ink; g.lineWidth = 1.5 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex, ey - rr); g.lineTo(ex, ey + rr); g.stroke(); }
        else if (style === 'Sleepy') {
          g.fillStyle = bodyCol; g.beginPath(); g.arc(ex, ey, rr + 0.8 * k, Math.PI / 2, Math.PI * 1.5); g.fill();
          g.strokeStyle = ink; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(ex, ey - rr); g.lineTo(ex, ey + rr); g.stroke();
        }
        if (style === 'Angry') {   // brows slanting down towards the nose
          g.strokeStyle = ink; g.lineWidth = 2.4 * k; g.lineCap = 'round';
          g.beginPath(); g.moveTo(ex - 3 * k, ey + s * 6.5 * k); g.lineTo(ex + 6 * k, ey + s * 1.5 * k); g.stroke();
        }
      }
    }
    g.restore();
  }

  // Pupils for the Star and Heart eyes. Drawn in the head's rotated frame, so "up" is the snake's left.
  function star(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  }
  function heart(g, x, y, r) {   // the point faces forward (+x), the way the snake looks
    g.save(); g.translate(x, y); g.rotate(-Math.PI / 2);
    g.beginPath(); g.moveTo(0, r * 0.95);
    g.bezierCurveTo(-r * 1.3, 0, -r * 0.95, -r * 1.05, 0, -r * 0.35);
    g.bezierCurveTo(r * 0.95, -r * 1.05, r * 1.3, 0, 0, r * 0.95);
    g.fill(); g.restore();
  }

  // Checkerboard, plus soft light from the top and a vignette. Drawn once into a cache.
  function drawBoard(g, cols, rows, cell, lit) {
    const W = cols * cell, H = rows * cell;
    g.fillStyle = TILE_B; g.fillRect(0, 0, W, H);
    g.fillStyle = TILE_A;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if ((x + y) % 2 === 0) g.fillRect(x * cell, y * cell, cell, cell);
    if (!lit) return;
    const d = Math.hypot(W, H);
    let gr = g.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, d * 0.55);
    gr.addColorStop(0, 'rgba(190,255,215,0.07)'); gr.addColorStop(1, 'rgba(190,255,215,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createRadialGradient(W / 2, H / 2, d * 0.28, W / 2, H / 2, d * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  // ---------- apples, portals, walls ----------
  // Gradients are built once at unit size; each apple is drawn with translate + scale.
  const grads = {};
  function grad(g, kind, color) {
    const key = kind + (color || '');
    if (grads[key]) return grads[key];
    const gr = g.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1);
    if (kind === 'gold') { gr.addColorStop(0, '#fff6c4'); gr.addColorStop(0.45, '#ffc83d'); gr.addColorStop(1, '#a86f00'); }
    else if (kind === 'poison') { gr.addColorStop(0, '#e2c2ff'); gr.addColorStop(0.45, '#9b5cf0'); gr.addColorStop(1, '#4a1f86'); }
    else if (kind === 'portal') { const c = U.hexRgb(color); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, color); gr.addColorStop(1, U.rgb(U.mix(c, [0, 0, 0], 0.55))); }
    else { gr.addColorStop(0, '#ff9c8f'); gr.addColorStop(0.5, '#ff4a3d'); gr.addColorStop(1, '#b81f19'); }
    return (grads[key] = gr);
  }

  const bornAt = new WeakMap();   // apple object -> time it first appeared (for the pop-in)
  function popScale(a, t) {
    let b = bornAt.get(a);
    if (b === undefined) { b = t; bornAt.set(a, b); }
    const s = Math.min(1, (t - b) / 260);
    return s < 1 ? 1 + Math.sin(s * Math.PI) * 0.25 - (1 - s) * 0.6 : 1;
  }

  function drawApple(g, a, t, game) {
    const pop = popScale(a, t);
    // Golden apples blink in their last few steps before turning normal.
    let alpha = 1;
    if (a.kind === 'gold' && game) { const left = a.until - game.steps; if (left <= 10) alpha = 0.55 + 0.45 * Math.abs(Math.cos(t / (left <= 4 ? 70 : 140))); }
    if (alpha < 1) g.globalAlpha = alpha;
    const bob = R.reduced ? 1 : 1 + Math.sin(t / 220 + a.x) * 0.04;
    const cx = a.x * CELL + CELL / 2, cy = a.y * CELL + CELL / 2 + 1, r = CELL * 0.33 * pop * bob;
    if (r <= 0) return;
    const portal = a.kind === 'portal', color = portal ? PORTAL_COLORS[a.pair % PORTAL_COLORS.length] : null;
    // contact shadow
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(cx + 1.5, cy + r * 0.92, r * 0.78, r * 0.26, 0, 0, TAU); g.fill();
    if (portal) {   // spinning ring so pairs are easy to match
      g.strokeStyle = color; g.lineWidth = 2.5; g.lineCap = 'round';
      const rot = R.reduced ? 0 : t / 400;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx, cy, r * 1.32, rot + i * TAU / 3, rot + i * TAU / 3 + 1.2); g.stroke(); }
    }
    g.save(); g.translate(cx, cy); g.scale(r, r);
    g.fillStyle = grad(g, a.kind, color); dot(g, 0, 0, 1);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.ellipse(-0.38, -0.42, 0.24, 0.14, -0.6, 0, TAU); g.fill();
    if (a.kind === 'poison') {
      g.fillStyle = 'rgba(40,10,70,0.45)'; dot(g, 0.3, 0.25, 0.14); dot(g, -0.1, 0.45, 0.09); dot(g, 0.45, -0.15, 0.08);
    }
    g.restore();
    if (!portal) {   // stem + leaf
      g.strokeStyle = a.kind === 'poison' ? '#3a2a1a' : '#6b4a2b'; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx, cy - r * 0.8); g.quadraticCurveTo(cx + 1, cy - r * 1.2, cx + 3, cy - r * 1.4); g.stroke();
      g.fillStyle = a.kind === 'poison' ? '#3f7a3a' : '#5fd16a';
      g.beginPath(); g.ellipse(cx + 7, cy - r * 1.25, 5.5, 2.6, -0.5, 0, TAU); g.fill();
    }
    if (a.kind === 'gold' && !R.reduced) {   // twinkle
      const tw = (Math.sin(t / 180 + a.y) + 1) / 2, sx = cx + r * 0.75, sy = cy - r * 0.55, sr = 2 + 3 * tw;
      g.fillStyle = '#fffbe6'; g.beginPath();
      g.moveTo(sx, sy - sr); g.lineTo(sx + sr * 0.3, sy - sr * 0.3); g.lineTo(sx + sr, sy); g.lineTo(sx + sr * 0.3, sy + sr * 0.3);
      g.lineTo(sx, sy + sr); g.lineTo(sx - sr * 0.3, sy + sr * 0.3); g.lineTo(sx - sr, sy); g.lineTo(sx - sr * 0.3, sy - sr * 0.3); g.fill();
    }
    g.globalAlpha = 1;
  }

  const wallBorn = new Map();   // tile index -> time it turned solid
  function drawWalls(g, game, t) {
    if (!game.rules.walls) return;
    const W = game.wall, cols = game.cols;
    for (let i = 0; i < W.length; i++) {
      if (!W[i]) continue;
      const x = (i % cols) * CELL, y = ((i / cols) | 0) * CELL;
      if (W[i] === 1) {   // marks where a wall will appear once your tail moves off it
        g.strokeStyle = 'rgba(200,220,210,0.25)'; g.lineWidth = 2; g.setLineDash([5, 5]);
        g.strokeRect(x + 5, y + 5, CELL - 10, CELL - 10); g.setLineDash([]);
        continue;
      }
      let b = wallBorn.get(i); if (b === undefined) { b = t; wallBorn.set(i, b); }
      const s = R.reduced ? 1 : Math.min(1, (t - b) / 220), sc = s < 1 ? 0.5 + 0.6 * U.ease(s) - 0.1 * s : 1;
      const pad = 3 + (1 - sc) * CELL * 0.4, w = CELL - pad * 2;
      g.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(g, x + pad + 1.5, y + pad + 3, w, w, 7); g.fill();
      g.fillStyle = '#4a5a52'; roundRect(g, x + pad, y + pad, w, w, 7); g.fill();
      g.fillStyle = '#5e7066'; roundRect(g, x + pad + 3, y + pad + 3, w - 6, w * 0.45, 5); g.fill();
    }
  }
  R.resetWalls = () => wallBorn.clear();

  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // ---------- particles (fixed pools, so effects never allocate) ----------
  class Fx {
    constructor() {
      this.parts = []; for (let i = 0; i < 120; i++) this.parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, c: '', born: 0, life: 0 });
      this.rings = []; for (let i = 0; i < 10; i++) this.rings.push({ on: false, x: 0, y: 0, born: 0, c: '' });
    }
    clear() { for (const p of this.parts) p.on = false; for (const r of this.rings) r.on = false; }
    _free(list) { for (const p of list) if (!p.on) return p; return null; }
    burst(cx, cy, now, colors, count) {
      const n = R.reduced ? 4 : (count || 14);
      for (let i = 0; i < n; i++) {
        const p = this._free(this.parts); if (!p) break;
        const a = Math.random() * TAU, sp = 100 + Math.random() * 180;
        p.on = true; p.x = cx; p.y = cy; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.r = 3 + Math.random() * 3.5;
        const q = Math.random(); p.c = q < 0.65 ? colors[0] : (q < 0.82 ? colors[1] : colors[2]);
        p.born = now; p.life = 380 + Math.random() * 220;
      }
      this.ring(cx, cy, now, '#ffffff');
    }
    ring(cx, cy, now, c) {
      const r = this._free(this.rings);
      if (r) { r.on = true; r.x = cx; r.y = cy; r.born = now; r.c = c; }
    }
    draw(g, t, dt) {
      const s = dt / 1000, damp = Math.exp(-5 * s);
      for (const p of this.parts) {
        if (!p.on) continue;
        if (t - p.born >= p.life) { p.on = false; continue; }
        p.x += p.vx * s; p.y += p.vy * s; p.vx *= damp; p.vy *= damp;
        const f = 1 - (t - p.born) / p.life;
        g.globalAlpha = f; g.fillStyle = p.c; dot(g, p.x, p.y, p.r * f);
      }
      for (const r of this.rings) {
        if (!r.on) continue;
        if (t - r.born >= 380) { r.on = false; continue; }
        const f = (t - r.born) / 380;
        g.globalAlpha = 1 - f; g.strokeStyle = r.c; g.lineWidth = 3 * (1 - f) + 0.5;
        g.beginPath(); g.arc(r.x, r.y, CELL * (0.3 + 0.9 * U.ease(f)), 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  // Confetti for a new best, drawn on a full-screen canvas above the menu.
  class Confetti {
    constructor(canvas) {
      this.cv = canvas; this.g = canvas.getContext('2d'); this.active = false; this.dirty = false;
      this.p = []; for (let i = 0; i < 160; i++) this.p.push({ x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, w: 0, h: 0, c: '' });
      this.colors = ['#ff5a4e', '#ffc83d', '#5b8cff', '#4cc35b', '#ff6fb1', '#27c2b0', '#ffffff'];
    }
    resize() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      this.dpr = dpr; this.W = root.innerWidth; this.H = root.innerHeight;
      this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    }
    fire() {
      if (R.reduced) return;
      this.resize();
      for (const q of this.p) {
        const left = Math.random() < 0.5;
        q.x = left ? -10 : this.W + 10; q.y = this.H * (0.45 + Math.random() * 0.35);
        const ang = (left ? -1.0 : -Math.PI + 1.0) + (Math.random() - 0.5) * 0.7, sp = 600 + Math.random() * 700;
        q.vx = Math.cos(ang) * sp; q.vy = Math.sin(ang) * sp;
        q.a = Math.random() * TAU; q.va = (Math.random() - 0.5) * 14;
        q.w = 6 + Math.random() * 6; q.h = 3 + Math.random() * 4;
        q.c = this.colors[(Math.random() * this.colors.length) | 0];
      }
      this.t0 = performance.now(); this.active = true;
    }
    draw(t, dt) {
      const g = this.g;
      if (!this.active) {
        if (this.dirty) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height); this.dirty = false; }
        return;
      }
      const s = Math.min(dt, 50) / 1000, age = t - this.t0;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height);
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.globalAlpha = age > 2200 ? Math.max(0, 1 - (age - 2200) / 800) : 1;
      for (const q of this.p) {
        q.vy += 1100 * s; q.vx *= Math.exp(-1.6 * s); q.vy *= Math.exp(-0.9 * s);
        q.x += q.vx * s; q.y += q.vy * s; q.a += q.va * s;
        g.save(); g.translate(q.x, q.y); g.rotate(q.a); g.scale(1, Math.cos(q.a * 1.7));
        g.fillStyle = q.c; g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); g.restore();
      }
      g.globalAlpha = 1; this.dirty = true;
      if (age > 3000) this.active = false;
    }
  }

  // A canvas that is always pixel-sharp: backing store = CSS size × devicePixelRatio.
  class View {
    constructor(canvas, cols, rows, lit) {
      this.cv = canvas; this.g = canvas.getContext('2d');
      this.cols = cols; this.rows = rows; this.lit = !!lit;
      this.tiles = document.createElement('canvas');
      this.snake = new SnakeDrawer();
      this.fx = new Fx();
    }
    setBoard(cols, rows) { this.cols = cols; this.rows = rows; this._sizeKey = ''; }
    // Size the canvas to cssW × cssH CSS pixels. Rebuilds the cached board layer only when needed.
    resize(cssW, cssH) {
      const dpr = Math.min(root.devicePixelRatio || 1, 3);
      const W = Math.max(1, Math.round(cssW * dpr)), H = Math.max(1, Math.round(cssH * dpr));
      const key = W + 'x' + H + '|' + this.cols + 'x' + this.rows;
      this.cv.style.width = cssW + 'px'; this.cv.style.height = cssH + 'px';
      if (key === this._sizeKey) return;
      this._sizeKey = key;
      this.cv.width = W; this.cv.height = H;
      this.sx = W / (this.cols * CELL); this.sy = H / (this.rows * CELL);
      this.tiles.width = W; this.tiles.height = H;
      const tg = this.tiles.getContext('2d');
      tg.setTransform(this.sx, 0, 0, this.sy, 0, 0);
      drawBoard(tg, this.cols, this.rows, CELL, this.lit);
    }
    // ox/oy shift the whole board (used for the death shake), in board units.
    begin(ox, oy) {
      const g = this.g, dx = (ox || 0) * this.sx, dy = (oy || 0) * this.sy;
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (dx || dy) { g.fillStyle = TILE_B; g.fillRect(0, 0, this.cv.width, this.cv.height); }
      g.drawImage(this.tiles, dx, dy);
      g.setTransform(this.sx, 0, 0, this.sy, dx, dy);
      return g;
    }
  }

  // Dark mode: everything outside a pool of light around the head is hidden.
  // Apples show as faint glints so you know roughly where to go.
  function drawDark(g, cols, rows, hx, hy, apples, t) {
    const W = cols * CELL, H = rows * CELL, r0 = CELL * 1.6, r1 = CELL * 4.2;
    const gr = g.createRadialGradient(hx, hy, r0, hx, hy, r1);
    gr.addColorStop(0, 'rgba(6,9,7,0)'); gr.addColorStop(1, 'rgba(6,9,7,0.97)');
    g.fillStyle = gr; g.fillRect(-CELL, -CELL, W + CELL * 2, H + CELL * 2);
    g.fillStyle = 'rgba(255,120,100,0.35)';
    for (const a of apples) {
      const ax = a.x * CELL + CELL / 2, ay = a.y * CELL + CELL / 2;
      if (Math.hypot(ax - hx, ay - hy) < r1) continue;
      dot(g, ax, ay, 2.5 + (R.reduced ? 0 : Math.sin(t / 300 + a.x) * 0.8));
    }
  }

  // Big "3 2 1" in the middle of the board. f = 0..1 through the current number.
  function drawCountdown(g, cols, rows, label, f) {
    const cx = cols * CELL / 2, cy = rows * CELL / 2;
    const s = R.reduced ? 1 : 1.35 - 0.35 * U.ease(Math.min(1, f * 2.2));
    const a = f < 0.75 ? 1 : 1 - (f - 0.75) / 0.25;
    g.save(); g.translate(cx, cy); g.scale(s, s);
    g.globalAlpha = a * 0.5; g.fillStyle = '#0b100d'; dot(g, 0, 0, CELL * 1.5);
    g.globalAlpha = a; g.fillStyle = '#ffffff';
    g.font = '700 ' + (CELL * 1.7) + 'px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, 0, CELL * 0.08);
    g.restore(); g.globalAlpha = 1;
  }

  Object.assign(R, { SnakeDrawer, View, Confetti, drawApple, drawWalls, drawBoard, drawCountdown, drawDark });
  S.render = R;
})(window);
