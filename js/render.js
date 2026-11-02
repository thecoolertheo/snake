// Drawing only. Reads game state, never changes it.
// All drawing is in "board units" (40 per cell); the canvas transform maps that to device pixels.
(function (root) {
  'use strict';
  const S = root.Snake, U = S.util, SK = S.skins;

  const CELL = 40, STEP = 4;
  const TILE_A = '#1c2a22', TILE_B = '#18241d', GREY = [86, 96, 90];
  const HUE_Q = 8;        // rainbow hue is bucketed in 8° steps so neighbouring points share one stroke
  const SHADE_GROUP = 3;  // the shadow (mostly hidden) uses 3× coarser buckets: half the strokes

  // Growable float buffers, reused every frame instead of allocating point objects.
  class Buf {
    constructor(cap) { this.n = 0; this._alloc(cap || 256); }
    _alloc(cap) {
      const o = this;
      const x = new Float32Array(cap), y = new Float32Array(cap), m = new Float32Array(cap);
      const w = new Float32Array(cap), k = new Int32Array(cap), ks = new Int32Array(cap);
      if (o.x) { x.set(o.x); y.set(o.y); m.set(o.m); w.set(o.w); k.set(o.k); ks.set(o.ks); }
      o.cap = cap; o.x = x; o.y = y; o.m = m; o.w = w; o.k = k; o.ks = ks;
    }
    push(x, y, m) {
      if (this.n >= this.cap) this._alloc(this.cap * 2);
      const i = this.n++; this.x[i] = x; this.y[i] = y; this.m[i] = m;
    }
  }

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
      const addV = (x, y) => {
        const i = v.n - 1;
        if (i >= 0 && Math.abs(v.x[i] - x) + Math.abs(v.y[i] - y) <= 0.01) return;
        v.push(x, y, 0);
      };
      const tl = cells[n - 1];
      addV((prevTail.x + (tl.x - prevTail.x) * p) * cell + h, (prevTail.y + (tl.y - prevTail.y) * p) * cell + h);
      for (let i = n - 1; i >= 1; i--) addV(cells[i].x * cell + h, cells[i].y * cell + h);
      addV((cells[1].x + (cells[0].x - cells[1].x) * p) * cell + h, (cells[1].y + (cells[0].y - cells[1].y) * p) * cell + h);

      let cx0 = v.x[0], cy0 = v.y[0], m = 0;
      out.push(cx0, cy0, 0);
      const line = (tx, ty) => {
        const len = Math.hypot(tx - cx0, ty - cy0); if (len < 0.01) return;
        const steps = Math.ceil(len / STEP);
        for (let j = 1; j <= steps; j++) out.push(cx0 + (tx - cx0) * j / steps, cy0 + (ty - cy0) * j / steps, m + len * j / steps);
        m += len; cx0 = tx; cy0 = ty;
      };
      for (let i = 1; i < v.n; i++) {
        const Ax = v.x[i - 1], Ay = v.y[i - 1], Vx = v.x[i], Vy = v.y[i];
        if (i + 1 < v.n) {
          const Bx = v.x[i + 1], By = v.y[i + 1];
          const ux = Math.sign(Vx - Ax), uy = Math.sign(Vy - Ay), wx = Math.sign(Bx - Vx), wy = Math.sign(By - Vy);
          const r = Math.min(cell / 2, Math.hypot(Vx - Ax, Vy - Ay), Math.hypot(Bx - Vx, By - Vy));
          if ((ux !== wx || uy !== wy) && r > 0.5) {
            const sx = Vx - ux * r, sy = Vy - uy * r; line(sx, sy);
            const ccx = sx + wx * r, ccy = sy + wy * r, m0 = m, steps = Math.max(2, Math.ceil(Math.PI / 2 * r / STEP));
            for (let j = 1; j <= steps; j++) {
              const f = Math.PI / 2 * j / steps, c = Math.cos(f), s = Math.sin(f);
              out.push(ccx + r * (-wx * c + ux * s), ccy + r * (-wy * c + uy * s), m0 + 2 * r * j / steps);
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
      const base = U.hexRgb(SK.COLORS[skin.color][1]);
      this.base = base;
      this.dark = U.mix(base, [0, 0, 0], 0.3);
      this.shadow = U.mix(base, [0, 0, 0], 0.5);
      this.fadeTo = U.mix(base, [15, 22, 18], 0.6);
      this.pat = SK.PATTERNS[skin.pattern];
      this.flash = flash;
    }
    _color(key, shade) {
      const cache = shade ? this.shade : this.body;
      let s = cache[key];
      if (s) return s;
      const raw = (key / 17) | 0, gl = key % 17, pat = this.pat;
      let c;
      if (shade) c = pat === 'Rainbow' ? U.hsl(raw * HUE_Q * SHADE_GROUP, 60, 32) : this.shadow;
      else if (pat === 'Stripes') c = raw === 0 ? this.dark : this.base;
      else if (pat === 'Fade') c = U.mix(this.base, this.fadeTo, raw / 32);
      else if (pat === 'Rainbow') c = U.hsl(raw * HUE_Q, 85, 62);
      else c = this.base;
      if (gl) c = U.mix(c, GREY, gl / 16 * 0.85);
      if (!shade && this.flash) c = U.mix(c, [255, 255, 255], this.flash);
      return (cache[key] = U.rgb(c));
    }

    // fx: {dead, flash 0..1, grey 0..1, bulges:Float32Array + nBulges, mouth 0..1}
    draw(g, cells, prevTail, p, cell, headAng, skin, fx) {
      this.build(cells, prevTail, p, cell);
      const P = this.path, n = P.n;
      const M = P.m[n - 1] || 1, k = cell / 40, W = cell * 0.72;
      this._palette(skin, fx.flash || 0);
      const pat = this.pat, tapered = SK.SHAPES[skin.shape] === 'Tapered';
      const sig2 = 2 * (cell * 0.45) ** 2, grey = fx.grey || 0;
      const nb = fx.nBulges || 0, bulges = fx.bulges;
      const hueN = 360 / HUE_Q;

      // Per-point colour key and width, computed once and shared by the shadow and body passes.
      for (let i = 0; i < n; i++) {
        const m = P.m[i];
        let raw = 0;
        if (pat === 'Stripes') raw = ((m % cell) + cell) % cell < cell * 0.4 ? 0 : 1;
        else if (pat === 'Fade') raw = Math.round((1 - m / M) * 32);
        else if (pat === 'Rainbow') raw = Math.round(m / cell * 28 / HUE_Q) % hueN;
        let gl = 0;
        if (grey) { const f = (M - m) / M; gl = Math.round(U.clamp((grey * 1.4 - f) / 0.4, 0, 1) * 16); }
        P.k[i] = raw * 17 + gl;
        P.ks[i] = (pat === 'Rainbow' ? (raw / SHADE_GROUP | 0) : 0) * 17 + gl;
        let w = tapered ? W * (0.4 + 0.6 * U.ease(Math.min(1, m / (cell * 3)))) : W;
        for (let b = 0; b < nb; b++) { const x = (M - m) - bulges[b]; w *= 1 + 0.32 * Math.exp(-x * x / sig2); }
        P.w[i] = Math.round(w * 2) / 2;
      }

      this._strokeRuns(g, true, 3 * k);
      this._strokeRuns(g, false, 0);
      const hx = P.x[n - 1], hy = P.y[n - 1], hc = this._color(P.k[n - 1], false);
      g.fillStyle = hc; g.beginPath(); g.arc(hx, hy, P.w[n - 1] / 2 * 1.06, 0, Math.PI * 2); g.fill();
      drawFace(g, hx, hy, headAng, k, fx, hc, skin);
    }

    // Strokes the path in runs of identical colour/width so it stays fast.
    _strokeRuns(g, shade, dy) {
      const P = this.path, n = P.n, X = P.x, Y = P.y, K = shade ? P.ks : P.k, Wd = P.w;
      g.lineCap = 'round'; g.lineJoin = 'round';
      let i = 1;
      while (i < n) {
        const key = K[i], w = Wd[i];
        g.strokeStyle = this._color(key, shade); g.lineWidth = w;
        g.beginPath(); g.moveTo(X[i - 1], Y[i - 1] + dy);
        while (i < n && K[i] === key && Wd[i] === w) { g.lineTo(X[i], Y[i] + dy); i++; }
        g.stroke();
      }
    }
  }

  function dot(g, cx, cy, r) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }

  function drawFace(g, x, y, a, k, fx, bodyCol, skin) {
    const style = SK.EYES[skin.eyes], ink = '#0f1512', dead = !!fx.dead;
    g.save(); g.translate(x, y); g.rotate(a);
    const o = fx.mouth || 0;
    if (o > 0.03 && !dead) {
      g.fillStyle = '#3b1016'; g.beginPath(); g.ellipse(11 * k, 0, 4.5 * k * o + 0.5, 8 * k * o, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff6b7a'; g.beginPath(); g.ellipse(12.5 * k, 0, 2 * k * o, 3.4 * k * o, 0, 0, Math.PI * 2); g.fill();
    }
    if (style === 'Shades' && !dead) {
      g.fillStyle = '#111518';
      for (let s = -1; s <= 1; s += 2) { g.beginPath(); g.ellipse(5 * k, s * 8 * k, 5 * k, 6.5 * k, 0, 0, Math.PI * 2); g.fill(); }
      g.fillRect(3.5 * k, -8 * k, 2.5 * k, 16 * k);
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let s = -1; s <= 1; s += 2) g.fillRect(6.5 * k, s * 8 * k - 4 * k, 1.6 * k, 3 * k);
    } else {
      for (let s = -1; s <= 1; s += 2) {
        const big = style === 'Big', ex = (big ? 3 : 4) * k, ey = s * (big ? 9.5 : 8) * k, r = (big ? 7.5 : 5.5) * k;
        g.fillStyle = '#fff'; dot(g, ex, ey, r);
        if (dead) {
          g.strokeStyle = ink; g.lineWidth = 1.8 * k; g.lineCap = 'round'; const q = r * 0.5;
          g.beginPath(); g.moveTo(ex - q, ey - q); g.lineTo(ex + q, ey + q); g.moveTo(ex + q, ey - q); g.lineTo(ex - q, ey + q); g.stroke();
          continue;
        }
        g.fillStyle = ink; dot(g, ex + (big ? 2.6 : 2) * k, ey, (big ? 3.8 : 2.8) * k);
        if (big) { g.fillStyle = '#fff'; dot(g, ex + 3.4 * k, ey - 1.4 * k, 1.2 * k); }
        if (style === 'Sleepy') {
          g.fillStyle = bodyCol; g.beginPath(); g.arc(ex, ey, r + 0.8 * k, Math.PI / 2, Math.PI * 1.5); g.fill();
          g.strokeStyle = ink; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(ex, ey - r); g.lineTo(ex, ey + r); g.stroke();
        }
      }
    }
    g.restore();
  }

  function drawTiles(g, cols, rows, cell) {
    g.fillStyle = TILE_B; g.fillRect(0, 0, cols * cell, rows * cell);
    g.fillStyle = TILE_A;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if ((x + y) % 2 === 0) g.fillRect(x * cell, y * cell, cell, cell);
  }

  // Particles live in a fixed pool, so eating never allocates.
  class Fx {
    constructor() {
      this.parts = []; for (let i = 0; i < 96; i++) this.parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, c: '', born: 0, life: 0 });
      this.rings = []; for (let i = 0; i < 8; i++) this.rings.push({ on: false, x: 0, y: 0, born: 0 });
    }
    clear() { for (const p of this.parts) p.on = false; for (const r of this.rings) r.on = false; }
    _free(list) { for (const p of list) if (!p.on) return p; return null; }
    burst(cx, cy, now, count) {
      for (let i = 0; i < (count || 14); i++) {
        const p = this._free(this.parts); if (!p) break;
        const a = Math.random() * Math.PI * 2, sp = 100 + Math.random() * 180;
        p.on = true; p.x = cx; p.y = cy; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.r = 3 + Math.random() * 3.5;
        p.c = Math.random() < 0.65 ? '#ff5a4e' : (Math.random() < 0.5 ? '#5fd16a' : '#ffd5cf');
        p.born = now; p.life = 380 + Math.random() * 220;
      }
      const r = this._free(this.rings);
      if (r) { r.on = true; r.x = cx; r.y = cy; r.born = now; }
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
        g.globalAlpha = 1 - f; g.strokeStyle = '#ffffff'; g.lineWidth = 3 * (1 - f) + 0.5;
        g.beginPath(); g.arc(r.x, r.y, CELL * (0.3 + 0.9 * U.ease(f)), 0, Math.PI * 2); g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  const appleBorn = new WeakMap();   // apple object -> time it first appeared (for the pop-in)
  function drawApple(g, a, t) {
    let b = appleBorn.get(a);
    if (b === undefined) { b = t; appleBorn.set(a, b); }
    const s = Math.min(1, (t - b) / 260), pop = s < 1 ? 1 + Math.sin(s * Math.PI) * 0.25 - (1 - s) * 0.6 : 1;
    const cx = a.x * CELL + CELL / 2, cy = a.y * CELL + CELL / 2 + 2, r = CELL * 0.33 * pop * (1 + Math.sin(t / 220) * 0.04);
    if (r <= 0) return;
    g.fillStyle = '#ff5a4e'; dot(g, cx, cy, r);
    g.fillStyle = 'rgba(255,255,255,.28)'; dot(g, cx - r * 0.35, cy - r * 0.35, r * 0.25);
    g.strokeStyle = '#5fd16a'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy - r * 0.8); g.quadraticCurveTo(cx + 2, cy - r * 1.4, cx + 7, cy - r * 1.5); g.stroke();
  }

  // A canvas that is always pixel-sharp: backing store = CSS size × devicePixelRatio.
  class View {
    constructor(canvas, cols, rows) {
      this.cv = canvas; this.g = canvas.getContext('2d');
      this.cols = cols; this.rows = rows;
      this.tiles = document.createElement('canvas');
      this.snake = new SnakeDrawer();
      this.fx = new Fx();
    }
    setBoard(cols, rows) { this.cols = cols; this.rows = rows; this._sizeKey = ''; }
    // Size the canvas to cssW × cssH CSS pixels. Rebuilds the cached tile layer only when needed.
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
      drawTiles(tg, this.cols, this.rows, CELL);
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

  S.render = { CELL, TILE_A, TILE_B, SnakeDrawer, View, drawApple, drawTiles };
})(window);
