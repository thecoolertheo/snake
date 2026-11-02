// App glue: state machine, fixed-timestep loop, and wiring between game, renderer, UI, input and audio.
(function (root) {
  'use strict';
  const S = root.Snake, U = S.util, R = S.render, SK = S.skins, A = S.audio, ui = S.ui;
  const CELL = R.CELL;
  const BOARDS = { s: [10, 9], m: [17, 15], l: [24, 21] };

  const data = S.store.load();
  const settings = data.settings;
  A.muted = settings.muted;

  // ---------- state ----------
  // menu → play ⇄ paused, play → dying → over → play
  let state = 'menu';
  let game = null;
  let acc = 0, last = 0, deathT = 0, gameTime = 0, mouth = 0;
  const eats = [];                          // gameTime of each recent eat, for the lump
  const bulges = new Float32Array(64);
  const fx = { dead: false, flash: 0, grey: 0, mouth: 0, bulges, nBulges: 0 };

  const cv = document.getElementById('c');
  const view = new R.View(cv, 17, 15);
  const pvView = new R.View(document.getElementById('pv'), 7, 3);
  const pvSnake = new R.SnakeDrawer();

  const stepMs = () => SK.SPEED_MS[settings.speed];
  const board = () => BOARDS[settings.board] || BOARDS.m;
  const currentBest = () => S.store.getBest(settings.mode, settings.board, settings.apples);

  function newGame() {
    const [cols, rows] = board();
    game = new S.Game({ cols, rows, apples: settings.apples, mode: settings.mode });
    if (view.cols !== cols || view.rows !== rows) { view.setBoard(cols, rows); fit(); }
    acc = 0; deathT = 0; mouth = 0; eats.length = 0; view.fx.clear();
    ui.setScore(0);
  }

  function showMenu(title, btn) {
    if (game.score > 0) S.store.submitBest(settings.mode, settings.board, settings.apples, game.score);
    const best = currentBest();
    ui.setBest(best);
    ui.showMenu(title, game.score, best, btn);
    fit();
  }

  function start() {
    if (state === 'play' || state === 'dying') return;
    if (state === 'over') newGame();
    if (state !== 'paused') A.sfx.start();
    state = 'play';
    ui.hideMenu();
  }
  function pause() { if (state === 'play') { state = 'paused'; showMenu('Paused', 'Resume'); } }

  function turn(nx, ny) {
    if (state === 'dying') return;
    if (state !== 'play') {
      const fresh = state !== 'paused';
      start();
      if (fresh) {   // a direction key from the menu starts the game and moves at once
        game.turn(nx, ny, 1); game.step(); acc = 0; A.sfx.turn(); handleEvents();
        return;
      }
    }
    if (game.turn(nx, ny, acc / stepMs())) A.sfx.turn();
    handleEvents();
  }

  function handleEvents() {
    const evs = game.events;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.type === 'eat') {
        ui.setScore(game.score, true);
        view.fx.burst(e.x * CELL + CELL / 2, e.y * CELL + CELL / 2, performance.now());
        eats.push(gameTime); mouth = 0; A.sfx.eat();
      } else if (e.type === 'die') {
        state = 'dying'; deathT = performance.now(); A.sfx.die();
        setTimeout(() => { if (state === 'dying') { state = 'over'; showMenu('Game over', 'Play again'); } }, 1100);
      } else if (e.type === 'win') {
        state = 'over'; showMenu('You win!', 'Play again');
      }
    }
    evs.length = 0;
  }

  // ---------- layout: the board fills the space it has, at device resolution ----------
  function fit() {
    const el = ui.el, cs = getComputedStyle(document.body);
    const availW = document.documentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = root.innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - el.bar.offsetHeight;
    const cell = Math.max(8, Math.min(availW / view.cols, availH / view.rows));
    const w = Math.floor(cell * view.cols), h = Math.floor(cell * view.rows);
    el.wrap.style.width = w + 'px';
    view.resize(w, h);
    if (ui.menuOpen()) { const pw = el.pv.clientWidth || 200; pvView.resize(pw, pw * 3 / 7); }
  }

  // ---------- drawing ----------
  const PV_TRACK = []; for (let x = 0; x < 7; x++) PV_TRACK.push({ x, y: 0 }); PV_TRACK.push({ x: 6, y: 1 });
  for (let x = 6; x >= 0; x--) PV_TRACK.push({ x, y: 2 }); PV_TRACK.push({ x: 0, y: 1 });
  const pvCells = [];
  const pvFx = { mouth: 0 };
  function drawPreview(t) {
    const st = t / stepMs(), hi = Math.floor(st), p = st - hi, L = PV_TRACK.length, at = i => PV_TRACK[((i % L) + L) % L];
    pvCells.length = 0; for (let i = 0; i < 6; i++) pvCells.push(at(hi - i));
    const g = pvView.begin();
    const c0 = pvCells[0], c1 = pvCells[1], c2 = pvCells[2];
    const a = U.lerpAng(U.angOf(c1.x - c2.x, c1.y - c2.y), U.angOf(c0.x - c1.x, c0.y - c1.y), U.ease(Math.min(1, p / 0.7)));
    pvSnake.draw(g, pvCells, at(hi - 6), p, CELL, a, settings, pvFx);
  }

  function frame(t) {
    const dt = Math.min(250, t - last); last = t;
    const ms = stepMs();
    // Fixed timestep: the game advances in whole steps; rendering interpolates between them.
    if (state === 'play') {
      acc += dt; gameTime += dt;
      while (acc >= ms && state === 'play') { acc -= ms; game.step(); handleEvents(); }
    }
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

    // Death: shake, flash, then the body greys out from head to tail.
    const dead = deathT > 0 && !game.won, e = t - deathT;
    fx.dead = dead;
    fx.flash = dead && e < 600 && ((e / 100 | 0) % 2 === 0) ? 0.75 : 0;
    fx.grey = dead && e > 600 ? Math.min(1, (e - 600) / 450) : 0;
    fx.mouth = mouth;
    const shake = dead && e < 350 ? (1 - e / 350) * 7 : 0;

    // The lump travels down the body after each apple.
    let w = 0;
    const lenPx = game.cells.length * CELL + CELL;
    for (let i = 0; i < eats.length; i++) {
      const d = (gameTime - eats[i]) / ms * CELL * 1.6;
      if (d < lenPx && w < bulges.length) { eats[w] = eats[i]; bulges[w++] = d; }
    }
    eats.length = w; fx.nBulges = w;

    const g = view.begin(shake ? (Math.random() * 2 - 1) * shake : 0, shake ? (Math.random() * 2 - 1) * shake : 0);
    for (const ap of game.apples) R.drawApple(g, ap, t);
    const a = U.lerpAng(U.angOf(game.prevDir.x, game.prevDir.y), U.angOf(game.dir.x, game.dir.y), U.ease(Math.min(1, p / 0.7)));
    view.snake.draw(g, game.cells, game.prevTail, p, CELL, a, settings, fx);
    view.fx.draw(g, t, fdt);

    if (ui.menuOpen()) drawPreview(t);
    requestAnimationFrame(frame);
  }

  // ---------- wiring ----------
  ui.init(settings, {
    play: () => { A.unlock(); start(); },
    pause: () => { A.unlock(); pause(); },
    settingsChanged: () => { A.muted = settings.muted; S.store.save(); },
    click: () => A.sfx.click()
  });
  S.input.init({
    dir: turn,
    togglePause: () => { if (state === 'play') pause(); else if (state === 'paused') start(); },
    confirm: start,
    anyInput: () => A.unlock(),
    menuOpen: ui.menuOpen
  }, cv);

  // Pause when the tab is hidden; reset the clock when it comes back so there's no time jump.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(); else last = performance.now();
  });
  root.addEventListener('resize', fit);
  if (root.ResizeObserver) new ResizeObserver(fit).observe(document.documentElement);

  newGame();
  ui.setBest(currentBest());
  showMenu('Snake', 'Play');
  fit();
  requestAnimationFrame(t => { last = t; frame(t); });

  // Handy for debugging from the console.
  S.app = { get game() { return game; }, get state() { return state; }, settings, view };
})(window);
