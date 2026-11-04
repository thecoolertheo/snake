// DOM side of the app: the top bar, the tabbed menu, skins, settings and stats.
(function (root) {
  'use strict';
  const S = root.Snake, SK = S.skins;
  const $ = id => document.getElementById(id);

  const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
  const LOCK = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>';
  const MODE_ICONS = {
    classic: '<path d="M4 18h8a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h9" stroke="#4cc35b" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="19.5" cy="4" r="2" fill="#4cc35b"/>',
    borderless: '<rect x="3" y="3" width="18" height="18" rx="3" stroke="#5b8cff" stroke-width="2" stroke-dasharray="3 3" fill="none"/><path d="M1 12h22M4 9l-3 3 3 3M20 9l3 3-3 3" stroke="#5b8cff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    walls: '<rect x="2" y="4" width="9" height="7" rx="1.5" fill="#7d9488"/><rect x="13" y="4" width="9" height="7" rx="1.5" fill="#5e7066"/><rect x="7.5" y="13" width="9" height="7" rx="1.5" fill="#7d9488"/>',
    portal: '<circle cx="7" cy="12" r="5" stroke="#4fc3ff" stroke-width="2.5" fill="none"/><circle cx="17" cy="12" r="5" stroke="#ff9f43" stroke-width="2.5" fill="none"/>',
    poison: '<circle cx="12" cy="14" r="8" fill="#9b5cf0"/><circle cx="9" cy="11" r="2" fill="#e2c2ff" opacity=".7"/><path d="M12 6c0-2 1-3 3-4" stroke="#3f7a3a" stroke-width="2" fill="none" stroke-linecap="round"/>',
    peaceful: '<path d="M15 3a9 9 0 1 0 6.5 13.5A7.5 7.5 0 0 1 15 3z" fill="#27c2b0"/>',
    turbo: '<path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="#ffc83d"/>',
    mirror: '<path d="M12 3v18" stroke="#8aa094" stroke-width="2" stroke-dasharray="2 2"/><path d="M9 8l-5 4 5 4zM15 8l5 4-5 4z" fill="#c9a2ff"/>',
    dark: '<circle cx="12" cy="12" r="10" fill="#0b100d" stroke="#3a4a41" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="#ffe9a8" opacity=".9"/><circle cx="12" cy="12" r="8" fill="#ffe9a8" opacity=".18"/>',
    hunger: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11" stroke="#ff9838" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M16 3c-2 1-2.5 4-2.5 7H17V21" stroke="#ff9838" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    runaway: '<circle cx="15" cy="14" r="6.5" fill="#ff5a4e"/><path d="M15 7.5c0-1.6.8-2.4 2.4-3.2" stroke="#5fd16a" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M2 11h5M3 15h4M2 19h5" stroke="#8aa094" stroke-width="2" stroke-linecap="round"/>',
    gold: '<circle cx="12" cy="14" r="8" fill="#ffc83d"/><circle cx="9" cy="11" r="2" fill="#fff6c4"/><path d="M12 6c0-2 1-3 3-4" stroke="#6b4a2b" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19 3l.8 1.7 1.7.8-1.7.8L19 8l-.8-1.7-1.7-.8 1.7-.8z" fill="#fffbe6"/>'
  };
  const BOARD_NAMES = { s: 'Small', m: 'Medium', l: 'Large', f: 'Fill screen' };
  const BOARD_KEYS = ['s', 'm', 'l', 'f'];

  const ui = S.ui = { tab: 'home', cat: 'color' };
  // Big screens have room to show related pages together.
  const WIDE = root.matchMedia('(min-width: 1000px) and (min-height: 560px)');
  const MERGED = { home: ['home', 'modes'], modes: ['home', 'modes'], unlocks: ['unlocks', 'stats'], stats: ['unlocks', 'stats'] };
  const pagesFor = name => (WIDE.matches && MERGED[name]) || [name];
  const PAGE_TITLES = { home: 'Snake Plus', modes: 'Modes', daily: 'Daily Challenge', weekly: 'Weekly missions', snake: 'Customize', unlocks: 'Unlocks', stats: 'Stats', settings: 'Settings' };
  let st, h, store;   // settings, handlers, store

  const D = S.daily;
  const FROM_HOME = { daily: 1, weekly: 1 };   // detail pages with no tab of their own: they open from Home and go back to it
  const DUEL_MODES = ['classic', 'borderless', 'walls', 'poison'];
  let duelMode = 'classic';
  const svg = (inner, cls) => '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true">' + inner + '</svg>';
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const pressed = (box, fn) => [...box.children].forEach((c, i) => c.setAttribute('aria-pressed', fn(c, i)));

  // h = { play, pause, openBest, gameChanged, settingsChanged(key), click }
  ui.init = function (_store, handlers) {
    store = _store; st = store.data.settings; h = handlers;
    ui.el = {
      score: $('score'), best: $('best'), bestBtn: $('bestBtn'), overlay: $('overlay'), title: $('ovTitle'),
      mScore: $('mScore'), mBest: $('mBest'), mBestBtn: $('mBestBtn'), play: $('playBtn'), mute: $('muteBtn'), menu: $('menuBtn'),
      shell: $('shell'), stage: $('stage'), wrap: $('wrap'), bar: $('bar'), pv: $('pv'), app: $('app'), dpad: $('dpad'),
      badge: $('badge'), modeLine: $('modeLine'), modeTag: $('modeTag'), panels: $('panels'), lockNote: $('lockNote'), lockText: $('lockText'), nextGoal: $('nextGoal')
    };
    const E = ui.el;

    // Tabs
    ui.el.panels.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { ui.setTab(b.dataset.go); h.click(); } });
    $('missedList').addEventListener('click', useMissed);
    $('nextGoal').addEventListener('click', () => { ui.openPage('unlocks'); h.click(); });
    $('missedClose').addEventListener('click', () => { $('missed').hidden = true; h.click(); });
    $('lvl').addEventListener('click', () => { ui.openPage('unlocks'); h.click(); });
    $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { ui.setTab(b.dataset.tab); h.click(); } });

    // Modes
    const grid = $('modeGrid');
    for (const m of S.MODES) {
      const b = el('button', 'mode-card');
      b.type = 'button'; b.dataset.mode = m.id; b.title = m.desc;
      const T = S.render.THEMES[m.id];
      if (T) { b.style.setProperty('--ta', T.a); b.style.setProperty('--tb', T.b); b.style.setProperty('--acc', T.accent); }
      b.innerHTML = '<span class="mc-ic">' + svg(MODE_ICONS[m.id]) + '</span><b>' + m.name + '</b><small></small>';
      b.addEventListener('click', () => {
        const u = lockedItem('mode', m.id);
        if (u) { showModeLock(u); return; }
        hideModeLock(); st.mode = m.id; h.gameChanged(); h.click();
      });
      grid.appendChild(b);
    }
    ui.modeDesc = el('p', 'mode-desc'); grid.before(ui.modeDesc);
    ui.modeLock = el('div', 'lock-note'); ui.modeLock.hidden = true;
    ui.modeLock.innerHTML = '<span></span><button type="button" class="link">See it on the roadmap</button>';
    ui.modeLock.querySelector('button').addEventListener('click', () => { ui.showOnRoad(ui.modeLockFocus); h.click(); });
    ui.modeDesc.after(ui.modeLock);
    seg('segBoard', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['f', 'Fill']], 'board', true);
    seg('segApples', [[1, '1'], [3, '3'], [5, '5']], 'apples', true);
    seg('segSpeed', SK.SPEEDS.map((n, i) => [i, n]), 'speed', false);
    toggle('swRamp', 'ramp');

    // Daily Challenge and two-player
    $('pageBack').addEventListener('click', () => { ui.setTab('home'); h.click(); });
    $('dailyPlay').addEventListener('click', () => { h.click(); h.daily(); });
    $('duelStart').addEventListener('click', () => { h.click(); h.duel(duelMode); });
    const duelBox = $('duelModes');
    for (const id of DUEL_MODES) {
      const b = el('button', null, S.MODE[id].name); b.type = 'button';
      b.addEventListener('click', () => { duelMode = id; pressed(duelBox, c => c === b); h.click(); });
      b.setAttribute('aria-pressed', id === duelMode);
      duelBox.appendChild(b);
    }

    // Snake
    buildSkinPickers();

    // Settings
    const vol = $('volume'), volOut = $('volOut');
    vol.value = Math.round(st.volume * 100); volOut.textContent = vol.value + '%'; vol.style.setProperty('--fill', vol.value + '%');
    vol.addEventListener('input', () => { st.volume = vol.value / 100; volOut.textContent = vol.value + '%'; vol.style.setProperty('--fill', vol.value + '%'); h.settingsChanged('volume'); });
    vol.addEventListener('change', () => h.click());
    toggle('swToasts', 'unlockToasts');
    for (const [id, key] of [['swAuto', 'autoRestart'], ['swCountdown', 'countdown'], ['swGrace', 'grace'], ['swWake', 'wake'], ['swShake', 'shake'], ['swConfetti', 'confetti']]) toggle(id, key);
    seg('segSwipe', [[0, 'Low'], [1, 'Normal'], [2, 'High']], 'swipe', false);
    ui._seg_swipe();
    toggle('swSfx', 'sfx'); toggle('swMusic', 'music'); toggle('swDpad', 'dpad'); toggle('swVibrate', 'vibrate');
    if (!navigator.wakeLock) $('swWake').hidden = true;
    if (!navigator.vibrate) $('vibNote').textContent = 'Not supported on this device (iPhone and iPad can’t vibrate from a web page)';

    // Sync
    const SY = () => S.sync;
    $('syncNew').addEventListener('click', async () => { h.click(); await SY().create(); });
    $('syncHave').addEventListener('click', () => { h.click(); const f = $('syncJoin'); f.hidden = !f.hidden; if (!f.hidden) $('syncInput').focus(); });
    $('syncInput').addEventListener('input', e => {
      const c = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8);
      e.target.value = c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c;
    });
    $('syncJoin').addEventListener('submit', async e => {
      e.preventDefault(); h.click();
      if (await SY().join($('syncInput').value)) { $('syncInput').value = ''; $('syncJoin').hidden = true; }
    });
    $('syncCopy').addEventListener('click', () => {
      h.click();
      const done = () => { $('syncCopy').textContent = 'Copied'; setTimeout(() => { $('syncCopy').textContent = 'Copy'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(SY().show()).then(done, () => {});
    });
    $('syncNow').addEventListener('click', () => { h.click(); SY().now(); });
    $('syncLeave').addEventListener('click', () => {
      h.click();
      if (confirm('Stop syncing on this device? Your progress stays here, and the code keeps working on your other devices.')) SY().leave();
    });

    // Compact pause card
    $('resumeBtn').addEventListener('click', h.play);
    $('restartBtn').addEventListener('click', h.restart);
    $('homeBtn').addEventListener('click', h.home);
    $('pSound').addEventListener('click', () => { st.muted = !st.muted; ui.renderMute(); h.settingsChanged('muted'); if (!st.muted) h.click(); });
    $('pMusic').addEventListener('click', () => { st.music = !st.music; ui.renderMute(); $('swMusic').setAttribute('aria-checked', st.music); h.settingsChanged('music'); h.click(); });

    // Bar + header buttons
    E.play.addEventListener('click', h.play);
    $('playTop').addEventListener('click', h.play);
    $('againBtn').addEventListener('click', h.play);
    $('overHome').addEventListener('click', h.home);
    E.menu.addEventListener('click', h.pause);
    E.bestBtn.addEventListener('click', h.openBest);
    E.mBestBtn.addEventListener('click', () => { ui.openPage('stats'); h.click(); });
    E.mute.addEventListener('click', () => { st.muted = !st.muted; ui.renderMute(); h.settingsChanged('muted'); if (!st.muted) h.click(); });
    for (const l of document.querySelectorAll('.logo')) l.innerHTML = LOGO;
    const hero = document.querySelector('.logo-hero');
    hero.classList.add('intro'); setTimeout(() => hero.classList.remove('intro'), 1800);
    watchFade(ui.el.panels, 'y'); watchFade($('menu'), 'y'); watchFade($('catTabs'), 'x'); watchFade($('missedList'), 'x'); watchFade($('wardrobe'), 'y');
    for (const p of ui.el.panels.children) watchFade(p, 'y');
    root.addEventListener('resize', ui.updateFades);
    ui.renderMute();
    ui.refresh();
    applyWide();
    if (WIDE.addEventListener) WIDE.addEventListener('change', applyWide);
  };

  function seg(id, items, key, isGame) {
    const box = $(id);
    for (const [v, label] of items) {
      const b = el('button', null, label); b.type = 'button';
      b.addEventListener('click', () => {
        st[key] = v; pressed(box, (c, i) => items[i][0] === st[key]);
        if (key === 'board') st.boardChosen = true;
        if (isGame) h.gameChanged(); else h.settingsChanged(key);
        h.click();
      });
      box.appendChild(b);
    }
    ui['_seg_' + key] = () => pressed(box, (c, i) => items[i][0] === st[key]);
  }

  function toggle(id, key) {
    const b = $(id);
    const sync = () => b.setAttribute('aria-checked', !!st[key]);
    b.addEventListener('click', () => { st[key] = !st[key]; sync(); h.settingsChanged(key); h.click(); });
    sync();
  }

  function lockText(u) {
    const p = store.progress(), v = Math.min(u.value(p), u.goal);
    return 'Locked: ' + SK.itemName(u) + '. ' + u.text + ' (' + v + '/' + u.goal + ').';
  }
  const lockedItem = (kind, i) => { const u = SK.unlockFor(kind, i); return u && !store.isUnlocked(u.id) ? u : null; };

  function buildSkinPickers() {
    const colorBox = $('optColor');
    SK.COLORS.forEach(([name, hex], i) => {
      const b = el('button', 'sw'); b.type = 'button'; b.style.background = hex; b.title = name;
      if (i === SK.CUSTOM) b.style.order = -1;   // your own colour is always the first tile
      b.addEventListener('click', () => {
        const u = lockedItem('color', i);
        if (u) { showLock(u); return; }
        hideLock(); h.click();
        if (i !== SK.CUSTOM) $('customPick').hidden = true;
        if (i === SK.CUSTOM) { $('customPick').hidden = false; if (!st.customColor) { $('customInput').focus(); return; } }
        st.color = i; h.settingsChanged('color'); renderSkins();
      });
      colorBox.appendChild(b);
    });
    // Custom colour: any colour, as long as it's clearly different from every built-in one.
    const inp = $('customInput'), status = $('customStatus');
    const check = (save) => {
      const hex = inp.value, near = SK.nearestColor(hex), ok = near.dist >= SK.CUSTOM_MIN;
      const chip = '<i class="cp-dot" style="background:' + near.hex + '"></i>';
      status.innerHTML = ok ? '<span class="ok">Unique!</span> Closest built-in colour: ' + chip + near.name
        : '<span class="bad">Too close to</span> ' + chip + '<b>' + near.name + '</b>. Try something more different.';
      $('customPick').classList.toggle('invalid', !ok);
      if (ok && save) { st.customColor = hex; st.color = SK.CUSTOM; h.settingsChanged('color'); renderSkins(); }
    };
    inp.addEventListener('input', () => check(true));
    inp.addEventListener('change', () => { check(true); h.click(); });
    ui.customCheck = check;
    buildGradPick();

    const chips = (id, key, items, kind) => {
      const box = $(id);
      items.forEach((n, i) => {
        const b = el('button', 'chip'); b.type = 'button';
        b.addEventListener('click', () => {
          const u = kind && lockedItem(kind, i);
          if (u) { showLock(u); return; }
          if (key === 'pattern') {
            $('gradPick').hidden = i !== SK.GRAD;
            if (i === SK.GRAD) { hideLock(); openGradPick(); gradSave(); h.click(); return; }
          }
          st[key] = i; hideLock(); h.settingsChanged(key); h.click(); renderSkins();
        });
        if (key === 'pattern' && i === SK.GRAD) b.style.order = -1;   // your own gradient is always the first tile
        box.appendChild(b);
      });
    };
    chips('optPattern', 'pattern', SK.PATTERNS, 'pattern');
    chips('optEyes', 'eyes', SK.EYES, 'eyes');
    $('lockRoad').addEventListener('click', () => { ui.showOnRoad(ui.lockFocus); h.click(); });
    $('roadmap').addEventListener('click', onRoadClick);
    chips('optShape', 'shape', SK.SHAPES);
    chips('optHat', 'hat', SK.HATS, 'hat');
    chips('optBurst', 'burst', SK.BURSTS, 'burst');
    chips('optTrail', 'trail', SK.TRAILS, 'trail');
    chips('optFood', 'food', SK.FOODS, 'food');
    chips('optBoardSkin', 'boardSkin', SK.BOARDS, 'board');
    buildWardrobe();
  }
  // Your own gradient: any two colours and a direction, as long as it isn't just a built-in pattern again.
  // The picker always shows what you're trying; only a gradient that passes the check gets saved.
  let gradDir = 0;
  const gradCss = (a, b, dir) => 'linear-gradient(' + (90 + dir * 45) + 'deg,' + a + ',' + b + ')';
  function gradSave() {
    const a = $('gradA').value, b = $('gradB').value, r = SK.gradCheck(a, b);
    $('gradBar').style.background = gradCss(a, b, gradDir);
    $('gradDirName').textContent = SK.GRAD_DIRS[gradDir];
    const n = '<b>' + r.name + '</b>';
    $('gradStatus').innerHTML = r.ok ? '<span class="ok">Unique!</span> Closest pattern: ' + r.name
      : r.why === 'solid' ? '<span class="bad">Too similar.</span> These two colours would just look solid.'
      : '<span class="bad">Too close to</span> ' + n + '. Try something more different.';
    $('gradPick').classList.toggle('invalid', !r.ok);
    if (r.ok) { st.customGrad = a + ',' + b + ',' + gradDir; st.pattern = SK.GRAD; h.settingsChanged('pattern'); renderSkins(); }
    return r.ok;
  }
  function openGradPick() {
    const G = SK.gradOf(st);
    $('gradA').value = G.a; $('gradB').value = G.b; gradDir = G.dir;
    [...$('gradDirs').children].forEach((b, i) => b.setAttribute('aria-pressed', i === gradDir));
    $('gradPick').hidden = false;
    $('gradBar').style.background = gradCss(G.a, G.b, gradDir);
    $('gradDirName').textContent = SK.GRAD_DIRS[gradDir];
  }
  function buildGradPick() {
    const box = $('gradDirs');
    for (let i = 0; i < 8; i++) {
      const b = el('button', '', '<svg viewBox="0 0 24 24" style="transform:rotate(' + i * 45 + 'deg)" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      b.type = 'button'; b.setAttribute('aria-label', SK.GRAD_DIRS[i]); b.title = SK.GRAD_DIRS[i];
      b.addEventListener('click', () => {
        gradDir = i; [...box.children].forEach((x, j) => x.setAttribute('aria-pressed', j === i));
        gradSave(); h.click();
      });
      box.appendChild(b);
    }
    for (const id of ['gradA', 'gradB']) {
      $(id).addEventListener('input', gradSave);
      $(id).addEventListener('change', () => { gradSave(); h.click(); });
    }
  }
  // Customize page: one category at a time, next to the live preview.
  const cats = () => [
    ['color', 'Colour', 'color', SK.COLORS.map(c => c[0])], ['pattern', 'Pattern', 'pattern', SK.PATTERNS], ['shape', 'Tail', null, SK.SHAPES],
    ['eyes', 'Eyes', 'eyes', SK.EYES], ['hat', 'Hat', 'hat', SK.HATS], ['burst', 'Eat effect', 'burst', SK.BURSTS],
    ['trail', 'Trail', 'trail', SK.TRAILS], ['food', 'Food', 'food', SK.FOODS], ['boardSkin', 'Board', 'board', SK.BOARDS]
  ];
  const openIn = (kind, n) => { let c = 0; for (let i = 0; i < n; i++) if (!kind || !lockedItem(kind, i)) c++; return c; };
  function buildWardrobe() {
    const box = $('catTabs');
    const dice = el('button', 'cat-tab cat-rand', svg('<rect x="3" y="3" width="18" height="18" rx="4"/><g fill="var(--mode-accent)"><circle cx="8" cy="8" r="1.7"/><circle cx="16" cy="8" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="8" cy="16" r="1.7"/><circle cx="16" cy="16" r="1.7"/></g>') + '<span>Randomize</span>');
    dice.type = 'button'; dice.id = 'randomBtn'; dice.title = 'Pick a random colour, pattern, tail, eyes, hat, effects, food and board';
    dice.addEventListener('click', shuffleLook);
    box.appendChild(dice);
    const saved = el('button', 'cat-tab', '<i class="ct-ic">' + svg('<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>', 'ct-save') + '</i><span>Saved</span>');
    saved.type = 'button'; saved.dataset.cat = 'combos';
    saved.addEventListener('click', () => { ui.setCat('combos'); h.click(); });
    box.appendChild(saved);
    $('optCombos').addEventListener('click', onCombo);
    for (const [id, name] of cats()) {
      const b = el('button', 'cat-tab', '<i class="ct-ic"></i><span>' + name + '</span><small></small>'); b.type = 'button'; b.dataset.cat = id;
      b.addEventListener('click', () => { ui.setCat(id); h.click(); });
      box.appendChild(b);
    }
    $('catFilter').addEventListener('click', e => {
      const on = $('wardrobe').classList.toggle('hide-locked');
      e.currentTarget.setAttribute('aria-pressed', on); hideLock(); h.click();
    });
  }
  ui.setCat = function (id) {
    ui.cat = id; hideLock();
    if (id === 'combos' && S.sync && S.sync.ready) S.sync.pull();
    for (const c of $('wardrobe').querySelectorAll('.cat')) c.hidden = c.dataset.cat !== id;
    renderSkins();
    const tab = $('catTabs').querySelector('[data-cat="' + id + '"]');
    if (tab.scrollIntoView) tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: S.render.reduced ? 'auto' : 'smooth' });
  };
  function renderCats() {
    for (const [id, name, kind, items] of cats()) {
      const b = $('catTabs').querySelector('[data-cat="' + id + '"]');
      b.setAttribute('aria-pressed', id === ui.cat);
      const count = openIn(kind, items.length) + '/' + items.length;
      b.querySelector('small').textContent = count;
      b.querySelector('.ct-ic').innerHTML = id === 'color' ? '<i class="ci" style="background:' + SK.colorHex(st) + '"></i>' : chipIcon(kind || id, st[id]);   // what you're wearing
      if (id === ui.cat) { $('catTitle').textContent = name; $('catNow').textContent = items[st[id]] || ''; $('catCount').textContent = count; }
    }
    const sv = $('catTabs').querySelector('[data-cat="combos"]');
    sv.setAttribute('aria-pressed', ui.cat === 'combos');
    $('catFilter').hidden = ui.cat === 'combos';
    if (ui.cat === 'combos') { $('catTitle').textContent = 'Saved looks'; $('catNow').textContent = ''; $('catCount').textContent = st.combos.filter(Boolean).length + '/5'; }
    renderCombos();
    ui.updateFades();
  }
  // Saved looks: 5 slots that each remember every type of customization.
  const LOOK_KEYS = ['color', 'pattern', 'shape', 'eyes', 'hat', 'burst', 'trail', 'food', 'boardSkin'];
  const sameLook = c => LOOK_KEYS.every(k => c[k] === st[k]) && (st.color !== SK.CUSTOM || c.customColor === st.customColor) && (st.pattern !== SK.GRAD || c.customGrad === st.customGrad);
  function renderCombos() {
    const box = $('optCombos');
    let html = '';
    st.combos.forEach((c, i) => {
      if (!c) { html += '<div class="combo-slot"><button type="button" class="combo empty" data-slot="' + i + '" aria-label="Save current look in slot ' + (i + 1) + '"><b>+</b><small>Save</small></button></div>'; return; }
      html += '<div class="combo-slot"><button type="button" class="combo" data-slot="' + i + '" aria-pressed="' + sameLook(c) + '" aria-label="Wear saved look ' + (i + 1) + '">' +
        '<img alt="" src="' + S.render.icon('hat', c.hat, SK.colorHex(c)) + '"><i style="background:' + patternSwatch(c.pattern, c) + '"></i></button>' +
        '<button type="button" class="combo-x" data-clear="' + i + '" aria-label="Clear saved look ' + (i + 1) + '">×</button></div>';
    });
    box.innerHTML = html;
    const linked = S.sync && S.sync.ready && S.sync.code();
    $('comboHint').textContent = (st.combos.some(c => !c) ? 'Tap an empty slot to save your current look. Tap a saved one to wear it.' : 'Tap a saved look to wear it. Use × to clear a slot and save over it.') +
      (linked ? ' These sync to your other devices.' : ' Turn on Sync in Settings to share them with your other devices.');
  }
  function onCombo(e) {
    const x = e.target.closest('[data-clear]');
    if (x) { st.combos[+x.dataset.clear] = null; h.settingsChanged('combos'); h.click(); renderCats(); return; }
    const b = e.target.closest('[data-slot]'); if (!b) return;
    const i = +b.dataset.slot, c = st.combos[i];
    if (!c) {
      const look = { customColor: st.customColor, customGrad: st.customGrad };
      for (const k of LOOK_KEYS) look[k] = st[k];
      st.combos[i] = look; h.settingsChanged('combos');
    } else {
      st.customColor = c.customColor;
      if (c.customGrad) st.customGrad = c.customGrad;   // a look saved before you had a gradient leaves yours alone
      for (const k of LOOK_KEYS) { st[k] = c[k]; h.settingsChanged(k); }
      $('customPick').hidden = st.color !== SK.CUSTOM;
      syncGradPick();
      ui.bump(ui.el.pv);
    }
    h.click(); renderSkins();
  }

  // Randomize: a random pick for every type of customization, from what you've unlocked.
  function shuffleLook() {
    for (const [id, , kind, items] of cats()) {
      const open = [];
      for (let i = 0; i < items.length; i++) if ((!kind || !lockedItem(kind, i)) && !(id === 'color' && i === SK.CUSTOM && !st.customColor) && !(id === 'pattern' && i === SK.GRAD && !st.customGrad)) open.push(i);
      st[id] = open[Math.floor(Math.random() * open.length)];
      h.settingsChanged(id);
    }
    $('customPick').hidden = st.color !== SK.CUSTOM;
    syncGradPick();
    h.click(); renderSkins(); ui.bump(ui.el.pv);
  }
  function syncGradPick() { if (st.pattern === SK.GRAD) openGradPick(); else $('gradPick').hidden = true; }

  function showLock(u) { ui.lockFocus = u; ui.el.lockText.textContent = lockText(u) + ' '; ui.el.lockNote.hidden = false; h.click(); }
  function hideLock() { ui.el.lockNote.hidden = true; }

  // Only the open category is drawn: with this many items, redrawing all of them on every tap adds up.
  function renderSkins() {
    if (ui.cat === 'color') {
      const colorBox = $('optColor'), custom = colorBox.children[SK.CUSTOM];
      custom.style.background = st.customColor
        ? 'radial-gradient(circle, ' + st.customColor + ' 52%, transparent 54%), conic-gradient(#ff5a4e, #ffc83d, #4cc35b, #27c2b0, #5b8cff, #9b6bff, #ff5a4e)'
        : 'conic-gradient(#ff5a4e, #ffc83d, #4cc35b, #27c2b0, #5b8cff, #9b6bff, #ff5a4e)';
      if (!lockedItem('color', SK.CUSTOM) && st.color === SK.CUSTOM) $('customPick').hidden = false;
      if (st.customColor) $('customInput').value = st.customColor;
      [...colorBox.children].forEach((b, i) => {
        const u = lockedItem('color', i);
        b.classList.toggle('locked', !!u); b.innerHTML = u ? LOCK : '';
        b.setAttribute('aria-pressed', st.color === i);
        b.setAttribute('aria-label', SK.COLORS[i][0] + (u ? ' (locked)' : ''));
      });
    }
    const chipsRender = (id, key, items, kind) => [...$(id).children].forEach((b, i) => {
      const u = kind && lockedItem(kind, i);
      b.classList.toggle('locked', !!u);
      b.innerHTML = chipIcon(kind || key, i) + '<span>' + items[i] + '</span>' + (u ? LOCK : '');
      b.setAttribute('aria-pressed', st[key] === i); b.title = items[i];
      b.setAttribute('aria-label', items[i] + (u ? ' (locked)' : ''));
    });
    if (ui.cat === 'pattern' && st.pattern === SK.GRAD && !lockedItem('pattern', SK.GRAD) && $('gradPick').hidden) openGradPick();
    for (const [id, , kind, items] of cats()) {
      if (id === ui.cat && id !== 'color') chipsRender({ pattern: 'optPattern', shape: 'optShape', eyes: 'optEyes', hat: 'optHat', burst: 'optBurst', trail: 'optTrail', food: 'optFood', boardSkin: 'optBoardSkin' }[id], id, items, kind);
    }
    renderCats();
  }

  function showModeLock(u) {
    ui.modeLockFocus = u;
    ui.modeLock.querySelector('span').textContent = 'Locked: ' + SK.itemName(u) + '. ' + S.MODE[u.index].desc + ' To unlock: ' + lockText(u).split('. ').slice(1).join('. ') + ' ';
    ui.modeLock.hidden = false; ui.fitHome(); h.tryMode(u.index); h.click();   // try it out in the preview
  }
  function hideModeLock() { if (ui.modeLock && !ui.modeLock.hidden) { ui.modeLock.hidden = true; ui.fitHome(); } h.tryMode(null); }

  function renderModes() {
    const cards = $('modeGrid').children;
    for (const b of cards) {
      const id = b.dataset.mode;
      b.setAttribute('aria-pressed', st.mode === id);
      const u = lockedItem('mode', id);
      b.classList.toggle('locked', !!u);
      b.querySelector('small').innerHTML = u ? LOCK + ' ' + u.goal + ' ' + u.track.unit : 'Best ' + store.getBest(id, st.board, st.apples);
    }
    ui.modeDesc.textContent = S.MODE[st.mode].desc;
    ui._seg_board(); ui._seg_apples(); ui._seg_speed();
    $('swRamp').setAttribute('aria-checked', !!st.ramp);
  }

  const fmtTime = ms => {
    const m = Math.floor(ms / 60000), hh = Math.floor(m / 60);
    return hh ? hh + 'h ' + (m % 60) + 'm' : m ? m + 'm ' + Math.floor(ms / 1000) % 60 + 's' : Math.floor(ms / 1000) + 's';
  };

  function renderStats() {
    const s = store.data.stats;
    const got = SK.UNLOCKS.filter(u => store.isUnlocked(u.id)).length;
    $('statTiles').innerHTML = [
      ['games', 'Games played', s.games], ['apples', 'Apples eaten', s.apples], ['length', 'Longest snake', s.longest],
      ['time', 'Time played', fmtTime(s.timeMs)], ['best', 'Best score', store.bestAny()], ['rewards', 'Rewards', got + '/' + SK.UNLOCKS.length]
    ].map(([ic, k, v]) => '<div class="tile">' + svg(TRACK_ICONS[ic]) + '<b>' + v + '</b><small>' + k + '</small></div>').join('');

    // Every best score in one place: one card per mode with a board × apples grid.
    const list = $('bestList'); list.innerHTML = '';
    for (const m of S.MODES) {
      const card = el('div', 'best-mode');
      const lk = lockedItem('mode', m.id);
      card.classList.toggle('locked', !!lk);
      let html = '<b>' + svg(MODE_ICONS[m.id]) + m.name + (lk ? ' ' + LOCK : '') + '</b><span class="top">' + store.bestMode(m.id) + '</span><div class="best-grid">';
      html += '<span class="h rh"></span><span class="h">1 apple</span><span class="h">3 apples</span><span class="h">5 apples</span>';
      for (const b of BOARD_KEYS) {
        html += '<span class="h rh">' + BOARD_NAMES[b] + '</span>';
        for (const a of [1, 3, 5]) {
          const v = store.getBest(m.id, b, a), cur = m.id === st.mode && b === st.board && a === st.apples;
          html += '<span class="v' + (v ? '' : ' zero') + (cur ? ' cur' : '') + '">' + (v || '–') + '</span>';
        }
      }
      card.innerHTML = html + '</div>';
      list.appendChild(card);
    }

  }
  function patternSwatch(i, look) {
    const n = SK.PATTERNS[i];
    if (i === SK.GRAD) {
      const who = look || st;
      if (!who.customGrad) return 'conic-gradient(#ff5a4e,#ffc83d,#4cc35b,#27c2b0,#5b8cff,#9b6bff,#ff5a4e)';
      const G = SK.gradOf(who);
      return gradCss(G.a, G.b, G.dir);
    }
    if (SK.GRADIENTS[n]) return 'linear-gradient(135deg,' + SK.GRADIENTS[n].map(c => 'rgb(' + c.join(',') + ')').join(',') + ')';
    if (n === 'Duo') return 'linear-gradient(90deg,#9db8ff 50%,#5b8cff 50%)';
    if (n === 'Zebra') return 'repeating-linear-gradient(90deg,#2a3f73 0 3px,#5b8cff 3px 11px)';
    if (n === 'Candy') return 'repeating-linear-gradient(135deg,#ff4d6d 0 5px,#fff0f5 5px 8px)';
    if (n === 'Tiger') return 'repeating-linear-gradient(100deg,#ff9838 0 7px,#28160a 7px 9px)';
    if (n === 'Stripes') return 'repeating-linear-gradient(90deg,#3f62b3 0 4px,#5b8cff 4px 10px)';
    if (n === 'Fade') return 'linear-gradient(90deg,#2c4370,#5b8cff)';
    if (n === 'Rainbow') return 'linear-gradient(90deg,#ff5a4e,#ffc83d,#4cc35b,#27c2b0,#5b8cff,#9b6bff)';
    if (n === 'Galaxy') return 'radial-gradient(circle at 30% 35%,#fff 6%,transparent 8%),radial-gradient(circle at 70% 60%,#fff 5%,transparent 7%),linear-gradient(135deg,#28287a,#6e32aa,#eb5abe)';
    if (n === 'Spots') return 'radial-gradient(circle at 35% 40%,rgba(0,0,0,.35) 18%,transparent 20%),radial-gradient(circle at 68% 65%,rgba(0,0,0,.35) 18%,transparent 20%),#5b8cff';
    const F = SK.FIXED_BANDS[n];
    if (F) { const w = Math.max(2, Math.round(F[2] * 12)); return 'repeating-linear-gradient(135deg,rgb(' + F[1].join(',') + ') 0 ' + w + 'px,rgb(' + F[0].join(',') + ') ' + w + 'px 12px)'; }
    return '#5b8cff';
  }

  // Two-tone checker swatch for a board skin (index 0 = the current mode's board).
  function boardSwatch(i) {
    const T = i ? SK.BOARD_THEMES[SK.BOARDS[i]] : S.render.THEMES[st.mode];
    return 'background:conic-gradient(' + T.a + ' 25%,' + T.b + ' 0 50%,' + T.a + ' 0 75%,' + T.b + ' 0) 0 0/50% 50%;box-shadow:inset 0 0 0 2px ' + T.accent;
  }
  function rewardPreview(u) {
    if (u.kind === 'board') return '<i class="rw" style="' + boardSwatch(u.index) + ', 0 0 0 3px var(--c-surface-2), 0 0 0 5px var(--c-bg)"></i>';
    if (u.kind === 'mode') return '<i class="rw rw-mode">' + svg(MODE_ICONS[u.index]) + '</i>';
    if (u.kind === 'color') return '<i class="rw" style="background:' + (u.index === SK.CUSTOM ? 'conic-gradient(#ff5a4e,#ffc83d,#4cc35b,#27c2b0,#5b8cff,#9b6bff,#ff5a4e)' : SK.COLORS[u.index][1]) + '"></i>';
    if (u.kind === 'pattern') return '<i class="rw" style="background:' + patternSwatch(u.index) + '"></i>';
    return '<i class="rw rw-img"><img alt="" src="' + S.render.icon(u.kind, u.index) + '"></i>';
  }
  // Tiny picture at the start of each chip in the Snake tab.
  function chipIcon(kind, i) {
    if (kind === 'pattern') return '<i class="ci" style="background:' + patternSwatch(i) + '"></i>';
    if (kind === 'board') return '<i class="ci ci-board" style="' + boardSwatch(i) + '"></i>';
    if (kind === 'trail' || kind === 'food') return '<img class="ci-img" alt="" src="' + S.render.icon(kind, i) + '">';
    if (kind === 'eyes' || kind === 'hat' || kind === 'burst') return '<img class="ci-img" alt="" src="' + S.render.icon(kind, i, SK.colorHex(st)) + '">';
    if (kind === 'shape') return '<i class="ci ci-tail' + (i ? ' tapered' : '') + '"></i>';
    return '';
  }
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const TRACK_ICONS = {
    apples: '<circle cx="12" cy="14" r="8" fill="#ff5a4e"/><path d="M12 6c0-2 1-3 3-4" stroke="#5fd16a" stroke-width="2" fill="none" stroke-linecap="round"/>',
    games: '<path d="M7 5v14l12-7z" fill="#5b8cff"/>',
    best: '<path d="M5 4h14v4a7 7 0 0 1-14 0zM9 18h6v3H9zM11 14h2v4h-2z" fill="#f2c94c"/>',
    length: '<path d="M3 16h10a4 4 0 0 0 0-8H9" stroke="#4cc35b" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="19" cy="16" r="3" fill="#4cc35b"/>',
    walls: MODE_ICONS.walls, portal: MODE_ICONS.portal, poison: MODE_ICONS.poison, borderless: MODE_ICONS.borderless,
    classic: MODE_ICONS.classic, peaceful: MODE_ICONS.peaceful, turbo: MODE_ICONS.turbo, mirror: MODE_ICONS.mirror,
    dark: MODE_ICONS.dark, gold: MODE_ICONS.gold, hunger: MODE_ICONS.hunger, runaway: MODE_ICONS.runaway,
    collector: '<path d="M4 10h16v10H4z" fill="#c77dff"/><path d="M3 7h18v4H3z" fill="#e2b8ff"/><path d="M11 7h2v13h-2z" fill="#ffc83d"/><path d="M12 7c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1z" fill="none" stroke="#ffc83d" stroke-width="1.6"/>',
    level: '<path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 16.9 6.1 20l1.2-6.5L2.5 8.9 9.1 8z" fill="#ffc83d"/>',
    time: '<circle cx="12" cy="12" r="9" fill="none" stroke="#7cc8ff" stroke-width="2.2"/><path d="M12 7v5l3.5 2" stroke="#7cc8ff" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    rewards: '<path d="M4 10h16v10H4z" fill="#c77dff"/><path d="M3 7h18v4H3z" fill="#e2b8ff"/><path d="M11 7h2v13h-2z" fill="#ffc83d"/><path d="M12 7c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1z" fill="none" stroke="#ffc83d" stroke-width="1.6"/>'
  };

  // How far along a track's path the fill reaches: stops are evenly spaced, the fill
  // moves proportionally between them (like a level path).
  function trackFill(t, v) {
    const n = t.steps.length; let prev = 0;
    for (let i = 0; i < n; i++) {
      const g = t.steps[i].goal;
      if (v < g) return (i + (v - prev) / (g - prev)) / n;
      prev = g;
    }
    return 1;
  }

  // Encouraging one-liner: the locked reward you're closest to.
  ui.nextGoal = function () {
    const p = store.progress(); let best = null, bestR = -1;
    for (const u of SK.UNLOCKS) {
      if (store.isUnlocked(u.id)) continue;
      const r = u.value(p) / u.goal;
      if (r > bestR) { bestR = r; best = u; }
    }
    if (!best) return '';
    const v = best.value(p), t = best.track;
    const need = t.cumulative ? (best.goal - v) + ' more ' + t.unit : best.text.charAt(0).toLowerCase() + best.text.slice(1);
    return 'Next unlock: ' + need + ' → ' + SK.itemName(best);
  };

  function renderRoadmap() {
    const box = $('roadmap'), p = store.progress();
    const got = SK.UNLOCKS.filter(u => store.isUnlocked(u.id)).length, pct = got / SK.UNLOCKS.length * 100;
    const ng = ui.nextGoal();
    $('roadHero').innerHTML = '<div class="rh-top"><b>' + got + '<small> / ' + SK.UNLOCKS.length + '</small></b><span>rewards unlocked</span></div>' +
      '<div class="rh-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<p>Modes, colours, patterns, eyes, hats and eat effects unlock as your stats grow. Tap anything you’ve unlocked to use it.' +
      (ng ? '<br><b>' + ng + '</b>' : '') + '</p>';
    let html = '';
    for (const t of SK.TRACKS) {
      const v = t.value(p), n = t.steps.length;
      let next = null;
      html += '<article class="track" data-track="' + t.id + '"><header>' + svg(TRACK_ICONS[t.id]) + '<b>' + t.name + '</b><span class="cur">' + v + '</span></header>';
      html += '<p class="how">' + t.how + '</p>';
      html += '<div class="road-scroll"><div class="road" style="width:max(100%,' + (n * 68 + 40) + 'px)"><div class="rail"><i style="width:' + (trackFill(t, v) * 100).toFixed(1) + '%"></i></div><span class="start">0</span>';
      t.steps.forEach((s, i) => {
        const u = SK.UNLOCKS.find(x => x.id === s.id), done = store.isUnlocked(u.id);
        if (!done && !next) next = u;
        const cls = done ? 'done' : (next === u ? 'next' : 'locked');
        const worn = done && st[SK.settingKey(u.kind)] === u.index;
        html += '<button type="button" class="stop ' + cls + (worn ? ' worn' : '') + '" data-id="' + u.id + '" style="left:' + ((i + 1) / n * 100) + '%" ' +
          'aria-label="' + SK.itemName(u) + ': ' + u.text + (done ? ', unlocked' : '') + '">' + rewardPreview(u) +
          '<span class="mark">' + (done ? CHECK : LOCK) + '</span><span class="goal">' + s.goal + '</span></button>';
      });
      html += '</div></div><p class="next" data-note>' + (next
        ? '<b>Next:</b> ' + SK.itemName(next) + ' at ' + (t.id === 'level' ? 'level ' + next.goal : next.goal + ' ' + t.unit) + ' <small>(' + Math.max(0, next.goal - v) + ' to go)</small>'
        : '<b class="ok">All rewards on this path unlocked!</b>') + '</p></article>';
    }
    box.innerHTML = html;
    // Scroll each path so its next reward is in view, like the current level on a map.
    for (const sc of box.querySelectorAll('.road-scroll')) {
      watchFade(sc, 'x');
      const nx = sc.querySelector('.stop.next') || sc.querySelector('.stop:last-of-type');
      if (nx) sc.scrollLeft = Math.max(0, nx.offsetLeft - sc.clientWidth * 0.6);
    }
  }

  function onRoadClick(e) {
    const b = e.target.closest('.stop'); if (!b) return;
    const u = SK.UNLOCKS.find(x => x.id === b.dataset.id), note = b.closest('.track').querySelector('[data-note]');
    if (store.isUnlocked(u.id)) {   // wear it
      if (u.id === 'p-gradient' && !st.customGrad) { ui.openPage('snake'); ui.setCat('pattern'); openGradPick(); h.click(); return; }
      st[SK.settingKey(u.kind)] = u.index; h.click();
      if (u.kind === 'mode') h.gameChanged(); else h.settingsChanged(u.kind);
      renderRoadmap(); renderSkins();
      const n2 = $('roadmap').querySelector('[data-track="' + u.track.id + '"] [data-note]');
      ui.bump(ui.el.pv);
      n2.innerHTML = '<b class="ok">' + (u.kind === 'mode' ? 'Selected:' : 'Now wearing:') + '</b> ' + SK.itemName(u);
    } else {
      const v = Math.min(u.value(store.progress()), u.goal);
      note.innerHTML = '<b>' + SK.itemName(u) + ':</b> ' + u.text + ' <small>(' + v + '/' + u.goal + ')</small>';
      h.click();
    }
  }

  // Jump to a reward's stop on the roadmap and make it pulse.
  ui.showOnRoad = function (u) {
    ui.setTab('unlocks');
    if (!u) return;
    const stop = $('roadmap').querySelector('[data-id="' + u.id + '"]'); if (!stop) return;
    const tr = stop.closest('.track');
    tr.scrollIntoView({ block: 'start' });
    const sc = stop.closest('.road-scroll'); if (sc) sc.scrollLeft = Math.max(0, stop.offsetLeft - sc.clientWidth / 2);
    stop.classList.add('focus'); setTimeout(() => stop.classList.remove('focus'), 1800);
    tr.querySelector('[data-note]').innerHTML = '<b>' + SK.itemName(u) + ':</b> ' + u.text + ' <small>(' + Math.min(u.value(store.progress()), u.goal) + '/' + u.goal + ')</small>';
  };

  // Anything that scrolls fades out at the edges it can still scroll past, so content never just gets cut off.
  const FADE = 28, fades = new Map();
  function updateFade(e, axis) {
    const y = axis === 'y', size = y ? e.clientHeight : e.clientWidth, full = y ? e.scrollHeight : e.scrollWidth;
    const over = getComputedStyle(e)[y ? 'overflowY' : 'overflowX'];
    const on = (over === 'auto' || over === 'scroll') && size > 0 && full > size + 1;
    e.classList.toggle(y ? 'fade-y' : 'fade-x', on);
    if (!on) return;
    const pos = Math.max(0, y ? e.scrollTop : e.scrollLeft), a = Math.round(Math.min(pos, FADE)), b = Math.round(Math.max(0, Math.min(full - size - pos, FADE)));
    // A preview that stays stuck to the top isn't scrolling, so the fade starts just below it.
    let top = 0;
    if (e === ui.el.panels) { for (const c of e.querySelectorAll('.ward-stage, .panel[data-panel="modes"] > .pv-slot')) if (c.offsetParent && getComputedStyle(c).position === 'sticky') top = c.offsetHeight; }
    const key = a + '|' + b + '|' + top;
    if (e._fade === key) return;
    e._fade = key;
    e.style.setProperty('--fa', a + 'px'); e.style.setProperty('--fb', b + 'px'); e.style.setProperty('--ft', top + 'px');
  }
  function watchFade(e, axis) {
    if (!e || fades.has(e)) return;
    fades.set(e, axis);
    let queued = false;
    e.addEventListener('scroll', () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; updateFade(e, axis); }); }, { passive: true });
    updateFade(e, axis);
  }
  ui.updateFades = function () {
    requestAnimationFrame(() => {
      for (const [e, axis] of fades) { if (!e.isConnected) fades.delete(e); else updateFade(e, axis); }
    });
  };

  // Sync card in Settings.
  ui.renderSync = function () {
    const y = S.sync; if (!y || !y.code) return;
    const on = !!y.code(), stEl = $('syncState'), msg = $('syncMsg');
    $('syncOff').hidden = on; $('syncOn').hidden = !on;
    if (on) $('syncCode').textContent = y.show();
    let s = '';
    if (y.state === 'syncing') s = 'Syncing…';
    else if (on && y.state === 'ok') {
      const m = Math.floor((Date.now() - y.at) / 60000);
      s = (y.at ? (m < 1 ? 'Synced just now' : m < 60 ? 'Synced ' + m + ' min ago' : 'Synced ' + Math.floor(m / 60) + ' h ago') : 'On') + (y.devices > 1 ? ' · ' + y.devices + ' devices' : '');
    } else if (on && y.state === 'error') s = 'Not synced';
    stEl.textContent = s; stEl.className = on && y.state === 'ok' ? 'ok' : '';
    msg.hidden = !(y.state === 'error' && y.msg); msg.textContent = y.msg;
  };
  ui.renderRoadmap = () => renderRoadmap();

  // The logo: SNAKE in tube letters like the snake's body (the S has a head), with PLUS in gold beneath.
  const LOGO = (function () {
    const letters = ['M66 20H36A15 15 0 0 0 36 50H52A15 15 0 0 1 52 80H20', 'M97 80V20L137 80V20', 'M157 80L181 20L205 80M167 58H195', 'M225 20V80M261 20L227 50L261 80', 'M317 20H283V80H317M283 50H311'];
    const plus = ['M119 134V106H129A7.500 7.500 0 0 1 129 121H119', 'M147 106V134H162', 'M174 106V126A8 8 0 0 0 190 126V106', 'M218 106H207A7 7 0 0 0 207 120H211A7 7 0 0 1 211 134H200'];
    const layer = (cls, list) => list.map((d, i) => '<path class="' + cls + '" pathLength="1" style="--i:' + i + '" d="' + d + '"/>').join('');
    return '<svg viewBox="0 0 336 146" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path class="lg-rule" d="M20 120H101"/><path class="lg-rule" d="M235 120H316"/>' +
      '<g class="lg-tube">' + layer('lg-shade', letters) + layer('lg-edge', letters) + layer('lg-body', letters) + layer('lg-gloss', letters) + layer('lg-glint', letters) + '</g>' +
      '<g class="lg-tongue"><path d="M78 20H90M90 20L96 16M90 20L96 24"/></g>' +
      '<circle class="lg-head-edge" cx="68" cy="20" r="16"/><circle class="lg-head" cx="68" cy="20" r="14"/><ellipse class="lg-head-gloss" cx="64" cy="13" rx="7" ry="3"/>' +
      '<g class="lg-eyes"><circle cx="70" cy="13" r="5" fill="#fff"/><circle cx="70" cy="27" r="5" fill="#fff"/><circle cx="72" cy="13" r="2.600" fill="#0f1512"/><circle cx="72" cy="27" r="2.600" fill="#0f1512"/></g>' +
      '<g class="lg-plus">' + layer('lg-plus-edge', plus) + layer('lg-plus-body', plus) + '</g></svg>';
  })();

  function renderHome() {
    $('homeBest').textContent = store.getBest(st.mode, st.board, st.apples);
    $('homeGot').textContent = SK.UNLOCKS.filter(u => store.isUnlocked(u.id)).length + ' / ' + SK.UNLOCKS.length;
    renderNext($('homeNext'), 3);
    ui.fitHome();
  }

  // The rewards you're closest to, at most one per path.
  function topGoals(n) {
    const p = store.progress(), best = {};
    for (const u of SK.UNLOCKS) {
      if (store.isUnlocked(u.id)) continue;
      const v = Math.min(u.value(p), u.goal), ratio = v / u.goal, cur = best[u.track.id];
      if (!cur || ratio > cur.ratio) best[u.track.id] = { u, v, ratio };
    }
    return Object.values(best).sort((a, b) => b.ratio - a.ratio).slice(0, n);
  }
  // Next-unlock card: the reward in a progress ring, a filling bar, and how far you've got.
  // The bar and ring grow from where they last were, so a finished game visibly moves them.
  let lastNext = { id: '', pct: 0 };
  function renderNext(box, count) {
    const goals = topGoals(count), g = goals[0];
    box.hidden = !g; if (!g) return;
    const t = g.u.track, pct = Math.floor(g.ratio * 100), from = lastNext.id === g.u.id ? Math.min(lastNext.pct, pct) : 0;
    const done = t.id === 'level' ? 'Level ' + g.v + ' of ' + g.u.goal : g.v + ' of ' + g.u.goal + ' ' + t.unit;
    const mini = goals.slice(1).map(o => {
      const q = Math.floor(o.ratio * 100);
      return '<span class="nx-mini" title="' + SK.itemName(o.u) + ': ' + o.u.text + '"><span class="nx-ring" style="--p:' + q + '%">' + rewardPreview(o.u) + '</span><span><b>' + SK.itemName(o.u) + '</b><small>' + q + '%</small></span></span>';
    }).join('');
    box.innerHTML = '<span class="nx-main"><span class="nx-ring" style="--p:' + from + '%">' + rewardPreview(g.u) + '</span>' +
      '<span class="nx-body"><small class="nx-k">Next unlock</small><span class="nx-top"><b>' + SK.itemName(g.u) + '</b><em>' + pct + '%</em></span>' +
      '<i class="nx-bar"><i style="width:' + from + '%"></i></i><small class="nx-how"><span>' + done + '</span><span>' + (g.u.goal - g.v) + ' to go</span></small></span></span>' +
      (mini ? '<span class="nx-more">' + mini + '</span>' : '');
    const bar = box.querySelector('.nx-bar i'), ring = box.querySelector('.nx-ring');
    if (from !== pct) { void bar.offsetWidth; bar.style.width = pct + '%'; ring.style.setProperty('--p', pct + '%'); }
    lastNext = { id: g.u.id, pct };
  }

  // Daily page: today's challenge, your streak, this week's missions.
  const SPEED_WORD = i => SK.SPEEDS[i];
  ui.renderDaily = function () {
    const key = D.dayKey(), spec = D.challenge(key), days = store.data.daily.days, played = key in days, m = S.MODE[spec.mode], now = D.streak(days, key);
    $('dailyMode').innerHTML = '<span class="mc-ic">' + svg(MODE_ICONS[m.id]) + '</span><span><b>' + m.name + '</b><small>' + m.desc + '</small></span>';
    $('dailyRules').textContent = [spec.layout, spec.apples + (m.portal ? ' pair' : ' apple') + (spec.apples > 1 ? 's' : ''), SPEED_WORD(spec.speed) + ' speed', spec.ramp ? 'Speeds up' : ''].filter(Boolean).join(' · ');
    $('dailyPlay').textContent = played ? 'Practice' : 'Play today’s challenge';
    $('dailyNote').textContent = played ? 'Today’s score: ' + days[key] + '. A new challenge arrives at midnight.' : 'Your first go counts, so make it a good one. Worth +' + D.dailyXp(now + 1) + ' XP.';
    $('dailyStreak').textContent = now; $('dailyBest').textContent = D.bestStreak(days);
    const n = D.dayNum(key);
    let dots = '';
    for (let i = 6; i >= 0; i--) {
      const k = D.keyOf(n - i), day = new Date(k + 'T12:00:00Z').toUTCString().slice(0, 1);
      dots += '<span class="dd' + (k in days ? ' on' : '') + (!i ? ' now' : '') + '" title="' + k + (k in days ? ': ' + days[k] : '') + '"><i></i><small>' + day + '</small></span>';
    }
    $('dailyDots').innerHTML = dots;
    const w = D.ensureWeek(store.data), left = D.daysLeftInWeek();
    $('weekLeft').textContent = left === 1 ? 'Last day' : left + ' days left';
    $('weekList').innerHTML = D.missions(w.week).map((x, i) => {
      const min = x.id === 'minutes', v = Math.min(x.goal, Math.floor(D.total(w, i, x))), pct = v / x.goal * 100, done = w.claimed[i];
      return '<div class="ms' + (done ? ' done' : '') + '"><div class="ms-t"><b>' + x.text + '</b><em>' + (done ? 'Done' : '+' + x.xp + ' XP') + '</em></div>' +
        '<i class="nx-bar"><i style="width:' + pct.toFixed(1) + '%"></i></i><small>' + v + ' of ' + x.goal + (min ? ' minutes' : '') + '</small></div>';
    }).join('');
    // The two short cards on Home.
    const list = D.missions(w.week), doneN = w.claimed.filter(Boolean).length;
    $('homeDaily').classList.toggle('new', !played);
    $('homeDaily').innerHTML = '<span class="hev-ic">' + svg(MODE_ICONS[m.id]) + '</span><span class="hev-t"><b>Daily Challenge</b><small>' +
      (played ? 'Score ' + days[key] + ' · ' + now + ' day streak' : m.name + ' · +' + D.dailyXp(now + 1) + ' XP') + '</small></span>';
    $('homeWeek').innerHTML = '<span class="hev-ic">' + svg(TRACK_ICONS.level) + '</span><span class="hev-t"><b>Weekly missions</b><small>' + doneN + ' of 3 done</small>' +
      '<span class="hev-bars">' + list.map((x, i) => '<i><i style="width:' + Math.min(100, D.total(w, i, x) / x.goal * 100).toFixed(1) + '%"></i></i>').join('') + '</span></span>';
    ui.updateFades();
  };
  ui.setDuel = on => { ui.el.bar.classList.toggle('duel', on); };
  ui.setRunTag = t => { ui.runTag = t; ui.el.modeTag.textContent = t || S.MODE[st.mode].name; };
  ui.sideNames = () => (root.innerWidth >= root.innerHeight ? ['on the left', 'on the right'] : ['on the top half', 'on the bottom half']);
  ui.toastMission = function (m) {
    const t = el('div', 'toast toast-lvl', '<i class="rw rw-lvl">+</i><span><small>Mission done! +' + m.xp + ' XP</small><b>' + m.text + '</b></span>');
    $('toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2800); setTimeout(() => t.remove(), 3300);
  };
  ui.note = function (a, b) {
    const t = el('div', 'toast toast-note', '<span><b>' + a + '</b><b>' + b + '</b></span>');
    $('toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 3400); setTimeout(() => t.remove(), 3900);
  };

  // Re-render everything that depends on settings or saved data.
  ui.refresh = function () {
    renderModes(); renderSkins(); ui.renderLevel(); ui.renderDaily(); renderHome();
    if (ui.shows('stats')) renderStats();
    const m = S.MODE[st.mode];
    const line = m.name + ' · ' + BOARD_NAMES[st.board] + ' · ' + st.apples + (m.portal ? ' pair' : ' apple') + (st.apples > 1 ? 's' : '') + ' · ' + SK.SPEEDS[st.speed] + (st.ramp ? ' +' : '');
    ui.el.modeLine.textContent = line;
    ui.el.modeTag.textContent = ui.runTag || m.name;
  };

  // Pages: one full-screen page at a time. The preview canvas moves to whichever page shows it.
  ui.setTab = function (name, scrollToBest) {
    const pages = pagesFor(name), main = pages[0];
    ui.tab = main;
    ui.el.shell.dataset.page = main;
    $('pageTitle').textContent = main === 'unlocks' && pages.length > 1 ? 'Progress' : PAGE_TITLES[main];
    const tab = FROM_HOME[main] ? 'home' : main;
    for (const b of $('tabs').querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === tab);
    $('pageBack').hidden = !FROM_HOME[main];
    for (const p of document.querySelectorAll('[data-panel]')) p.hidden = pages.indexOf(p.dataset.panel) < 0;
    const slot = document.querySelector('[data-panel="' + main + '"] .pv-slot');
    if (slot) { slot.appendChild(ui.el.pv); if (h.layout) h.layout(); }
    hideLock(); hideModeLock();
    if (main === 'home' || FROM_HOME[main]) ui.renderDaily();
    if (main === 'home') renderHome();
    if (ui.shows('stats')) renderStats();
    if (ui.shows('unlocks')) renderRoadmap();
    if (main === 'settings') ui.renderSync();
    ui.el.panels.scrollTop = 0;
    for (const p of ui.el.panels.children) p.scrollTop = 0;
    if (scrollToBest) $('bestHeading').scrollIntoView({ block: 'start' });
    ui.updateFades();
  };
  ui.shows = name => !document.querySelector('[data-panel="' + name + '"]').hidden;
  function applyWide() {
    $('tabs').querySelector('[data-tab="unlocks"] span').textContent = WIDE.matches ? 'Progress' : 'Unlocks';
    ui.setTab(ui.tab);
  }
  // Home never scrolls. Each column steps through tighter layouts until it fits the space there is,
  // and if the tightest one is still too tall (a tiny window) the column is scaled down to fit.
  const FIT_TIERS = 3;
  function fitPanel(panel, room) {
    panel.style.transform = ''; panel.style.alignSelf = ''; panel.style.marginBottom = '';
    let h = 0;
    for (let tier = 0; tier <= FIT_TIERS; tier++) {
      panel.dataset.fit = tier; h = panel.offsetHeight;
      if (h <= room) return;
    }
    panel.style.alignSelf = 'start'; panel.style.transformOrigin = 'top center'; panel.style.transform = 'scale(' + (room / h).toFixed(4) + ')';
    panel.style.marginBottom = (room - h) + 'px';   // the page takes up only its scaled size
  }
  ui.fitHome = function () {
    if (ui.tab !== 'home' || !ui.pageOpen()) return;
    const box = ui.el.panels, cs = getComputedStyle(box), room = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    for (const p of box.children) if (!p.hidden) fitPanel(p, room);
  };

  // Opens a page from the game (the card underneath stays for when you come back to it).
  ui.openPage = function (name) { ui.el.shell.hidden = false; ui.setTab(name, name === 'stats'); };

  // Player level + XP bar in the menu header.
  ui.renderLevel = function () {
    const xp = store.data.stats.xp, L = SK.levelOf(xp), a = SK.xpForLevel(L), b = SK.xpForLevel(L + 1);
    const pct = L >= 100 ? 100 : Math.min(100, (xp - a) / (b - a) * 100);
    $('lvl').innerHTML = $('homeLvl').innerHTML = '<span class="lv-n">' + L + '</span><span class="lv-t"><b>' + SK.titleOf(L) + '</b><small>' +
      (L >= 100 ? 'Max level!' : (b - xp) + ' XP to level ' + (L + 1)) + '</small></span><i class="lv-bar"><i style="width:' + pct.toFixed(1) + '%"></i></i>';
  };
  // "New best" pop-up, for when there's no game over screen to show it.
  ui.toastBest = function (score) {
    const t = el('div', 'toast toast-lvl', '<i class="rw rw-lvl">' + score + '</i><span><small>New best!</small><b>Score ' + score + '</b></span>');
    $('toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2700);
  };
  ui.toastLevel = function (L, title) {
    const t = el('div', 'toast toast-lvl', '<i class="rw rw-lvl">' + L + '</i><span><small>Level up!</small><b>' + title + '</b></span>');
    $('toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2800); setTimeout(() => t.remove(), 3300);
    return t.getBoundingClientRect();
  };

  // "What you missed": the rewards (and level-up) you earned while pop-ups were off.
  function renderMissed(m) {
    const box = $('missed'), list = $('missedList');
    box.hidden = !m; if (!m) return;
    let html = '';
    if (m.level) html += '<div class="ms-item ms-lvl"><i class="rw rw-lvl">' + m.level + '</i><span><b>Level ' + m.level + '</b><small>' + SK.titleOf(m.level) + '</small></span></div>';
    for (const u of m.items) {
      html += '<button type="button" class="ms-item" data-id="' + u.id + '">' + rewardPreview(u) + '<span><b>' + SK.itemName(u).replace(/ (colour|pattern|eyes|hat|eat effect|trail|food|board|mode)$/, '') +
        '</b><small>' + SK.itemName(u).match(/ (colour|pattern|eyes|hat|eat effect|trail|food|board|mode)$/)[1] + '</small></span></button>';
    }
    list.innerHTML = html;
    ui.updateFades();
  }
  function useMissed(e) {
    const b = e.target.closest('.ms-item[data-id]'); if (!b) return;
    const u = SK.UNLOCKS.find(x => x.id === b.dataset.id);
    if (u.kind === 'color' && u.index === SK.CUSTOM && !st.customColor) { ui.openPage('snake'); ui.setCat('color'); $('customPick').hidden = false; h.click(); return; }
    if (u.id === 'p-gradient' && !st.customGrad) { ui.openPage('snake'); ui.setCat('pattern'); openGradPick(); h.click(); return; }
    st[SK.settingKey(u.kind)] = u.index; h.click();
    if (u.kind === 'mode') h.gameChanged(); else h.settingsChanged(u.kind);
    ui.refresh(); ui.bump(ui.el.pv);
    for (const x of $('missedList').querySelectorAll('.ms-item')) x.classList.toggle('using', x === b);
  }

  // In-game "Unlocked!" toast. Returns its position so confetti can burst from it.
  ui.toast = function (u) {
    const box = $('toasts');
    const t = el('div', 'toast', rewardPreview(u) + '<span><small>Unlocked!</small><b>' + SK.itemName(u) + '</b></span>');
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2800);
    setTimeout(() => t.remove(), 3300);
    return t.getBoundingClientRect();
  };

  ui.renderMute = () => {
    const ps = $('pSound'); ps.setAttribute('aria-pressed', !st.muted); ps.querySelector('.ic').innerHTML = st.muted ? ICON_OFF : ICON_ON;
    $('pMusic').setAttribute('aria-pressed', !!st.music);
    ui.el.mute.innerHTML = st.muted ? ICON_OFF : ICON_ON;
    ui.el.mute.setAttribute('aria-label', st.muted ? 'Sound off' : 'Sound on');
  };
  ui.setScore = (n, bump) => { ui.el.score.textContent = n; if (bump) ui.bump(ui.el.score); };
  ui.setBest = (n, passed) => {
    ui.el.best.textContent = n;
    ui.el.bestBtn.classList.toggle('passed', !!passed);
  };
  ui.pageOpen = () => !ui.el.shell.hidden;
  ui.menuOpen = () => ui.pageOpen() || !ui.el.overlay.hidden;
  // o = { title, score, best, btn, badge, next, missed, tab, compact, over }
  // compact (paused) and over (game over) show a card on the board; anything else shows the pages.
  ui.showMenu = o => {
    const E = ui.el, card = !!(o.compact || o.over);
    E.title.textContent = o.title; E.mScore.textContent = o.score; E.mBest.textContent = o.best;
    const L = o.labels || ['Score', 'Best'], box = E.mScore.closest('.scores');
    box.querySelectorAll('small').forEach((n, i) => { n.textContent = L[i]; });
    box.classList.toggle('duel', L[0] === 'Player 1');
    ui.setPlayLabel(o.btn); $('againBtn').textContent = o.btn;
    E.badge.hidden = !o.badge; if (o.badge) E.badge.textContent = o.badge;
    renderMissed(o.missed);
    E.overlay.hidden = !card; E.shell.hidden = card;
    if (o.next) renderNext(E.nextGoal, 1); else E.nextGoal.hidden = true;
    $('pauseBox').hidden = !o.compact; $('overBox').hidden = !o.over;
    ui.renderMute();
    ui.refresh();
    ui.updateFades();
    if (!card) ui.setTab(o.tab || 'home', o.tab === 'stats');
    (o.compact ? $('resumeBtn') : o.over ? $('againBtn') : E.play).focus({ preventScroll: true });
  };
  ui.closeCard = () => { ui.el.overlay.hidden = true; };
  ui.setPlayLabel = t => { ui.el.play.textContent = t; $('playTop').textContent = t; };
  ui.hideMenu = () => {
    ui.el.overlay.hidden = true; ui.el.shell.hidden = true;
    const a = document.activeElement; if (a && a.blur) a.blur();
  };
  ui.bump = (node, big) => {
    if (S.render.reduced) return;
    try { node.animate([{ transform: 'scale(' + (big ? 1.6 : 1.4) + ')' }, { transform: 'scale(1)' }], { duration: big ? 420 : 240, easing: 'ease-out' }); } catch (e) {}
  };
})(window);
