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
      eq(C.totals(m), { games: 7, apples: 21, timeMs: 7000, xp: 140, missions: 0, perfect: 0, longest: 14 });
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
      eq(m.devices, { A: { games: 0, apples: 0, timeMs: 0, xp: 0, missions: 0, perfect: 0, longest: 0, at: 0 } }); eq(m.best, { ok: 4 }); eq(m.unlocked, ['a']); eq(m.settings, { color: 2 }); eq(m.settingsAt, 0);
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
  if (typeof module !== 'undefined' && !root.document && !S.daily) require('./js/daily.js');
  if (S.skins) {
    const SK = S.skins, hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    test('rewards: exactly 530, all different, every path long enough', () => {
      eq(SK.UNLOCKS.length, 530); eq(new Set(SK.UNLOCKS.map(u => u.id)).size, 530);
      eq(new Set(SK.UNLOCKS.map(u => u.kind + u.index)).size, 530, 'one reward per item');
      for (const t of SK.TRACKS) {
        if (t.steps.length < (t.id === 'streak' || t.id === 'missions' || t.id === 'perfect' ? 10 : 22)) throw new Error(t.id + ' has only ' + t.steps.length);
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
      for (const n of SK.PATTERNS.slice(26)) if (n !== 'Gradient' && !SK.GRADIENTS[n] && !SK.FIXED_BANDS[n]) throw new Error('pattern ' + n);
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

  // ---------- two-player ----------
  // Player 1 at (3,2) heading right, player 2 at (6,6) heading left, on the same board.
  function duel(mode) {
    const o = { cols: 10, rows: 9, apples: 1, grace: false, waitApples: true, mode: mode || 'classic' };
    const a = new S.Game(Object.assign({ start: { x: 3, y: 2, dx: 1 } }, o));
    const b = new S.Game(Object.assign({ start: { x: 6, y: 6, dx: -1 }, share: a }, o));
    a.apples.push({ x: 9, y: 0, kind: 'apple' });
    return [a, b];
  }
  // Puts a snake exactly on the tiles listed, head first.
  function place(g, cells, dir) {
    for (const c of g.cells.slice()) g.occ[g.idx(c.x, c.y)]--;
    g.cells = cells.map(([x, y]) => ({ x, y }));
    for (const c of g.cells) g.occ[g.idx(c.x, c.y)]++;
    g.dir = { x: dir[0], y: dir[1] }; g.prevDir = g.dir;
  }
  test('two-player: both snakes share one board and start apart', () => {
    const [a, b] = duel();
    eq(a.occ === b.occ, true, 'occ'); eq(a.wall === b.wall, true, 'wall'); eq(a.apples === b.apples, true, 'apples');
    eq(head(b), { x: 6, y: 6 }); eq(b.dir, { x: -1, y: 0 }, 'dir'); eq(b.cells[2], { x: 8, y: 6 }, 'tail is behind it');
  });
  test('two-player: running into the other snake loses to it', () => {
    const [a, b] = duel();
    place(a, [[4, 2], [3, 2], [2, 2]], [1, 0]); place(b, [[5, 5], [5, 4], [5, 3], [5, 2], [5, 1]], [0, 1]);
    S.duelStep(a, b);
    eq(a.alive, false, 'player 1'); eq(b.alive, true, 'player 2');
  });
  test('two-player: going for the same tile is a draw', () => {
    const [a, b] = duel();
    place(a, [[3, 4], [2, 4], [1, 4]], [1, 0]); place(b, [[5, 4], [6, 4], [7, 4]], [-1, 0]);
    S.duelStep(a, b);
    eq(a.alive, false, 'player 1'); eq(b.alive, false, 'player 2');
    eq(a.events.pop().meet, true, 'they meet in the middle');
  });
  test('two-player: swapping places head on is a draw, whichever order they are in', () => {
    for (const flip of [false, true]) {
      const [a, b] = duel();
      place(a, [[3, 4], [2, 4], [1, 4]], [1, 0]); place(b, [[4, 4], [5, 4], [6, 4]], [-1, 0]);
      if (flip) S.duelStep(b, a); else S.duelStep(a, b);
      eq(a.alive, false, 'player 1'); eq(b.alive, false, 'player 2');
    }
  });
  test('two-player: following the other tail is safe for either player', () => {
    for (const flip of [false, true]) {
      const [a, b] = duel();
      place(a, [[3, 4], [2, 4], [1, 4]], [1, 0]); place(b, [[6, 2], [5, 2], [4, 2], [4, 3], [4, 4]], [1, 0]);
      if (flip) S.duelStep(b, a); else S.duelStep(a, b);
      eq(a.alive, true, 'follower'); eq(b.alive, true, 'leader'); eq(head(a), { x: 4, y: 4 });
    }
  });
  test('two-player: if both crash on the same step it is a draw', () => {
    const [a, b] = duel();
    place(a, [[9, 2], [8, 2], [7, 2]], [1, 0]); place(b, [[0, 6], [1, 6], [2, 6]], [-1, 0]);
    S.duelStep(a, b);
    eq(a.alive, false, 'player 1'); eq(b.alive, false, 'player 2');
  });
  test('two-player: an eaten apple is replaced once, and the board stays in step', () => {
    const [a, b] = duel();
    a.apples.length = 0; a.apples.push({ x: 4, y: 2, kind: 'apple' });
    S.duelStep(a, b);
    eq(a.score, 1, 'score'); eq(a.apples.length, 1, 'apples on the board'); eq(b.apples.length, 1, 'same list');
    let n = 0; for (const v of a.occ) n += v;
    eq(n, a.cells.length + b.cells.length, 'occupied tiles');
  });
  test('two-player: walls left behind stop both snakes', () => {
    const [a, b] = duel('walls');
    a.wall[a.idx(5, 6)] = 2;
    S.duelStep(a, b);
    eq(b.alive, false, 'hit the wall');
  });

  test('two-player: portals share one list and pair numbers never clash', () => {
    const [a, b] = duel('portal');
    a.apples.length = 0; a.fillApples();
    eq(a.apples.length, 2, 'one pair'); eq(a.apples[0].pair, a.apples[1].pair, 'pair');
    b.fillApples(); eq(b.apples.length, 2, 'not doubled');
    a.apples.length = 0; a.apples.push({ x: 4, y: 2, kind: 'portal', pair: 7 }, { x: 8, y: 8, kind: 'portal', pair: 7 });
    const list = a.apples;
    eq(a.peek(), { x: 8, y: 8 }, 'peek follows the portal');
    S.duelStep(a, b);
    eq(head(a), { x: 8, y: 8 }, 'came out the other end'); eq(a.apples === list && b.apples === list, true, 'still shared');
    eq(new Set(a.apples.map(x => x.pair)).size, 1, 'one new pair');
  });
  test('two-player: every mode plays out without breaking the board', () => {
    for (const m of S.MODES) {
      const mode = m.id;
      const r = S.util.rng(5);
      for (let round = 0; round < 25; round++) {
        const o = { cols: 12, rows: 11, apples: 3, grace: false, waitApples: true, mode, rng: r };
        const a = new S.Game(Object.assign({ start: { x: 3, y: 3, dx: 1 } }, o)), b = new S.Game(Object.assign({ start: { x: 8, y: 7, dx: -1 }, share: a }, o));
        a.fillApples();
        for (let i = 0; i < 300 && a.alive && b.alive; i++) {
          for (const g of [a, b]) { const k = r() * 4 | 0; if (r() < 0.4) g.turn([1, -1, 0, 0][k], [0, 0, 1, -1][k], 1); }
          S.duelStep(a, b);
          let n = 0; for (const v of a.occ) n += v;
          eq(n, a.cells.length + b.cells.length, mode + ' occupied tiles');
          if (a.apples !== b.apples) throw new Error(mode + ' lost the shared apples');
        }
      }
    }
  });

  test('two-player Peaceful: snakes pass through each other, even head on', () => {
    const [a, b] = duel('peaceful');
    place(a, [[3, 4], [2, 4], [1, 4]], [1, 0]); place(b, [[4, 4], [5, 4], [6, 4]], [-1, 0]);
    S.duelStep(a, b); eq(a.alive && b.alive, true, 'swapped places'); eq(head(a), { x: 4, y: 4 });
    place(a, [[3, 2], [2, 2], [1, 2]], [1, 0]); place(b, [[5, 2], [6, 2], [7, 2]], [-1, 0]);
    S.duelStep(a, b); eq(a.alive && b.alive, true, 'same tile'); eq(head(a), head(b), 'sharing a tile');
    let n = 0; for (const v of a.occ) n += v;
    eq(n, a.cells.length + b.cells.length, 'occupied tiles');
  });
  test('two-player Peaceful: a shared apple goes to one snake, and either can get it', () => {
    const wins = [0, 0];
    for (let i = 0; i < 200; i++) {
      const [a, b] = duel('peaceful'), r = S.util.rng(i + 1);
      a.rng = r; a.apples.length = 0; a.apples.push({ x: 4, y: 4, kind: 'apple' });
      place(a, [[3, 4], [2, 4], [1, 4]], [1, 0]); place(b, [[5, 4], [6, 4], [7, 4]], [-1, 0]);
      S.duelStep(a, b);
      eq(a.score + b.score, 1, 'one apple, one point'); wins[a.score ? 0 : 1]++;
    }
    if (wins[0] < 70 || wins[1] < 70) throw new Error('not fair: ' + wins);
  });
  test('two-player Peaceful: first to the goal wins, and together is a draw', () => {
    const [a, b] = duel('peaceful'), G = S.PEACE_GOAL;
    a.score = G - 1; b.score = G - 1; eq(S.duelRace(a, b), null, 'race still on');
    a.score = G; eq(S.duelRace(a, b), 0, 'player 1');
    a.score = 3; b.score = G; eq(S.duelRace(a, b), 1, 'player 2');
    a.score = G; eq(S.duelRace(a, b), -1, 'both');
  });

  // ---------- the Mixer ----------
  test('mixer: rules combine, and the normal modes are untouched', () => {
    const g = new S.Game({ cols: 10, rows: 9, mode: 'mix', mix: ['walls', 'dark', 'hunger', 'borderless'], rng: S.util.rng(1) });
    eq([g.rules.walls, g.rules.dark, g.rules.hunger, g.rules.wrap], [true, true, true, true]);
    eq(g.rules.poison, undefined); eq(S.MODE.walls.dark, undefined, 'Walls itself did not change');
    eq(S.MODES.some(m => m.id === 'mix'), false, 'not one of the normal twelve');
  });
  test('mixer: with no rules it plays like Classic, and rubbish is ignored', () => {
    const g = new S.Game({ cols: 10, rows: 9, mode: 'mix', mix: [], rng: S.util.rng(1) });
    eq(Object.keys(g.rules).length, 0);
    eq(S.mixClean(['nope', 'peaceful', 'classic', 'mix', 'dark', 'dark']), ['dark']); eq(S.mixClean('dark'), []); eq(S.mixClean(null), []);
  });
  test('mixer: every rule can go with every other', () => {
    eq(S.mixClean(S.MIX_IDS), S.MIX_IDS);
  });
  test('mixer: portals and poison share the board', () => {
    const g = new S.Game({ cols: 10, rows: 9, apples: 2, mode: 'mix', mix: ['portal', 'poison'], rng: S.util.rng(1) });
    eq(g.apples.filter(a => a.kind === 'portal').length, 4, 'portals'); eq(g.apples.filter(a => a.kind === 'poison').length, 1, 'poison');
    eq(g.apples.some(a => a.kind === 'apple'), false, 'portals are still the food');
    const a = g.apples.find(x => x.kind === 'poison'), h = g.cells[0], len = g.cells.length;
    g.apples.splice(g.apples.indexOf(a), 1); g.apples.push({ x: h.x + 1, y: h.y, kind: 'poison' });
    g.step(); eq(g.score, 0, 'poison scores nothing'); eq(g.cells.length <= len, true, 'no growth'); eq(g.apples.filter(x => x.kind === 'poison').length, 1, 'poison comes back');
  });
  test('mixer: runaway portals hop, each end on its own, onto free tiles', () => {
    const g = mk({ mode: 'mix', mix: ['portal', 'runaway'] }), h = g.cells[0];
    g.setApples([{ x: h.x + 2, y: h.y, kind: 'portal', pair: 0 }, { x: 0, y: 0, kind: 'portal', pair: 0 }]);
    g.rng = () => 0;   // always hops
    const far = { x: g.apples[1].x, y: g.apples[1].y }, near = g.apples[0], was = near.x + ',' + near.y;
    g._flee();
    if (near.x + ',' + near.y === was) throw new Error('the near end stayed put');
    eq(g.apples[1].x, far.x); eq(g.apples[1].y, far.y);
    eq(g.apples[0].pair, g.apples[1].pair, 'still a pair');
    const hx = g.cells[0].x, hy = g.cells[0].y;
    eq(Math.abs(near.x - hx) + Math.abs(near.y - hy) > 2, true, 'moved away from the head');
  });
  test('mixer: both ends of a golden portal turn gold, score 3, and fade together', () => {
    const g = new S.Game({ cols: 12, rows: 11, apples: 3, mode: 'mix', mix: ['portal', 'gold'], rng: S.util.rng(4) }); g.steps = 1;
    let pairs = 0;
    for (let i = 0; i < 60; i++) {
      g.apples = []; g.fillApples();
      for (const a of g.apples) {
        const b = g.apples.find(o => o !== a && o.pair === a.pair);
        eq(!!a.gold, !!b.gold, 'ends match'); eq(a.until, b.until, 'same timer'); if (a.gold) pairs++;
      }
    }
    eq(pairs > 0 && pairs < 360, true, 'some but not all');
    const m = mk({ mode: 'mix', mix: ['portal', 'gold'] }), h = m.cells[0], len = m.cells.length;
    m.setApples([{ x: h.x + 1, y: h.y, kind: 'portal', pair: 0 }, { x: 7, y: 1, kind: 'portal', pair: 0 }]);
    for (const a of m.apples) { a.gold = true; a.until = 99; }
    m.step();
    eq(m.score, 3, 'score'); eq(m.eaten, 1, 'one portal'); eq(m.cells[0].x, 7, 'came out the other end'); eq(m.cells.length + m.grow, len + 3, 'grows like a golden apple');
    eq(m.events.some(e => e.type === 'eat' && e.kind === 'gold' && e.worth === 3), true, 'gold event'); eq(m.events.some(e => e.type === 'portal'), true, 'portal event');
    const f = mk({ mode: 'mix', mix: ['portal', 'gold'] });
    f.setApples([{ x: 0, y: 0, kind: 'portal', pair: 0 }, { x: 0, y: 2, kind: 'portal', pair: 0 }]);
    for (const a of f.apples) { a.gold = true; a.until = 1; }
    f.step();
    eq(f.apples.filter(a => a.kind === 'portal').length, 2, 'stays a portal'); eq(f.apples.some(a => a.gold), false, 'gold gone');
  });
  test('mixer: each combination has one best, whatever order you picked it in', () => {
    eq(S.mixKey(['dark', 'walls']), S.mixKey(['walls', 'dark']));
    if (S.mixKey(['dark']) === S.mixKey(['walls'])) throw new Error('two mixes share a best');
    eq(S.mixKey(S.MIX_IDS).length <= 8, true, 'short enough to sync');
  });
  test('mixer: random combinations all play out, on their own and with two snakes', () => {
    const r = S.util.rng(11);
    for (let n = 0; n < 150; n++) {
      const mix = S.MIX_IDS.filter(() => r() < 0.45), o = { cols: 12, rows: 11, apples: 3, mode: 'mix', mix, grace: false, rng: r };
      const g = new S.Game(o);
      for (let i = 0; i < 200 && g.alive; i++) { const k = r() * 4 | 0; g.turn([1, -1, 0, 0][k], [0, 0, 1, -1][k], 1); g.step(); }
      const a = new S.Game(Object.assign({ waitApples: true, start: { x: 3, y: 3, dx: 1 } }, o)), b = new S.Game(Object.assign({ waitApples: true, start: { x: 8, y: 7, dx: -1 }, share: a }, o));
      a.fillApples();
      for (let i = 0; i < 200 && a.alive && b.alive; i++) {
        for (const q of [a, b]) { const k = r() * 4 | 0; q.turn([1, -1, 0, 0][k], [0, 0, 1, -1][k], 1); }
        S.duelStep(a, b);
        let c = 0; for (const v of a.occ) c += v;
        eq(c, a.cells.length + b.cells.length, String(mix));
      }
    }
  });
  test('run summary: counts tiles crossed and turns', () => {
    const g = mk(); g.apples.length = 0; g.apples.push({ x: 9, y: 0, kind: 'apple' });
    g.step(); g.turn(0, 1); g.step(); g.step();
    eq(g.turns, 1); eq(g.visits[g.idx(3, 4)], 1); eq(g.visits[g.idx(3, 5)], 1); eq(g.visits.reduce((a, b) => a + b, 0), 3);
  });

  // ---------- leaderboard replays ----------
  if (S.daily) {
    const D = S.daily, DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // Plays like a person: turns at random, sometimes late enough to redo the last move.
    function play(spec, seed, stopAt) {
      const r = S.util.rng(seed), g = new S.Game({ cols: spec.cols, rows: spec.rows, apples: spec.apples, mode: spec.mode, seed: spec.seed, blocks: spec.blocks, record: true });
      while (g.alive && g.ticks < stopAt) {
        for (let n = r() * 3 | 0; n > 0; n--) { const d = DIRS4[r() * 4 | 0]; g.turn(d[0], d[1], r() < 0.4 ? 0.1 : 1); }
        if (g.alive) g.step();
        g.events.length = 0;
      }
      return g;
    }
    test('replay: every mode gives the exact same game from its moves, redos and grace included', () => {
      let redos = 0, eaten = 0;
      for (const m of S.MODES) for (let seed = 1; seed <= 40; seed++) {
        const spec = Object.assign(D.challenge('2026-11-04'), { mode: m.id }), g = play(spec, seed * 7, 2000);
        const r = D.replay(spec, g.log, g.ticks);
        if (!r) throw new Error(m.id + ' seed ' + seed + ' would not replay');
        eq([r.score, r.alive, r.cells.length, r.steps], [g.score, g.alive, g.cells.length, g.steps], m.id + ' seed ' + seed);
        eq(r.cells[0], g.cells[0], m.id + ' head'); eaten += g.eaten;
        for (let i = 1; i < g.log.length; i += 2) if (g.log[i] & 4) redos++;
      }
      if (!redos || !eaten) throw new Error('test never redid a move or ate an apple');
    });
    test('replay: tampering is caught', () => {
      const spec = D.challenge('2026-11-04');
      let g = null;
      for (let seed = 1; seed < 400 && !(g && g.score > 0 && g.log.length > 6); seed++) g = play(spec, seed, 2000);
      eq(D.replay(spec, g.log, g.ticks).score, g.score, 'honest run');
      eq(D.replay(spec, 'nope', g.ticks), null, 'not a list'); eq(D.replay(spec, [1], g.ticks), null, 'odd length');
      eq(D.replay(spec, g.log, 1e9), null, 'too long'); eq(D.replay(spec, g.log, 0), null, 'no ticks');
      eq(D.replay(spec, [0, 99], 5), null, 'bad direction');
      eq(D.replay(spec, g.log.concat([g.ticks + 50, 0]), g.ticks), null, 'moves past the end');
      const other = D.challenge('2026-11-05'), r = D.replay(other, g.log, g.ticks);
      if (r && r.score === g.score && r.score > 3) throw new Error('moves should not carry over to another day');
    });
    test('names: short, plain and polite', () => {
      eq(D.cleanName('  Theo  '), 'Theo'); eq(D.cleanName('snake_fan-99'), 'snake_fan-99'); eq(D.cleanName('Zoë'), 'Zoë');
      eq(D.cleanName('a'), '', 'too short'); eq(D.cleanName('x'.repeat(17)), '', 'too long');
      eq(D.cleanName('<b>hi</b>'), '', 'markup'); eq(D.cleanName('sh1t head'), '', 'disguised'); eq(D.cleanName(null), '');
    });
    test('weekly bonus: pays once, when all three are done', () => {
      const d = { weekly: { week: '', mine: [0, 0, 0], seen: {}, claimed: [false, false, false], bonus: false } }, day = new Date(2026, 10, 4, 12);
      D.ensureWeek(d, day);
      d.weekly.claimed = [true, true, false];
      eq(D.claim(d, day).length, 0, 'two of three');
      const list = D.missions(d.weekly.week);
      d.weekly.mine[2] = list[2].goal;
      const paid = D.claim(d, day);
      eq(paid.length, 2, 'mission and bonus'); eq(paid[1].bonus, true); eq(paid[1].xp, D.BONUS_XP);
      eq(D.claim(d, day).length, 0, 'only once');
      D.ensureWeek(d, new Date(2026, 10, 9, 12)); eq(d.weekly.bonus, false, 'new week');
    });
    if (S.skins) test('rewards: the exclusive ones sit on streak, mission and perfect week paths only', () => {
      const SK = S.skins;
      const exclusive = SK.UNLOCKS.filter(u => ['streak', 'missions', 'perfect'].indexOf(u.track.id) >= 0);
      eq(exclusive.length, 30);
      for (const u of exclusive) { eq(!!SK.itemName(u), true, u.id); if (u.kind === 'board' && !SK.BOARD_THEMES[SK.BOARDS[u.index]]) throw new Error(u.id); }
      for (const name of SK.PATTERNS.slice(136)) if (!SK.GRADIENTS[name] && !SK.FIXED_BANDS[name]) throw new Error(name);
      for (const name of SK.BURSTS.slice(-4)) if (!SK.BURST_STYLES[name]) throw new Error(name);
      for (const name of SK.TRAILS.slice(-5)) if (!SK.TRAIL_STYLES[name]) throw new Error(name);
      const p = { bestStreak: 7, missions: 3, perfect: 1 };
      eq(SK.UNLOCKS.filter(u => u.track.id === 'streak' && u.value(p) >= u.goal).length, 4);
    });
  }

  // ---------- Daily Challenge and weekly missions ----------
  if (S.daily) {
    const D = S.daily, at = (y, m, d) => new Date(y, m - 1, d, 12);
    const year = []; for (let i = 0; i < 730; i++) year.push(D.keyOf(D.dayNum('2026-01-01') + i));
    test('daily: the date alone decides the challenge', () => {
      eq(D.challenge('2026-11-04'), D.challenge('2026-11-04'));
      eq(new Set(year.map(k => JSON.stringify(D.challenge(k)))).size, 730, 'different every day');
    });
    test('daily: every challenge is a real, playable mode with the start row clear', () => {
      for (const k of year) {
        const c = D.challenge(k);
        eq(!!S.MODE[c.mode], true, k); eq(c.mode !== 'peaceful', true, k);
        for (const [x, y] of c.blocks) if (y === 7 || x < 0 || y < 0 || x >= c.cols || y >= c.rows) throw new Error(k + ' block at ' + x + ',' + y);
        const g = new S.Game({ cols: c.cols, rows: c.rows, apples: c.apples, mode: c.mode, seed: c.seed, blocks: c.blocks });
        if (c.mode !== 'portal') for (let i = 0; i < 12; i++) { g.step(); if (!g.alive) throw new Error(k + ' died going straight'); }   // a portal can drop you anywhere
      }
    });
    test('daily: never the same mode two days running', () => {
      for (let i = 1; i < year.length; i++) if (D.challenge(year[i]).mode === D.challenge(year[i - 1]).mode) throw new Error(year[i]);
    });
    test('daily: apples come in the same order whatever you do', () => {
      const c = D.challenge('2026-11-04'), order = moves => {
        const g = new S.Game({ cols: 17, rows: 15, apples: 1, mode: 'classic', seed: c.seed }), out = [];
        for (let n = 0; n < 6; n++) {
          const a = g.apples[0]; out.push([a.x, a.y]);
          g.apples.length = 0; g.steps += moves; g.fillApples();
        }
        return out;
      };
      eq(order(1), order(7));
    });
    test('daily: the same day still differs between seeds', () => {
      const g = s => new S.Game({ cols: 17, rows: 15, seed: s }).apples[0];
      if (JSON.stringify(g(1)) === JSON.stringify(g(2)) && JSON.stringify(g(3)) === JSON.stringify(g(4))) throw new Error('seed ignored');
    });
    test('daily: streaks count days in a row', () => {
      const days = { '2026-11-01': 3, '2026-11-02': 0, '2026-11-03': 9 };
      eq(D.streak(days, '2026-11-03'), 3, 'played today');
      eq(D.streak(days, '2026-11-04'), 3, 'today still to play');
      eq(D.streak(days, '2026-11-05'), 0, 'missed a day');
      eq(D.bestStreak(Object.assign({ '2026-10-20': 1 }, days)), 3, 'best');
      eq(D.streak({ '2026-12-31': 1, '2027-01-01': 1, '2027-03-01': 1, '2027-02-28': 1 }, '2027-03-01'), 2, 'across a month');
    });
    test('daily: XP grows with the streak and stops at day 10', () => {
      eq(D.dailyXp(1), 110); eq(D.dailyXp(10), 200); eq(D.dailyXp(50), 200);
    });
    test('weeks: run Monday to Sunday and sort in order', () => {
      eq(D.weekKey(at(2026, 11, 2)), '2026-W45', 'Monday'); eq(D.weekKey(at(2026, 11, 8)), '2026-W45', 'Sunday');
      eq(D.weekKey(at(2026, 11, 9)), '2026-W46', 'next Monday'); eq(D.weekKey(at(2027, 1, 1)), '2026-W53', 'new year in the old week');
      eq(D.weekKey(at(2027, 1, 4)), '2027-W01'); eq(D.daysLeftInWeek(at(2026, 11, 8)), 1, 'Sunday');
    });
    const save = () => ({ weekly: { week: '', mine: [0, 0, 0], seen: {}, claimed: [false, false, false] } });
    test('missions: every week has three different missions you can actually do', () => {
      for (let y = 2026; y < 2030; y++) for (let w = 1; w < 54; w++) {
        const key = y + '-W' + (w < 10 ? '0' : '') + w, list = D.missions(key);
        eq(new Set(list.map(m => m.id)).size, 3, key);
        for (const m of list) {
          const mode = m.id.split(':')[1];
          if (mode && S.skins && S.skins.unlockFor('mode', mode)) throw new Error(key + ' needs a locked mode');
        }
      }
    });
    test('missions: add up, pay once and reset the next week', () => {
      const d = save(), day = at(2026, 11, 4), list = D.missions(D.weekKey(day));
      const i = list.findIndex(m => m.id === 'games' || m.id === 'apples' || m.id === 'minutes'), m = list[i];
      const game = { mode: 'classic', apples: 40, ms: 600000, score: 1, length: 3, daily: false };
      let paid = [];
      for (let n = 0; n < 12; n++) paid = paid.concat(D.record(d, game, day));
      eq(paid.filter(x => x.id === m.id).length, 1, 'paid once');
      eq(d.weekly.claimed[i], true, 'marked done');
      D.record(d, game, at(2026, 11, 9));
      eq(d.weekly.week, '2026-W46', 'week'); eq(d.weekly.claimed.filter(Boolean).length <= 1, true, 'fresh start');
    });
    test('missions: a score mission takes your best game, not the total', () => {
      const m = { id: 'score', goal: 15, max: true }, w = { mine: [10, 0, 0], seen: { x: [12, 0, 0] } };
      eq(D.total(w, 0, m), 12);
      const n = { id: 'apples', goal: 15 }; eq(D.total(w, 0, n), 22, 'a counter adds devices up');
    });
    test('missions: a clock running behind never wipes the week', () => {
      const d = save(); d.weekly.week = '2026-W46'; d.weekly.mine = [5, 0, 0];
      D.ensureWeek(d, at(2026, 11, 4)); eq(d.weekly.mine, [5, 0, 0]);
    });
  }
  if (S.syncCore) {
    const C = S.syncCore;
    test('sync: daily results merge and a played 0 still counts', () => {
      const m = C.mergeDocs({ daily: { '2026-11-01': 4, '2026-11-02': 0 } }, { daily: { '2026-11-01': 9, '2026-11-03': 2 } });
      eq(m.daily, { '2026-11-01': 9, '2026-11-02': 0, '2026-11-03': 2 });
      eq(Object.keys(C.sanitize({ daily: { nope: 1, '2026-1-1': 2 } }).daily).length, 0, 'bad dates dropped');
    });
    test('sync: daily results are capped so a save stays small', () => {
      const days = {}; for (let i = 0; i < 900; i++) days[new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)] = 1;
      const out = Object.keys(C.sanitize({ daily: days }).daily);
      eq(out.length, 400); eq(out[399], '2022-06-18', 'keeps the newest');
    });
    test('sync: weekly missions keep each device separate', () => {
      const m = C.mergeDocs({ weekly: { week: '2026-W45', devices: { a: [5, 0, 0] }, claimed: [false, true, false] } },
        { weekly: { week: '2026-W45', devices: { a: [3, 1, 0], b: [7, 0, 0] }, claimed: [true, false, false] } });
      eq(m.weekly.devices, { a: [5, 1, 0], b: [7, 0, 0] }); eq(m.weekly.claimed, [true, true, false]);
    });
    test('sync: a newer device that has no leaderboard name never blanks yours', () => {
      const named = { settings: { lbName: 'Theo', lbId: 'abc', color: 1 }, settingsAt: 5 }, fresh = { settings: { lbName: '', lbId: '', color: 2 }, settingsAt: 9 };
      const m = C.mergeDocs(named, fresh);
      eq(m.settings.color, 2, 'the newer look wins'); eq(m.settings.lbName, 'Theo'); eq(m.settings.lbId, 'abc');
      eq(C.mergeDocs({ weekly: { week: '2026-W45', bonus: true } }, { weekly: { week: '2026-W45' } }).weekly.bonus, true, 'bonus stays claimed');
      eq(C.totals({ devices: { a: { games: 0, apples: 0, timeMs: 0, xp: 0, missions: 4, perfect: 1, longest: 0 }, b: { games: 0, apples: 0, timeMs: 0, xp: 0, missions: 2, perfect: 0, longest: 0 } } }).missions, 6);
    });
    test('sync: a newer week replaces an older one, and old saves still merge', () => {
      const old = { weekly: { week: '2026-W45', devices: { a: [9, 9, 9] }, claimed: [true, true, true] } }, cur = { weekly: { week: '2026-W46', devices: { b: [1, 0, 0] } } };
      eq(C.mergeDocs(old, cur).weekly.week, '2026-W46'); eq(C.mergeDocs(cur, old).weekly.devices, { b: [1, 0, 0] });
      eq(C.mergeDocs({}, old).weekly.week, '2026-W45', 'a doc from before this update');
      eq(C.sanitize({ weekly: { week: 'bad', devices: { a: [1, 1, 1] } } }).weekly.week, '', 'bad week dropped');
      const s = JSON.stringify(C.sanitize(old)); eq(JSON.stringify(C.mergeDocs(old, {})).length, s.length, 'nothing new means no change');
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
