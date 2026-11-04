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

  // Extra particle shapes shared by eat effects, trails and menu icons.
  function shape(g, s, x, y, r, a, f) {
    switch (s) {
      case 'leaf': g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, r * 1.5, r * 0.7, 0, 0, TAU); g.fill(); g.restore(); break;
      case 'coin': dot(g, x, y, r * 1.2); g.fillStyle = 'rgba(120,80,0,0.45)'; dot(g, x, y, r * 0.7); break;
      case 'gem': g.beginPath(); g.moveTo(x, y - r * 1.4); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.4); g.lineTo(x - r, y); g.closePath(); g.fill(); break;
      case 'bolt': g.save(); g.translate(x, y); g.rotate(a * 0.3); g.beginPath();
        g.moveTo(-r * 0.2, -r * 1.5); g.lineTo(r * 0.7, -r * 0.2); g.lineTo(0, -r * 0.1); g.lineTo(r * 0.3, r * 1.5); g.lineTo(-r * 0.7, r * 0.1); g.lineTo(0, 0); g.closePath(); g.fill(); g.restore(); break;
      case 'flower': { const c0 = g.fillStyle; for (let j = 0; j < 5; j++) { const q = a + j * TAU / 5; dot(g, x + Math.cos(q) * r * 0.75, y + Math.sin(q) * r * 0.75, r * 0.55); }
        g.fillStyle = '#ffe36b'; dot(g, x, y, r * 0.45); g.fillStyle = c0; break; }
      case 'puff': { const ga = g.globalAlpha; g.globalAlpha = ga * 0.45; dot(g, x, y, r * (2.4 - (f == null ? 1 : f))); g.globalAlpha = ga; break; }
      default: dot(g, x, y, r);
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
    // trim = how much to cut off the tail end, in pixels, so a tail can retract smoothly (0 for normal play).
    build(cells, prevTail, p, cell, trim) {
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
      if (trim > 0) this._trim(trim);
    }

    // Removes the first d pixels of the path, ending on an exact point between two path points.
    _trim(d) {
      const P = this.path, n = P.n;
      let s = 0;
      while (s < n - 2 && P.m[s + 1] <= d) s++;
      const f = P.b[s + 1] || P.m[s + 1] <= P.m[s] ? 0 : U.clamp((d - P.m[s]) / (P.m[s + 1] - P.m[s]), 0, 1);
      const x = P.x[s] + (P.x[s + 1] - P.x[s]) * f, y = P.y[s] + (P.y[s + 1] - P.y[s]) * f;
      for (let i = s; i < n; i++) { const j = i - s; P.x[j] = P.x[i]; P.y[j] = P.y[i]; P.m[j] = Math.max(0, P.m[i] - d); P.b[j] = P.b[i]; }
      P.n = n - s; P.x[0] = x; P.y[0] = y; P.m[0] = 0; P.b[0] = 1;
    }

    // Colour strings are cached by key = patternKey*17 + greyLevel, so a frame creates no new strings.
    _palette(skin, flash) {
      const sig = SK.colorHex(skin) + '|' + skin.pattern + '|' + flash;
      if (sig === this.sig) return;
      this.sig = sig; this.body.length = 0; this.shade.length = 0;
      const base = U.hexRgb(SK.colorHex(skin));
      this.base = base;
      this.dark = U.mix(base, [0, 0, 0], 0.3);
      this.light = U.mix(base, [255, 255, 255], 0.38);
      this.zebra = U.mix(base, [0, 0, 0], 0.55);
      this.shadow = U.mix(base, [0, 0, 0], 0.5);
      this.fadeTo = U.mix(base, [15, 22, 18], 0.6);
      this.pat = SK.PATTERNS[skin.pattern] || 'Solid';
      this.stops = SK.GRADIENTS[this.pat] || null;
      this.fixed = SK.FIXED_BANDS[this.pat] || null;
      if (this.fixed) { this.base = this.fixed[0]; this.shadow = U.mix(this.fixed[0], [0, 0, 0], 0.5); }
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
      else if (this.fixed) c = raw === 0 ? this.fixed[1] : this.fixed[0];
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
      this.build(cells, prevTail, p, cell, fx.trim || 0);
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
        else if (this.fixed) raw = ((m % cell) + cell) % cell < cell * this.fixed[2] ? 0 : 1;
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
      if (pat === 'Spots') this._spots(g, cell, M, 'rgba(0,0,0,0.22)', 0.13);
      else if (pat === 'Galaxy') this._spots(g, cell * 0.7, M, 'rgba(255,255,255,0.7)', 0.06);
      this._gloss(g, W);

      // Banded patterns keep the head the main colour, so it doesn't flicker as bands slide past.
      const banded = pat === 'Stripes' || pat === 'Zebra' || pat === 'Duo' || !!this.fixed;
      const hk = banded ? 17 + P.k[n - 1] % 17 : P.k[n - 1];
      const hx = P.x[n - 1], hy = P.y[n - 1], hc = this._color(hk, false);
      drawHead(g, hx, hy, headAng, k, fx, hc, skin, P.w[n - 1] / 2 * 1.06);
      if (skin.hat) drawHat(g, hx, hy, W / 2, skin.hat, fx.dead);
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
    _spots(g, cell, M, color, size) {
      const P = this.path, n = P.n;
      g.fillStyle = color;
      let next = cell * 0.5, side = 1;
      for (let i = 1; i < n && next < M - cell * 0.8; i++) {
        if (P.m[i] < next || P.b[i]) continue;
        const dx = P.x[i] - P.x[i - 1], dy = P.y[i] - P.y[i - 1], len = Math.hypot(dx, dy) || 1;
        const off = P.w[i] * 0.2 * side;
        dot(g, P.x[i] - dy / len * off, P.y[i] + dx / len * off, P.w[i] * size);
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
    if (style === 'Robot' && !dead) {   // one glowing visor across the face
      const open = Math.max(0.15, 1 - blink);
      g.fillStyle = '#14191c'; roundRect(g, 1 * k, -11 * k, 8 * k, 22 * k, 3.5 * k); g.fill();
      g.fillStyle = '#4ff0ff'; roundRect(g, 3.6 * k, -8.5 * k * open, 2.8 * k, 17 * k * open, 1.4 * k); g.fill();
      g.fillStyle = 'rgba(79,240,255,0.25)'; roundRect(g, 2.2 * k, -10 * k * open, 5.6 * k, 20 * k * open, 2.5 * k); g.fill();
    } else if (style === 'Shades' && !dead) {
      g.fillStyle = '#111518';
      for (let s = -1; s <= 1; s += 2) { g.beginPath(); g.ellipse(5 * k, s * 8 * k, 5 * k, 6.5 * k, 0, 0, TAU); g.fill(); }
      g.fillRect(3.5 * k, -8 * k, 2.5 * k, 16 * k);
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let s = -1; s <= 1; s += 2) g.fillRect(6.5 * k, s * 8 * k - 4 * k, 1.6 * k, 3 * k);
    } else {
      const big = style === 'Big' || style === 'Sparkly' || style === 'Cute' || style === 'Owl', one = style === 'Cyclops';
      for (let s = one ? 0 : -1; s <= (one ? 0 : 1); s += 2) {
        const ex = (big ? 3 : one ? 3 : 4) * k, ey = s * (big ? 9.5 : 8) * k, rr = (big ? 7.5 : one ? 8.5 : 5.5) * k;
        if (dead) {
          g.fillStyle = '#fff'; dot(g, ex, ey, rr);
          g.strokeStyle = ink; g.lineWidth = 1.8 * k; g.lineCap = 'round'; const q = rr * 0.5;
          g.beginPath(); g.moveTo(ex - q, ey - q); g.lineTo(ex + q, ey + q); g.moveTo(ex + q, ey - q); g.lineTo(ex - q, ey + q); g.stroke();
          continue;
        }
        if (style === 'Happy') {   // both eyes shut in happy curves
          g.strokeStyle = ink; g.lineWidth = 1.9 * k; g.lineCap = 'round';
          g.beginPath(); g.arc(ex - 1.5 * k, ey, rr * 0.85, -Math.PI / 2.3, Math.PI / 2.3); g.stroke();
          continue;
        }
        if (style === 'Wink' && s === 1) {   // one eye shut in a happy curve
          g.strokeStyle = ink; g.lineWidth = 1.8 * k; g.lineCap = 'round';
          g.beginPath(); g.arc(ex - 1 * k, ey, rr * 0.8, -Math.PI / 2.4, Math.PI / 2.4); g.stroke();
          continue;
        }
        // Blink: the eye squashes shut across the head, then a lid line shows briefly.
        const open = 1 - blink;
        g.save(); g.translate(ex, ey); g.scale(Math.max(0.08, open), 1);
        g.fillStyle = '#fff'; dot(g, 0, 0, rr);
        if (style === 'Star') { g.fillStyle = '#f0a500'; star(g, 2 * k, 0, 3.6 * k); }
        else if (style === 'Heart') { g.fillStyle = '#ff4d7a'; heart(g, 2 * k, 0, 3.4 * k); }
        else if (style === 'Owl') {
          g.fillStyle = '#ff9838'; dot(g, 1.6 * k, 0, 4.4 * k); g.fillStyle = ink; dot(g, 1.9 * k, 0, 2.6 * k);
          g.fillStyle = '#fff'; dot(g, 2.8 * k, -1.2 * k, 0.9 * k);
        }
        else if (style === 'Cat') {
          g.fillStyle = '#b5e550'; dot(g, 1.6 * k, 0, 4.2 * k); g.fillStyle = ink;
          g.beginPath(); g.ellipse(2 * k, 0, 0.9 * k, 3.6 * k, 0, 0, TAU); g.fill();
        }
        else if (style === 'Laser') {
          g.fillStyle = 'rgba(255,40,40,0.35)'; dot(g, 2.2 * k, 0, 4.4 * k);
          g.fillStyle = '#ff2a2a'; dot(g, 2.2 * k, 0, 2.6 * k); g.fillStyle = '#ffd0d0'; dot(g, 2.8 * k, -0.6 * k, 0.9 * k);
        }
        else if (style === 'Dizzy') {   // spiral pupils
          g.strokeStyle = ink; g.lineWidth = 1.1 * k; g.beginPath();
          for (let i = 0; i <= 28; i++) { const a = i * 0.45, rad = i / 28 * rr * 0.75; g.lineTo(Math.cos(a) * rad + 0.5 * k, Math.sin(a) * rad); }
          g.stroke();
        }
        else {
          const pr = (big ? 3.8 : one ? 4.4 : 2.8) * k;
          g.fillStyle = ink; dot(g, (big ? 2.6 : one ? 3 : 2) * k, 0, pr);
          if (big || one) { g.fillStyle = '#fff'; dot(g, (one ? 4.2 : 3.4) * k, -1.5 * k, 1.3 * k); }
          if (style === 'Sparkly') { g.fillStyle = '#fff'; dot(g, 1.4 * k, 1.6 * k, 0.8 * k); dot(g, 4.4 * k, 0.4 * k, 0.5 * k); }
        }
        g.restore();
        if (open < 0.25) { g.strokeStyle = ink; g.lineWidth = 1.5 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex, ey - rr); g.lineTo(ex, ey + rr); g.stroke(); }
        else if (style === 'Sleepy') {
          g.fillStyle = bodyCol; g.beginPath(); g.arc(ex, ey, rr + 0.8 * k, Math.PI / 2, Math.PI * 1.5); g.fill();
          g.strokeStyle = ink; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(ex, ey - rr); g.lineTo(ex, ey + rr); g.stroke();
        }
        if (style === 'Sus' && open >= 0.25) {   // heavy lids on the outer half of each eye
          g.fillStyle = bodyCol; g.beginPath(); g.arc(ex, ey, rr + 0.8 * k, s > 0 ? -0.15 : Math.PI + 0.15, s > 0 ? Math.PI + 0.15 : -0.15, s < 0); g.fill();
          g.strokeStyle = ink; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(ex - rr, ey + s * 0.8 * k); g.lineTo(ex + rr, ey - s * 0.8 * k); g.stroke();
        }
        if (style === 'Cute') { g.fillStyle = 'rgba(255,120,150,0.45)'; g.beginPath(); g.ellipse(-3 * k, ey + s * 4 * k, 2.6 * k, 3.6 * k, 0, 0, TAU); g.fill(); }
        if (style === 'Glasses' && !dead) {
          g.strokeStyle = '#1a1a1a'; g.lineWidth = 1.6 * k; g.beginPath(); g.arc(ex, ey, rr + 1.6 * k, 0, TAU); g.stroke();
          if (s === 1) { g.beginPath(); g.moveTo(ex, -8 * k + rr + 1.6 * k); g.lineTo(ex, 8 * k - rr - 1.6 * k); g.stroke(); }
        }
        if (style === 'Monocle' && s === 1) {
          g.strokeStyle = '#d9a400'; g.lineWidth = 1.5 * k; g.beginPath(); g.arc(ex, ey, rr + 1.6 * k, 0, TAU); g.stroke();
          g.lineWidth = 0.8 * k; g.beginPath(); g.moveTo(ex - rr - 1 * k, ey + 2 * k); g.quadraticCurveTo(ex - 9 * k, ey + 6 * k, ex - 12 * k, ey + 3 * k); g.stroke();
        }
        if (style === 'Angry') {   // brows slanting down towards the nose
          g.strokeStyle = ink; g.lineWidth = 2.4 * k; g.lineCap = 'round';
          g.beginPath(); g.moveTo(ex - 3 * k, ey + s * 6.5 * k); g.lineTo(ex + 6 * k, ey + s * 1.5 * k); g.stroke();
        }
      }
    }
    g.restore();
  }

  // Hats sit upright on top of the head whichever way the snake faces, like a sticker.
  function drawHat(g, x, y, r, i, dead) {
    const name = SK.HATS[i]; if (!name || name === 'None') return;
    g.save(); g.translate(x, y - r * 0.92);
    if (dead) g.globalAlpha = 0.6;
    const sh = 'rgba(0,0,0,0.25)';
    switch (name) {
      case 'Party':
        g.fillStyle = sh; tri(g, -r * 0.55, 2, r * 0.55, 2, r * 0.05, -r * 1.55 + 2);
        g.fillStyle = '#ff6fb1'; tri(g, -r * 0.55, 0, r * 0.55, 0, r * 0.05, -r * 1.55);
        g.strokeStyle = '#ffc83d'; g.lineWidth = r * 0.14;
        g.beginPath(); g.moveTo(-r * 0.36, -r * 0.4); g.lineTo(r * 0.38, -r * 0.4); g.moveTo(-r * 0.17, -r * 0.9); g.lineTo(r * 0.24, -r * 0.9); g.stroke();
        g.fillStyle = '#fff'; dot(g, r * 0.05, -r * 1.58, r * 0.2);
        break;
      case 'Crown':
        g.fillStyle = '#d99a00'; g.fillRect(-r * 0.62, -r * 0.18, r * 1.24, r * 0.3);
        g.fillStyle = '#ffc83d'; g.beginPath();
        g.moveTo(-r * 0.62, 0); g.lineTo(-r * 0.62, -r * 0.8); g.lineTo(-r * 0.31, -r * 0.42); g.lineTo(0, -r * 0.98);
        g.lineTo(r * 0.31, -r * 0.42); g.lineTo(r * 0.62, -r * 0.8); g.lineTo(r * 0.62, 0); g.closePath(); g.fill();
        g.fillStyle = '#ff4d6d'; dot(g, 0, -r * 0.3, r * 0.12);
        g.fillStyle = '#4fc3ff'; dot(g, -r * 0.36, -r * 0.24, r * 0.09); dot(g, r * 0.36, -r * 0.24, r * 0.09);
        break;
      case 'Top hat':
        g.fillStyle = '#111518'; g.beginPath(); g.ellipse(0, 0, r * 0.8, r * 0.2, 0, 0, TAU); g.fill();
        g.fillRect(-r * 0.45, -r * 1.15, r * 0.9, r * 1.12);
        g.fillStyle = '#e5383b'; g.fillRect(-r * 0.45, -r * 0.36, r * 0.9, r * 0.2);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(-r * 0.35, -r * 1.1, r * 0.14, r * 0.7);
        break;
      case 'Wizard':
        g.fillStyle = '#5a3fc0'; g.beginPath(); g.ellipse(0, 0, r * 0.85, r * 0.2, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(-r * 0.5, -r * 0.05); g.lineTo(r * 0.5, -r * 0.05);
        g.quadraticCurveTo(r * 0.25, -r * 1.0, r * 0.62, -r * 1.65); g.quadraticCurveTo(-r * 0.15, -r * 1.2, -r * 0.5, -r * 0.05); g.fill();
        g.fillStyle = '#ffe36b'; star(g, -r * 0.05, -r * 0.55, r * 0.17); star(g, r * 0.22, -r * 0.95, r * 0.11);
        break;
      case 'Halo':
        g.strokeStyle = 'rgba(255,220,120,0.35)'; g.lineWidth = r * 0.35;
        g.beginPath(); g.ellipse(0, -r * 0.75, r * 0.6, r * 0.2, 0, 0, TAU); g.stroke();
        g.strokeStyle = '#ffe36b'; g.lineWidth = r * 0.13;
        g.beginPath(); g.ellipse(0, -r * 0.75, r * 0.6, r * 0.2, 0, 0, TAU); g.stroke();
        break;
      case 'Bow':
        g.translate(r * 0.55, r * 0.05); g.rotate(0.35);
        g.fillStyle = '#ff4d7a'; tri(g, 0, 0, -r * 0.55, -r * 0.38, -r * 0.55, r * 0.38); tri(g, 0, 0, r * 0.55, -r * 0.38, r * 0.55, r * 0.38);
        g.fillStyle = '#ff8fab'; dot(g, 0, 0, r * 0.17);
        break;
      case 'Beanie':
        g.fillStyle = '#e5383b'; g.beginPath(); g.arc(0, -r * 0.05, r * 0.66, Math.PI, 0); g.fill();
        g.fillStyle = '#fff'; g.fillRect(-r * 0.7, -r * 0.12, r * 1.4, r * 0.26); dot(g, 0, -r * 0.78, r * 0.2);
        break;
      case 'Cowboy':
        g.fillStyle = '#7a4a24'; g.beginPath(); g.ellipse(0, 0, r * 1.05, r * 0.24, 0, 0, TAU); g.fill();
        g.fillStyle = '#9a6233'; roundRect(g, -r * 0.48, -r * 0.82, r * 0.96, r * 0.82, r * 0.25); g.fill();
        g.fillStyle = '#3a2210'; g.fillRect(-r * 0.48, -r * 0.3, r * 0.96, r * 0.14);
        break;
      case 'Chef':
        g.fillStyle = '#f5f5f5'; g.fillRect(-r * 0.42, -r * 0.5, r * 0.84, r * 0.5);
        dot(g, -r * 0.32, -r * 0.75, r * 0.32); dot(g, r * 0.32, -r * 0.75, r * 0.32); dot(g, 0, -r * 0.95, r * 0.36);
        g.fillStyle = '#d8d8d8'; g.fillRect(-r * 0.42, -r * 0.14, r * 0.84, r * 0.14);
        break;
      case 'Viking':
        g.fillStyle = '#f2ead8';
        g.beginPath(); g.moveTo(-r * 0.5, -r * 0.2); g.quadraticCurveTo(-r * 1.0, -r * 0.4, -r * 0.95, -r * 1.05); g.quadraticCurveTo(-r * 0.7, -r * 0.55, -r * 0.35, -r * 0.45); g.fill();
        g.beginPath(); g.moveTo(r * 0.5, -r * 0.2); g.quadraticCurveTo(r * 1.0, -r * 0.4, r * 0.95, -r * 1.05); g.quadraticCurveTo(r * 0.7, -r * 0.55, r * 0.35, -r * 0.45); g.fill();
        g.fillStyle = '#8fa3b8'; g.beginPath(); g.arc(0, 0, r * 0.62, Math.PI, 0); g.fill();
        g.fillStyle = '#6b7c8f'; g.fillRect(-r * 0.62, -r * 0.12, r * 1.24, r * 0.16);
        break;
      case 'Pirate':
        g.fillStyle = '#151515'; g.beginPath(); g.moveTo(-r * 0.95, 0); g.quadraticCurveTo(0, -r * 1.25, r * 0.95, 0); g.quadraticCurveTo(0, -r * 0.3, -r * 0.95, 0); g.fill();
        g.fillStyle = '#fff'; dot(g, 0, -r * 0.5, r * 0.15); g.fillRect(-r * 0.2, -r * 0.3, r * 0.4, r * 0.07);
        break;
      case 'Santa':
        g.fillStyle = '#e5383b'; g.beginPath(); g.moveTo(-r * 0.6, 0); g.quadraticCurveTo(-r * 0.2, -r * 1.3, r * 0.75, -r * 0.95); g.lineTo(r * 0.6, 0); g.fill();
        g.fillStyle = '#fff'; roundRect(g, -r * 0.7, -r * 0.2, r * 1.4, r * 0.3, r * 0.15); g.fill(); dot(g, r * 0.78, -r * 0.95, r * 0.2);
        break;
      case 'Cat ears':
        g.translate(0, r * 0.45);
        for (const sx of [-1, 1]) {
          g.fillStyle = '#2b2b2b'; tri(g, sx * r * 0.2, -r * 0.35, sx * r * 0.8, -r * 0.1, sx * r * 0.6, -r * 0.95);
          g.fillStyle = '#ff9ab5'; tri(g, sx * r * 0.33, -r * 0.37, sx * r * 0.67, -r * 0.22, sx * r * 0.56, -r * 0.72);
        }
        break;
      case 'Antenna':
        g.strokeStyle = '#c9d6df'; g.lineWidth = r * 0.1; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(r * 0.2, -r * 0.6, 0, -r * 1.1); g.stroke();
        g.fillStyle = 'rgba(79,240,255,0.35)'; dot(g, 0, -r * 1.2, r * 0.32); g.fillStyle = '#4ff0ff'; dot(g, 0, -r * 1.2, r * 0.18);
        break;
      case 'Propeller':
        g.fillStyle = '#ff5a4e'; g.beginPath(); g.arc(0, 0, r * 0.6, Math.PI, Math.PI * 1.5); g.lineTo(0, 0); g.fill();
        g.fillStyle = '#ffc83d'; g.beginPath(); g.arc(0, 0, r * 0.6, Math.PI * 1.5, 0); g.lineTo(0, 0); g.fill();
        g.fillStyle = '#5b8cff'; g.fillRect(-r * 0.62, -r * 0.06, r * 1.24, r * 0.12);
        g.strokeStyle = '#444'; g.lineWidth = r * 0.08; g.beginPath(); g.moveTo(0, -r * 0.6); g.lineTo(0, -r * 0.8); g.stroke();
        g.fillStyle = '#4cc35b'; g.beginPath(); g.ellipse(-r * 0.32, -r * 0.84, r * 0.34, r * 0.09, 0.15, 0, TAU); g.ellipse(r * 0.32, -r * 0.84, r * 0.34, r * 0.09, -0.15, 0, TAU); g.fill();
        break;
      case 'Laurel':
        g.fillStyle = '#ffc83d';
        for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) {
          const a = Math.PI * (0.95 - j * 0.16), lx = Math.cos(a) * r * 0.62 * sx, ly = -Math.sin(a) * r * 0.62 + r * 0.05;
          g.beginPath(); g.ellipse(lx, ly - r * 0.15, r * 0.22, r * 0.1, sx * (0.9 - j * 0.35), 0, TAU); g.fill();
        }
        g.fillStyle = '#fff3b0'; dot(g, 0, -r * 0.55, r * 0.1);
        break;
      case 'Headphones':
        g.strokeStyle = '#2b2b2b'; g.lineWidth = r * 0.16; g.beginPath(); g.arc(0, r * 0.35, r * 0.8, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
        g.fillStyle = '#ff5a4e'; roundRect(g, -r * 0.98, -r * 0.05, r * 0.36, r * 0.62, r * 0.14); g.fill(); roundRect(g, r * 0.62, -r * 0.05, r * 0.36, r * 0.62, r * 0.14); g.fill();
        break;
      case 'Graduation':
        g.fillStyle = '#1d1d1d'; g.fillRect(-r * 0.45, -r * 0.35, r * 0.9, r * 0.35);
        g.beginPath(); g.moveTo(0, -r * 0.95); g.lineTo(r * 1.0, -r * 0.6); g.lineTo(0, -r * 0.25); g.lineTo(-r * 1.0, -r * 0.6); g.closePath(); g.fill();
        g.strokeStyle = '#ffc83d'; g.lineWidth = r * 0.07; g.beginPath(); g.moveTo(0, -r * 0.6); g.lineTo(r * 0.75, -r * 0.45); g.lineTo(r * 0.75, -r * 0.05); g.stroke();
        g.fillStyle = '#ffc83d'; dot(g, r * 0.75, -r * 0.02, r * 0.09);
        break;
      case 'Bunny ears':
        for (const sx of [-1, 1]) {
          g.save(); g.translate(sx * r * 0.32, r * 0.1); g.rotate(sx * 0.18);
          g.fillStyle = '#f5f5f5'; g.beginPath(); g.ellipse(0, -r * 0.8, r * 0.22, r * 0.75, 0, 0, TAU); g.fill();
          g.fillStyle = '#ffb3c8'; g.beginPath(); g.ellipse(0, -r * 0.78, r * 0.1, r * 0.55, 0, 0, TAU); g.fill();
          g.restore();
        }
        break;
      case 'Flower':
        g.translate(-r * 0.45, r * 0.05);
        g.fillStyle = '#fff3f8';
        for (let p = 0; p < 5; p++) { const a = p * TAU / 5; g.beginPath(); g.ellipse(Math.cos(a) * r * 0.26, Math.sin(a) * r * 0.26, r * 0.22, r * 0.15, a, 0, TAU); g.fill(); }
        g.fillStyle = '#ffc83d'; dot(g, 0, 0, r * 0.16);
        break;
    }
    g.restore();
  }
  function tri(g, ax, ay, bx, by, cx, cy) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath(); g.fill(); }

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

  // Each mode has its own board: tile colours, a tint of light, an accent and an ambient effect.
  const THEMES = {
    classic:    { a: '#1c2a22', b: '#18241d', light: '190,255,215', glow: 'rgba(76,195,91,.10)',   accent: '#4cc35b', amb: null },
    borderless: { a: '#18273a', b: '#142235', light: '150,200,255', glow: 'rgba(91,140,255,.14)',  accent: '#5b8cff', amb: 'drift', edges: '91,140,255' },
    walls:      { a: '#2b2824', b: '#25221e', light: '255,230,190', glow: 'rgba(168,159,145,.12)', accent: '#c9b89c', amb: 'dust' },
    portal:     { a: '#211c38', b: '#1b1731', light: '200,170,255', glow: 'rgba(199,125,255,.16)', accent: '#c77dff', amb: 'stars' },
    poison:     { a: '#1f2a1d', b: '#1a2418', light: '190,120,255', glow: 'rgba(155,92,240,.14)',  accent: '#b388ff', amb: 'bubbles' },
    peaceful:   { a: '#183130', b: '#142a29', light: '160,255,230', glow: 'rgba(39,194,176,.14)',  accent: '#27c2b0', amb: 'fireflies' },
    turbo:      { a: '#2c1e16', b: '#251912', light: '255,170,90',  glow: 'rgba(255,152,56,.14)',  accent: '#ffb347', amb: 'streaks' },
    mirror:     { a: '#2a1b2d', b: '#241727', light: '255,170,220', glow: 'rgba(255,111,177,.13)', accent: '#ff8fc8', amb: 'sparkle', axis: true },
    dark:       { a: '#141917', b: '#101412', light: '255,233,168', glow: 'rgba(255,233,168,.05)', accent: '#ffe9a8', amb: null },
    gold:       { a: '#2c2516', b: '#262012', light: '255,215,120', glow: 'rgba(255,200,61,.14)',  accent: '#ffc83d', amb: 'glitter' },
    hunger:     { a: '#2c1d19', b: '#261814', light: '255,140,100', glow: 'rgba(255,120,80,.13)',  accent: '#ff9838', amb: 'embers' },
    runaway:    { a: '#1f2f1b', b: '#1a2916', light: '220,255,170', glow: 'rgba(181,229,80,.12)',  accent: '#b5e550', amb: 'pollen' }
  };
  R.THEMES = THEMES;

  // Checkerboard, plus soft light from the top and a vignette. Drawn once into a cache.
  function drawBoard(g, cols, rows, cell, lit, theme) {
    const T = theme || THEMES.classic, W = cols * cell, H = rows * cell;
    g.fillStyle = T.b; g.fillRect(0, 0, W, H);
    g.fillStyle = T.a;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if ((x + y) % 2 === 0) g.fillRect(x * cell, y * cell, cell, cell);
    if (!lit) return;
    const d = Math.hypot(W, H);
    let gr = g.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, d * 0.55);
    gr.addColorStop(0, 'rgba(' + T.light + ',0.08)'); gr.addColorStop(1, 'rgba(' + T.light + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (T.edges) {   // Borderless: the edges glow to show they're open
      const e = cell * 0.9;
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, e, 0, 0, 0, e, H], [W, 0, W - e, 0, W - e, 0, e, H], [0, 0, 0, e, 0, 0, W, e], [0, H, 0, H - e, 0, H - e, W, e]]) {
        const lg = g.createLinearGradient(x0, y0, x1, y1);
        lg.addColorStop(0, 'rgba(' + T.edges + ',0.22)'); lg.addColorStop(1, 'rgba(' + T.edges + ',0)');
        g.fillStyle = lg; g.fillRect(rx, ry, rw, rh);
      }
    }
    if (T.grid) {   // Neon: glowing grid lines
      g.strokeStyle = 'rgba(' + T.grid + ',0.16)'; g.lineWidth = 1.2; g.beginPath();
      for (let x = 0; x <= cols; x++) { g.moveTo(x * cell, 0); g.lineTo(x * cell, H); }
      for (let y = 0; y <= rows; y++) { g.moveTo(0, y * cell); g.lineTo(W, y * cell); }
      g.stroke();
    }
    if (T.flat) return;   // Retro: no vignette, keep it crisp
    if (T.axis) {   // Mirror: a faint line of symmetry down the middle
      g.strokeStyle = 'rgba(255,170,220,0.12)'; g.lineWidth = 2; g.setLineDash([6, 8]);
      g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([]);
    }
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

  function drawApple(g, a, t, game, p) {
    const pop = popScale(a, t);
    // Golden apples blink in their last few steps before turning normal.
    let alpha = 1;
    if (a.kind === 'gold' && game) { const left = a.until - game.steps; if (left <= 10) alpha = 0.55 + 0.45 * Math.abs(Math.cos(t / (left <= 4 ? 70 : 140))); }
    if (alpha < 1) g.globalAlpha = alpha;
    const bob = R.reduced ? 1 : 1 + Math.sin(t / 220 + a.x) * 0.04;
    let ax = a.x, ay = a.y, hop = 0;
    if (game && a.movedAt === game.steps && p != null && p < 1) {   // Runaway: slide + little hop to the new tile
      const e = U.ease(p); ax = a.fx + (a.x - a.fx) * e; ay = a.fy + (a.y - a.fy) * e; hop = Math.sin(p * Math.PI) * 6;
    }
    const cx = ax * CELL + CELL / 2, cy = ay * CELL + CELL / 2 + 1 - hop, r = CELL * 0.33 * pop * bob;
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
    if (a.kind === 'apple' && R.food) { drawFood(g, cx, cy, r, R.food); g.globalAlpha = 1; return; }
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

  // Food skins (they replace the normal apple). Drawn at unit size around (cx, cy) with radius r.
  function drawFood(g, cx, cy, r, i) {
    const n = SK.FOODS[i], shine = (x, y, w, h) => { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(x, y, w, h, -0.6, 0, TAU); g.fill(); };
    g.save(); g.translate(cx, cy); g.scale(r, r);
    switch (n) {
      case 'Cherry':
        g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.12; g.beginPath(); g.moveTo(-0.45, 0.2); g.quadraticCurveTo(-0.2, -0.9, 0.25, -1.05); g.moveTo(0.5, 0.25); g.quadraticCurveTo(0.4, -0.6, 0.25, -1.05); g.stroke();
        g.fillStyle = '#c9184a'; dot(g, -0.45, 0.35, 0.58); g.fillStyle = '#e5383b'; dot(g, 0.5, 0.4, 0.58);
        shine(-0.62, 0.15, 0.16, 0.1); shine(0.33, 0.2, 0.16, 0.1);
        g.fillStyle = '#5fd16a'; g.beginPath(); g.ellipse(0.5, -0.95, 0.32, 0.14, 0.4, 0, TAU); g.fill();
        break;
      case 'Orange':
        g.fillStyle = '#ff8c1a'; dot(g, 0, 0, 1); g.fillStyle = 'rgba(160,70,0,0.25)'; dot(g, 0.35, 0.35, 0.08); dot(g, -0.3, 0.45, 0.07); dot(g, 0.1, -0.2, 0.06);
        shine(-0.38, -0.42, 0.24, 0.14); g.fillStyle = '#4cc35b'; g.beginPath(); g.ellipse(0.25, -1.0, 0.36, 0.15, -0.4, 0, TAU); g.fill();
        break;
      case 'Strawberry':
        g.fillStyle = '#ff3b4f'; g.beginPath(); g.moveTo(0, 1.05); g.bezierCurveTo(-1.1, 0.3, -1.0, -0.75, 0, -0.6); g.bezierCurveTo(1.0, -0.75, 1.1, 0.3, 0, 1.05); g.fill();
        g.fillStyle = '#ffe36b'; for (const [x, y] of [[-0.4, -0.2], [0.35, -0.25], [0, 0.05], [-0.3, 0.35], [0.3, 0.35], [0, 0.65]]) dot(g, x, y, 0.07);
        g.fillStyle = '#3f9a3a'; tri(g, -0.6, -0.65, 0.6, -0.65, 0, -0.35); tri(g, -0.25, -0.95, 0.25, -0.95, 0, -0.5);
        shine(-0.4, -0.35, 0.15, 0.09);
        break;
      case 'Grape':
        g.fillStyle = '#7d3cc0'; for (const [x, y] of [[-0.45, -0.35], [0.1, -0.4], [0.6, -0.3], [-0.2, 0.15], [0.35, 0.15], [0.08, 0.65]]) dot(g, x, y, 0.38);
        g.fillStyle = 'rgba(255,255,255,0.35)'; for (const [x, y] of [[-0.55, -0.48], [0, -0.53], [-0.3, 0.02]]) dot(g, x, y, 0.1);
        g.strokeStyle = '#6b4a2b'; g.lineWidth = 0.12; g.beginPath(); g.moveTo(0.1, -0.75); g.lineTo(0.2, -1.1); g.stroke();
        break;
      case 'Donut':
        g.fillStyle = '#d99a5b'; dot(g, 0, 0, 1); g.fillStyle = '#ff8fc8'; g.beginPath(); g.arc(0, -0.05, 0.86, 0, TAU); g.fill();
        g.fillStyle = '#1b2a22'; dot(g, 0, 0, 0.3);
        for (const [x, y, c] of [[-0.5, -0.3, '#5b8cff'], [0.45, -0.45, '#ffe36b'], [0.55, 0.3, '#4cc35b'], [-0.35, 0.5, '#fff'], [0.05, -0.65, '#ff5a4e']]) { g.fillStyle = c; g.fillRect(x - 0.08, y - 0.03, 0.16, 0.06); }
        break;
      case 'Star':
        g.fillStyle = '#ffd23d'; g.beginPath();
        for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, rr = j % 2 ? 0.48 : 1.1; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.closePath(); g.fill(); shine(-0.2, -0.3, 0.2, 0.1);
        break;
      case 'Gem':
        g.fillStyle = '#3ec9f0'; g.beginPath(); g.moveTo(-0.95, -0.25); g.lineTo(-0.5, -0.8); g.lineTo(0.5, -0.8); g.lineTo(0.95, -0.25); g.lineTo(0, 1); g.closePath(); g.fill();
        g.fillStyle = '#9ff2ff'; g.beginPath(); g.moveTo(-0.5, -0.8); g.lineTo(0.5, -0.8); g.lineTo(0.3, -0.25); g.lineTo(-0.3, -0.25); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,60,120,0.25)'; g.beginPath(); g.moveTo(0.3, -0.25); g.lineTo(0.95, -0.25); g.lineTo(0, 1); g.closePath(); g.fill();
        break;
      case 'Mushroom':
        g.fillStyle = '#f5ead6'; roundRect(g, -0.32, -0.1, 0.64, 1.0, 0.2); g.fill();
        g.fillStyle = '#e5383b'; g.beginPath(); g.arc(0, 0.05, 1.0, Math.PI, 0); g.closePath(); g.fill();
        g.fillStyle = '#fff'; dot(g, -0.45, -0.35, 0.16); dot(g, 0.15, -0.65, 0.14); dot(g, 0.55, -0.25, 0.12);
        break;
      case 'Pizza':
        g.fillStyle = '#e8b04a'; g.beginPath(); g.moveTo(0, 1.05); g.lineTo(-0.95, -0.7); g.quadraticCurveTo(0, -1.15, 0.95, -0.7); g.closePath(); g.fill();
        g.fillStyle = '#ffd86b'; g.beginPath(); g.moveTo(0, 0.85); g.lineTo(-0.75, -0.5); g.quadraticCurveTo(0, -0.85, 0.75, -0.5); g.closePath(); g.fill();
        g.fillStyle = '#d6402f'; dot(g, -0.25, -0.35, 0.16); dot(g, 0.3, -0.4, 0.15); dot(g, 0.02, 0.2, 0.15);
        break;
      case 'Watermelon':
        g.fillStyle = '#3f9a3a'; g.beginPath(); g.arc(0, -0.25, 1.05, 0, Math.PI); g.closePath(); g.fill();
        g.fillStyle = '#d9f5c9'; g.beginPath(); g.arc(0, -0.25, 0.9, 0, Math.PI); g.closePath(); g.fill();
        g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(0, -0.25, 0.78, 0, Math.PI); g.closePath(); g.fill();
        g.fillStyle = '#1b1b1b'; for (const [x, y] of [[-0.4, 0], [0, 0.2], [0.4, 0], [-0.15, -0.1], [0.2, -0.1]]) { g.beginPath(); g.ellipse(x, y, 0.05, 0.09, 0, 0, TAU); g.fill(); }
        break;
      case 'Blueberry':
        g.fillStyle = '#3b4fc4'; dot(g, 0, 0.05, 0.95); g.fillStyle = '#2a3796'; g.beginPath();
        for (let j = 0; j < 5; j++) { const a = -Math.PI / 2 + j * TAU / 5; g.lineTo(Math.cos(a) * 0.32, -0.55 + Math.sin(a) * 0.32); } g.closePath(); g.fill();
        shine(-0.4, -0.15, 0.22, 0.12);
        break;
      case 'Cookie':
        g.fillStyle = '#d9a066'; dot(g, 0, 0, 1); g.fillStyle = '#b97f45'; dot(g, 0.3, 0.3, 0.6);
        g.fillStyle = '#4a2a14'; for (const [x, y] of [[-0.4, -0.3], [0.3, -0.5], [0.45, 0.25], [-0.2, 0.45], [0, -0.05]]) dot(g, x, y, 0.13);
        break;
    }
    g.restore();
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
      this.parts = []; for (let i = 0; i < 120; i++) this.parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, c: '', born: 0, life: 0, s: 'dot', a: 0, va: 0 });
      this.rings = []; for (let i = 0; i < 10; i++) this.rings.push({ on: false, x: 0, y: 0, born: 0, c: '' });
    }
    clear() { for (const p of this.parts) p.on = false; for (const r of this.rings) r.on = false; }
    _free(list) { for (const p of list) if (!p.on) return p; return null; }
    burst(cx, cy, now, colors, count, shape) {
      const n = R.reduced ? 4 : (count || 14);
      for (let i = 0; i < n; i++) {
        const p = this._free(this.parts); if (!p) break;
        const a = Math.random() * TAU, sp = 100 + Math.random() * 180;
        p.on = true; p.x = cx; p.y = cy; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.r = 3 + Math.random() * 3.5;
        const q = Math.random(); p.c = colors.length > 3 ? colors[(q * colors.length) | 0] : q < 0.65 ? colors[0] : (q < 0.82 ? colors[1] : colors[2]);
        p.s = shape || 'dot'; p.a = Math.random() * TAU; p.va = (Math.random() - 0.5) * 12;
        p.born = now; p.life = 380 + Math.random() * 220;
      }
      this.ring(cx, cy, now, '#ffffff');
    }
    // One particle left behind the tail (trails). Slow, soft and short-lived.
    trail(x, y, now, colors, shp) {
      if (R.reduced) return;
      const p = this._free(this.parts); if (!p) return;
      p.on = true; p.x = x + (Math.random() - 0.5) * 10; p.y = y + (Math.random() - 0.5) * 10;
      p.vx = (Math.random() - 0.5) * 18; p.vy = (Math.random() - 0.5) * 18 - (shp === 'puff' ? 10 : 0);
      p.r = 2 + Math.random() * 2; p.c = colors[(Math.random() * colors.length) | 0]; p.s = shp;
      p.a = Math.random() * TAU; p.va = (Math.random() - 0.5) * 4; p.born = now; p.life = 700 + Math.random() * 400;
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
        g.globalAlpha = f; g.fillStyle = p.c; p.a += p.va * s;
        const rr = p.r * (p.s === 'dot' ? f : 0.6 + 0.4 * f);
        switch (p.s) {
          case 'rect': g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillRect(-rr, -rr * 0.5, rr * 2, rr); g.restore(); break;
          case 'square': g.fillRect(Math.round(p.x - rr), Math.round(p.y - rr), Math.round(rr * 1.6), Math.round(rr * 1.6)); break;
          case 'ring': g.strokeStyle = p.c; g.lineWidth = 1.6; g.beginPath(); g.arc(p.x, p.y, rr * 1.2, 0, TAU); g.stroke(); break;
          case 'star': star(g, p.x, p.y, rr * 1.4); break;
          case 'heart': g.save(); g.translate(p.x, p.y); g.rotate(Math.PI); heart(g, 0, 0, rr * 1.3); g.restore(); break;
          default: shape(g, p.s, p.x, p.y, rr, p.a, f);
        }
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

  // Confetti, drawn on a full-screen canvas above everything. fire() is the big new-best
  // celebration; pop(x, y) is a small burst (used when you unlock something mid-game).
  class Confetti {
    constructor(canvas) {
      this.cv = canvas; this.g = canvas.getContext('2d'); this.active = false; this.dirty = false;
      this.p = []; for (let i = 0; i < 200; i++) this.p.push({ on: false, t0: 0, x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, w: 0, h: 0, c: '' });
      this.colors = ['#ff5a4e', '#ffc83d', '#5b8cff', '#4cc35b', '#ff6fb1', '#27c2b0', '#ffffff'];
    }
    resize() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      if (this.W === root.innerWidth && this.H === root.innerHeight && this.dpr === dpr) return;
      this.dpr = dpr; this.W = root.innerWidth; this.H = root.innerHeight;
      this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    }
    _launch(q, x, y, ang, sp, now) {
      q.on = true; q.t0 = now; q.x = x; q.y = y; q.vx = Math.cos(ang) * sp; q.vy = Math.sin(ang) * sp;
      q.a = Math.random() * TAU; q.va = (Math.random() - 0.5) * 14;
      q.w = 6 + Math.random() * 6; q.h = 3 + Math.random() * 4;
      q.c = this.colors[(Math.random() * this.colors.length) | 0];
    }
    fire() {
      if (R.noConfetti) return;
      if (R.reduced) return;
      this.resize(); const now = performance.now();
      for (let i = 0; i < 160; i++) {
        const left = Math.random() < 0.5;
        this._launch(this.p[i], left ? -10 : this.W + 10, this.H * (0.45 + Math.random() * 0.35),
          (left ? -1.0 : -Math.PI + 1.0) + (Math.random() - 0.5) * 0.7, 600 + Math.random() * 700, now);
      }
      this.active = true;
    }
    pop(x, y, n) {
      if (R.noConfetti) return;
      if (R.reduced) return;
      this.resize(); const now = performance.now(); let k = 0;
      for (const q of this.p) {
        if (q.on) continue;
        this._launch(q, x, y, -Math.PI / 2 + (Math.random() - 0.5) * 2.2, 250 + Math.random() * 380, now);
        if (++k >= (n || 36)) break;
      }
      this.active = true;
    }
    draw(t, dt) {
      const g = this.g;
      if (!this.active) {
        if (this.dirty) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height); this.dirty = false; }
        return;
      }
      const s = Math.min(dt, 50) / 1000;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height);
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      let any = false;
      for (const q of this.p) {
        if (!q.on) continue;
        const age = t - q.t0;
        if (age > 3000 || q.y > this.H + 40) { q.on = false; continue; }
        any = true;
        q.vy += 1100 * s; q.vx *= Math.exp(-1.6 * s); q.vy *= Math.exp(-0.9 * s);
        q.x += q.vx * s; q.y += q.vy * s; q.a += q.va * s;
        g.globalAlpha = age > 2200 ? Math.max(0, 1 - (age - 2200) / 800) : 1;
        g.save(); g.translate(q.x, q.y); g.rotate(q.a); g.scale(1, Math.cos(q.a * 1.7));
        g.fillStyle = q.c; g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); g.restore();
      }
      g.globalAlpha = 1; this.dirty = true; this.active = any;
    }
  }

  // Gentle ambient life on each mode's board (fireflies, stars, bubbles…). Fixed pool, board units.
  class Ambient {
    constructor() { this.p = []; for (let i = 0; i < 40; i++) this.p.push({ x: 0, y: 0, vx: 0, vy: 0, r: 0, ph: 0 }); this.n = 0; this.kind = null; }
    reset(kind, cols, rows) {
      this.kind = kind; this.W = cols * CELL; this.H = rows * CELL;
      this.n = kind ? Math.min(this.p.length, Math.max(8, Math.round(cols * rows / 9))) : 0;
      for (let i = 0; i < this.n; i++) this._spawn(this.p[i], true);
    }
    _spawn(q, anywhere) {
      const W = this.W, H = this.H, k = this.kind, rnd = Math.random;
      q.x = rnd() * W; q.y = rnd() * H; q.ph = rnd() * TAU; q.r = 1 + rnd() * 2; q.vx = 0; q.vy = 0;
      if (k === 'drift') { q.vx = 8 + rnd() * 14; q.vy = (rnd() - 0.5) * 4; }
      else if (k === 'dust') { q.vx = (rnd() - 0.5) * 6; q.vy = (rnd() - 0.5) * 6; }
      else if (k === 'bubbles') { q.vy = -(10 + rnd() * 16); q.r = 2 + rnd() * 4; if (!anywhere) q.y = H + 10; }
      else if (k === 'streaks') { q.vx = 260 + rnd() * 200; q.vy = 50 + rnd() * 30; q.r = 14 + rnd() * 18; if (!anywhere) q.x = -40; }
      else if (k === 'embers') { q.vy = -(14 + rnd() * 20); q.vx = (rnd() - 0.5) * 8; if (!anywhere) q.y = H + 6; }
      else if (k === 'glitter') { q.vy = 4 + rnd() * 6; }
      else if (k === 'pollen') { q.vx = 6 + rnd() * 8; q.vy = 3 + rnd() * 6; }
      else if (k === 'fireflies') { q.vx = (rnd() - 0.5) * 14; q.vy = (rnd() - 0.5) * 14; }
      else if (k === 'petals') { q.vx = 8 + rnd() * 10; q.vy = 10 + rnd() * 12; q.r = 2.5 + rnd() * 2; if (!anywhere) q.y = -8; }
      else if (k === 'snow') { q.vx = (rnd() - 0.5) * 6; q.vy = 8 + rnd() * 12; if (!anywhere) q.y = -6; }
    }
    draw(g, t, dt) {
      if (!this.n || R.reduced) return;
      const s = dt / 1000, k = this.kind, W = this.W, H = this.H;
      for (let i = 0; i < this.n; i++) {
        const q = this.p[i];
        q.x += q.vx * s; q.y += q.vy * s;
        if (k === 'fireflies') { q.vx += Math.sin(t / 900 + q.ph) * 6 * s; q.vy += Math.cos(t / 1100 + q.ph) * 6 * s; }
        if (q.x < -50 || q.x > W + 50 || q.y < -20 || q.y > H + 20) {
          if (k === 'drift' || k === 'pollen' || k === 'dust' || k === 'fireflies') { q.x = (q.x + W) % W; q.y = (q.y + H) % H; }
          else this._spawn(q, false);
        }
        const tw = 0.5 + 0.5 * Math.sin(t / 600 + q.ph);
        switch (k) {
          case 'drift': g.fillStyle = 'rgba(124,200,255,' + (0.12 + 0.12 * tw) + ')'; dot(g, q.x, q.y, q.r); break;
          case 'dust': g.fillStyle = 'rgba(216,203,181,' + (0.06 + 0.08 * tw) + ')'; dot(g, q.x, q.y, q.r); break;
          case 'stars': g.fillStyle = 'rgba(233,216,255,' + (0.1 + 0.55 * tw * tw) + ')'; star(g, q.x, q.y, q.r * 1.6); break;
          case 'sparkle': g.fillStyle = 'rgba(255,190,230,' + (0.08 + 0.4 * tw * tw) + ')'; star(g, q.x, q.y, q.r * 1.5); break;
          case 'glitter': g.fillStyle = 'rgba(255,215,120,' + (0.1 + 0.5 * tw * tw) + ')'; dot(g, q.x, q.y, q.r * 0.8); break;
          case 'bubbles': g.strokeStyle = 'rgba(190,140,255,' + (0.14 + 0.1 * tw) + ')'; g.lineWidth = 1.2; g.beginPath(); g.arc(q.x, q.y, q.r, 0, TAU); g.stroke(); break;
          case 'embers': g.fillStyle = 'rgba(255,' + (120 + (tw * 60 | 0)) + ',60,' + (0.15 + 0.3 * tw) + ')'; dot(g, q.x, q.y, q.r * 0.8); break;
          case 'pollen': g.fillStyle = 'rgba(230,255,150,' + (0.1 + 0.15 * tw) + ')'; dot(g, q.x, q.y, q.r * 0.9); break;
          case 'petals': g.fillStyle = 'rgba(255,183,213,' + (0.25 + 0.2 * tw) + ')'; g.save(); g.translate(q.x, q.y); g.rotate(t / 700 + q.ph); g.beginPath(); g.ellipse(0, 0, q.r, q.r * 0.55, 0, 0, TAU); g.fill(); g.restore(); break;
          case 'snow': g.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.25 * tw) + ')'; dot(g, q.x + Math.sin(t / 800 + q.ph) * 3, q.y, q.r * 0.8); break;
          case 'streaks':
            g.strokeStyle = 'rgba(255,180,110,0.1)'; g.lineWidth = 1.5;
            g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.r, q.y - q.r * 0.2); g.stroke(); break;
          case 'fireflies':
            g.fillStyle = 'rgba(216,255,138,' + (0.05 + 0.1 * tw) + ')'; dot(g, q.x, q.y, 7);
            g.fillStyle = 'rgba(230,255,170,' + (0.3 + 0.6 * tw) + ')'; dot(g, q.x, q.y, 1.7); break;
        }
      }
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
    // Mode theme, unless a board skin is chosen (skin index > 0).
    setTheme(id, skin) {
      const T = (skin && SK.BOARD_THEMES[SK.BOARDS[skin]]) || THEMES[id] || THEMES.classic;
      if (T !== this.theme) { this.theme = T; this._sizeKey = ''; }
      return T;
    }
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
      drawBoard(tg, this.cols, this.rows, CELL, this.lit, this.theme);
    }
    // ox/oy shift the whole board (used for the death shake), in board units.
    begin(ox, oy) {
      const g = this.g, dx = (ox || 0) * this.sx, dy = (oy || 0) * this.sy;
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (dx || dy) { g.fillStyle = (this.theme || THEMES.classic).b; g.fillRect(0, 0, this.cv.width, this.cv.height); }
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

  // Mirror preview: a quick arrow beside the head showing which way the player "swiped".
  R.drawSwipeHint = function (g, cols, rows, hx, hy, dx, dy, a) {
    const W = cols * CELL, H = rows * CELL, r = CELL * 0.42;
    const x = U.clamp(hx + dx * CELL * 1.3, r + 2, W - r - 2), y = U.clamp(hy + dy * CELL * 1.3, r + 2, H - r - 2);
    g.save(); g.translate(x, y); g.rotate(Math.atan2(dy, dx)); g.globalAlpha = a;
    g.fillStyle = 'rgba(0,0,0,.55)'; dot(g, 0, 0, r * 1.25);
    g.strokeStyle = '#fff'; g.lineWidth = CELL * 0.11; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-r * 0.6, 0); g.lineTo(r * 0.55, 0); g.moveTo(r * 0.1, -r * 0.5); g.lineTo(r * 0.6, 0); g.lineTo(r * 0.1, r * 0.5); g.stroke();
    g.restore();
  };

  // Hunger mode: a meter along the bottom edge that drains your patience smoothly. It glides between
  // game steps, slides back with a pop when you eat, and shakes and glows red as you get close to starving.
  class HungerBar {
    constructor() { this.grad = null; this.gradFor = null; this.reset(); }
    reset() { this.v = 0; this.fedT = -1e9; this.hitT = -1e9; }
    fed(t) { this.fedT = t; }
    hit(t) { this.hitT = t; }
    draw(g, cols, rows, target, t, dt) {
      this.v += (target - this.v) * Math.min(1, dt / (target > this.v ? 70 : 170));
      const L = this.v, W = cols * CELL, H = rows * CELL, w = W * 0.62, h = 14, x = (W - w) / 2, y = H - h - 12;
      const rm = R.reduced, danger = U.clamp((L - 0.6) / 0.4, 0, 1), still = rm ? 0 : 1;
      const fedAge = U.clamp((t - this.fedT) / 340, 0, 1), hitAge = U.clamp((t - this.hitT) / 280, 0, 1);
      const pulse = 0.5 + 0.5 * Math.sin(t / (210 - 130 * danger));
      const pop = 1 + still * 0.14 * (1 - fedAge) * (1 - fedAge);
      const sx = still * (Math.sin(t / 34) * danger * danger * 1.6 + Math.sin(t / 19) * (1 - hitAge) * 5);
      g.save();
      g.translate(W / 2 + sx, y + h / 2); g.scale(pop, pop); g.translate(-W / 2, -(y + h / 2));
      if (danger > 0) {   // red glow around the bar
        g.globalAlpha = danger * (0.25 + 0.4 * pulse); g.fillStyle = '#ff3b30';
        roundRect(g, x - 7, y - 7, w + 14, h + 14, (h + 14) / 2); g.fill(); g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(6,10,8,.8)'; roundRect(g, x - 3, y - 3, w + 6, h + 6, (h + 6) / 2); g.fill();
      if (this.gradFor !== g || this.gradW !== x) {   // green → yellow → red across the whole track
        const c = g.createLinearGradient(x, 0, x + w, 0);
        c.addColorStop(0, '#4cc35b'); c.addColorStop(0.5, '#f2cd3f'); c.addColorStop(0.78, '#ff9838'); c.addColorStop(1, '#ff3b30');
        this.grad = c; this.gradFor = g; this.gradW = x;
      }
      const fw = Math.max(h, w * U.clamp(L, 0, 1));
      g.save(); roundRect(g, x, y, fw, h, h / 2); g.clip();
      g.fillStyle = this.grad; g.fillRect(x, y, w, h);
      // Stripes that run faster the hungrier you get.
      g.fillStyle = 'rgba(255,255,255,.17)';
      const off = rm ? 0 : (t * (0.018 + 0.05 * L)) % 22;
      for (let sxp = x - 22 + off; sxp < x + fw; sxp += 22) {
        g.beginPath(); g.moveTo(sxp, y + h); g.lineTo(sxp + 8, y); g.lineTo(sxp + 17, y); g.lineTo(sxp + 9, y + h); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x, y + 1.5, fw, h * 0.26);
      if (fedAge < 1) { g.globalAlpha = 1 - fedAge; g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.globalAlpha = 1; }
      g.restore();
      // Bright tip on the moving end.
      g.fillStyle = '#fff'; g.globalAlpha = 0.65 + 0.35 * pulse;
      dot(g, x + fw - h / 2, y + h / 2, h * (0.26 + 0.08 * pulse)); g.globalAlpha = 1;
      // A little apple that wobbles more as you starve.
      const ax = x - 20, ay = y + h / 2, tilt = still * Math.sin(t / 70) * (0.08 + 0.4 * danger), as = 1 + 0.16 * pulse * danger;
      g.save(); g.translate(ax, ay); g.rotate(tilt); g.scale(as, as);
      g.fillStyle = 'rgba(6,10,8,.8)'; dot(g, 0, 0, 13);
      g.fillStyle = '#ff5a4e'; dot(g, 0, 1, 8);
      g.strokeStyle = '#5fd16a'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(1, -10, 5, -11); g.stroke();
      g.restore();
      g.restore();
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

  // Small picture of a head (eyes / hat) or an eat effect, for menu chips and the roadmap.
  // Drawn with the same code as the game so previews always match. Cached as data URLs.
  const icons = {};
  R.icon = function (kind, i, color) {
    const key = kind + i + (color || '');
    if (icons[key]) return icons[key];
    const c = document.createElement('canvas'); c.width = c.height = 144;
    const g = c.getContext('2d'); g.scale(144 / 40, 144 / 40);
    if (kind === 'trail') {
      const T = SK.TRAIL_STYLES[SK.TRAILS[i]];
      g.fillStyle = '#5b8cff'; g.strokeStyle = '#5b8cff'; g.lineCap = 'round'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(26, 28); g.lineTo(34, 20); g.stroke();
      if (T) [[20, 24, 3], [14, 18, 2.6], [8, 22, 2.2], [11, 12, 1.8], [4, 15, 1.5]].forEach(([x, y, r], j) => {
        const c = T[0][j % T[0].length]; g.fillStyle = c; g.strokeStyle = c;
        if (T[1] === 'star') star(g, x, y, r * 1.4); else if (T[1] === 'ring') { g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
        else if (T[1] === 'heart') { g.save(); g.translate(x, y); g.rotate(Math.PI); heart(g, 0, 0, r * 1.2); g.restore(); }
        else shape(g, T[1], x, y, r, j, 0.6);
      });
      return (icons[key] = c.toDataURL());
    }
    if (kind === 'food') {
      const a = { x: 0, y: 0, kind: 'apple' }, prev = R.food;
      bornAt.set(a, -1e6);   // fully grown, no pop-in
      R.food = i; g.translate(0, -1); drawApple(g, a, 0); R.food = prev;
      return (icons[key] = c.toDataURL());
    }
    if (kind === 'burst') {
      const B = SK.BURST_STYLES[SK.BURSTS[i]];
      const pts = [[20, 9, 3.4], [31, 15, 2.8], [30, 28, 3.2], [19, 32, 2.6], [9, 26, 3.4], [10, 13, 2.6], [20, 20, 2.2]];
      pts.forEach(([x, y, r], j) => {
        const col = B.colors[j % B.colors.length]; g.fillStyle = col; g.strokeStyle = col;
        switch (B.shape) {
          case 'leaf': case 'coin': case 'gem': case 'bolt': case 'flower': shape(g, B.shape, x, y, r, j, 1); break;
          case 'rect': g.save(); g.translate(x, y); g.rotate(j); g.fillRect(-r, -r * 0.5, r * 2, r); g.restore(); break;
          case 'square': g.fillRect(x - r, y - r, r * 1.7, r * 1.7); break;
          case 'ring': g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, r * 1.1, 0, TAU); g.stroke(); break;
          case 'star': star(g, x, y, r * 1.5); break;
          case 'heart': g.save(); g.translate(x, y); g.rotate(Math.PI); heart(g, 0, 0, r * 1.4); g.restore(); break;
          default: dot(g, x, y, r);
        }
      });
    } else {
      const skin = { eyes: kind === 'eyes' ? i : 0, hat: kind === 'hat' ? i : 0 };
      const cy = kind === 'hat' ? 30 : 20, r = kind === 'hat' ? 9.5 : 14;
      drawHead(g, 20, cy, -Math.PI / 2, r / 14, {}, color || '#5b8cff', skin, r);
      if (kind === 'hat') drawHat(g, 20, cy, r * 0.95, i, false);
    }
    return (icons[key] = c.toDataURL());
  };

  Object.assign(R, { SnakeDrawer, View, Confetti, Ambient, HungerBar, drawApple, drawWalls, drawBoard, drawCountdown, drawDark });
  S.render = R;
})(window);
