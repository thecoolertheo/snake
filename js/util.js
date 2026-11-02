// Shared helpers. Classic script: everything hangs off one global, window.Snake.
(function (root) {
  'use strict';
  const S = root.Snake = root.Snake || {};

  const U = S.util = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.ease = t => t * t * (3 - 2 * t);
  U.hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  U.mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  U.rgb = a => 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')';
  U.hsl = (h, s, l) => {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return [0, 8, 4].map(n => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255));
  };
  U.angOf = (x, y) => Math.atan2(y, x);
  U.lerpAng = (a, b, t) => {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * t;
  };
  // Small seeded RNG (mulberry32) so tests are repeatable.
  U.rng = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
