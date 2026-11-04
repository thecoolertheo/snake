// Daily challenge and weekly missions. Rules only: no DOM, safe in tests.
// The date alone decides each challenge, so every device gets the same one with no server involved.
//   data.daily  = { days: { "2026-11-04": score } }   streaks are worked out from this list
//   data.weekly = { week, mine: [n, n, n], seen: { deviceId: [n, n, n] }, claimed: [bool, bool, bool] }
// mine is what this device has done this week and seen is what your other devices have done (sync.js).
(function (root) {
  'use strict';
  const S = root.Snake = root.Snake || {}, U = S.util;

  const COLS = 17, ROWS = 15, DAY = 864e5;
  const pad = n => (n < 10 ? '0' : '') + n;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  // Your local date, so a new challenge arrives at your midnight.
  const dayKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dayNum = k => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
  const keyOf = n => new Date(n * DAY).toISOString().slice(0, 10);

  // ISO week: Monday to Sunday, so "2026-W45" sorts in order.
  function weekKey(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const start = Date.UTC(t.getUTCFullYear(), 0, 1);
    return t.getUTCFullYear() + '-W' + pad(Math.ceil(((t - start) / DAY + 1) / 7));
  }
  const daysLeftInWeek = (d = new Date()) => 8 - (d.getDay() || 7);

  // Obstacles for the 17×15 board. The snake starts on row 7 heading right, so that row always stays clear.
  const rect = (x0, y0, x1, y1) => { const o = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) o.push([x, y]); return o; };
  const LAYOUTS = [
    { name: 'Open board', blocks: [] },
    { name: 'Open board', blocks: [] },
    { name: 'Four pillars', blocks: [...rect(4, 3, 5, 4), ...rect(11, 3, 12, 4), ...rect(4, 10, 5, 11), ...rect(11, 10, 12, 11)] },
    { name: 'Two bars', blocks: [...rect(5, 3, 11, 3), ...rect(5, 11, 11, 11)] },
    { name: 'The gate', blocks: [...rect(8, 0, 8, 4), ...rect(8, 10, 8, 14)] },
    { name: 'Corners', blocks: [...rect(2, 2, 4, 2), ...rect(2, 3, 2, 4), ...rect(12, 2, 14, 2), ...rect(14, 3, 14, 4), ...rect(2, 12, 4, 12), ...rect(2, 10, 2, 11), ...rect(12, 12, 14, 12), ...rect(14, 10, 14, 11)] },
    { name: 'Stepping stones', blocks: [[3, 3], [8, 3], [13, 3], [6, 5], [10, 5], [6, 9], [10, 9], [3, 11], [8, 11], [13, 11]] }
  ];

  // Modes run through a shuffled cycle, so every one comes up and none appears two days running.
  // (You can't crash in Peaceful, so a score there would mean nothing.)
  function cycle(block) {
    const list = S.MODES.filter(m => m.id !== 'peaceful'), r = U.rng(hash('cycle' + block));
    for (let i = list.length - 1; i > 0; i--) { const j = r() * (i + 1) | 0; [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  }
  function modeOfDay(key) {
    const n = dayNum(key), size = S.MODES.length - 1, block = Math.floor(n / size), list = cycle(block);
    if (list[0] === cycle(block - 1)[size - 1]) [list[0], list[1]] = [list[1], list[0]];   // only the first two ever move, so the last stays put
    return list[n - block * size];
  }

  // Everything about one day's challenge. Your own speed and apple settings don't apply, so scores compare.
  function challenge(key) {
    const r = U.rng(hash(key)), mode = modeOfDay(key), hard = mode.turbo || mode.dark || mode.mirror;
    const layout = LAYOUTS[r() * LAYOUTS.length | 0], apples = r() < 0.3 ? 3 : 1;
    const speed = !hard && r() < 0.25 ? 2 : 1, ramp = !mode.turbo && r() < 0.25;
    return { key, seed: hash('apples' + key), mode: mode.id, cols: COLS, rows: ROWS, apples, speed, ramp, layout: layout.name, blocks: layout.blocks };
  }

  function streak(days, today) {
    let n = 0, d = dayNum(today);
    if (!(today in days)) d--;                  // today isn't over yet, so an unplayed today doesn't break it
    while (keyOf(d) in days) { n++; d--; }
    return n;
  }
  function bestStreak(days) {
    const list = Object.keys(days).map(dayNum).sort((a, b) => a - b);
    let best = 0, run = 0;
    list.forEach((d, i) => { run = i && d === list[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
    return best;
  }
  const dailyXp = streakNow => 100 + 10 * Math.min(streakNow, 10);   // 110 on day one, 200 from day 10

  // ---------- weekly missions: one easy, one medium, one hard ----------
  // Only uses modes everyone has from the start. max: the best single game counts, not the total.
  const m = (id, goal, text, max) => ({ id, goal, text, max: !!max });
  const POOL = [
    [m('apples', 40, 'Eat 40 apples'), m('games', 8, 'Play 8 games'), m('minutes', 10, 'Play for 10 minutes'), m('apples:walls', 15, 'Eat 15 apples in Walls'), m('apples:borderless', 15, 'Eat 15 apples in Borderless')],
    [m('apples', 120, 'Eat 120 apples'), m('score', 15, 'Score 15 in one game', true), m('length', 20, 'Grow to length 20', true), m('dailies', 3, 'Play 3 Daily Challenges'), m('apples:portal', 30, 'Eat 30 apples in Portal'), m('apples:poison', 30, 'Eat 30 apples in Poison')],
    [m('apples', 300, 'Eat 300 apples'), m('score', 30, 'Score 30 in one game', true), m('length', 35, 'Grow to length 35', true), m('dailies', 5, 'Play 5 Daily Challenges'), m('minutes', 45, 'Play for 45 minutes')]
  ];
  const MISSION_XP = [150, 300, 600], BONUS_XP = 500;   // the bonus is for finishing all three in one week

  function missions(week) {
    const r = U.rng(hash('week' + week)), out = [];
    POOL.forEach((pool, tier) => {
      const open = pool.filter(x => !out.some(o => o.id === x.id));
      out.push(Object.assign({ xp: MISSION_XP[tier] }, open[r() * open.length | 0]));
    });
    return out;
  }

  // Moves the save on to the current week. A clock running behind never rolls it back.
  function ensureWeek(data, date) {
    const w = data.weekly, now = weekKey(date);
    if (w.week < now) { w.week = now; w.mine = [0, 0, 0]; w.seen = {}; w.claimed = [false, false, false]; w.bonus = false; }
    return w;
  }

  function total(w, i, mission) {
    const all = [w.mine[i] || 0];
    for (const id in w.seen) all.push(w.seen[id][i] || 0);
    return mission.max ? Math.max(...all) : all.reduce((a, b) => a + b, 0);
  }

  function amount(mission, g) {
    const [id, mode] = mission.id.split(':');
    if (mode) return g.mode === mode ? g.apples : 0;
    if (g.mode === 'peaceful' && (id === 'score' || id === 'length')) return 0;   // nothing stops you in Peaceful
    return { apples: g.apples, games: 1, minutes: g.ms / 60000, score: g.score, length: g.length, dailies: g.daily ? 1 : 0 }[id] || 0;
  }

  // Marks anything finished as done. Returns the missions completed just now, so each pays out once.
  function claim(data, date) {
    const w = ensureWeek(data, date), out = [];
    missions(w.week).forEach((x, i) => {
      if (!w.claimed[i] && total(w, i, x) >= x.goal) { w.claimed[i] = true; out.push(x); }
    });
    if (!w.bonus && w.claimed.every(Boolean)) { w.bonus = true; out.push({ bonus: true, xp: BONUS_XP, text: 'All three missions' }); }
    return out;
  }

  // g = { mode, apples, ms, score, length, daily }: one finished game.
  function record(data, g, date) {
    const w = ensureWeek(data, date);
    missions(w.week).forEach((x, i) => {
      const v = amount(x, g);
      w.mine[i] = x.max ? Math.max(w.mine[i] || 0, v) : (w.mine[i] || 0) + v;
    });
    return claim(data, date);
  }

  // ---------- leaderboard rules, shared with the server (api/board.js) ----------
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]], MAX_TICKS = 40000;
  // Plays a Daily again from its list of moves. The score comes from this, never from what a player claims.
  function replay(spec, log, ticks) {
    if (!Array.isArray(log) || log.length % 2 || !Number.isInteger(ticks) || ticks < 1 || ticks > MAX_TICKS) return null;
    const g = new S.Game({ cols: spec.cols, rows: spec.rows, apples: spec.apples, mode: spec.mode, seed: spec.seed, blocks: spec.blocks });
    let i = 0;
    while (g.ticks < ticks && g.alive) {
      const due = i < log.length && log[i] === g.ticks;
      if (due) {
        const d = log[i + 1], o = DIRS[d & 3];
        if (!Number.isInteger(d) || d < 0 || d > 7) return null;
        i += 2;
        if (d & 4) { if (!g.undo) return null; g._revert(); g.queue.push({ x: o[0], y: o[1] }); g.step(); continue; }
        g.queue.push({ x: o[0], y: o[1] });
      }
      g.step();
    }
    return i === log.length && g.ticks === ticks ? g : null;
  }
  // Names are public, so they stay short and plain. '' means not allowed.
  const BLOCKED = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fagg', 'rape', 'nazi', 'hitler', 'whore', 'slut', 'retard'];
  function cleanName(s) {
    const n = String(s == null ? '' : s).normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (!/^[\p{L}\p{N} _-]{2,16}$/u.test(n)) return '';
    const plain = n.toLowerCase().replace(/[ _-]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's');
    return BLOCKED.some(w => plain.indexOf(w) >= 0) ? '' : n;
  }

  S.daily = { replay, cleanName, BONUS_XP, COLS, ROWS, LAYOUTS, dayKey, dayNum, keyOf, weekKey, daysLeftInWeek, challenge, streak, bestStreak, dailyXp, POOL, MISSION_XP, missions, ensureWeek, total, claim, record };
})(typeof window !== 'undefined' ? window : globalThis);
