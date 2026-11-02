// Turns keyboard and touch input into a few high-level actions.
// h = { dir(dx,dy), togglePause(), confirm(), anyInput(), menuOpen() }
(function (root) {
  'use strict';
  const S = root.Snake;

  const KEYS = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
  };

  S.input = {
    init(h, swipeEl) {
      root.addEventListener('keydown', e => {
        h.anyInput();
        const tag = e.target && e.target.tagName;
        if (tag === 'SELECT' || tag === 'INPUT') return;
        const k = KEYS[e.key];
        if (k) { e.preventDefault(); if (!e.repeat) h.dir(k[0], k[1]); return; }
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { h.togglePause(); return; }
        if ((e.key === ' ' || e.key === 'Enter') && h.menuOpen() && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault(); h.confirm();
        }
      });

      // Swipe: a new turn fires every 20px of travel, so you can swipe an L in one motion.
      let sx = 0, sy = 0, tracking = false;
      swipeEl.addEventListener('touchstart', e => {
        h.anyInput();
        const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tracking = true;
      }, { passive: true });
      swipeEl.addEventListener('touchmove', e => {
        if (!tracking || h.menuOpen()) return;
        const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
        if (Math.abs(dx) > Math.abs(dy)) h.dir(Math.sign(dx), 0); else h.dir(0, Math.sign(dy));
        sx = t.clientX; sy = t.clientY;
      }, { passive: true });
      swipeEl.addEventListener('touchend', () => { tracking = false; }, { passive: true });
    }
  };
})(window);
