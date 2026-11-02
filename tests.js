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
    eq(g.alive, false, 'alive'); eq(g.events.some(e => e.type === 'die'), true, 'die event');
  });
  test('dead snake does not move', () => {
    const g = mk({ cols: 4 }); g.step(); g.step(); const h = head(g); g.step(); eq(head(g), h);
  });
  test('running into your body kills', () => {
    const g = mk(); g.grow = 3; g.step(); g.step(); g.step();   // length 6
    g.turn(0, 1); g.step(); g.turn(-1, 0); g.step(); g.turn(0, -1); g.step();
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
    g.turn(0, 1); g.step(); g.turn(-1, 0); g.step(); g.turn(0, -1); g.step();
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
    const g = mk({ mode: 'walls' }); g.wall[g.idx(4, 4)] = 2; g.step(); g.step();
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
    eq(g.cells[0], { x: 7, y: 6 }); for (let i = 0; i < 23; i++) g.step(); eq(g.alive, true); g.step(); eq(g.alive, false);
  });

  S.testResults = results;
  if (typeof module !== 'undefined' && !root.document) {
    let fail = 0;
    for (const r of results) { console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '  -> ' + r.msg)); if (!r.ok) fail++; }
    console.log(`\n${results.length - fail}/${results.length} passed`);
    process.exitCode = fail ? 1 : 0;
  }
})(typeof window !== 'undefined' ? window : globalThis);
