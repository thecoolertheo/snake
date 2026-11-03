// Sync rules shared by the game (browser) and the sync server (api/sync.js, Node).
// A synced save is a "doc":
//   devices:    { deviceId: { games, apples, timeMs, xp, longest, at } }  what each device has added
//   best:       { "mode|board|apples": score }
//   unlocked:   [ reward ids ]
//   settings:   the look of your snake (SYNCED keys only), with settingsAt = when it last changed
// Merging never loses progress: counters are kept per device and only go up (totals are the sum),
// bests take the higher score, unlocks are combined, and the newest look wins.
(function (root) {
  'use strict';
  const SYNCED = ['color', 'pattern', 'eyes', 'shape', 'hat', 'burst', 'trail', 'food', 'boardSkin', 'customColor', 'unlockToasts'];
  const COUNTS = ['games', 'apples', 'timeMs', 'xp'];
  const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // no 0/O or 1/I/L, so codes are easy to read out
  const CODE_LEN = 8;

  const num = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.min(v, 1e15) : 0);
  const okKey = k => typeof k === 'string' && k.length > 0 && k.length <= 48;

  // "k7qm 3xrp", "K7QM-3XRP" -> "K7QM3XRP"; anything that isn't a full code -> ''
  function cleanCode(s) {
    const c = String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    return c.length === CODE_LEN && [...c].every(ch => ALPHA.indexOf(ch) >= 0) ? c : '';
  }
  const showCode = c => c.slice(0, 4) + '-' + c.slice(4);
  function newCode(rand) {
    rand = rand || Math.random;
    let c = '';
    for (let i = 0; i < CODE_LEN; i++) c += ALPHA[Math.floor(rand() * ALPHA.length) % ALPHA.length];
    return c;
  }

  function empty() { return { v: 1, devices: {}, best: {}, unlocked: [], settings: {}, settingsAt: 0 }; }

  // Keeps only well-formed data, so a bad or hostile request can't break anyone's save.
  function sanitize(d) {
    const out = empty();
    if (!d || typeof d !== 'object') return out;
    if (d.devices && typeof d.devices === 'object') {
      for (const id of Object.keys(d.devices).slice(0, 64)) {
        const r = d.devices[id];
        if (!okKey(id) || !r || typeof r !== 'object') continue;
        const o = {};
        for (const k of COUNTS) o[k] = num(r[k]);
        o.longest = num(r.longest); o.at = num(r.at);
        out.devices[id] = o;
      }
    }
    if (d.best && typeof d.best === 'object') {
      for (const k of Object.keys(d.best).slice(0, 2000)) if (okKey(k) && num(d.best[k])) out.best[k] = num(d.best[k]);
    }
    if (Array.isArray(d.unlocked)) {
      const seen = {};
      for (const id of d.unlocked.slice(0, 2000)) if (okKey(id) && !seen[id]) { seen[id] = 1; out.unlocked.push(id); }
    }
    if (d.settings && typeof d.settings === 'object') {
      for (const k of SYNCED) {
        const v = d.settings[k];
        if (typeof v === 'number' && isFinite(v) && v >= 0 && v < 1000) out.settings[k] = Math.floor(v);
        else if (typeof v === 'boolean') out.settings[k] = v;
        else if (k === 'customColor' && (v === null || (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)))) out.settings[k] = v;
      }
    }
    out.settingsAt = num(d.settingsAt);
    return out;
  }

  function mergeDocs(a, b) {
    a = sanitize(a); b = sanitize(b);
    const out = empty();
    for (const src of [a, b]) {
      for (const id in src.devices) {
        const r = src.devices[id], o = out.devices[id] || (out.devices[id] = { games: 0, apples: 0, timeMs: 0, xp: 0, longest: 0, at: 0 });
        for (const k in o) o[k] = Math.max(o[k], r[k]);
      }
      for (const k in src.best) out.best[k] = Math.max(out.best[k] || 0, src.best[k]);
      for (const id of src.unlocked) if (out.unlocked.indexOf(id) < 0) out.unlocked.push(id);
    }
    const newer = b.settingsAt > a.settingsAt ? b : a;
    out.settings = Object.assign({}, newer.settings); out.settingsAt = newer.settingsAt;
    return out;
  }

  // Totals across devices; pass skip to leave one device out.
  function totals(doc, skip) {
    const t = { games: 0, apples: 0, timeMs: 0, xp: 0, longest: 0 };
    for (const id in doc.devices) {
      if (id === skip) continue;
      const r = doc.devices[id];
      for (const k of COUNTS) t[k] += r[k];
      t.longest = Math.max(t.longest, r.longest);
    }
    return t;
  }

  const core = { SYNCED, COUNTS, ALPHA, CODE_LEN, cleanCode, showCode, newCode, empty, sanitize, mergeDocs, totals };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (root) { root.Snake = root.Snake || {}; root.Snake.syncCore = core; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
