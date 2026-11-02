// Everything saved lives under one localStorage key with a version number.
// load() migrates the old separate keys (snake-best, snake-skin, snake-muted) the first time.
(function (root) {
  'use strict';
  const S = root.Snake = root.Snake || {};

  const KEY = 'snake-save';
  const VERSION = 1;

  const ls = {
    get(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  function defaults() {
    return {
      v: VERSION,
      settings: { color: 0, pattern: 0, eyes: 0, shape: 0, speed: 1, muted: false,
                  mode: 'classic', board: 'm', apples: 1 },
      best: {},        // "mode|board|apples" -> best score
      stats: {},
      unlocked: []
    };
  }

  // Fills in anything missing so older saves keep working when new settings are added.
  function merge(base, saved) {
    for (const k in saved) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && saved[k] && typeof saved[k] === 'object') merge(base[k], saved[k]);
      else base[k] = saved[k];
    }
    return base;
  }

  function fromOldKeys() {
    const d = defaults();
    const best = +ls.get('snake-best') || 0;
    if (best) d.best[bestKey('classic', 'm', 1)] = best;   // the old board was 17x15 with one apple
    try { const skin = JSON.parse(ls.get('snake-skin')); if (skin) merge(d.settings, skin); } catch (e) {}
    if (ls.get('snake-muted') === '1') d.settings.muted = true;
    return d;
  }

  // Add future migrations here: MIGRATIONS[n] upgrades a save from version n to n+1.
  const MIGRATIONS = {};

  function bestKey(mode, board, apples) { return mode + '|' + board + '|' + apples; }

  const store = {
    KEY, VERSION, bestKey,
    data: null,
    load() {
      let saved = null;
      try { saved = JSON.parse(ls.get(KEY)); } catch (e) {}
      if (!saved || typeof saved !== 'object') {
        this.data = fromOldKeys();
        this.save();
        return this.data;
      }
      while ((saved.v | 0) < VERSION && MIGRATIONS[saved.v | 0]) saved = MIGRATIONS[saved.v | 0](saved);
      this.data = merge(defaults(), saved);
      this.data.v = VERSION;
      return this.data;
    },
    save() { ls.set(KEY, JSON.stringify(this.data)); },
    getBest(mode, board, apples) { return this.data.best[bestKey(mode, board, apples)] || 0; },
    // Returns true when this is a new best.
    submitBest(mode, board, apples, score) {
      const k = bestKey(mode, board, apples);
      if (score > (this.data.best[k] || 0)) { this.data.best[k] = score; this.save(); return true; }
      return false;
    }
  };

  S.store = store;
})(typeof window !== 'undefined' ? window : globalThis);
