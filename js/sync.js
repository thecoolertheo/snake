// Live sync between devices with a sync code (Settings → Sync).
// Each device keeps playing on its own local save and swaps changes with the sync server:
// after every game, when the app comes back to the front, every 8 s in the menu, and when it goes to the background.
// The merge rules live in sync-core.js. Counters (games, apples, time, XP) are tracked per device:
//   your total = what other devices have added (sync.others) + what this device has added.
(function (root) {
  'use strict';
  const S = root.Snake, C = S.syncCore;
  const LIVE = 'https://snake-lake-two.vercel.app/api/sync';
  const local = /^(localhost|127\.|192\.168\.|10\.|\[?::1)/.test(location.hostname);
  const API = root.SNAKE_SYNC_API || (location.protocol.indexOf('http') === 0 && !local ? '/api/sync' : LIVE);   // SNAKE_SYNC_API: for local testing
  const zeros = () => ({ games: 0, apples: 0, timeMs: 0, xp: 0, longest: 0 });
  const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  let store, h, timer = 0, busy = false, again = false, lastLook = '', lastCombos = [], rawSave = null;
  const sync = S.sync = { state: 'off', at: 0, devices: 0, msg: '' };
  const sd = () => store.data.sync;
  const look = () => { const o = {}; for (const k of C.SYNCED) o[k] = store.data.settings[k]; return o; };

  function setState(state, msg) { sync.state = state; sync.msg = msg || ''; if (h.status) h.status(); }

  // This device's save, in sync format.
  function localDoc() {
    const d = store.data, s = d.stats, y = sd(), mine = { longest: s.longest, at: Date.now() };
    for (const k of C.COUNTS) mine[k] = Math.max(0, s[k] - (y.others[k] || 0));
    return { devices: { [y.device]: mine }, best: d.best, unlocked: d.unlocked, settings: look(), settingsAt: y.settingsAt,
      combos: d.settings.combos.map((c, i) => ({ look: c, at: y.comboAt[i] || 0 })) };
  }

  // Takes the merged save from the server. Returns what changed, or null.
  function apply(doc) {
    const d = store.data, s = d.stats, y = sd(), me = y.device;
    const state = () => JSON.stringify([s, d.best, d.unlocked.length, look(), d.settings.combos]);
    const before = state();
    const rec = doc.devices[me] || {}, others = C.totals(doc, me);
    for (const k of C.COUNTS) {
      const mine = Math.max(0, s[k] - (y.others[k] || 0));   // includes games finished while the request was out
      s[k] = others[k] + Math.max(mine, rec[k] || 0);
    }
    s.longest = Math.max(s.longest, others.longest, rec.longest || 0);
    y.others = others;
    for (const k in doc.best) if (doc.best[k] > (d.best[k] || 0)) d.best[k] = doc.best[k];
    for (const id of doc.unlocked) if (d.unlocked.indexOf(id) < 0) d.unlocked.push(id);
    let lookChanged = false;
    if (doc.settingsAt > y.settingsAt) {
      for (const k of C.SYNCED) if (k in doc.settings && d.settings[k] !== doc.settings[k]) { d.settings[k] = doc.settings[k]; lookChanged = true; }
      y.settingsAt = doc.settingsAt;
      lastLook = JSON.stringify(look());
    }
    doc.combos.forEach((c, i) => {
      if (c.at > (y.comboAt[i] || 0)) { d.settings.combos[i] = c.look; y.comboAt[i] = c.at; lastCombos[i] = JSON.stringify(c.look); }
    });
    sync.devices = Object.keys(doc.devices).length;
    return before !== state() ? { look: lookChanged } : null;
  }

  async function post(body, keepalive) {
    // A request stuck on a bad connection must not hold up every sync after it.
    const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 10000);
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: !!keepalive, cache: 'no-store', signal: stop.signal });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { status: r.status, body: j };
    } finally { clearTimeout(timer); }
  }

  function schedule(ms) {
    if (!sd().code) return;
    clearTimeout(timer);
    timer = setTimeout(() => run(false), ms);
  }

  async function run(background) {
    const y = sd();
    if (!y.code) return;
    if (busy) { again = true; return; }
    if (!background && h.canSync && !h.canSync()) { schedule(4000); return; }   // never mid-game
    busy = true;
    if (sync.state !== 'ok') setState('syncing');
    try {
      const r = await post({ code: y.code, mode: 'sync', doc: localDoc() }, background);
      if (r.status === 200 && r.body && r.body.doc) {
        const changes = apply(r.body.doc);
        y.at = sync.at = Date.now(); rawSave();
        setState('ok');
        if (changes && h.remote) h.remote(changes);
      } else if (r.status === 404) setState('error', 'This sync code no longer exists. Stop syncing and set it up again.');
      else setState('error', 'The sync server had a problem. It will try again shortly.');
    } catch (e) {
      setState('error', navigator.onLine === false ? 'You’re offline. Your progress is saved here and will sync when you’re back online.' : 'Couldn’t reach the sync server. It will try again shortly.');
    }
    busy = false;
    if (again) { again = false; schedule(400); }
  }

  sync.init = function (_store, handlers) {
    store = _store; h = handlers; sync.ready = true;
    const y = store.data.sync;
    if (!y.device) y.device = randomId();
    y.others = Object.assign(zeros(), y.others);
    if (!Array.isArray(y.comboAt) || y.comboAt.length !== 5) y.comboAt = [0, 0, 0, 0, 0];
    // Looks saved before slots had their own times count as changed now, so they reach your other devices.
    store.data.settings.combos.forEach((c, i) => { if (c && !y.comboAt[i]) y.comboAt[i] = Date.now(); });
    lastLook = JSON.stringify(look());
    lastCombos = store.data.settings.combos.map(c => JSON.stringify(c));
    sync.at = y.at || 0;
    // Every save notes when your look last changed, then queues a sync.
    rawSave = store.save.bind(store);
    store.save = function () {
      const j = JSON.stringify(look());
      const q = sd();
      // +1 means a change here always beats what this device last saw, even if its clock runs behind.
      if (j !== lastLook) { lastLook = j; q.settingsAt = Math.max(Date.now(), q.settingsAt + 1); }
      store.data.settings.combos.forEach((c, i) => {
        const k = JSON.stringify(c);
        if (k !== lastCombos[i]) { lastCombos[i] = k; q.comboAt[i] = Math.max(Date.now(), (q.comboAt[i] || 0) + 1); }
      });
      rawSave();
      schedule(2500);
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) run(true); else schedule(300); });
    root.addEventListener('online', () => schedule(300));
    setInterval(() => { if (!document.hidden) schedule(0); }, 8000);
    if (y.code) { sync.state = 'ok'; schedule(600); }
  };

  sync.code = () => sd().code;
  sync.pull = () => schedule(0);
  sync.show = () => C.showCode(sd().code);
  sync.now = () => { clearTimeout(timer); setState('syncing'); return run(false); };

  // New code: this whole save becomes the first device on it.
  sync.create = async function () {
    const y = sd(), keep = { device: y.device, others: y.others };
    y.device = randomId(); y.others = zeros(); y.settingsAt = Date.now();
    setState('syncing');
    try {
      for (let i = 0; i < 5; i++) {
        const code = C.newCode();
        const r = await post({ code, mode: 'create', doc: localDoc() });
        if (r.status === 409) continue;
        if (r.status !== 200) break;
        y.code = code; y.last = code; y.at = sync.at = Date.now(); sync.devices = 1;
        rawSave(); setState('ok');
        return true;
      }
      setState('error', 'The sync server had a problem. Try again in a moment.');
    } catch (e) { setState('error', 'Couldn’t reach the sync server. Check your connection and try again.'); }
    Object.assign(y, keep);
    return false;
  };

  // Joins an existing code. Your progress here is added to it, and you take on its look.
  sync.join = async function (text) {
    const code = C.cleanCode(text), y = sd();
    if (!code) { setState('error', 'Sync codes are 8 letters and numbers, like K7QM-3XRP.'); return false; }
    const keep = { device: y.device, others: Object.assign({}, y.others), settingsAt: y.settingsAt };
    if (code !== y.last) { y.device = randomId(); y.others = zeros(); }   // rejoining your old code carries on where you left off
    y.settingsAt = 0;
    setState('syncing');
    try {
      const r = await post({ code, mode: 'join', doc: localDoc() });
      if (r.status === 200 && r.body && r.body.doc) {
        y.code = code; y.last = code;
        const changes = apply(r.body.doc);
        y.at = sync.at = Date.now(); rawSave(); setState('ok');
        if (changes && h.remote) h.remote(changes);
        return true;
      }
      setState('error', r.status === 404 ? 'No save uses that code. Check it and try again.' : 'The sync server had a problem. Try again in a moment.');
    } catch (e) { setState('error', 'Couldn’t reach the sync server. Check your connection and try again.'); }
    Object.assign(y, keep);
    return false;
  };

  // Stops syncing here. Everything stays on this device; the code keeps working on the others.
  sync.leave = function () {
    const y = sd();
    clearTimeout(timer);
    y.code = ''; y.at = 0; sync.at = 0; sync.devices = 0;
    rawSave(); setState('off');
  };

  sync._apply = apply; sync._localDoc = localDoc;   // for tests
})(typeof window !== 'undefined' ? window : globalThis);
