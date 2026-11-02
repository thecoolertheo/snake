// Turns keyboard, touch, D-pad and gamepad input into a few high-level actions.
// h = { dir(dx,dy), togglePause(), confirm(), anyInput(), menuOpen() }
(function (root) {
  'use strict';
  const S = root.Snake;

  const KEYS = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
  };
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  // Touches that start on these are left alone (buttons, menu, sliders).
  const INTERACTIVE = 'button, a, input, select, label, .overlay, .dpad';

  let H = null;
  const pads = {};   // gamepad index -> previous button/axis state

  S.input = {
    init(h) {
      H = h;
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

      // Swipe anywhere on the screen, not just the board. A new turn fires every 20px of travel,
      // so you can swipe an L in one motion.
      let sx = 0, sy = 0, tracking = false;
      document.addEventListener('touchstart', e => {
        h.anyInput();
        tracking = !(e.target.closest && e.target.closest(INTERACTIVE));
        if (!tracking) return;
        const t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      }, { passive: true });
      document.addEventListener('touchmove', e => {
        if (!tracking) return;
        e.preventDefault();   // stops page scroll / pull-to-refresh while steering
        if (h.menuOpen()) return;
        const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
        if (Math.abs(dx) > Math.abs(dy)) h.dir(Math.sign(dx), 0); else h.dir(0, Math.sign(dy));
        sx = t.clientX; sy = t.clientY;
      }, { passive: false });
      document.addEventListener('touchend', () => { tracking = false; h.anyInput(); }, { passive: true });

      // On-screen D-pad: react on press, not release, so it feels instant.
      const dpad = document.getElementById('dpad');
      if (dpad) dpad.addEventListener('pointerdown', e => {
        const b = e.target.closest('[data-dir]'); if (!b) return;
        e.preventDefault(); h.anyInput();
        const d = DIRS[b.dataset.dir]; h.dir(d[0], d[1]);
        b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 120);
      });
    },

    // Called every frame. Edge-triggered so holding a direction doesn't spam turns.
    pollGamepads() {
      if (!navigator.getGamepads) return;
      const list = navigator.getGamepads();
      for (let i = 0; i < list.length; i++) {
        const gp = list[i]; if (!gp || !gp.connected) continue;
        const prev = pads[i] || (pads[i] = { dir: '', start: false, a: false });
        const btn = n => !!(gp.buttons[n] && gp.buttons[n].pressed);
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        let dir = '';
        if (btn(12)) dir = 'up'; else if (btn(13)) dir = 'down'; else if (btn(14)) dir = 'left'; else if (btn(15)) dir = 'right';
        else if (Math.max(Math.abs(ax), Math.abs(ay)) > 0.55) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up');
        if (dir && dir !== prev.dir) { H.anyInput(); const d = DIRS[dir]; H.dir(d[0], d[1]); }
        prev.dir = dir;
        const start = btn(9), a = btn(0);
        if (start && !prev.start) H.togglePause();
        if (a && !prev.a && H.menuOpen()) H.confirm();
        prev.start = start; prev.a = a;
      }
    }
  };
})(window);
