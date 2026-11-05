// App glue: state machine, fixed-timestep loop, and wiring between game, renderer, UI, input and audio.
(function (root) {
  'use strict';
  const S = root.Snake, U = S.util, R = S.render, SK = S.skins, A = S.audio, ui = S.ui, store = S.store, D = S.daily;
  const CELL = R.CELL;
  const BOARDS = { s: [10, 9], m: [17, 15], l: [24, 21] };   // 'f' (fill screen) is worked out from the screen
  const GAME_NAME = 'Snake Plus';
  const COUNT_MS = 420;
  const AUTO_DEATH_MS = 650;   // how long a crash plays out when a new game starts by itself
  const XP_APPLE = 10, XP_GAME = 15, XP_BEST = 50;
  const ROUNDS_TO_WIN = 3;       // two-player: first to this many rounds takes the match
  // Trails: a couple of particles from the tail end on every step.
  function emitTrail(v, g) {
    const name = SK.TRAILS[settings.trail]; if (!name || name === 'None') return;
    const T = SK.TRAIL_STYLES[name], tl = g.cells[g.cells.length - 1], now = performance.now();
    v.fx.trail(tl.x * CELL + CELL / 2, tl.y * CELL + CELL / 2, now, T[0], T[1]);
    if (Math.random() < 0.5) v.fx.trail(tl.x * CELL + CELL / 2, tl.y * CELL + CELL / 2, now, T[0], T[1]);
  }
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
  // Accessibility settings (and your device's own reduced motion setting).
  function applyAccess() {
    const on = (name, v) => document.documentElement.classList.toggle(name, !!v);
    R.reduced = !!(rm && rm.matches) || !!settings.a11yCalm;
    R.safe = !!settings.a11ySafe; R.contrast = !!settings.a11yContrast;
    on('a-calm', settings.a11yCalm); on('a-contrast', settings.a11yContrast); on('a-text', settings.a11yText);
  }
  applyAccess();
  if (rm && rm.addEventListener) rm.addEventListener('change', applyAccess);

  // ---------- state ----------
  // menu → countdown → play ⇄ paused, play → dying → over → countdown …
  let state = 'menu';
  let game = null, pendingNew = false;
  let acc = 0, last = 0, deathT = 0, gameTime = 0;
  let crashing = false, runEnd = '';
  let countT = 0, countN = -1;
  let bestBefore = 0, passedBest = false;
  let blinkT = -1e9, nextBlink = 2000;
  // What kind of game this is. solo: your own setup. daily: today's challenge. duel: two players, one screen.
  let pick = settings.duel ? 'duel' : 'solo', run = { kind: 'solo' }, match = null, foe = null, duelTold = false;
  const basePick = () => (settings.duel ? 'duel' : 'solo');
  if (!S.MODE[settings.duelMode]) settings.duelMode = 'classic';
  // Everything needed to animate one snake. The head runs on into whatever it hit (reach), and
  // the crash only happens when it gets there. eats = gameTime of recent apples, for the lump.
  const newPlayer = () => {
    const bulges = new Float32Array(64);
    return { g: null, skin: settings, bar: new R.HungerBar(), eats: [], reach: 0, reachTo: 0, reachX: 0, reachY: 0, mouth: 0, squashT: -1e9, lastDir: null,
      fx: { dead: false, flash: 0, grey: 0, mouth: 0, bulges, nBulges: 0, blink: 0, squash: 0, reachX: 0, reachY: 0 } };
  };
  const me = newPlayer(), fx = me.fx, players = [me];

  const cv = $('c');
  const view = new R.View(cv, 17, 15, true);
  const PV_COLS = 10, PV_ROWS = 4;
  const pvView = new R.View($('pv'), PV_COLS, PV_ROWS, true);
  const pvSnake = new R.SnakeDrawer();
  const pvAmbient = new R.Ambient();
  const pvHunger = new R.HungerBar(), hunger = me.bar;
  const confetti = new R.Confetti($('confetti'));
  const ambient = new R.Ambient();
  me.drawer = view.snake;
  const rival = newPlayer(); rival.drawer = new R.SnakeDrawer();
  const lights = [[0, 0], [0, 0]];   // two-player Dark: where each head is
  const liveUnlocked = [];   // rewards unlocked during the current game
  let liveLevel = 0;         // level reached during the current game (0 = no level-up)
  let liveCheckT = 0;

  // The menu's accent colour follows your snake: its colour, or the main colour of its pattern.
  function lookRgb() {
    const pat = SK.PATTERNS[settings.pattern], stops = SK.stopsFor(settings);
    return stops ? stops[1] : SK.FIXED_BANDS[pat] ? SK.FIXED_BANDS[pat][0] : U.hexRgb(SK.colorHex(settings));
  }
  function applyAccent() {
    const c = lookRgb();
    const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255, st = document.documentElement.style;
    st.setProperty('--mode-accent', U.rgb(c));
    st.setProperty('--accent-glow', 'rgba(' + c.join(',') + ',.16)');
    st.setProperty('--mode-ink', lum > 0.62 ? '#0f1512' : '#ffffff');   // readable text/knobs on top of the accent
  }

  // Each mode has its own look: board colours + ambient effect, and an accent for the menu.
  function applyTheme() {
    const st = document.documentElement.style;
    const T = view.setTheme(game ? game.mode : settings.mode, settings.boardSkin); pvTheme();
    st.setProperty('--mode-glow', T.glow);
    if (game) ambient.reset(T.amb, game.cols, game.rows);
  }

  const baseMs = () => SK.SPEED_MS[settings.speed];
  const gameMs = () => SK.SPEED_MS[run.spec ? run.spec.speed : settings.speed];   // the Daily Challenge sets its own speed
  // Optional ramp: 1.5% faster per apple, never faster than 60% of the base interval.
  // Turbo mode: 3% faster per point, down to 45% of the base interval.
  const stepMs = () => {
    if (!game) return baseMs();
    const score = foe ? Math.max(game.score, foe.g.score) : game.score;   // two-player: both snakes follow whoever is ahead
    if (game.rules.turbo) return gameMs() * Math.max(0.45, Math.pow(0.97, score));
    return gameMs() * ((run.spec ? run.spec.ramp : settings.ramp) ? Math.max(0.6, Math.pow(0.985, score)) : 1);
  };
  // Space the board can use, in CSS pixels (after the bar, padding and D-pad).
  function available() {
    const E = ui.el, cs = getComputedStyle(document.body);
    document.documentElement.classList.toggle('full', settings.board === 'f' && !run.fixed);
    const showPad = !!settings.dpad && !foe;   // one D-pad can't steer two snakes: both players swipe
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
  // What your best score is filed under. Each Mixer combination has its own.
  const bestId = () => (settings.mode === 'mix' ? S.mixKey(settings.mix) : settings.mode);
  const mixOf = id => (id === 'mix' ? settings.mix : undefined);
  const currentBest = () => {
    if (run.kind === 'duel') return match.wins[1];
    if (run.kind === 'daily') return data.daily.days[run.spec.key] || 0;
    return store.getBest(bestId(), settings.board, settings.apples);
  };
  // Only after the player has interacted (browsers block it otherwise and log a warning).
  const vibrate = p => {
    const ua = navigator.userActivation;
    if (settings.vibrate && navigator.vibrate && (!ua || ua.hasBeenActive)) try { navigator.vibrate(p); } catch (e) {}
  };

  // Player 2 wears a plain colour as far from player 1's look as possible, so you can always tell them apart.
  function rivalLook() {
    const mine = lookRgb(), far = c => { const o = U.hexRgb(c[1]); return (o[0] - mine[0]) ** 2 + (o[1] - mine[1]) ** 2 + (o[2] - mine[2]) ** 2; };
    const best = ['Orange', 'Blue', 'Pink', 'Yellow', 'Teal'].map(n => SK.COLORS.find(c => c[0] === n)).sort((a, b) => far(b) - far(a))[0];
    // Colourblind-friendly: stripes as well, so the two snakes differ by more than colour.
    return Object.assign({}, settings, { color: SK.COLORS.indexOf(best), pattern: settings.a11ySafe ? SK.PATTERNS.indexOf('Stripes') : 0, customColor: null, customGrad: null, trail: 0, hat: 0 });
  }
  function resetPlayer(q, g) {
    q.g = g; q.bar.reset(); q.lastDir = g.dir; q.reach = q.reachTo = 0; q.mouth = 0; q.eats.length = 0; q.fx.reachX = q.fx.reachY = 0;
  }
  function newGame() {
    foe = null;
    let cols, rows;
    if (pick === 'daily') {
      const spec = D.challenge(D.dayKey());
      run = { kind: 'daily', spec, fixed: true, scored: !(spec.key in data.daily.days) };
      cols = spec.cols; rows = spec.rows;
      game = new S.Game({ cols, rows, apples: spec.apples, mode: spec.mode, seed: spec.seed, blocks: spec.blocks, record: run.scored });   // edge grace is always on, so scores compare
    } else if (pick === 'duel') {
      const rules = String(mixOf(settings.duelMode));
      if (!match || match.mode !== settings.duelMode || match.rules !== rules) match = { mode: settings.duelMode, rules, wins: [0, 0] };
      if (match.wins.some(n => n >= ROUNDS_TO_WIN)) match.wins = [0, 0];
      run = { kind: 'duel' };
      [cols, rows] = board();
      const o = { cols, rows, apples: settings.apples, mode: match.mode, mix: mixOf(match.mode), grace: false, waitApples: true };
      const edge = Math.floor(cols / 4), top = Math.floor(rows / 3), bottom = rows - 1 - top;
      game = new S.Game(Object.assign({ start: { x: edge, y: top, dx: 1 } }, o));
      const g2 = new S.Game(Object.assign({ start: { x: cols - 1 - edge, y: bottom, dx: -1 }, share: game }, o));
      game.fillApples();
      foe = rival; rival.skin = rivalLook(); resetPlayer(rival, g2);
      const css = document.documentElement.style;
      css.setProperty('--p1', U.rgb(lookRgb())); css.setProperty('--p2', SK.colorHex(rival.skin));
    } else {
      run = { kind: 'solo' };
      [cols, rows] = board();
      game = new S.Game({ cols, rows, apples: settings.apples, mode: settings.mode, mix: mixOf(settings.mode), grace: settings.grace });
    }
    players.length = 0; players.push(me); if (foe) players.push(foe);
    resetPlayer(me, game);
    if (view.cols !== cols || view.rows !== rows) { view.setBoard(cols, rows); fit(); }
    acc = 0; deathT = 0; gameTime = 0; crashing = false; view.fx.clear(); R.resetWalls(); hunger.reset();
    pendingNew = false;
    bestBefore = currentBest(); passedBest = false;
    ui.setDuel(!!foe);
    ui.setScore(foe ? match.wins[0] : 0); ui.setBest(bestBefore);
    ui.setRunTag(run.kind === 'daily' ? (run.scored ? 'Daily' : 'Daily practice') : foe ? duelTag() : '');
    liveUnlocked.length = 0; liveLevel = 0;
    applyTheme(); fit();
  }

  // The bar's mode label. In a Peaceful race it also keeps the apple count.
  const duelTag = () => S.MODE[match.mode].name + (game.rules.ghost ? ' ' + game.score + '–' + foe.g.score + ' of ' + S.PEACE_GOAL : '');

  // Starts a Daily Challenge from the menu.
  function launch(kind) {
    if (state === 'dying' || state === 'play' || state === 'countdown') return;
    if (state === 'paused' && game.steps > 0) endGame();
    A.unlock(); applyAudio();
    pick = kind; newGame(); state = 'menu'; ui.closeCard(); start();
  }

  function showMenu(title, btn, extra) {
    A.set({ duck: true }); keepAwake(false);
    const labels = foe ? ['Player 1', 'Player 2'] : run.kind === 'daily' ? ['Score', 'Today'] : null;
    ui.showMenu(Object.assign({ title, score: foe ? match.wins[0] : game.score, best: currentBest(), btn, labels }, extra || {}));
    fit();
  }

  function start() {
    if (state === 'play' || state === 'countdown' || state === 'dying') return;
    const resuming = state === 'paused' && !pendingNew;
    if (state === 'paused' && pendingNew && game.steps > 0) endGame();      // settings changed mid-game: count it and start fresh
    if (state === 'over' || pendingNew) newGame();
    if (settings.countdown || resuming) { state = 'countdown'; countT = performance.now(); countN = -1; }
    else { state = 'play'; acc = 0; A.sfx.start(); }
    ui.hideMenu(); A.set({ duck: false }); keepAwake(true);
    if (foe && !duelTold) { duelTold = true; ui.note('Player 1: WASD, or swipe ' + ui.sideNames()[0], 'Player 2: arrow keys, or swipe ' + ui.sideNames()[1]); }
  }
  // Stops the screen turning off during a game, on browsers that allow it.
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && settings.wake && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      else if (!on && wakeLock) { const w = wakeLock; wakeLock = null; await w.release(); }
    } catch (e) {}
  }
  function pause() {
    if (state !== 'play' && state !== 'countdown') return;
    state = 'paused'; store.save();
    showMenu('Paused', 'Resume', { compact: true, missed: heldMissed });
    heldMissed = null;
  }

  function turn(nx, ny, who) {
    if (state === 'dying') return;
    if (ui.pageOpen() && ui.tab !== 'home') return;   // arrow keys don't start a game from Modes, Settings, ...
    const steer = () => (foe && who ? foe.g : game);    // start() can make a new game, so look it up each time
    if (state === 'menu' || state === 'over' || state === 'paused') {
      start();   // a direction from the menu starts the countdown and sets your first move
      if (state === 'countdown' && steer().turn(nx, ny, 1)) A.sfx.turn();
      return;
    }
    if (state === 'countdown' || foe) { if (steer().turn(nx, ny, 1)) A.sfx.turn(); return; }   // two-player never redoes a move: both snakes step together
    if (game.turn(nx, ny, acc / stepMs())) A.sfx.turn();
    handleEvents();
  }

  // How far the head has to travel from the middle of its cell to touch what's in cell (x, y), in board units.
  function gapTo(g, x, y, meet) {
    const head = g.cells[0];
    if (x === head.x && y === head.y) return 0;   // starved: nothing to run into
    const r = CELL * 0.382;                       // the head's radius
    if (meet) return CELL - r + 2;                // two heads meeting in the tile between them
    if (!g.inBounds(x, y)) return CELL / 2 - r + 3;                    // the edge of the board, pressed in a little
    return (g.wall[g.idx(x, y)] === 2 ? CELL * 0.575 : CELL * 0.64) - r + 2;   // a wall block, or a snake's body
  }
  function aimReach(q, x, y, meet) {
    if (q.reachX !== q.g.dir.x || q.reachY !== q.g.dir.y) q.reach = 0;   // turned on the way in: start again from there
    q.reachTo = gapTo(q.g, x, y, meet); q.reachX = q.g.dir.x; q.reachY = q.g.dir.y;
  }
  const reachGoal = q => (q.g.inGrace || (!q.g.alive && !q.g.won) ? q.reachTo : 0);
  const autoNext = () => settings.autoRestart && run.kind === 'solo';   // a Daily or a two-player round always ends on its card
  function crash(now) {
    crashing = false; deathT = now; for (const q of players) q.squashT = now; A.sfx.die(); vibrate([40, 40, 90]);
    setTimeout(() => { if (state === 'dying') { state = 'over'; finish('Game over'); } }, autoNext() ? AUTO_DEATH_MS : 1100);
  }

  function handleEvents() {
    if (game.dir !== me.lastDir) { me.lastDir = game.dir; me.squashT = performance.now(); }
    const evs = game.events, now = performance.now();
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i], cx = e.x * CELL + CELL / 2, cy = e.y * CELL + CELL / 2;
      switch (e.type) {
        case 'eat': {
          ui.setScore(game.score, true); hunger.fed(now);
          if (e.kind === 'gold') { view.fx.burst(cx, cy, now, ['#ffc83d', '#fff6c4', '#ff9838'], 22); A.sfx.gold(); }
          else if (e.kind !== 'portal') {
            const B = SK.BURST_STYLES[SK.BURSTS[settings.burst]] || SK.BURST_STYLES.Classic;
            view.fx.burst(cx, cy, now, B.colors, B.count || (B.shape === 'dot' ? 14 : 16), B.shape);
          }
          for (let k = 0; k < (e.worth || 1); k++) me.eats.push(gameTime - k * stepMs() * 0.6);
          me.mouth = 0; A.sfx.eat(); vibrate(e.kind === 'gold' ? [12, 30, 12] : 12);
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
        case 'shrink': view.fx.burst(cx, cy, now, ['#8a9a90', '#5a6a60', '#c0c8c4'], 5); hunger.hit(now); break;
        case 'wall': A.sfx.wall(); break;
        case 'grace': me.squashT = now; aimReach(me, e.x, e.y); A.sfx.grace(); vibrate(8); break;
        case 'expire': view.fx.burst(cx, cy, now, ['#ffc83d', '#fff6c4', '#a86f00'], 6); break;
        case 'die':
          state = 'dying'; crashing = true; aimReach(me, e.x, e.y);
          runEnd = e.x === game.cells[0].x && e.y === game.cells[0].y ? 'You starved' : !game.inBounds(e.x, e.y) ? 'You hit the edge' : game.wall[game.idx(e.x, e.y)] === 2 ? 'You hit a wall' : 'You ran into yourself';
          break;
        case 'win': state = 'over'; finish('You win!'); break;
      }
    }
    evs.length = 0;
  }

  // Counts finished missions and any weekly bonus. Returns the XP they're worth.
  function payout(list) {
    let xp = 0;
    for (const m of list) { xp += m.xp; if (m.bonus) data.stats.perfect++; else data.stats.missions++; }
    return xp;
  }

  // One step for both snakes in a two-player game, and everything that came out of it.
  function duelTick() {
    S.duelStep(game, foe.g);
    const now = performance.now();
    for (const q of players) {
      emitTrail(view, q.g);
      if (q.g.dir !== q.lastDir) { q.lastDir = q.g.dir; q.squashT = now; }
      for (const e of q.g.events) {
        const cx = e.x * CELL + CELL / 2, cy = e.y * CELL + CELL / 2;
        if (e.type === 'eat') {
          if (e.kind === 'gold') { view.fx.burst(cx, cy, now, ['#ffc83d', '#fff6c4', '#ff9838'], 22); A.sfx.gold(); }
          else if (e.kind !== 'portal') {
            const B = SK.BURST_STYLES[SK.BURSTS[q.skin.burst]] || SK.BURST_STYLES.Classic;
            view.fx.burst(cx, cy, now, B.colors, B.count || (B.shape === 'dot' ? 14 : 16), B.shape);
          }
          for (let k = 0; k < (e.worth || 1); k++) q.eats.push(gameTime - k * stepMs() * 0.6);
          q.bar.fed(now); q.mouth = 0; A.sfx.eat(); vibrate(12);
        } else if (e.type === 'portal') {
          const c = R.PORTAL_COLORS[e.pair % R.PORTAL_COLORS.length];
          view.fx.ring(cx, cy, now, c); view.fx.burst(e.tx * CELL + CELL / 2, e.ty * CELL + CELL / 2, now, [c, '#ffffff', c], 10); A.sfx.portal();
        } else if (e.type === 'poison') { view.fx.burst(cx, cy, now, ['#9b5cf0', '#e2c2ff', '#4a1f86']); A.sfx.poison(); }
        else if (e.type === 'shrink') { view.fx.burst(cx, cy, now, ['#8a9a90', '#5a6a60', '#c0c8c4'], 5); q.bar.hit(now); }
        else if (e.type === 'expire') view.fx.burst(cx, cy, now, ['#ffc83d', '#fff6c4', '#a86f00'], 6);
        else if (e.type === 'wall') A.sfx.wall();
        else if (e.type === 'die') aimReach(q, e.x, e.y, e.meet);
      }
      q.g.events.length = 0;
    }
    if (game.rules.ghost) {   // Peaceful: nobody crashes, so the round ends when someone reaches the apple goal
      ui.setRunTag(duelTag());
      const w = S.duelRace(game, foe.g);
      if (w !== null) { state = 'over'; A.sfx.passBest(); finishRound(w); }
      return;
    }
    if (!game.alive || !foe.g.alive) { state = 'dying'; crashing = true; }
  }

  function finishRound(race) {
    const out = q => !q.g.alive && !q.g.won, a = out(me), b = out(foe), w = race !== undefined ? race : a === b ? -1 : a ? 1 : 0;
    if (w >= 0) match.wins[w]++;
    const done = match.wins.some(n => n >= ROUNDS_TO_WIN), who = 'Player ' + (w + 1);
    ui.setScore(match.wins[0]); ui.setBest(match.wins[1]);
    ui.say(done ? who + ' wins the match' : w < 0 ? 'Draw' : who + ' takes the round. ' + match.wins[0] + ' to ' + match.wins[1]);
    showMenu(done ? who + ' wins!' : w < 0 ? 'Draw' : who + ' takes the round', done ? 'Rematch' : 'Next round',
      { over: true, badge: done ? '' : 'First to ' + ROUNDS_TO_WIN + ' rounds wins' });
    if (done) { confetti.fire(); A.sfx.newBest(); }
  }

  // Records the finished game: stats, best score, unlocks. Returns what changed.
  // Two-player games stay out of it: only one of the two would be you.
  function endGame() {
    if (foe) return { isBest: false, celebrate: false, unlocked: [], missions: [], dailyXp: 0 };
    const s = data.stats, daily = run.kind === 'daily';
    s.games++; s.apples += game.eaten; s.longest = Math.max(s.longest, game.maxLen);
    let isBest = false, dailyXp = 0;
    const scored = daily && run.scored;
    if (scored) {   // the first go of the day is the one that counts; replays are practice
      data.daily.days[run.spec.key] = game.score; run.scored = false;
      dailyXp = D.dailyXp(D.streak(data.daily.days, run.spec.key));
    } else if (!daily) isBest = store.submitBest(bestId(), settings.board, settings.apples, game.score);
    const missions = D.record(data, { mode: game.mode, apples: game.eaten, ms: gameTime, score: game.score, length: game.maxLen, daily: scored });
    s.xp += game.eaten * XP_APPLE + XP_GAME + (isBest && game.score > 0 ? XP_BEST : 0) + dailyXp + payout(missions);
    if (scored) S.board.record({ day: run.spec.key, score: game.score, ticks: game.ticks, log: game.log, sent: false });
    ui.lastResult = { daily, score: game.score, mode: ui.modeName(game.mode, game.mix), isBest: isBest && game.score > 0, day: daily ? run.spec.key : '',
      ms: gameTime, length: game.maxLen, apples: game.eaten, turns: game.turns, why: game.won ? 'You filled the board!' : game.alive ? 'You stopped here' : runEnd,
      map: { cols: game.cols, rows: game.rows, visits: game.visits.slice(), wall: game.wall.slice(), cells: game.cells.map(c => ({ x: c.x, y: c.y })) } };
    const unlocked = checkUnlocks();
    store.save();
    return { isBest: isBest && game.score > 0, celebrate: isBest && (bestBefore > 0 || game.score >= 10), unlocked, missions, dailyXp };
  }

  // Unlocks anything whose milestone has been reached. Returns the newly unlocked rewards.
  function checkUnlocks() {
    const out = [];
    for (let more = true; more;) {   // repeat: unlocking things moves the Collector path forward too
      more = false; const p = store.progress();
      for (const u of SK.UNLOCKS) if (!store.isUnlocked(u.id) && u.value(p) >= u.goal) { data.unlocked.push(u.id); out.push(u); more = true; }
    }
    return out;
  }
  // XP arrived in a later version: give existing players credit for what they've already done.
  if (!data.stats.xpInit) { data.stats.xp = Math.max(data.stats.xp, data.stats.apples * XP_APPLE + data.stats.games * XP_GAME); data.stats.xpInit = true; store.save(); }
  let shownLevel = SK.levelOf(data.stats.xp);
  if (checkUnlocks().length) store.save();   // goals can change between versions
  D.ensureWeek(data);
  if (!S.MODE[settings.mode] || !modeOpen(settings.mode)) settings.mode = 'classic';
  settings.mix = S.mixClean(settings.mix);
  if (!settings.duel) settings.mix = settings.mix.filter(modeOpen);   // locked rules are only open with two players

  // Unlock rewards the moment you reach them mid-game (toast + a burst of confetti).
  function liveCheck() {
    if (!game || state !== 'play' || foe) return;
    const b = store.progress(), solo = run.kind === 'solo' && settings.mode !== 'mix', mode = solo ? settings.mode : null, score = solo ? game.score : 0;   // a Daily score isn't a best in that mode
    const liveXp = data.stats.xp + game.eaten * XP_APPLE, level = SK.levelOf(liveXp);
    const pops = settings.unlockToasts !== false;   // off: stay quiet, show it all after the game instead
    if (level > shownLevel) {   // level up mid-game
      shownLevel = level; liveLevel = level;
      if (pops) {
        const r = ui.toastLevel(level, SK.titleOf(level));
        A.sfx.newBest(); vibrate([15, 40, 15]);
        if (r) confetti.pop(r.left + r.width / 2, r.top + r.height / 2, 50);
      }
    }
    const p = { ...b, level, apples: b.apples + game.eaten, longest: Math.max(b.longest, game.cells.length),
      bestAny: Math.max(b.bestAny, score), bestMode: m => Math.max(b.bestMode(m), m === mode ? score : 0) };
    let changed = false;
    for (const u of SK.UNLOCKS) {
      if (store.isUnlocked(u.id) || u.value(p) < u.goal) continue;
      data.unlocked.push(u.id); liveUnlocked.push(u); changed = true; if (u.id !== 'p-gradient') p.collected++;
      if (!pops) continue;
      const r = ui.toast(u);
      A.sfx.unlock(); vibrate([15, 40, 15]);
      if (r) confetti.pop(r.left + r.width / 2, r.top + r.height / 2, 40);
    }
    if (changed) store.save();
  }

  // "Keep playing after a crash": everything the game over card would say becomes a pop-up, and a new game starts.
  // With pop-ups off, unlocks wait on the pause menu, the only way out in this mode.
  let heldMissed = null;
  function keepGoing(r, lateUnlocks) {
    const quiet = settings.unlockToasts === false, score = game.score, lvl = SK.levelOf(data.stats.xp);
    let lvlUp = 0;
    if (lvl > shownLevel) { shownLevel = lvl; lvlUp = lvl; }
    if (quiet) {
      if (r.unlocked.length || liveLevel || lvlUp) {
        heldMissed = heldMissed || { items: [], level: 0 };
        heldMissed.items.push(...r.unlocked); heldMissed.level = Math.max(heldMissed.level, liveLevel, lvlUp);
      }
    } else {
      if (lvlUp) { const b = ui.toastLevel(lvlUp, SK.titleOf(lvlUp)); A.sfx.newBest(); if (b) confetti.pop(b.left + b.width / 2, b.top + b.height / 2, 50); }
      for (const u of lateUnlocks) { const b = ui.toast(u); A.sfx.unlock(); if (b) confetti.pop(b.left + b.width / 2, b.top + b.height / 2, 40); }
    }
    if (r.isBest) ui.toastBest(score);
    if (!quiet) for (const m of r.missions) ui.toastMission(m);
    if (r.celebrate) { confetti.fire(); A.sfx.newBest(); vibrate([20, 60, 20, 60, 40]); }
    newGame(); state = 'menu'; start();
  }
  function finish(title) {
    if (foe) return finishRound();
    const r = endGame(), lateUnlocks = r.unlocked;
    r.unlocked = liveUnlocked.concat(r.unlocked);
    if (autoNext()) return keepGoing(r, lateUnlocks);
    let badge = '';
    if (r.isBest) badge = 'New best!';
    if (r.dailyXp) { const n = D.streak(data.daily.days, run.spec.key); badge = 'Daily done · ' + n + ' day streak · +' + r.dailyXp + ' XP'; title = 'Daily done'; }
    for (const m of r.missions) { badge = (badge ? badge + ' · ' : '') + (m.bonus ? 'Perfect week! +' : 'Mission done +') + m.xp + ' XP'; ui.renderDaily(); }
    const lvl = SK.levelOf(data.stats.xp);
    let lvlUp = 0;
    if (lvl > shownLevel) { shownLevel = lvl; lvlUp = lvl; badge = (badge ? badge + ' · ' : '') + 'Level ' + lvl + '!'; A.sfx.newBest(); }
    if (r.unlocked.length) badge = (badge ? badge + ' · ' : '') + (r.unlocked.length > 2 ? 'Unlocked ' + r.unlocked.length + ' rewards' : 'Unlocked ' + r.unlocked.map(SK.itemName).join(', '));
    ui.setBest(currentBest());
    // Pop-ups off: everything you unlocked (and any level-up) waits for you here.
    const quiet = settings.unlockToasts === false;
    const missed = quiet && (r.unlocked.length || liveLevel || lvlUp) ? { items: r.unlocked, level: Math.max(liveLevel, lvlUp) } : null;
    if (missed) badge = r.isBest ? 'New best!' : '';   // the card already lists unlocks and level-ups
    ui.say(title + '. Score ' + game.score + '.' + (badge ? ' ' + badge : ''));
    showMenu(title, run.kind === 'daily' ? 'Practice' : 'Play again', { over: true, badge, next: ui.nextGoal(), missed });
    if (missed) { A.sfx.unlock(); const box = document.getElementById('missed').getBoundingClientRect(); confetti.pop(box.left + box.width / 2, box.top + 20, 36); }
    if (r.celebrate) { confetti.fire(); A.sfx.newBest(); vibrate([20, 60, 20, 60, 40]); }
    if (r.unlocked.length > liveUnlocked.length) A.sfx.unlock();   // end-of-game unlocks (e.g. games played)
  }

  // ---------- layout: the board fills the space it has, at device resolution ----------
  function fit() {
    const E = ui.el, a = available(), availW = a.w, availH = a.h;
    // A fill-screen board that no longer matches the screen (rotation, resize) is rebuilt,
    // but only between games.
    if (settings.board === 'f' && !run.fixed && game && (state === 'menu' || state === 'over')) {
      const [c, r] = board();
      if (c !== game.cols || r !== game.rows) { newGame(); return; }
    }
    const cell = Math.max(8, Math.min(availW / view.cols, availH / view.rows));
    const w = Math.floor(cell * view.cols), h = Math.floor(cell * view.rows);
    E.wrap.style.width = w + 'px';
    view.resize(w, h);
    ui.fitHome();
    if (ui.menuOpen() && E.pv.offsetParent) { const pw = E.pv.parentElement.clientWidth || 200; pvView.resize(pw, Math.round(pw * PV_ROWS / PV_COLS)); }
    if (confetti.active) confetti.resize();
  }

  // ---------- drawing ----------
  // ---------- menu preview: a little snake that plays by itself ----------
  // It heads for apples (avoiding moves that would trap it), wanders a bit, grows,
  // and once it fills ~40% of the mini board it shrinks back to 3 and starts over.
  const PV_MAX = Math.round(PV_COLS * PV_ROWS * 0.4);
  let pvGame = null, pvAcc = 0, pvShrinking = false, pvTrim = 0, pvShrinkT = 0;
  const pvEats = [], pvBulges = new Float32Array(16), pvTime = { t: 0 };
  const pvFx = { mouth: 0, blink: 0, bulges: pvBulges, nBulges: 0, squash: 0 };
  const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  // The preview plays the real mode: a locked mode tapped on the Modes page gets a try-out here too.
  let pvTry = null, pvTarget = null, pvHint = null;
  const pvModeId = () => pvTry || (settings.duel ? settings.duelMode : settings.mode);
  function pvTheme() { pvAmbient.reset(pvView.setTheme(pvModeId(), settings.boardSkin).amb, PV_COLS, PV_ROWS); }
  // With Two players on, a second snake plays too, on the same little board and in player 2's colours.
  let pvFoe = null, pvAvoid = -1;
  const pv2 = { drawer: new R.SnakeDrawer(), skin: settings, eats: [], trim: 0, bar: new R.HungerBar(), fx: { mouth: 0, blink: 0, bulges: new Float32Array(16), nBulges: 0, squash: 0 } };
  const pvWantsTwo = () => !!settings.duel && !pvTry;
  function pvNew() {
    const o = { cols: PV_COLS, rows: PV_ROWS, apples: settings.apples, mode: pvModeId(), mix: mixOf(pvModeId()), grace: false };
    pvFoe = null;
    if (pvWantsTwo()) {
      pvGame = new S.Game(Object.assign({ waitApples: true, start: { x: 2, y: 1, dx: 1 } }, o));
      pvFoe = new S.Game(Object.assign({ waitApples: true, start: { x: PV_COLS - 3, y: 2, dx: -1 }, share: pvGame }, o));
      pvGame.fillApples(); pv2.skin = rivalLook();
    } else pvGame = new S.Game(o);
    pvShrinking = false; pvTrim = 0; pv2.trim = 0; pvEats.length = 0; pv2.eats.length = 0; pv2.bar.reset(); pvHint = null; R.resetWalls(); pvHunger.reset(); pvGild(pvGame);
  }
  // Gold Rush: golden apples are rare in a real game, so show them often here.
  function pvGild(g) {
    if (!g.rules.gold) return;
    for (const a of g.apples) if (a.kind === 'apple' && !a.seen) { a.seen = 1; if (Math.random() < 0.6) { a.kind = 'gold'; a.until = g.steps + 24; } }
    else if (a.kind === 'portal' && !a.seen) {
      const b = g.apples.find(o => o !== a && o.kind === 'portal' && o.pair === a.pair), gild = Math.random() < 0.6;
      for (const z of [a, b]) if (z) { z.seen = 1; if (gild) { z.gold = true; z.until = g.steps + 24; } }
    }
  }
  // Tile index one step from (x, y), going round the edges in wrapping modes, or -1.
  function pvNext(g, x, y, d) {
    let nx = x + d.x, ny = y + d.y;
    if (!g.inBounds(nx, ny)) { if (!g.rules.wrap) return -1; nx = (nx + g.cols) % g.cols; ny = (ny + g.rows) % g.rows; }
    return g.idx(nx, ny);
  }
  // Can the snake step onto tile i? The tail tile is fine because it moves away.
  function pvOpen(g, i) {
    if (g.wall[i] || i === pvAvoid) return false;
    const x = i % g.cols, y = (i / g.cols) | 0, ai = g.appleAt(x, y);
    if (ai >= 0 && g.apples[ai] !== pvTarget && (g.apples[ai].kind === 'poison' || g.apples[ai].kind === 'portal')) return false;
    if (g.rules.ghost) return true;
    const t = g.cells[g.cells.length - 1];
    return g.occ[i] === 0 || (t.x === x && t.y === y && g.grow === 0);
  }
  // How many tiles can be reached from tile i: used to avoid trapping itself.
  function pvRoom(g, i) {
    const seen = new Uint8Array(g.cols * g.rows), q = [i]; seen[i] = 1; let n = 0;
    while (q.length) {
      const c = q.pop(), x = c % g.cols, y = (c / g.cols) | 0; n++;
      for (const d of DIRS4) { const k = pvNext(g, x, y, d); if (k >= 0 && !seen[k] && pvOpen(g, k)) { seen[k] = 1; q.push(k); } }
    }
    return n;
  }
  // First step of the shortest path to the target (breadth-first search), or null.
  function pvPathStep(g) {
    const a = pvTarget, h = g.cells[0]; if (!a) return null;
    const first = new Int8Array(g.cols * g.rows).fill(-1), start = g.idx(h.x, h.y), goal = g.idx(a.x, a.y), q = [start];
    first[start] = 4;
    for (let n = 0; n < q.length; n++) {
      const i = q[n];
      if (i === goal) return DIRS4[first[i]];
      for (let k = 0; k < 4; k++) {
        const j = pvNext(g, i % g.cols, (i / g.cols) | 0, DIRS4[k]);
        if (j >= 0 && first[j] < 0 && pvOpen(g, j)) { first[j] = i === start ? k : first[i]; q.push(j); }
      }
    }
    return null;
  }
  // What to go for. In Poison it bites a purple apple now and then, so you can see it shrink.
  function pvPick(g) {
    if (g.rules.poison && g.cells.length >= 6) { const b = g.apples.find(a => a.kind === 'poison'); if (b) return b; }
    const h = g.cells[0]; let best = null, bd = 1e9;
    for (const a of g.apples) {
      if (a.kind === 'poison') continue;
      const d = Math.abs(a.x - h.x) + Math.abs(a.y - h.y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  function pvChoose(g) {
    const h = g.cells[0], len = g.cells.length, safe = [];
    pvTarget = pvPick(g);
    for (const d of DIRS4) {
      if (d.x === -g.dir.x && d.y === -g.dir.y) continue;
      const i = pvNext(g, h.x, h.y, d);
      if (i >= 0 && pvOpen(g, i)) safe.push({ d, room: pvRoom(g, i) });
    }
    if (!safe.length) return null;
    const roomy = safe.filter(c => c.room >= len);
    const path = pvPathStep(g);
    // Hunger: dawdles until the meter is nearly full, so you can watch it fill.
    const eager = g.rules.hunger ? (g.hungerLevel() > 0.7 ? 0.95 : 0.1) : 0.75;
    if (path && Math.random() < eager) { const c = roomy.find(c => c.d.x === path.x && c.d.y === path.y); if (c) return c.d; }
    const pool = roomy.length ? roomy : safe.sort((a, b) => b.room - a.room).slice(0, 1);
    // Wander: usually keep going straight if that's fine, otherwise pick at random.
    const straight = pool.find(c => c.d.x === g.dir.x && c.d.y === g.dir.y);
    if (straight && Math.random() < 0.6) return straight.d;
    return pool[(Math.random() * pool.length) | 0].d;
  }
  function pvStep() {
    if (pvFoe) return pvStepTwo();
    const g = pvGame, d = pvChoose(g);
    if (!d) { pvNew(); return; }
    // Mirror flips every turn, so it swipes the opposite way; the arrow shows that swipe.
    const flip = g.rules.mirror ? -1 : 1;
    if (flip < 0 && (d.x !== g.dir.x || d.y !== g.dir.y)) pvHint = { x: -d.x, y: -d.y, t: performance.now() };
    g.turn(d.x * flip, d.y * flip, 1); g.step();
    if (!g.alive) { pvNew(); return; }
    emitTrail(pvView, g);
    pvEffects(g, pvEats, pvHunger);
    pvGild(g);
    if (g.wallCount >= 7) { pvNew(); return; }   // the mini board fills up fast: clear it and go again
    if (g.cells.length >= PV_MAX && !pvShrinking) { pvShrinking = true; pvShrinkT = 0; }
  }
  // Both snakes choose, then step together. The second steers clear of the tile the first is heading for.
  function pvStepTwo() {
    const a = pvGame, b = pvFoe, da = pvChoose(a);
    if (!da) { pvNew(); return; }
    const flip = a.rules.mirror ? -1 : 1;
    pvAvoid = a.rules.ghost ? -1 : pvNext(a, a.cells[0].x, a.cells[0].y, da);
    const db = pvChoose(b);
    pvAvoid = -1;
    if (!db) { pvNew(); return; }
    a.turn(da.x * flip, da.y * flip, 1); b.turn(db.x * flip, db.y * flip, 1);
    S.duelStep(a, b);
    if (!a.alive || !b.alive) { pvNew(); return; }
    emitTrail(pvView, a); emitTrail(pvView, b);
    pvEffects(a, pvEats, pvHunger); pvEffects(b, pv2.eats, pv2.bar);
    pvGild(a);
    if (a.wallCount + b.wallCount >= 7) { pvNew(); return; }
    if (a.cells.length + b.cells.length >= PV_MAX + 6 && !pvShrinking) { pvShrinking = true; pvShrinkT = 0; }
  }
  function pvEffects(g, eaten, bar) {
    const now = performance.now();
    for (const e of g.events) {
      const cx = e.x * CELL + CELL / 2, cy = e.y * CELL + CELL / 2;
      if (e.type === 'eat') {
        bar.fed(now);
        for (let k = 0; k < (e.worth || 1); k++) eaten.push(pvTime.t - k * baseMs() * 0.6);
        if (e.kind === 'gold') pvView.fx.burst(cx, cy, now, ['#ffc83d', '#fff6c4', '#ff9838'], 22);
        else if (e.kind !== 'portal') {
          const B = SK.BURST_STYLES[SK.BURSTS[settings.burst]] || SK.BURST_STYLES.Classic;
          pvView.fx.burst(cx, cy, now, B.colors, B.count || 14, B.shape);
        }
      } else if (e.type === 'portal') {
        const c = R.PORTAL_COLORS[e.pair % R.PORTAL_COLORS.length];
        pvView.fx.ring(cx, cy, now, c); pvView.fx.burst(e.tx * CELL + CELL / 2, e.ty * CELL + CELL / 2, now, [c, '#ffffff', c], 10);
      } else if (e.type === 'poison') pvView.fx.burst(cx, cy, now, ['#9b5cf0', '#e2c2ff', '#4a1f86']);
      else if (e.type === 'shrink') { pvView.fx.burst(cx, cy, now, ['#8a9a90', '#5a6a60', '#c0c8c4'], 5); bar.hit(now); }
      else if (e.type === 'expire') pvView.fx.burst(cx, cy, now, ['#ffc83d', '#fff6c4', '#a86f00'], 6);
    }
    g.events.length = 0;
  }
  // Too long for the mini board: the tail reels in smoothly, quick at first and easing off as it gets short.
  function pvReel(g, trim, dt) {
    trim += dt / 1000 * (3 + (g.cells.length - 3) * 0.75) * Math.min(1, pvShrinkT / 350);
    while (g.cells.length > 3) {
      // Going off one edge and back on the other adds a cell's length of path, so that stretch counts double.
      const next = g.cells[g.cells.length - 2], size = next.ja && (next.jb.x !== next.x || next.jb.y !== next.y) ? 2 : 1;
      if (trim < size) return trim;
      trim -= size;
      g.trimTail();
    }
    return 0;
  }
  function pvShrink(g, dt) {
    pvShrinkT += dt;
    pvTrim = pvReel(g, pvTrim, dt);
    if (pvFoe) pv2.trim = pvReel(pvFoe, pv2.trim, dt);
    if (g.cells.length <= 3 && (!pvFoe || pvFoe.cells.length <= 3)) { pvShrinking = false; pvTrim = pv2.trim = 0; g.score = 0; if (pvFoe) pvFoe.score = 0; }
  }
  const pvStepMs = g => baseMs() * (g.rules.turbo ? Math.max(0.35, 0.7 * Math.pow(0.92, g.score)) : 1);
  function drawPreview(t, dt) {
    if (!pvGame || pvGame.mode !== pvModeId() || pvGame.appleCount !== settings.apples || !!pvFoe !== pvWantsTwo() || (pvGame.mix && String(pvGame.mix) !== String(S.mixClean(settings.mix)))) pvNew();
    pvAcc += dt; pvTime.t += dt;
    let ms = pvStepMs(pvGame);
    while (pvAcc >= ms) { pvAcc -= ms; pvStep(); ms = pvStepMs(pvGame); }
    const g = pvGame, p = Math.min(1, pvAcc / ms);
    if (pvShrinking) pvShrink(g, dt);
    pvFx.trim = pvTrim * CELL;
    let w = 0;
    for (let i = 0; i < pvEats.length; i++) {
      const d = (pvTime.t - pvEats[i]) / ms * CELL * 1.6;
      if (d < g.cells.length * CELL + CELL && w < pvBulges.length) { pvEats[w] = pvEats[i]; pvBulges[w++] = d; }
    }
    pvEats.length = w; pvFx.nBulges = w; pvFx.blink = fx.blink;
    const c0 = g.cells[0], ap = pvTarget || g.apples[0];
    pvFx.mouth = ap && Math.abs(ap.x - c0.x) + Math.abs(ap.y - c0.y) <= 1 ? 1 - p * 0.3 : Math.max(0, pvFx.mouth - dt / 120);
    const fdt = Math.min(dt, 50), gc = pvView.begin();
    pvAmbient.draw(gc, t, fdt);
    R.drawWalls(gc, g, t);
    for (const a of g.apples) R.drawApple(gc, a, t, g, p);
    const ang = U.lerpAng(U.angOf(g.prevDir.x, g.prevDir.y), U.angOf(g.dir.x, g.dir.y), U.ease(Math.min(1, p / 0.7)));
    pvSnake.draw(gc, g.cells, g.prevTail, p, CELL, ang, settings, pvFx);
    const P = pvSnake.path, hx = P.x[P.n - 1], hy = P.y[P.n - 1], f = pvFoe;
    if (f) {
      const F = pv2.fx;
      F.trim = pv2.trim * CELL; F.blink = fx.blink;
      let k = 0;
      for (let i = 0; i < pv2.eats.length; i++) {
        const d = (pvTime.t - pv2.eats[i]) / ms * CELL * 1.6;
        if (d < f.cells.length * CELL + CELL && k < F.bulges.length) { pv2.eats[k] = pv2.eats[i]; F.bulges[k++] = d; }
      }
      pv2.eats.length = k; F.nBulges = k;
      const a2 = U.lerpAng(U.angOf(f.prevDir.x, f.prevDir.y), U.angOf(f.dir.x, f.dir.y), U.ease(Math.min(1, p / 0.7)));
      pv2.drawer.draw(gc, f.cells, f.prevTail, p, CELL, a2, pv2.skin, F);
    }
    if (g.rules.hunger) {
      pvHunger.draw(gc, g.cols, g.rows, g.hungerLevel(p), t, fdt);
      if (f) pv2.bar.draw(gc, g.cols, g.rows, f.hungerLevel(p), t, fdt, true);
    }
    pvView.fx.draw(gc, t, fdt);
    // Over the effects, so they stay hidden in the dark too.
    if (g.rules.dark) {
      if (f) { const Q = pv2.drawer.path; lights[0][0] = hx; lights[0][1] = hy; lights[1][0] = Q.x[Q.n - 1]; lights[1][1] = Q.y[Q.n - 1]; R.drawDarkTwo(gc, g.cols, g.rows, lights, g.apples, t); }
      else R.drawDark(gc, g.cols, g.rows, hx, hy, g.apples, t);
    }
    if (pvHint) {
      const age = (performance.now() - pvHint.t) / 650;
      if (age >= 1) pvHint = null; else R.drawSwipeHint(gc, g.cols, g.rows, hx, hy, pvHint.x, pvHint.y, 1 - age);
    }
  }

  function frame(t) {
    const dt = Math.min(250, t - last); last = t;
    S.input.pollGamepads();
    R.food = settings.food;

    if (state === 'countdown') {
      const e = t - countT, n = Math.floor(e / COUNT_MS);
      if (n !== countN && n < 3) { countN = n; A.sfx.tick(); }
      if (e >= COUNT_MS * 3) { state = 'play'; acc = 0; A.sfx.start(); }
    }
    // Fixed timestep: the game advances in whole steps; rendering interpolates between them.
    if (state === 'play') {
      acc += dt; gameTime += dt; if (!foe) data.stats.timeMs += dt;
      if ((liveCheckT += dt) > 1000) { liveCheckT = 0; liveCheck(); }   // time-based milestones
      // The grace beat before a crash only lasts half a step, so it saves a quick turn but isn't a free pause.
      const due = () => stepMs() * (game.inGrace ? GRACE_FRACTION : 1);
      let ms = due();
      while (acc >= ms && state === 'play') {
        acc -= ms;
        if (foe) duelTick(); else { game.step(); emitTrail(view, game); handleEvents(); }
        ms = due();
      }
    }
    const ms = stepMs();
    // During the grace beat the head holds still at the edge instead of sliding.
    const p = state === 'play' && !game.inGrace ? Math.min(acc / ms, 1) : 1;

    // Heading into something: keep moving at snake speed until the head touches it. A last-second
    // turn out of the grace beat lets it spring back.
    for (const q of players) {
      const goal = reachGoal(q);
      if (q.reach < goal) q.reach = Math.min(goal, q.reach + dt * CELL / ms);
      else if (q.reach > goal) q.reach = Math.max(goal, q.reach - dt * CELL / ms * 0.5);
      q.fx.reachX = q.reachX * q.reach; q.fx.reachY = q.reachY * q.reach;
    }
    if (crashing && players.every(q => q.reach >= reachGoal(q))) crash(performance.now());

    // Idle blink every few seconds.
    if (t > nextBlink) { blinkT = t; nextBlink = t + 2200 + Math.random() * 3800; }
    const be = t - blinkT, blink = be < 160 ? Math.sin(Math.PI * be / 160) : 0;
    const e = t - deathT, fdt = Math.min(50, dt);
    let shake = 0;
    for (const q of players) {
      const f = q.fx, g = q.g;
      // Mouth opens as the head approaches an apple.
      let target = 0;
      if (state === 'play') {
        const c0 = g.cells[0], c1 = g.cells[1], d = g.dir;
        const hx = c1.x + (c0.x - c1.x) * p, hy = c1.y + (c0.y - c1.y) * p;
        for (const ap of g.apples) {
          const ax = ap.x - hx, ay = ap.y - hy, ahead = ax * d.x + ay * d.y, side = Math.abs(ax * d.y - ay * d.x);
          if (ahead > 0 && ahead < 2.2 && side < 0.6) target = Math.max(target, Math.min(1, (2.2 - ahead) / 1.6));
        }
      }
      q.mouth += (target - q.mouth) * Math.min(1, fdt / 60);
      f.mouth = q.mouth; f.blink = blink;
      // A small squash when the head turns.
      const se = t - q.squashT;
      f.squash = !R.reduced && se < 180 ? 1 - U.ease(se / 180) : 0;
      // Death: shake, flash, then the body greys out from head to tail. The winner of a two-player round is left alone.
      const dead = deathT > 0 && !g.alive && !g.won;
      f.dead = dead;
      f.flash = dead && (R.reduced ? e < 260 : e < 600 && (e / 100 | 0) % 2 === 0) ? 0.75 : 0;   // reduced motion: one flash, never a flicker
      f.grey = dead && e > 600 ? Math.min(1, (e - 600) / 450) : 0;
      if (dead && !R.reduced && settings.shake && e < 350) shake = (1 - e / 350) * 7;
      // The lump travels down the body after each apple.
      let w = 0;
      const lenPx = g.cells.length * CELL + CELL;
      for (let i = 0; i < q.eats.length; i++) {
        const d = (gameTime - q.eats[i]) / ms * CELL * 1.6;
        if (d < lenPx && w < f.bulges.length) { q.eats[w] = q.eats[i]; f.bulges[w++] = d; }
      }
      q.eats.length = w; f.nBulges = w;
    }

    if (!ui.pageOpen()) {   // a full page covers the board, so there's no need to draw it
    const g = view.begin(shake ? (Math.random() * 2 - 1) * shake : 0, shake ? (Math.random() * 2 - 1) * shake : 0);
    ambient.draw(g, t, fdt);
    R.drawWalls(g, game, t);
    for (const ap of game.apples) R.drawApple(g, ap, t, game, p);
    for (const q of players) {
      const n = q.g, a = U.lerpAng(U.angOf(n.prevDir.x, n.prevDir.y), U.angOf(n.dir.x, n.dir.y), U.ease(Math.min(1, p / 0.7)));
      q.drawer.draw(g, n.cells, n.prevTail, p, CELL, a, q.skin, q.fx);
    }
    if (game.rules.hunger && state !== 'menu') for (const q of players) q.bar.draw(g, game.cols, game.rows, q.g.hungerLevel(state === 'play' ? p : 0), t, fdt, q === foe, foe ? U.rgb(U.hexRgb(SK.colorHex(q.skin))) : null);
    view.fx.draw(g, t, fdt);
    if (game.rules.dark) {
      if (foe) { const P = view.snake.path, Q = foe.drawer.path; lights[0][0] = P.x[P.n - 1]; lights[0][1] = P.y[P.n - 1]; lights[1][0] = Q.x[Q.n - 1]; lights[1][1] = Q.y[Q.n - 1]; R.drawDarkTwo(g, game.cols, game.rows, lights, game.apples, t); }
      else { const P = view.snake.path; R.drawDark(g, game.cols, game.rows, P.x[P.n - 1], P.y[P.n - 1], game.apples, t); }
    }   // over the effects, so they stay hidden in the dark too
    if (state === 'countdown') {
      const ce = t - countT, n = Math.min(2, Math.floor(ce / COUNT_MS));
      R.drawCountdown(g, game.cols, game.rows, String(3 - n), (ce - n * COUNT_MS) / COUNT_MS);
    }
    }

    if (ui.menuOpen() && pvView.cv.offsetParent) drawPreview(t, Math.min(dt, 100));
    confetti.draw(t, dt);
    requestAnimationFrame(frame);
  }

  // ---------- wiring ----------
  function applyAudio() { A.set({ muted: settings.muted, volume: settings.volume, sfxOn: settings.sfx, musicOn: settings.music }); }
  applyAudio();
  R.noConfetti = !settings.confetti;

  ui.init(store, {
    play: () => { A.unlock(); applyAudio(); start(); },
    pause: () => { A.unlock(); pause(); },
    openBest: () => {
      if (state === 'dying' || foe) return;
      if (state === 'play' || state === 'countdown') pause();
      ui.openPage('stats');
    },
    gameChanged: () => {
      store.save();
      pick = basePick();
      if (state === 'paused') { pendingNew = true; ui.setPlayLabel('New game'); }
      else if (state === 'menu' || state === 'over') { newGame(); state = 'menu'; ui.closeCard(); ui.setPlayLabel('Play'); }
      ui.el.mBest.textContent = currentBest();
      ui.refresh();
      pvTheme(); fit();
    },
    daily: () => launch('daily'),
    tryMode: id => { if (pvTry === id) return; pvTry = id; pvTheme(); fit(); },
    settingsChanged: key => {
      store.save(); applyAudio();
      if (key.indexOf('a11y') === 0) {
        applyAccess(); applyTheme(); view._sizeKey = ''; pvView._sizeKey = ''; fit();
        if (foe) rival.skin = rivalLook();
      }
      if (pvFoe) pv2.skin = rivalLook();   // player 2 stays different from whatever you've just put on
      R.noConfetti = !settings.confetti;
      if (key === 'color' || key === 'pattern' || key === 'customGrad') applyAccent();
      if (key === 'board' || key === 'boardSkin') { applyTheme(); fit(); }
      if (key === 'dpad') fit();
      if (key === 'speed' || key === 'ramp') ui.refresh();
    },
    click: () => A.sfx.click(),
    layout: () => fit(),
    // Pause card: restart counts the current game, then starts a fresh one with a countdown.
    restart: () => {
      if (state !== 'paused') return;
      A.sfx.click();
      if (game.steps > 0) endGame();
      newGame(); state = 'menu'; start();
    },
    home: () => {
      if (state !== 'paused' && state !== 'over') return;
      A.sfx.click();
      if (state === 'paused' && game.steps > 0) endGame();
      pick = basePick(); match = null; newGame(); state = 'menu';
      showMenu(GAME_NAME, 'Play');
    }
  });
  // Live sync across devices (Settings → Sync). Never swaps data mid-game.
  S.sync.init(store, {
    canSync: () => state === 'menu' || state === 'over' || state === 'paused',
    status: ui.renderSync,
    remote: ch => {
      data.stats.xp += payout(D.claim(data));                          // your devices together finished a mission
      shownLevel = Math.max(shownLevel, SK.levelOf(data.stats.xp));   // levels earned elsewhere don't pop up here
      if (checkUnlocks().length) store.save();                         // combined totals can reach new goals
      if (ch.look) { applyAccent(); applyTheme(); }
      if (state === 'paused') bestBefore = Math.max(bestBefore, currentBest());
      ui.refresh(); ui.el.mBest.textContent = currentBest(); if (!foe) ui.setBest(state === 'paused' ? Math.max(bestBefore, game.score) : currentBest());
      if (ui.shows('unlocks') && ui.menuOpen()) ui.renderRoadmap();
    }
  });
  S.board.init(store, ui.renderBoard);
  setInterval(() => { if (ui.tab === 'settings' && ui.menuOpen()) ui.renderSync(); }, 15000);   // keeps "Synced 2 min ago" fresh
  S.input.init({
    dir: turn,
    togglePause: () => { if (state === 'play' || state === 'countdown') pause(); else if (state === 'paused') start(); },
    confirm: start,
    anyInput: () => { A.unlock(); },
    swipeScale: () => [1.45, 1, 0.68][settings.swipe] || 1,
    menuOpen: ui.menuOpen,
    // Two-player: each person gets half of the screen, across the longer side.
    side: (x, y) => (foe ? (root.innerWidth >= root.innerHeight ? x > root.innerWidth / 2 : y > root.innerHeight / 2) ? 1 : 0 : 0)
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
  showMenu(GAME_NAME, 'Play');
  requestAnimationFrame(t => { last = t; frame(t); });

  // Handy for debugging and automated checks.
  S.app = { get game() { return game; }, get state() { return state; }, settings, view, store, confetti, endGame, newGame, get foe() { return foe && foe.g; }, get run() { return run; }, get match() { return match; }, fx, get preview() { return pvGame; }, get previewFoe() { return pvFoe; }, get previewPath() { return pvSnake.path; } };
})(window);
