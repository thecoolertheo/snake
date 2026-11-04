// Daily Challenge leaderboard, from the game's side. The server is api/board.js.
// Your scored run is saved until the server has it, so playing offline or choosing a name later still counts.
(function (root) {
  'use strict';
  const S = root.Snake, D = S.daily;
  const board = S.board = { state: 'idle', top: [], count: 0, you: null, msg: '', day: '' };
  let store, changed;
  const st = () => store.data.settings, saved = () => store.data.board;

  function newId() {
    const a = new Uint32Array(4); root.crypto.getRandomValues(a);
    return [...a].map(n => n.toString(36).padStart(7, '0')).join('').slice(0, 24);
  }
  async function post(body) {
    const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 10000);
    try {
      const r = await fetch(S.sync.boardApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: stop.signal });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { status: r.status, body: j };
    } finally { clearTimeout(timer); }
  }

  board.load = async function () {
    const day = D.dayKey();
    if (!st().lbName) { board.state = 'idle'; changed(); return; }
    if (board.day !== day) { board.top = []; board.you = null; board.count = 0; board.day = day; }
    board.state = board.top.length ? 'ready' : 'loading'; changed();
    try {
      const r = await post({ mode: 'top', day, id: st().lbId });
      if (r.status !== 200 || !r.body) throw new Error('server');
      board.top = r.body.top; board.count = r.body.count; board.you = r.body.you; board.state = 'ready'; board.msg = '';
    } catch (e) {
      board.state = 'error';
      board.msg = navigator.onLine === false ? 'You’re offline. The leaderboard will load when you’re back.' : 'Couldn’t reach the leaderboard. Try again in a moment.';
    }
    changed();
  };

  // Sends today's run if there's one waiting. Runs from earlier days can no longer be added.
  board.send = async function () {
    const run = saved().run, day = D.dayKey();
    if (!run || run.sent || !st().lbName) return;
    if (D.dayNum(day) - D.dayNum(run.day) > 1 || run.score < 1) { saved().run = null; store.save(); return; }
    try {
      const r = await post({ mode: 'submit', day: run.day, id: st().lbId, name: st().lbName, score: run.score, ticks: run.ticks, log: run.log });
      if (r.status === 200) { run.sent = true; board.msg = ''; store.save(); await board.load(); return; }
      if (r.status === 422) { run.sent = true; store.save(); board.msg = 'That run couldn’t be verified, so it wasn’t added.'; }
      else if (r.status === 409) { board.msg = 'That name isn’t allowed. Try a different one.'; }
      changed();
    } catch (e) {}   // still saved: it goes next time
  };

  board.record = run => { saved().run = run; store.save(); board.send(); };

  // Returns false if the name isn't allowed.
  board.setName = async function (text) {
    const name = D.cleanName(text);
    if (!name) return false;
    if (!st().lbId) st().lbId = newId();
    st().lbName = name; store.save();
    const run = saved().run;
    if (run && run.day === D.dayKey() && run.score > 0) run.sent = false;   // sent again, so your name changes on today's board
    await board.send();
    await board.load();
    return true;
  };

  board.init = function (_store, onChange) {
    store = _store; changed = onChange;
    board.send();
    root.addEventListener('online', () => board.send());
  };
})(window);
