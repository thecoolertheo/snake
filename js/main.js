// App glue: state machine, fixed-timestep loop, and wiring between game, renderer, UI, input and audio.
(function (root) {
  'use strict';
  const S = root.Snake, U = S.util, R = S.render, SK = S.skins, A = S.audio, ui = S.ui, store = S.store;
  const CELL = R.CELL;
  const BOARDS = { s: [10, 9], m: [17, 15], l: [24, 21] };
  const COUNT_MS = 420;          // each number of the 3-2-1 countdown
  const $ = id => document.getElementById(id);

  const data = store.load();
  const settings = data.settings;
  if (!BOARDS[settings.board]) settings.board = 'm';
  if ([1, 3, 5].indexOf(settings.apples) < 0) settings.apples = 1;
  if (!S.MODE[settings.mode]) settings.mode = 'classic';

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
  const pvView = new R.View($('pv'), 7, 3, true);
  const pvSnake = new R.SnakeDrawer();
  const confetti = new R.Confetti($('confetti'));

  const baseMs = () => SK.SPEED_MS[settings.speed];
  // Optional ramp: 1.5% faster per apple, never faster than 60% of the base interval.
  const stepMs = () => baseMs() * (settings.ramp && game ? Math.max(0.6, Math.pow(0.985, game.score)) : 1);
  const board = () => BOARDS[settings.board];
  const currentBest = () => store.getBest(settings.mode, settings.board, settings.apples);
  const vibrate = p => { if (settings.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };

  function newGame() {
    const [cols, rows] = board();
    game = new S.Game({ cols, rows, apples: settings.apples, mode: settings.mode });
    if (view.cols !== cols || view.rows !== rows) { view.setBoard(cols, rows); fit(); }
    acc = 0; deathT = 0; mouth = 0; gameTime = 0; eats.length = 0; view.fx.clear(); R.resetWalls();
    lastDir = game.dir; pendingNew = false;
    bestBefore = currentBest(); passedBest = false;
    ui.setScore(0); ui.setBest(bestBefore);
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
    showMenu('Paused', 'Resume');
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
          if (e.kind !== 'portal') view.fx.burst(cx, cy, now, ['#ff5a4e', '#5fd16a', '#ffd5cf']);
          eats.push(gameTime); mouth = 0; A.sfx.eat(); vibrate(12);
          if (!passedBest && bestBefore > 0 && game.score > bestBefore) { passedBest = true; A.sfx.passBest(); ui.bump(ui.el.best, true); }
          ui.setBest(Math.max(bestBefore, game.score), passedBest);
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
    s.games++; s.apples += game.score; s.longest = Math.max(s.longest, game.maxLen);
    const isBest = store.submitBest(settings.mode, settings.board, settings.apples, game.score);
    const p = store.progress(), unlocked = [];
    for (const u of SK.UNLOCKS) if (!store.isUnlocked(u.id) && u.value(p) >= u.goal) { data.unlocked.push(u.id); unlocked.push(u); }
    store.save();
    return { isBest: isBest && game.score > 0, celebrate: isBest && (bestBefore > 0 || game.score >= 10), unlocked };
  }

  function finish(title) {
    const r = endGame();
    let badge = '';
    if (r.isBest) badge = 'New best!';
    if (r.unlocked.length) badge = (badge ? badge + ' · ' : '') + 'Unlocked ' + r.unlocked.map(SK.itemName).join(', ');
    ui.setBest(currentBest());
    showMenu(title, 'Play again', { badge });
    if (r.celebrate) { confetti.fire(); A.sfx.newBest(); vibrate([20, 60, 20, 60, 40]); }
    if (r.unlocked.length) A.sfx.unlock();
  }

  // ---------- layout: the board fills the space it has, at device resolution ----------
  function fit() {
    const E = ui.el, cs = getComputedStyle(document.body);
    const showPad = !!settings.dpad;
    E.dpad.hidden = !showPad;
    const side = showPad && root.innerWidth > root.innerHeight * 1.15;
    E.app.classList.toggle('side', side);
    let availW = document.documentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let availH = root.innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - E.bar.offsetHeight;
    if (showPad) { if (side) availW -= E.dpad.offsetWidth + 12; else availH -= E.dpad.offsetHeight + 12; }
    const cell = Math.max(8, Math.min(availW / view.cols, availH / view.rows));
    const w = Math.floor(cell * view.cols), h = Math.floor(cell * view.rows);
    E.wrap.style.width = w + 'px';
    view.resize(w, h);
    if (ui.menuOpen() && E.pv.offsetParent) { const pw = E.pv.clientWidth || 200; pvView.resize(pw, Math.round(pw * 3 / 7)); }
    if (confetti.active) confetti.resize();
  }

  // ---------- drawing ----------
  const PV_TRACK = []; for (let x = 0; x < 7; x++) PV_TRACK.push({ x, y: 0 }); PV_TRACK.push({ x: 6, y: 1 });
  for (let x = 6; x >= 0; x--) PV_TRACK.push({ x, y: 2 }); PV_TRACK.push({ x: 0, y: 1 });
  const pvCells = [];
  const pvFx = { mouth: 0, blink: 0 };
  function drawPreview(t) {
    const st = t / baseMs(), hi = Math.floor(st), p = st - hi, L = PV_TRACK.length, at = i => PV_TRACK[((i % L) + L) % L];
    pvCells.length = 0; for (let i = 0; i < 6; i++) pvCells.push(at(hi - i));
    const g = pvView.begin();
    const c0 = pvCells[0], c1 = pvCells[1], c2 = pvCells[2];
    const a = U.lerpAng(U.angOf(c1.x - c2.x, c1.y - c2.y), U.angOf(c0.x - c1.x, c0.y - c1.y), U.ease(Math.min(1, p / 0.7)));
    pvFx.blink = fx.blink;
    pvSnake.draw(g, pvCells, at(hi - 6), p, CELL, a, settings, pvFx);
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
      let ms = stepMs();
      while (acc >= ms && state === 'play') { acc -= ms; game.step(); handleEvents(); ms = stepMs(); }
    }
    const ms = stepMs();
    const p = state === 'play' ? Math.min(acc / ms, 1) : 1;

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
    R.drawWalls(g, game, t);
    for (const ap of game.apples) R.drawApple(g, ap, t);
    const a = U.lerpAng(U.angOf(game.prevDir.x, game.prevDir.y), U.angOf(game.dir.x, game.dir.y), U.ease(Math.min(1, p / 0.7)));
    view.snake.draw(g, game.cells, game.prevTail, p, CELL, a, settings, fx);
    view.fx.draw(g, t, fdt);
    if (state === 'countdown') {
      const ce = t - countT, n = Math.min(2, Math.floor(ce / COUNT_MS));
      R.drawCountdown(g, game.cols, game.rows, String(3 - n), (ce - n * COUNT_MS) / COUNT_MS);
    }

    if (ui.menuOpen()) drawPreview(t);
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
      ui.setTab('stats', true);
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
      if (key === 'dpad') fit();
      if (key === 'speed' || key === 'ramp') ui.refresh();
    },
    click: () => A.sfx.click()
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

  newGame();
  showMenu('Snake', 'Play');
  requestAnimationFrame(t => { last = t; frame(t); });

  // Handy for debugging and automated checks.
  S.app = { get game() { return game; }, get state() { return state; }, settings, view, store, confetti, endGame, newGame };
})(window);
