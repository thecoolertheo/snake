// Sync rules shared by the game (browser) and the sync server (api/sync.js, Node).
// A synced save is a "doc":
//   devices:    { deviceId: { games, apples, timeMs, xp, longest, at } }  what each device has added
//   best:       { "mode|board|apples": score }
//   unlocked:   [ reward ids ]
//   settings:   the look of your snake (SYNCED keys only), with settingsAt = when it last changed
//   combos:     the 5 saved looks, each { look, at } with its own change time
//   daily:      { "2026-11-04": score } Daily Challenge results; streaks are worked out from these
//   weekly:     { week, devices: { deviceId: [n, n, n] }, claimed: [bool, bool, bool] } weekly missions
// Merging never loses progress: counters are kept per device and only go up (totals are the sum),
// bests take the higher score, unlocks are combined, the newest look wins, and each saved-look
// slot is merged by itself, so changing one thing on one device never touches the others.
(function (root) {
  'use strict';
  const SYNCED = ['color', 'pattern', 'eyes', 'shape', 'hat', 'burst', 'trail', 'food', 'boardSkin', 'customColor', 'customGrad', 'unlockToasts', 'lbName', 'lbId'];
  const LOOK_KEYS = ['color', 'pattern', 'shape', 'eyes', 'hat', 'burst', 'trail', 'food', 'boardSkin'];
  const COUNTS = ['games', 'apples', 'timeMs', 'xp', 'missions', 'perfect'];
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

  const okHex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  const okGrad = v => typeof v === 'string' && /^#[0-9a-fA-F]{6},#[0-9a-fA-F]{6},[0-7]$/.test(v);
  // One saved look: every part must be a small whole number, or the slot is dropped.
  function cleanLook(c) {
    if (!c || typeof c !== 'object') return null;
    const o = {};
    for (const k of LOOK_KEYS) { if (!Number.isInteger(c[k]) || c[k] < 0 || c[k] >= 1000) return null; o[k] = c[k]; }
    o.customColor = okHex(c.customColor) ? c.customColor : null;
    o.customGrad = okGrad(c.customGrad) ? c.customGrad : null;
    return o;
  }

  function emptyCombos() { return [0, 1, 2, 3, 4].map(() => ({ look: null, at: 0 })); }
  const emptyWeek = () => ({ week: '', devices: {}, claimed: [false, false, false], bonus: false });
  function empty() { return { v: 1, devices: {}, best: {}, unlocked: [], settings: {}, settingsAt: 0, combos: emptyCombos(), daily: {}, weekly: emptyWeek() }; }
  const DAILY_KEEP = 400;   // days of results to keep, so a save can't outgrow the size limit
  const sortDays = o => { const out = {}; for (const k of Object.keys(o).sort().slice(-DAILY_KEEP)) out[k] = o[k]; return out; };

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
        else if (k === 'customColor' && (v === null || okHex(v))) out.settings[k] = v;
        else if (k === 'customGrad' && (v === null || okGrad(v))) out.settings[k] = v;
        else if (k === 'lbName' && typeof v === 'string' && v.length <= 32) out.settings[k] = v;
        else if (k === 'lbId' && typeof v === 'string' && /^[0-9a-z]{0,32}$/.test(v)) out.settings[k] = v;
      }
    }
    out.settingsAt = num(d.settingsAt);
    if (Array.isArray(d.combos) && d.combos.length === 5) {
      out.combos = d.combos.map(c => (c && typeof c === 'object' ? { look: cleanLook(c.look), at: num(c.at) } : { look: null, at: 0 }));
    } else if (d.settings && Array.isArray(d.settings.combos) && d.settings.combos.length === 5) {
      // Saves from before slots had their own times. An empty slot here means "never used", not "cleared".
      out.combos = d.settings.combos.map(c => { const look = cleanLook(c); return { look, at: look ? out.settingsAt : 0 }; });
    }
    if (d.daily && typeof d.daily === 'object') {
      const days = {};
      for (const k of Object.keys(d.daily).slice(0, 2000)) if (/^\d{4}-\d\d-\d\d$/.test(k)) days[k] = num(d.daily[k]);
      out.daily = sortDays(days);
    }
    const w = d.weekly;
    if (w && typeof w === 'object' && typeof w.week === 'string' && /^\d{4}-W\d\d$/.test(w.week)) {
      out.weekly.week = w.week;
      if (w.devices && typeof w.devices === 'object') {
        for (const id of Object.keys(w.devices).slice(0, 64)) {
          const r = w.devices[id];
          if (okKey(id) && Array.isArray(r) && r.length === 3) out.weekly.devices[id] = r.map(num);
        }
      }
      if (Array.isArray(w.claimed) && w.claimed.length === 3) out.weekly.claimed = w.claimed.map(v => v === true);
      out.weekly.bonus = w.bonus === true;
    }
    return out;
  }

  function mergeDocs(a, b) {
    a = sanitize(a); b = sanitize(b);
    const out = empty();
    for (const src of [a, b]) {
      for (const id in src.devices) {
        const r = src.devices[id], o = out.devices[id] || (out.devices[id] = { games: 0, apples: 0, timeMs: 0, xp: 0, missions: 0, perfect: 0, longest: 0, at: 0 });
        for (const k in o) o[k] = Math.max(o[k], r[k]);
      }
      for (const k in src.best) out.best[k] = Math.max(out.best[k] || 0, src.best[k]);
      for (const id of src.unlocked) if (out.unlocked.indexOf(id) < 0) out.unlocked.push(id);
    }
    const newer = b.settingsAt > a.settingsAt ? b : a;
    out.settings = Object.assign({}, newer.settings); out.settingsAt = newer.settingsAt;
    // A device that hasn't heard your leaderboard name yet mustn't blank it just by being newer.
    for (const k of ['lbName', 'lbId']) if (!out.settings[k]) { const o = newer === a ? b : a; if (o.settings[k]) out.settings[k] = o.settings[k]; }
    out.combos = a.combos.map((x, i) => { const y = b.combos[i]; return y.at > x.at ? y : x; });
    const days = Object.assign({}, a.daily);
    for (const k in b.daily) days[k] = Math.max(days[k] || 0, b.daily[k]);
    out.daily = sortDays(days);
    // A newer week replaces an older one. In the same week each device's progress is kept separately.
    if (a.weekly.week !== b.weekly.week) out.weekly = a.weekly.week > b.weekly.week ? a.weekly : b.weekly;
    else {
      out.weekly.week = a.weekly.week;
      out.weekly.claimed = a.weekly.claimed.map((v, i) => v || b.weekly.claimed[i]);
      out.weekly.bonus = a.weekly.bonus || b.weekly.bonus;
      out.weekly.devices = Object.assign({}, a.weekly.devices);
      for (const id in b.weekly.devices) {
        const x = out.weekly.devices[id], y = b.weekly.devices[id];
        out.weekly.devices[id] = x ? x.map((v, i) => Math.max(v, y[i])) : y;
      }
    }
    return out;
  }

  // Totals across devices; pass skip to leave one device out.
  function totals(doc, skip) {
    const t = { games: 0, apples: 0, timeMs: 0, xp: 0, missions: 0, perfect: 0, longest: 0 };
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
