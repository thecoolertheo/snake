// App glue: state machine, fixed-timestep loop, and wiring between game, renderer, UI, input and audio.
(function (root) {
  'use strict';
  const S = root.Snake, U = S.util, R = S.render, SK = S.skins, A = S.audio, ui = S.ui, store = S.store;
  const CELL = R.CELL;
  const BOARDS = { s: [10, 9], m: [17, 15], l: [24, 21] };   // 'f' (fill screen) is worked out from the screen
  const COUNT_MS = 420;
  const GRACE_FRACTION = 0.5;    // how long the grace beat lasts, as a fraction of a step          // each number of the 3-2-1 countdown
  const $ = id => document.getElementById(id);

  const data = store.load();
  const settings = data.settings;
  if (!BOARDS[settings.board] && settings.board !== 'f') settings.board = 'm';
  // Until you pick a board size yourself, start with one that suits the screen:
  // phones get Small, tablets and laptops Medium, big desktop screens Large.
  if (!settings.boardChosen) {
    const short = Math.min(root.innerWidth, root.innerHeight), long = Math.max(root.innerWidth, root.innerHeight);
    settings.board = short < 500 ? 's' : (short >= 900 && long >= 1400 ? 'l' : 'm');
  }
  if ([1, 3, 5].indexOf(settings.apples) < 0) settings.apples = 1;
  const modeOpen = id => { const u = SK.unlockFor('mode', id); return !u || store.isUnlocked(u.id); };

  // Reduced motion: no shake, no confetti, fewer particles.
  const rm = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
  R.reduced = !!(rm && rm.matches);
  if (rm && rm.addEventListener) rm.addEventListener('change', () => { R.reduced = rm.matches; });

  // ---------- state ----------
  // menu → countdown → play ⇄ paused, play → dying → over → countdown …
  let state = 'menu';
  let game = null, pendingNew = false;
  let acc = 0, last = 0, deathT = 0, gameTime = 0, mouth = 0;
  let countT = 0, countN = -1;
  let bestBefore = 0, passedBest = false;
  let squashT = -1e9, lastDir = null, blinkT = -1e9, nextBlink = 2000;
  const eats = [];                          // gameTime of each recent eat, for the lump
  const bulges = new Float32Array(64);
  const fx = { dead: false, flash: 0, grey: 0, mouth: 0, bulges, nBulges: 0, blink: 0, squash: 0 };

  const cv = $('c');
  const view = new R.View(cv, 17, 15, true);
  const PV_COLS = 10, PV_ROWS = 4;
  const pvView = new R.View($('pv'), PV_COLS, PV_ROWS, true);
  const pvSnake = new R.SnakeDrawer();
  const confetti = new R.Confetti($('confetti'));
  const ambient = new R.Ambient();
  const liveUnlocked = [];   // rewards unlocked during the current game
  let liveCheckT = 0;

  // The menu's accent colour follows your snake: its colour, or the main colour of its pattern.
  function applyAccent() {
    const pat = SK.PATTERNS[settings.pattern];
    let c = U.hexRgb((SK.COLORS[settings.color] || SK.COLORS[0])[1]);
    if (SK.GRADIENTS[pat]) c = SK.GRADIENTS[pat][1];
    else if (SK.FIXED_BANDS[pat]) c = SK.FIXED_BANDS[pat][0];
    const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255, st = document.documentElement.style;
    st.setProperty('--mode-accent', U.rgb(c));
    st.setProperty('--accent-glow', 'rgba(' + c.join(',') + ',.16)');
    st.setProperty('--mode-ink', lum > 0.62 ? '#0f1512' : '#ffffff');   // readable text/knobs on top of the accent
  }

  // Each mode has its own look: board colours + ambient effect, and an accent for the menu.
  function applyTheme() {
    const T = R.THEMES[settings.mode] || R.THEMES.classic, st = document.documentElement.style;
    st.setProperty('--mode-glow', T.glow);
    view.setTheme(settings.mode); pvView.setTheme(settings.mode);
    if (game) ambient.reset(T.amb, game.cols, game.rows);
  }

  const baseMs = () => SK.SPEED_MS[settings.speed];
  // Optional ramp: 1.5% faster per apple, never faster than 60% of the base interval.
  // Turbo mode: 3% faster per point, down to 45% of the base interval.
  const stepMs = () => {
    if (!game) return baseMs();
    if (game.rules.turbo) return baseMs() * Math.max(0.45, Math.pow(0.97, game.score));
    return baseMs() * (settings.ramp ? Math.max(0.6, Math.pow(0.985, game.score)) : 1);
  };
  // Space the board can use, in CSS pixels (after the bar, padding and D-pad).
  function available() {
    const E = ui.el, cs = getComputedStyle(document.body);
    document.documentElement.classList.toggle('full', settings.board === 'f');
    const showPad = !!settings.dpad;
    E.dpad.hidden = !showPad;
    const side = showPad && root.innerWidth > root.innerHeight * 1.15;
    E.app.classList.toggle('side', side);
    let w = document.documentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let h = root.innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - E.bar.offsetHeight;
    if (showPad) { if (side) w -= E.dpad.offsetWidth + 12; else h -= E.dpad.offsetHeight + 12; }
    return { w, h };
  }
  // Fill screen: as many ~30-46px cells as fit the space, so the board covers it edge to edge.
  function board() {
    if (settings.board !== 'f') return BOARDS[settings.board];
    const a = available(), target = U.clamp(Math.min(a.w, a.h) / 12, 28, 46);
    return [Math.max(8, Math.floor(a.w / target)), Math.max(8, Math.floor(a.h / target))];
  }
  const currentBest = () => store.getBest(settings.mode, settings.board, settings.apples);
  // Only after the player has interacted (browsers block it otherwise and log a warning).
  const vibrate = p => {
    const ua = navigator.userActivation;
    if (settings.vibrate && navigator.vibrate && (!ua || ua.hasBeenActive)) try { navigator.vibrate(p); } catch (e) {}
  };

  function newGame() {
    const [cols, rows] = board();
    game = new S.Game({ cols, rows, apples: settings.apples, mode: settings.mode });
    if (view.cols !== cols || view.rows !== rows) { view.setBoard(cols, rows); fit(); }
    acc = 0; deathT = 0; mouth = 0; gameTime = 0; eats.length = 0; view.fx.clear(); R.resetWalls();
    lastDir = game.dir; pendingNew = false;
    bestBefore = currentBest(); passedBest = false;
    ui.setScore(0); ui.setBest(bestBefore);
    liveUnlocked.length = 0;
    applyTheme(); fit();
  }

  function showMenu(title, btn, extra) {
    A.set({ duck: true });
    ui.showMenu(Object.assign({ title, score: game.score, best: currentBest(), btn }, extra || {}));
    fit();
  }

  function start() {
    if (state === 'play' || state === 'countdown' || state === 'dying') return;
    if (state === 'paused' && pendingNew && game.steps > 0) endGame();      // settings changed mid-game: count it and start fresh
    if (state === 'over' || pendingNew) newGame();
    state = 'countdown'; countT = performance.now(); countN = -1;
    ui.hideMenu(); A.set({ duck: false });
  }
  function pause() {
    if (state !== 'play' && state !== 'countdown') return;
    state = 'paused'; store.save();
    showMenu('Paused', 'Resume', { compact: true });
  }

  function turn(nx, ny) {
    if (state === 'dying') return;
    if (state === 'menu' || state === 'over' || state === 'paused') {
      start();   // a direction from the menu starts the countdown and sets your first move
      if (state === 'countdown' && game.turn(nx, ny, 1)) A.sfx.turn();
      return;
    }
    if (state === 'countdown') { if (game.turn(nx, ny, 1)) A.sfx.turn(); return; }
    if (game.turn(nx, ny, acc / stepMs())) A.sfx.turn();
    handleEvents();
  }

  function handleEvents() {
    if (game.dir !== lastDir) { lastDir = game.dir; squashT = performance.now(); }
    const evs = game.events, now = performance.now();
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i], cx = e.x * CELL + CELL / 2, cy = e.y * CELL + CELL / 2;
      switch (e.type) {
        case 'eat': {
          ui.setScore(game.score, true);
          if (e.kind === 'gold') { view.fx.burst(cx, cy, now, ['#ffc83d', '#fff6c4', '#ff9838'], 22); A.sfx.gold(); }
          else if (e.kind !== 'portal') {
            const B = SK.BURST_STYLES[SK.BURSTS[settings.burst]] || SK.BURST_STYLES.Classic;
            view.fx.burst(cx, cy, now, B.colors, B.shape === 'dot' ? 14 : 16, B.shape);
          }
          for (let k = 0; k < (e.worth || 1); k++) eats.push(gameTime - k * stepMs() * 0.6);
          mouth = 0; A.sfx.eat(); vibrate(e.kind === 'gold' ? [12, 30, 12] : 12);
          if (!passedBest && bestBefore > 0 && game.score > bestBefore) { passedBest = true; A.sfx.passBest(); ui.bump(ui.el.best, true); }
          ui.setBest(Math.max(bestBefore, game.score), passedBest);
          liveCheck();
          break;
        }
        case 'portal': {
          const c = R.PORTAL_COLORS[e.pair % R.PORTAL_COLORS.length];
          view.fx.ring(cx, cy, now, c); view.fx.burst(e.tx * CELL + CELL / 2, e.ty * CELL + CELL / 2, now, [c, '#ffffff', c], 10);
          A.sfx.portal();
          break;
        }
        case 'poison': view.fx.burst(cx, cy, now, ['#9b5cf0', '#e2c2ff', '#4a1f86']); A.sfx.poison(); vibrate([10, 40, 10]); break;
        case 'shrink': view.fx.burst(cx, cy, now, ['#8a9a90', '#5a6a60', '#c0c8c4'], 5); break;
        case 'wall': A.sfx.wall(); break;
        case 'grace': squashT = now; A.sfx.grace(); vibrate(8); break;
        case 'expire': view.fx.burst(cx, cy, now, ['#ffc83d', '#fff6c4', '#a86f00'], 6); break;
        case 'die':
          state = 'dying'; deathT = now; A.sfx.die(); vibrate([40, 40, 90]);
          setTimeout(() => { if (state === 'dying') { state = 'over'; finish('Game over'); } }, 1100);
          break;
        case 'win': state = 'over'; finish('You win!'); break;
      }
    }
    evs.length = 0;
  }

  // Records the finished game: stats, best score, unlocks. Returns what changed.
  function endGame() {
    const s = data.stats;
    s.games++; s.apples += game.eaten; s.longest = Math.max(s.longest, game.maxLen);
    const isBest = store.submitBest(settings.mode, settings.board, settings.apples, game.score);
    const unlocked = checkUnlocks();
    store.save();
    return { isBest: isBest && game.score > 0, celebrate: isBest && (bestBefore > 0 || game.score >= 10), unlocked };
  }

  // Unlocks anything whose milestone has been reached. Returns the newly unlocked rewards.
  function checkUnlocks() {
    const p = store.progress(), out = [];
    for (const u of SK.UNLOCKS) if (!store.isUnlocked(u.id) && u.value(p) >= u.goal) { data.unlocked.push(u.id); out.push(u); }
    return out;
  }
  if (checkUnlocks().length) store.save();   // goals can change between versions
  if (!S.MODE[settings.mode] || !modeOpen(settings.mode)) settings.mode = 'classic';

  // Unlock rewards the moment you reach them mid-game (toast + a burst of confetti).
  function liveCheck() {
    if (!game || state !== 'play') return;
    const b = store.progress(), mode = settings.mode;
    const p = { games: b.games, minutes: b.minutes, apples: b.apples + game.eaten, longest: Math.max(b.longest, game.cells.length),
      bestAny: Math.max(b.bestAny, game.score), bestMode: m => Math.max(b.bestMode(m), m === mode ? game.score : 0) };
    let changed = false;
    for (const u of SK.UNLOCKS) {
      if (store.isUnlocked(u.id) || u.value(p) < u.goal) continue;
      data.unlocked.push(u.id); liveUnlocked.push(u); changed = true;
      const r = ui.toast(u);
      A.sfx.unlock(); vibrate([15, 40, 15]);
      if (r) confetti.pop(r.left + r.width / 2, r.top + r.height / 2, 40);
    }
    if (changed) store.save();
  }

  function finish(title) {
    const r = endGame();
    r.unlocked = liveUnlocked.concat(r.unlocked);
    let badge = '';
    if (r.isBest) badge = 'New best!';
    if (r.unlocked.length) badge = (badge ? badge + ' · ' : '') + (r.unlocked.length > 2 ? 'Unlocked ' + r.unlocked.length + ' rewards' : 'Unlocked ' + r.unlocked.map(SK.itemName).join(', '));
    ui.setBest(currentBest());
    showMenu(title, 'Play again', { badge, next: ui.nextGoal() });
    if (r.celebrate) { confetti.fire(); A.sfx.newBest(); vibrate([20, 60, 20, 60, 40]); }
    if (r.unlocked.length > liveUnlocked.length) A.sfx.unlock();   // end-of-game unlocks (e.g. games played)
  }

  // ---------- layout: the board fills the space it has, at device resolution ----------
  function fit() {
    const E = ui.el, a = available(), availW = a.w, availH = a.h;
    // A fill-screen board that no longer matches the screen (rotation, resize) is rebuilt,
    // but only between games.
    if (settings.board === 'f' && game && (state === 'menu' || state === 'over')) {
      const [c, r] = board();
      if (c !== game.cols || r !== game.rows) { newGame(); return; }
    }
    const cell = Math.max(8, Math.min(availW / view.cols, availH / view.rows));
    const w = Math.floor(cell * view.cols), h = Math.floor(cell * view.rows);
    E.wrap.style.width = w + 'px';
    view.resize(w, h);
    if (ui.menuOpen() && E.pv.offsetParent) { const pw = E.pv.clientWidth || 200; pvView.resize(pw, Math.round(pw * PV_ROWS / PV_COLS)); }
    if (confetti.active) confetti.resize();
  }

  // ---------- drawing ----------
  // ---------- menu preview: a little snake that plays by itself ----------
  // It heads for apples (avoiding moves that would trap it), wanders a bit, grows,
  // and once it fills ~40% of the mini board it shrinks back to 3 and starts over.
  const PV_MAX = Math.round(PV_COLS * PV_ROWS * 0.4);
  let pvGame = null, pvAcc = 0, pvShrinking = false;
  const pvEats = [], pvBulges = new Float32Array(16), pvTime = { t: 0 };
  const pvFx = { mouth: 0, blink: 0, bulges: pvBulges, nBulges: 0, squash: 0 };
  const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  function pvNew() { pvGame = new S.Game({ cols: PV_COLS, rows: PV_ROWS, apples: 1, mode: 'classic', grace: false }); pvShrinking = false; pvEats.length = 0; }
  // Can the snake step onto (x, y)? The tail cell is fine because it moves away.
  function pvOpen(g, x, y) {
    if (!g.inBounds(x, y)) return false;
    const t = g.cells[g.cells.length - 1];
    return g.occ[g.idx(x, y)] === 0 || (t.x === x && t.y === y && g.grow === 0);
  }
  // How many tiles can be reached from (x, y): used to avoid trapping itself.
  function pvRoom(g, x, y) {
    const seen = new Uint8Array(g.cols * g.rows), q = [x, y]; seen[g.idx(x, y)] = 1; let n = 0;
    while (q.length) {
      const cy = q.pop(), cx = q.pop(); n++;
      for (const d of DIRS4) {
        const nx = cx + d.x, ny = cy + d.y;
        if (pvOpen(g, nx, ny) && !seen[g.idx(nx, ny)]) { seen[g.idx(nx, ny)] = 1; q.push(nx, ny); }
      }
    }
    return n;
  }
  // First step of the shortest path to the apple (breadth-first search), or null.
  function pvPathStep(g) {
    const a = g.apples[0], h = g.cells[0]; if (!a) return null;
    const prev = new Int16Array(g.cols * g.rows).fill(-1), start = g.idx(h.x, h.y), q = [start];
    prev[start] = start;
    while (q.length) {
      const i = q.shift(), x = i % g.cols, y = (i / g.cols) | 0;
      if (x === a.x && y === a.y) {
        let k = i; while (prev[k] !== start) k = prev[k];
        return { x: (k % g.cols) - h.x, y: ((k / g.cols) | 0) - h.y };
      }
      for (const d of DIRS4) {
        const nx = x + d.x, ny = y + d.y;
        if (pvOpen(g, nx, ny) && prev[g.idx(nx, ny)] < 0) { prev[g.idx(nx, ny)] = i; q.push(g.idx(nx, ny)); }
      }
    }
    return null;
  }
  function pvChoose(g) {
    const h = g.cells[0], len = g.cells.length;
    const safe = DIRS4.filter(d => !(d.x === -g.dir.x && d.y === -g.dir.y) && pvOpen(g, h.x + d.x, h.y + d.y))
      .map(d => ({ d, room: pvRoom(g, h.x + d.x, h.y + d.y) }));
    if (!safe.length) return null;
    const roomy = safe.filter(c => c.room >= len);
    const path = pvPathStep(g);
    if (path && Math.random() < 0.75) { const c = roomy.find(c => c.d.x === path.x && c.d.y === path.y); if (c) return c.d; }
    const pool = roomy.length ? roomy : safe.sort((a, b) => b.room - a.room).slice(0, 1);
    // Wander: usually keep going straight if that's fine, otherwise pick at random.
    const straight = pool.find(c => c.d.x === g.dir.x && c.d.y === g.dir.y);
    if (straight && Math.random() < 0.6) return straight.d;
    return pool[(Math.random() * pool.length) | 0].d;
  }
  function pvStep() {
    const g = pvGame, d = pvChoose(g);
    if (!d) { pvNew(); return; }
    g.turn(d.x, d.y, 1); g.step();
    if (!g.alive) { pvNew(); return; }
    for (const e of g.events) if (e.type === 'eat') pvEats.push(pvTime.t);
    g.events.length = 0;
    if (g.cells.length >= PV_MAX) pvShrinking = true;
    if (pvShrinking && (!g.trimTail() || g.cells.length <= 3)) pvShrinking = false;
  }
  function drawPreview(t, dt) {
    if (!pvGame) pvNew();
    const ms = baseMs();
    pvAcc += dt; pvTime.t += dt;
    while (pvAcc >= ms) { pvAcc -= ms; pvStep(); }
    const g = pvGame, p = Math.min(1, pvAcc / ms);
    let w = 0;
    for (let i = 0; i < pvEats.length; i++) {
      const d = (pvTime.t - pvEats[i]) / ms * CELL * 1.6;
      if (d < g.cells.length * CELL + CELL && w < pvBulges.length) { pvEats[w] = pvEats[i]; pvBulges[w++] = d; }
    }
    pvEats.length = w; pvFx.nBulges = w; pvFx.blink = fx.blink;
    const c0 = g.cells[0], c1 = g.cells[1], ap = g.apples[0];
    pvFx.mouth = ap && Math.abs(ap.x - c0.x) + Math.abs(ap.y - c0.y) <= 1 ? 1 - p * 0.3 : Math.max(0, pvFx.mouth - dt / 120);
    const gc = pvView.begin();
    for (const a of g.apples) R.drawApple(gc, a, t, g, p);
    const ang = U.lerpAng(U.angOf(g.prevDir.x, g.prevDir.y), U.angOf(g.dir.x, g.dir.y), U.ease(Math.min(1, p / 0.7)));
    pvSnake.draw(gc, g.cells, g.prevTail, p, CELL, ang, settings, pvFx);
  }

  function frame(t) {
    const dt = Math.min(250, t - last); last = t;
    S.input.pollGamepads();

    if (state === 'countdown') {
      const e = t - countT, n = Math.floor(e / COUNT_MS);
      if (n !== countN && n < 3) { countN = n; A.sfx.tick(); }
      if (e >= COUNT_MS * 3) { state = 'play'; acc = 0; A.sfx.start(); }
    }
    // Fixed timestep: the game advances in whole steps; rendering interpolates between them.
    if (state === 'play') {
      acc += dt; gameTime += dt; data.stats.timeMs += dt;
      if ((liveCheckT += dt) > 1000) { liveCheckT = 0; liveCheck(); }   // time-based milestones
      // The grace beat before a crash only lasts half a step, so it saves a quick turn but isn't a free pause.
      const due = () => stepMs() * (game.inGrace ? GRACE_FRACTION : 1);
      let ms = due();
      while (acc >= ms && state === 'play') { acc -= ms; game.step(); handleEvents(); ms = due(); }
    }
    const ms = stepMs();
    // During the grace beat the head holds still at the edge instead of sliding.
    const p = state === 'play' && !game.inGrace ? Math.min(acc / ms, 1) : 1;

    // Mouth opens as the head approaches an apple.
    let target = 0;
    if (state === 'play') {
      const c0 = game.cells[0], c1 = game.cells[1], d = game.dir;
      const hx = c1.x + (c0.x - c1.x) * p, hy = c1.y + (c0.y - c1.y) * p;
      for (const ap of game.apples) {
        const ax = ap.x - hx, ay = ap.y - hy, ahead = ax * d.x + ay * d.y, side = Math.abs(ax * d.y - ay * d.x);
        if (ahead > 0 && ahead < 2.2 && side < 0.6) target = Math.max(target, Math.min(1, (2.2 - ahead) / 1.6));
      }
    }
    const fdt = Math.min(50, dt);
    mouth += (target - mouth) * Math.min(1, fdt / 60);

    // Idle blink every few seconds, and a small squash when the head turns.
    if (t > nextBlink) { blinkT = t; nextBlink = t + 2200 + Math.random() * 3800; }
    const be = t - blinkT;
    fx.blink = be < 160 ? Math.sin(Math.PI * be / 160) : 0;
    const se = t - squashT;
    fx.squash = !R.reduced && se < 180 ? 1 - U.ease(se / 180) : 0;

    // Death: shake, flash, then the body greys out from head to tail.
    const dead = deathT > 0 && !game.won, e = t - deathT;
    fx.dead = dead;
    fx.flash = dead && e < 600 && ((e / 100 | 0) % 2 === 0) ? 0.75 : 0;
    fx.grey = dead && e > 600 ? Math.min(1, (e - 600) / 450) : 0;
    fx.mouth = mouth;
    const shake = !R.reduced && dead && e < 350 ? (1 - e / 350) * 7 : 0;

    // The lump travels down the body after each apple.
    let w = 0;
    const lenPx = game.cells.length * CELL + CELL;
    for (let i = 0; i < eats.length; i++) {
      const d = (gameTime - eats[i]) / ms * CELL * 1.6;
      if (d < lenPx && w < bulges.length) { eats[w] = eats[i]; bulges[w++] = d; }
    }
    eats.length = w; fx.nBulges = w;

    const g = view.begin(shake ? (Math.random() * 2 - 1) * shake : 0, shake ? (Math.random() * 2 - 1) * shake : 0);
    ambient.draw(g, t, fdt);
    R.drawWalls(g, game, t);
    for (const ap of game.apples) R.drawApple(g, ap, t, game, p);
    const a = U.lerpAng(U.angOf(game.prevDir.x, game.prevDir.y), U.angOf(game.dir.x, game.dir.y), U.ease(Math.min(1, p / 0.7)));
    view.snake.draw(g, game.cells, game.prevTail, p, CELL, a, settings, fx);
    if (game.rules.hunger && state !== 'menu') R.drawHunger(g, game.cols, game.rows, game.hungerLevel(), t);
    if (game.rules.dark) { const P = view.snake.path; R.drawDark(g, game.cols, game.rows, P.x[P.n - 1], P.y[P.n - 1], game.apples, t); }
    view.fx.draw(g, t, fdt);
    if (state === 'countdown') {
      const ce = t - countT, n = Math.min(2, Math.floor(ce / COUNT_MS));
      R.drawCountdown(g, game.cols, game.rows, String(3 - n), (ce - n * COUNT_MS) / COUNT_MS);
    }

    if (ui.menuOpen() && pvView.cv.offsetParent) drawPreview(t, Math.min(dt, 100));
    confetti.draw(t, dt);
    requestAnimationFrame(frame);
  }

  // ---------- wiring ----------
  function applyAudio() { A.set({ muted: settings.muted, volume: settings.volume, sfxOn: settings.sfx, musicOn: settings.music }); }
  applyAudio();

  ui.init(store, {
    play: () => { A.unlock(); applyAudio(); start(); },
    pause: () => { A.unlock(); pause(); },
    openBest: () => {
      if (state === 'dying') return;
      if (state === 'play' || state === 'countdown') pause();
      if (!ui.menuOpen()) showMenu('Snake', 'Play');
      ui.expand(); ui.setTab('stats', true);
    },
    gameChanged: () => {
      store.save();
      if (state === 'paused') { pendingNew = true; ui.setPlayLabel('New game'); }
      else if (state === 'menu' || state === 'over') { newGame(); state = 'menu'; ui.setPlayLabel('Play'); }
      ui.el.mBest.textContent = currentBest();
      ui.refresh();
    },
    settingsChanged: key => {
      store.save(); applyAudio();
      if (key === 'color' || key === 'pattern') applyAccent();
      if (key === 'dpad') fit();
      if (key === 'speed' || key === 'ramp') ui.refresh();
    },
    click: () => A.sfx.click(),
    // Pause card: restart counts the current game, then starts a fresh one with a countdown.
    restart: () => {
      if (state !== 'paused') return;
      A.sfx.click();
      if (game.steps > 0) endGame();
      newGame(); state = 'menu'; start();
    },
    home: () => {
      if (state !== 'paused') return;
      A.sfx.click();
      if (game.steps > 0) endGame();
      newGame(); state = 'menu';
      showMenu('Snake', 'Play');
    }
  });
  S.input.init({
    dir: turn,
    togglePause: () => { if (state === 'play' || state === 'countdown') pause(); else if (state === 'paused') start(); },
    confirm: start,
    anyInput: () => { A.unlock(); },
    menuOpen: ui.menuOpen
  });

  // Pause when the tab is hidden; reset the clock when it comes back so there's no time jump.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); store.save(); A.suspend(); }
    else { last = performance.now(); A.resume(); }
  });
  root.addEventListener('pagehide', () => store.save());
  root.addEventListener('resize', fit);
  if (root.ResizeObserver) new ResizeObserver(fit).observe(document.documentElement);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  applyAccent();
  newGame();
  showMenu('Snake', 'Play');
  requestAnimationFrame(t => { last = t; frame(t); });

  // Handy for debugging and automated checks.
  S.app = { get game() { return game; }, get state() { return state; }, settings, view, store, confetti, endGame, newGame, get preview() { return pvGame; } };
})(window);
