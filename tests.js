// Core rule tests. Runs in tests.html, or from a terminal with: node tests.js
(function (root) {
  'use strict';
  const S = root.Snake;
  const results = [];

  function test(name, fn) {
    try { fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, msg: e.message }); }
  }
  function eq(a, b, what) {
    const ja = JSON.stringify(a), jb = JSON.stringify(b);
    if (ja !== jb) throw new Error((what || 'value') + ': expected ' + jb + ', got ' + ja);
  }
  // A game with no apples in the way unless a test places them.
  function mk(o = {}) {
    const g = new S.Game(Object.assign({ cols: 10, rows: 9, rng: S.util.rng(1) }, o));
    g.setApples([{ x: 9, y: 0 }]);
    return g;
  }
  const head = g => ({ x: g.cells[0].x, y: g.cells[0].y });

  test('starts with 3 cells facing right', () => {
    const g = mk();
    eq(g.cells.length, 3, 'length'); eq(g.dir, { x: 1, y: 0 }, 'dir'); eq(head(g), { x: 2, y: 4 }, 'head');
  });
  test('moves one cell per step and keeps its length', () => {
    const g = mk(); g.step(); g.step();
    eq(head(g), { x: 4, y: 4 }); eq(g.cells.length, 3, 'length');
  });
  test('turn applies on the next step', () => {
    const g = mk(); g.turn(0, 1); g.step();
    eq(head(g), { x: 2, y: 5 }); eq(g.dir, { x: 0, y: 1 }, 'dir');
  });
  test('reversing into yourself is ignored', () => {
    const g = mk(); eq(g.turn(-1, 0), false, 'turn result'); g.step(); eq(head(g), { x: 3, y: 4 });
  });
  test('same direction is ignored', () => {
    const g = mk(); eq(g.turn(1, 0), false);
  });
  test('turn buffer holds 3 turns, in order', () => {
    const g = mk();
    eq(g.turn(0, -1), true); eq(g.turn(-1, 0), true); eq(g.turn(0, 1), true); eq(g.turn(1, 0), false, '4th turn');
    g.step(); eq(head(g), { x: 2, y: 3 }, 'after up');
    g.step(); eq(head(g), { x: 1, y: 3 }, 'after left');
    g.step(); eq(head(g), { x: 1, y: 4 }, 'after down');
  });
  test('buffer checks reversal against the last queued turn', () => {
    const g = mk(); g.turn(0, -1); eq(g.turn(0, 1), false, 'down after up'); eq(g.turn(-1, 0), true, 'left after up');
  });
  test('hitting the wall kills', () => {
    const g = mk({ cols: 5 }); g.setApples([{ x: 0, y: 0 }]);
    g.step(); g.step(); eq(g.alive, true, 'alive at edge'); g.step();
    eq(g.alive, true, 'grace step'); g.step();
    eq(g.alive, false, 'alive'); eq(g.events.some(e => e.type === 'die'), true, 'die event');
  });
  test('dead snake does not move', () => {
    const g = mk({ cols: 4 }); g.step(); g.step(); const h = head(g); g.step(); eq(head(g), h);
  });
  test('running into your body kills', () => {
    const g = mk(); g.grow = 3; g.step(); g.step(); g.step();   // length 6
    g.turn(0, 1); g.step(); g.turn(-1, 0); g.step(); g.turn(0, -1); g.step(); g.step();
    eq(g.alive, false);
  });
  test('moving into the cell the tail is leaving is allowed', () => {
    const g = mk(); g.grow = 1; g.step();   // length 4: a 2x2 loop is possible
    g.turn(0, 1); g.step(); g.turn(-1, 0); g.step(); g.turn(0, -1); g.step();
    eq(g.alive, true);
  });
  test('eating scores, emits an event and grows by one', () => {
    const g = mk(); g.setApples([{ x: 3, y: 4 }]);
    g.step();
    eq(g.score, 1, 'score'); eq(g.cells.length, 4, 'length'); eq(g.events.filter(e => e.type === 'eat').length, 1, 'eat events');
    g.step(); eq(g.cells.length, 4, 'length after next step');
  });
  test('eating 3 apples grows by 3', () => {
    const g = mk();
    for (let x = 3; x <= 5; x++) { g.setApples([{ x, y: 4 }]); g.step(); }
    eq(g.cells.length, 6); eq(g.score, 3);
  });
  test('a new apple spawns on a free tile after eating', () => {
    const g = mk(); g.setApples([{ x: 3, y: 4 }]); g.step();
    eq(g.apples.length, 1, 'apples');
    const a = g.apples[0]; eq(g.cells.some(c => c.x === a.x && c.y === a.y), false, 'apple on snake');
  });
  test('apples never spawn on the snake (200 random boards)', () => {
    for (let s = 0; s < 200; s++) {
      const g = new S.Game({ cols: 5, rows: 4, apples: 3, rng: S.util.rng(s) });
      for (const a of g.apples) if (g.cells.some(c => c.x === a.x && c.y === a.y)) throw new Error('seed ' + s);
      eq(new Set(g.apples.map(a => a.x + ',' + a.y)).size, 3, 'distinct apples');
    }
  });
  test('instant turn: early turn redoes the last move', () => {
    const g = mk(); g.step();                       // head 3,4
    eq(g.turn(0, -1, 0.1), 'redo', 'result');
    eq(head(g), { x: 2, y: 3 }, 'head'); eq(g.cells.length, 3, 'length'); eq(g.dir, { x: 0, y: -1 }, 'dir');
  });
  test('instant turn: redo keeps the body intact', () => {
    const g = mk(); g.step(); g.step(); g.turn(0, 1, 0.2);
    eq(g.cells.map(c => [c.x, c.y]), [[3, 5], [3, 4], [2, 4]]);
  });
  test('instant turn: no redo late in the step', () => {
    const g = mk(); g.step(); eq(g.turn(0, -1, 0.6), true); eq(head(g), { x: 3, y: 4 });
  });
  test('instant turn: no redo right after a turn', () => {
    const g = mk(); g.turn(0, 1); g.step(); eq(g.turn(1, 0, 0.1), true);
    eq(head(g), { x: 2, y: 5 });
  });
  test('instant turn: no redo after eating', () => {
    const g = mk(); g.setApples([{ x: 3, y: 4 }]); g.step();
    eq(g.turn(0, -1, 0.1), true); eq(g.score, 1); eq(g.cells.length, 4);
  });
  test('instant turn: no redo when turns are already queued', () => {
    const g = mk(); g.step(); g.turn(0, -1, 0.6); eq(g.turn(-1, 0, 0.1), true); eq(g.queue.length, 2);
  });
  test('filling the board wins', () => {
    const g = new S.Game({ cols: 5, rows: 1, rng: S.util.rng(3) });   // snake x 0..1? starts at 2,1,0
    g.setApples([{ x: 3, y: 0 }]); g.step(); g.setApples([{ x: 4, y: 0 }]); g.step();
    eq(g.won, true, 'won'); eq(g.events.some(e => e.type === 'win'), true, 'win event');
  });
  test('occupancy grid matches the body after many moves', () => {
    const g = new S.Game({ cols: 12, rows: 12, rng: S.util.rng(7) });
    const dirs = [[0, 1], [-1, 0], [0, -1], [1, 0]];
    for (let i = 0; i < 300 && g.alive; i++) {
      if (i % 3 === 0) { const d = dirs[(i / 3) % 4]; g.turn(d[0], d[1], (i % 5) / 5); }
      g.step();
    }
    const occ = new Uint16Array(144); for (const c of g.cells) occ[c.y * 12 + c.x]++;
    eq(Array.from(g.occ), Array.from(occ));
  });

  // ---------- modes ----------
  test('Borderless: wraps around the right edge', () => {
    const g = mk({ mode: 'borderless', cols: 5 }); g.setApples([{ x: 0, y: 0 }]);
    g.step(); g.step(); g.step();
    eq(g.alive, true, 'alive'); eq(head(g), { x: 0, y: 4 }, 'head');
    eq(g.cells[0].ja, { x: 5, y: 4 }, 'jump in'); eq(g.cells[0].jb, { x: -1, y: 4 }, 'jump out');
  });
  test('Borderless: wraps around the top edge', () => {
    const g = mk({ mode: 'borderless', rows: 3 }); g.setApples([{ x: 9, y: 2 }]);
    g.turn(0, -1); g.step(); g.step();
    eq(head(g), { x: 2, y: 2 });
  });
  test('Borderless: running into yourself still kills', () => {
    const g = mk({ mode: 'borderless' }); g.grow = 3; g.step(); g.step(); g.step();
    g.turn(0, 1); g.step(); g.turn(-1, 0); g.step(); g.turn(0, -1); g.step(); g.step();
    eq(g.alive, false);
  });
  test('Walls: the eaten tile turns into a wall once the tail leaves', () => {
    const g = mk({ mode: 'walls' }); g.setApples([{ x: 3, y: 4 }]); g.step();
    const i = g.idx(3, 4);
    eq(g.wall[i], 1, 'pending while body is on it');
    for (let s = 0; s < 4; s++) g.step();
    eq(g.wall[i], 2, 'solid after tail passes'); eq(g.wallCount, 1, 'count');
    eq(g.events.some(e => e.type === 'wall'), true, 'wall event');
  });
  test('Walls: hitting a wall kills', () => {
    const g = mk({ mode: 'walls' }); g.wall[g.idx(4, 4)] = 2; g.step(); g.step(); g.step();
    eq(g.alive, false);
  });
  test('Walls: apples never spawn on walls', () => {
    const g = new S.Game({ cols: 4, rows: 3, mode: 'walls', rng: S.util.rng(5) });
    for (let x = 0; x < 4; x++) g.wall[g.idx(x, 0)] = 2;
    for (let n = 0; n < 50; n++) { g.apples = []; g.fillApples(); const a = g.apples[0]; eq(g.wall[g.idx(a.x, a.y)], 0); }
  });
  test('Portal: apples spawn in pairs', () => {
    const g = new S.Game({ mode: 'portal', apples: 3, rng: S.util.rng(2) });
    eq(g.apples.length, 6, 'apples'); eq(new Set(g.apples.map(a => a.pair)).size, 3, 'pairs');
  });
  test('Portal: entering one apple comes out of its partner', () => {
    const g = mk({ mode: 'portal' });
    g.setApples([{ x: 3, y: 4, kind: 'portal', pair: 0 }, { x: 7, y: 1, kind: 'portal', pair: 0 }]);
    g.step();
    eq(head(g), { x: 7, y: 1 }, 'head'); eq(g.score, 1, 'score'); eq(g.cells.length, 4, 'grew');
    eq(g.apples.length, 2, 'new pair'); eq(g.apples.some(a => a.x === 7 && a.y === 1), false, 'old pair gone');
    g.step(); eq(head(g), { x: 8, y: 1 }, 'keeps direction');
  });
  test('Poison: purple apple shrinks by 2, never below 3', () => {
    const g = mk({ mode: 'poison' }); g.grow = 3; g.step(); g.step(); g.step();   // length 6
    g.setApples([{ x: 6, y: 4, kind: 'poison' }, { x: 0, y: 0 }]);
    g.step();
    eq(g.cells.length, 4, 'length'); eq(g.score, 0, 'score');
    g.setApples([{ x: 7, y: 4, kind: 'poison' }, { x: 0, y: 0 }]); g.step();
    eq(g.cells.length, 3, 'min length');
  });
  test('Poison: keeps normal and poison apples on the board', () => {
    const g = new S.Game({ mode: 'poison', apples: 3, rng: S.util.rng(4) });
    eq(g.apples.filter(a => a.kind === 'apple').length, 3); eq(g.apples.filter(a => a.kind === 'poison').length, 2);
  });
  test('Peaceful: edges wrap and you pass through yourself', () => {
    const g = mk({ mode: 'peaceful' }); g.grow = 3; g.step(); g.step(); g.step();
    g.turn(0, 1); g.step(); g.turn(-1, 0); g.step(); g.turn(0, -1); g.step();
    eq(g.alive, true, 'alive after self-crossing');
    for (let s = 0; s < 20; s++) g.step();
    eq(g.alive, true, 'alive after wrapping');
  });
  test('maxLen tracks the longest the snake got', () => {
    const g = mk({ mode: 'poison' }); g.grow = 4; for (let s = 0; s < 4; s++) g.step();
    g.setApples([{ x: 7, y: 4, kind: 'poison' }, { x: 0, y: 0 }]); g.step();
    eq(g.maxLen, 7); eq(g.cells.length, 5);
  });

  test('Mirror: controls are flipped', () => {
    const g = mk({ mode: 'mirror' }); eq(g.turn(0, -1), true); g.step();
    eq(head(g), { x: 2, y: 5 }, 'pressing up goes down');
    eq(g.turn(1, 0), true, 'pressing right goes left'); g.step();
    eq(head(g), { x: 1, y: 5 });
  });
  test('Mirror: a flipped reversal is still ignored', () => {
    const g = mk({ mode: 'mirror' }); eq(g.turn(1, 0), false, 'right → left would reverse');
  });
  test('Gold Rush: golden apple scores 3, grows 3, counts as 1 eaten', () => {
    const g = mk({ mode: 'gold' }); g.setApples([{ x: 3, y: 4, kind: 'gold' }]); g.apples[0].until = 99;
    g.step();
    eq(g.score, 3, 'score'); eq(g.eaten, 1, 'eaten');
    g.step(); g.step(); eq(g.cells.length, 6, 'grew by 3');
  });
  test('Gold Rush: an uneaten golden apple turns normal when time runs out', () => {
    const g = mk({ mode: 'gold' }); g.setApples([{ x: 0, y: 0, kind: 'gold' }]); g.apples[0].until = 2;
    g.step(); eq(g.apples[0].kind, 'gold', 'still gold'); g.step();
    eq(g.apples[0].kind, 'apple', 'expired'); eq(g.events.some(e => e.type === 'expire'), true, 'event');
  });
  test('Gold Rush: golden apples do spawn', () => {
    const g = new S.Game({ mode: 'gold', apples: 5, rng: S.util.rng(9) }); g.steps = 1;
    let gold = 0; for (let i = 0; i < 40; i++) { g.apples = []; g.fillApples(); gold += g.apples.filter(a => a.kind === 'gold').length; }
    eq(gold > 20 && gold < 120, true, 'roughly 30% gold (' + gold + '/200)');
  });
  test('Any board size works (fill-screen boards)', () => {
    const g = new S.Game({ cols: 31, rows: 13, rng: S.util.rng(1) });
    eq(g.cells[0], { x: 7, y: 6 }); for (let i = 0; i < 23; i++) g.step(); eq(g.alive, true); g.step(); g.step(); eq(g.alive, false);
  });

  // ---------- grace period ----------
  test('Grace: the snake waits one step before hitting the edge', () => {
    const g = mk({ cols: 4 }); g.step();             // head at x=3, the last column
    g.step();
    eq(g.alive, true, 'alive'); eq(g.inGrace, true, 'in grace'); eq(head(g), { x: 3, y: 4 }, 'did not move');
    eq(g.events.some(e => e.type === 'grace'), true, 'grace event');
  });
  test('Grace: turning during the grace step saves you', () => {
    const g = mk({ cols: 4 }); g.step(); g.step();   // in grace at the edge
    eq(g.turn(0, 1, 0.1), true, 'turn queued (no redo during grace)'); g.step();
    eq(g.alive, true, 'alive'); eq(head(g), { x: 3, y: 5 }, 'turned down'); eq(g.inGrace, false, 'grace over');
  });
  test('Grace: you get a fresh grace after moving again', () => {
    const g = mk({ cols: 4 }); g.step(); g.step(); g.turn(0, 1); g.step();   // saved, heading down
    g.turn(1, 0); g.step(); eq(g.inGrace, true, 'second grace'); eq(g.alive, true);
  });
  test('Grace: also applies to running into yourself', () => {
    const g = mk(); g.grow = 3; g.step(); g.step(); g.step();
    g.turn(0, 1); g.step(); g.turn(-1, 0); g.step(); g.turn(0, -1); g.step();
    eq(g.alive, true, 'grace'); g.turn(-1, 0); g.step(); eq(g.alive, true, 'escaped left');
  });
  test('Grace can be turned off (menu preview)', () => {
    const g = mk({ cols: 4, grace: false }); g.step(); g.step(); eq(g.alive, false);
  });

  // ---------- Hunger / Runaway ----------
  test('Hunger: shrinks after 30 hungry steps, then every 8', () => {
    const g = mk({ mode: 'hunger', cols: 60 }); g.grow = 5; for (let i = 0; i < 5; i++) g.step();   // length 8
    for (let i = 5; i < 29; i++) g.step(); eq(g.cells.length, 8, 'still 8 at step 29');
    g.step(); eq(g.cells.length, 7, 'shrank at 30');
    for (let i = 0; i < 8; i++) g.step(); eq(g.cells.length, 6, 'shrank again 8 later');
  });
  test('Hunger: eating resets the timer', () => {
    const g = mk({ mode: 'hunger', cols: 60 }); for (let i = 0; i < 20; i++) g.step();
    g.setApples([{ x: g.cells[0].x + 1, y: 4 }]); g.step(); eq(g.hungry, 0); eq(g.hungerLevel(), 0);
  });
  test('Hunger: starving at length 2 ends the game', () => {
    const g = new S.Game({ mode: 'hunger', cols: 200, rows: 3, rng: S.util.rng(1) }); g.setApples([{ x: 0, y: 0 }]);
    for (let i = 0; i < 60 && g.alive; i++) g.step();
    eq(g.alive, false, 'dead'); eq(g.events.some(e => e.type === 'starve'), true, 'starve event');
  });
  test('Runaway: a nearby apple hops further away', () => {
    let moved = 0;
    for (let seed = 0; seed < 20; seed++) {
      const g = mk({ mode: 'runaway', rng: S.util.rng(seed) }); g.setApples([{ x: 7, y: 2 }]);
      g.step(); g.step(); g.step();                     // a hop check happens every 3 steps
      const a = g.apples[0];
      if (a.movedAt) { moved++; eq(Math.abs(a.x - g.cells[0].x) + Math.abs(a.y - g.cells[0].y) >= 2, true, 'moved away'); }
    }
    eq(moved > 5, true, 'hopped in some games (' + moved + '/20)');
  });

  // ---------- sync merge rules (js/sync-core.js) ----------
  const C = S.syncCore;
  if (C) {
    const dev = (games, xp, longest) => ({ games, apples: games * 3, timeMs: games * 1000, xp, longest, at: 1 });
    test('sync: codes are cleaned and validated', () => {
      eq(C.cleanCode(' k7qm-3xrp '), 'K7QM3XRP'); eq(C.cleanCode('K7QM3XR'), '', 'too short'); eq(C.cleanCode('K7QM3XR0'), '', '0 is not used');
      eq(C.cleanCode(C.newCode()).length, 8, 'new code is valid'); eq(C.showCode('K7QM3XRP'), 'K7QM-3XRP');
    });
    test('sync: counters add up across devices, never double count', () => {
      const a = { devices: { A: dev(5, 100, 9) } }, b = { devices: { B: dev(2, 40, 14) } };
      const m = C.mergeDocs(a, b);
      eq(C.totals(m), { games: 7, apples: 21, timeMs: 7000, xp: 140, longest: 14 });
      eq(C.totals(C.mergeDocs(m, b)).games, 7, 'merging the same device again');
      eq(C.totals(C.mergeDocs(m, { devices: { A: dev(6, 120, 9) } })).games, 8, 'device A played one more');
      eq(C.totals(C.mergeDocs(m, { devices: { A: dev(1, 10, 1) } })).games, 7, 'an older copy never lowers totals');
      eq(C.totals(m, 'A').games, 2, 'totals without one device');
    });
    test('sync: bests take the higher score, unlocks combine', () => {
      const m = C.mergeDocs({ best: { 'classic|m|1': 20, 'walls|s|1': 4 }, unlocked: ['a', 'b'] }, { best: { 'classic|m|1': 15, 'poison|l|3': 9 }, unlocked: ['b', 'c'] });
      eq(m.best, { 'classic|m|1': 20, 'walls|s|1': 4, 'poison|l|3': 9 }); eq(m.unlocked, ['a', 'b', 'c']);
    });
    test('sync: the newest look wins', () => {
      const old = { settings: { color: 3, hat: 1 }, settingsAt: 100 }, nu = { settings: { color: 7, hat: 0 }, settingsAt: 200 };
      eq(C.mergeDocs(old, nu).settings, { color: 7, hat: 0 });
      const t = Date.now(); eq(C.mergeDocs({ settings: { color: 1 }, settingsAt: t }, { settings: { color: 2 }, settingsAt: t + 1 }).settings.color, 2, 'real timestamps'); eq(C.mergeDocs(nu, old).settings, { color: 7, hat: 0 }); eq(C.mergeDocs(nu, old).settingsAt, 200);
    });
    const LOOK = { color: 1, pattern: 2, shape: 0, eyes: 3, hat: 4, burst: 5, trail: 6, food: 7, boardSkin: 8, customColor: '#123456', customGrad: '#ff5a1f,#2bd4ff,3' };
    const slots = o => [0, 1, 2, 3, 4].map(i => o[i] || { look: null, at: 0 });
    test('sync: saved looks merge slot by slot', () => {
      const a = { combos: slots({ 0: { look: LOOK, at: 5 } }) }, b = { combos: slots({ 3: { look: Object.assign({}, LOOK, { hat: 9 }), at: 2 } }) };
      const m = C.mergeDocs(a, b);
      eq(m.combos[0].look.hat, 4, 'slot from one device'); eq(m.combos[3].look.hat, 9, 'slot from the other');
      eq(C.mergeDocs(b, a).combos[0].at, 5, 'either way round');
    });
    test('sync: changing your look never touches saved looks', () => {
      const a = { settings: { color: 1 }, settingsAt: 1, combos: slots({ 2: { look: LOOK, at: 1 } }) };
      const m = C.mergeDocs(a, { settings: { color: 9 }, settingsAt: 99 });   // e.g. an older version that doesn't know saved looks
      eq(m.settings.color, 9); eq(m.combos[2].look, LOOK);
    });
    test('sync: clearing a slot spreads, and bad slots are dropped', () => {
      const m = C.mergeDocs({ combos: slots({ 1: { look: LOOK, at: 5 } }) }, { combos: slots({ 1: { look: null, at: 6 } }) });
      eq(m.combos[1], { look: null, at: 6 });
      eq(C.sanitize({ combos: slots({ 0: { look: { color: 'x' }, at: 3 } }) }).combos[0].look, null);
      eq(C.sanitize({ combos: [1, 2] }).combos.length, 5, 'wrong length');
    });
    test('sync: saves from before slots had their own times carry over', () => {
      const old = C.sanitize({ settings: { combos: [LOOK, null, null, null, null] }, settingsAt: 7 });
      eq(old.combos[0], { look: LOOK, at: 7 }); eq(old.combos[1], { look: null, at: 0 }, 'empty means unused'); eq('combos' in old.settings, false);
      eq(C.mergeDocs(old, { combos: slots({ 1: { look: LOOK, at: 1 } }) }).combos[1].at, 1, 'an unused slot takes a look');
    });
    test('sync: bad data is dropped', () => {
      const m = C.sanitize({ devices: { A: { games: -5, xp: 'lots', apples: 1 / 0 }, '': { games: 3 } }, best: { k: -1, j: 'x', ok: 4 }, unlocked: [1, 'a', 'a', null],
        settings: { color: 2, mode: 'turbo', customColor: 'red', hat: 1e9 }, settingsAt: -1 });
      eq(m.devices, { A: { games: 0, apples: 0, timeMs: 0, xp: 0, longest: 0, at: 0 } }); eq(m.best, { ok: 4 }); eq(m.unlocked, ['a']); eq(m.settings, { color: 2 }); eq(m.settingsAt, 0);
    });
  }

  test('a crash leaves the snake facing what it hit, even if turning is what killed it', () => {
    const g = new S.Game({ cols: 8, rows: 8, apples: 1, mode: 'classic', grace: false });
    g.apples.length = 0;
    const h = g.cells[0];
    g.cells[0].y = 0; g.dir = { x: 1, y: 0 }; g.queue.push({ x: 0, y: -1 });
    g.step();
    eq(g.alive, false); eq(g.dir, { x: 0, y: -1 });
    const die = g.events.find(e => e.type === 'die');
    eq([die.x, die.y], [h.x, -1], 'the event says where it hit');
  });

  // Rewards and your own gradient
  if (typeof module !== 'undefined' && !root.document && !S.skins) require('./js/skins.js');
  if (S.skins) {
    const SK = S.skins, hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    test('rewards: exactly 500, all different, every path long enough', () => {
      eq(SK.UNLOCKS.length, 500); eq(new Set(SK.UNLOCKS.map(u => u.id)).size, 500);
      eq(new Set(SK.UNLOCKS.map(u => u.kind + u.index)).size, 500, 'one reward per item');
      for (const t of SK.TRACKS) {
        if (t.steps.length < 22) throw new Error(t.id + ' has only ' + t.steps.length);
        eq(new Set(t.steps.map(s => s.goal)).size, t.steps.length, t.id + ' repeats a goal');
      }
    });
    test('rewards: saved looks keep pointing at the same items', () => {
      eq(SK.COLORS[47][0], 'Custom'); eq(SK.CUSTOM, 47); eq(SK.PATTERNS[25], 'Racing'); eq(SK.EYES[19], 'Cat'); eq(SK.HATS[20], 'Bunny ears');
      eq(SK.BURSTS[13], 'Blossoms'); eq(SK.TRAILS[11], 'Mist'); eq(SK.FOODS[12], 'Blueberry'); eq(SK.BOARDS[10], 'Volcano');
    });
    test('rewards: every item has what it needs to be shown, and nothing added is free', () => {
      const LIST = { color: 'COLORS', pattern: 'PATTERNS', eyes: 'EYES', hat: 'HATS', burst: 'BURSTS', trail: 'TRAILS', food: 'FOODS', board: 'BOARDS' };
      const FIRST = { color: 48, pattern: 26, eyes: 20, hat: 21, burst: 14, trail: 12, food: 13, board: 11 };
      for (const k in LIST) for (let i = FIRST[k]; i < SK[LIST[k]].length; i++) if (!SK.unlockFor(k, i)) throw new Error('no reward for ' + SK[LIST[k]][i]);
      for (const k in LIST) eq(new Set(SK[LIST[k]].map(x => (Array.isArray(x) ? x[0] : x))).size, SK[LIST[k]].length, k + ' repeats a name');
      for (const n of SK.PATTERNS.slice(26, -1)) if (!SK.GRADIENTS[n] && !SK.FIXED_BANDS[n]) throw new Error('pattern ' + n);
      for (const n of SK.BURSTS) if (!SK.BURST_STYLES[n]) throw new Error('burst ' + n);
      for (const n of SK.TRAILS.slice(1)) if (!SK.TRAIL_STYLES[n]) throw new Error('trail ' + n);
      for (const n of SK.BOARDS.slice(1)) if (!SK.BOARD_THEMES[n]) throw new Error('board ' + n);
    });
    test('rewards: no two built-in colours look the same', () => {
      const c = SK.COLORS.filter((x, i) => i !== SK.CUSTOM);
      for (let i = 0; i < c.length; i++) for (let j = 0; j < i; j++) if (SK.colorDistance(c[i][1], c[j][1]) < 6) throw new Error(c[i][0] + ' / ' + c[j][0]);
    });
    test('rewards: the gradient is the last Collector stop and needs everything else', () => {
      const t = SK.TRACKS.find(x => x.id === 'collector'), last = t.steps[t.steps.length - 1];
      eq(last.id, 'p-gradient'); eq(last.goal, SK.UNLOCKS.length - 1); eq(last.index, SK.GRAD);
    });
    test('gradient: can\'t remake a built-in pattern', () => {
      for (const n in SK.GRADIENTS) {
        const G = SK.GRADIENTS[n], a = hex(G[0]), b = hex(G[2]);
        eq(SK.gradCheck(a, b).ok, false, n); eq(SK.gradCheck(b, a).ok, false, n + ' reversed');
      }
      for (const n in SK.FIXED_BANDS) { const F = SK.FIXED_BANDS[n]; eq(SK.gradCheck(hex(F[0]), hex(F[1])).ok, false, n); }
      eq(SK.gradCheck('#3366cc', '#3468cf').why, 'solid');
      eq(SK.gradCheck('#5b8cff', '#2c4370').ok, false, 'Fade of Blue');
    });
    test('gradient: the default passes its own check, and bad saves fall back to it', () => {
      const G = SK.GRAD_DEFAULT.split(',');
      eq(SK.gradCheck(G[0], G[1]).ok, true);
      eq(SK.gradOf({ customGrad: 'red,blue,9' }).a, G[0]); eq(SK.gradOf({ customGrad: '#112233,#445566,5' }).dir, 5);
    });
    if (S.syncCore) test('gradient: syncs, and bad values are dropped', () => {
      const C = S.syncCore, v = '#ff5a1f,#2bd4ff,3';
      eq(C.sanitize({ settings: { customGrad: v } }).settings.customGrad, v);
      eq(C.sanitize({ settings: { customGrad: null } }).settings.customGrad, null);
      eq('customGrad' in C.sanitize({ settings: { customGrad: 'javascript:1' } }).settings, false);
      eq('customGrad' in C.sanitize({ settings: { customGrad: '#ff5a1f,#2bd4ff,8' } }).settings, false);
    });
  }

  S.testResults = results;
  if (typeof module !== 'undefined' && !root.document) {
    let fail = 0;
    for (const r of results) { console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '  -> ' + r.msg)); if (!r.ok) fail++; }
    console.log(`\n${results.length - fail}/${results.length} passed`);
    process.exitCode = fail ? 1 : 0;
  }
})(typeof window !== 'undefined' ? window : globalThis);
