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

  const ui = S.ui = { tab: 'modes' };
  let st, h, store;   // settings, handlers, store

  const svg = (inner, cls) => '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true">' + inner + '</svg>';
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const pressed = (box, fn) => [...box.children].forEach((c, i) => c.setAttribute('aria-pressed', fn(c, i)));

  // h = { play, pause, openBest, gameChanged, settingsChanged(key), click }
  ui.init = function (_store, handlers) {
    store = _store; st = store.data.settings; h = handlers;
    ui.el = {
      score: $('score'), best: $('best'), bestBtn: $('bestBtn'), overlay: $('overlay'), title: $('ovTitle'),
      mScore: $('mScore'), mBest: $('mBest'), mBestBtn: $('mBestBtn'), play: $('playBtn'), mute: $('muteBtn'), menu: $('menuBtn'),
      stage: $('stage'), wrap: $('wrap'), bar: $('bar'), pv: $('pv'), app: $('app'), dpad: $('dpad'),
      badge: $('badge'), modeLine: $('modeLine'), modeTag: $('modeTag'), panels: $('panels'), lockNote: $('lockNote'), lockText: $('lockText'), nextGoal: $('nextGoal')
    };
    const E = ui.el;

    // Tabs
    ui.el.panels.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { ui.setTab(b.dataset.go); h.click(); } });
    $('lvl').addEventListener('click', () => { ui.setTab('unlocks'); h.click(); });
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
    ui.modeDesc = el('p', 'mode-desc'); grid.after(ui.modeDesc);
    ui.modeLock = el('div', 'lock-note'); ui.modeLock.hidden = true;
    ui.modeLock.innerHTML = '<span></span><button type="button" class="link">See it on the roadmap</button>';
    ui.modeLock.querySelector('button').addEventListener('click', () => { ui.showOnRoad(ui.modeLockFocus); h.click(); });
    ui.modeDesc.after(ui.modeLock);
    seg('segBoard', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['f', 'Fill']], 'board', true);
    seg('segApples', [[1, '1'], [3, '3'], [5, '5']], 'apples', true);
    seg('segSpeed', SK.SPEEDS.map((n, i) => [i, n]), 'speed', false);
    toggle('swRamp', 'ramp');

    // Snake
    buildSkinPickers();

    // Settings
    const vol = $('volume'), volOut = $('volOut');
    vol.value = Math.round(st.volume * 100); volOut.textContent = vol.value + '%'; vol.style.setProperty('--fill', vol.value + '%');
    vol.addEventListener('input', () => { st.volume = vol.value / 100; volOut.textContent = vol.value + '%'; vol.style.setProperty('--fill', vol.value + '%'); h.settingsChanged('volume'); });
    vol.addEventListener('change', () => h.click());
    toggle('swSfx', 'sfx'); toggle('swMusic', 'music'); toggle('swDpad', 'dpad'); toggle('swVibrate', 'vibrate');
    if (!navigator.vibrate) $('vibNote').textContent = 'Not supported on this device (iPhone and iPad can’t vibrate from a web page)';

    // Compact pause card
    $('resumeBtn').addEventListener('click', h.play);
    $('restartBtn').addEventListener('click', h.restart);
    $('homeBtn').addEventListener('click', h.home);
    $('pSound').addEventListener('click', () => { st.muted = !st.muted; ui.renderMute(); h.settingsChanged('muted'); if (!st.muted) h.click(); });
    $('pMusic').addEventListener('click', () => { st.music = !st.music; ui.renderMute(); $('swMusic').setAttribute('aria-checked', st.music); h.settingsChanged('music'); h.click(); });

    // Bar + header buttons
    E.play.addEventListener('click', h.play);
    E.menu.addEventListener('click', h.pause);
    E.bestBtn.addEventListener('click', h.openBest);
    E.mBestBtn.addEventListener('click', () => { ui.setTab('stats', true); h.click(); });
    E.mute.addEventListener('click', () => { st.muted = !st.muted; ui.renderMute(); h.settingsChanged('muted'); if (!st.muted) h.click(); });
    ui.renderMute();
    ui.refresh();
    root.addEventListener('resize', () => ui.moveInk());
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

    const chips = (id, key, items, kind) => {
      const box = $(id);
      items.forEach((n, i) => {
        const b = el('button', 'chip'); b.type = 'button';
        b.addEventListener('click', () => {
          const u = kind && lockedItem(kind, i);
          if (u) { showLock(u); return; }
          st[key] = i; hideLock(); h.settingsChanged(key); h.click(); renderSkins();
        });
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
  }
  function showLock(u) { ui.lockFocus = u; ui.el.lockText.textContent = lockText(u) + ' '; ui.el.lockNote.hidden = false; ui.el.lockNote.scrollIntoView({ block: 'nearest', behavior: S.render.reduced ? 'auto' : 'smooth' }); h.click(); }
  function hideLock() { ui.el.lockNote.hidden = true; }

  function renderSkins() {
    const colorBox = $('optColor');
    const custom = colorBox.children[SK.CUSTOM];
    custom.style.background = st.customColor
      ? 'radial-gradient(circle, ' + st.customColor + ' 52%, transparent 54%), conic-gradient(#ff5a4e, #ffc83d, #4cc35b, #27c2b0, #5b8cff, #9b6bff, #ff5a4e)'
      : 'conic-gradient(#ff5a4e, #ffc83d, #4cc35b, #27c2b0, #5b8cff, #9b6bff, #ff5a4e)';
    const customOpen = !lockedItem('color', SK.CUSTOM) && st.color === SK.CUSTOM;
    if (customOpen) $('customPick').hidden = false;
    if (st.customColor) $('customInput').value = st.customColor;
    [...colorBox.children].forEach((b, i) => {
      const u = lockedItem('color', i);
      b.classList.toggle('locked', !!u); b.innerHTML = u ? LOCK : '';
      b.setAttribute('aria-pressed', st.color === i);
      b.setAttribute('aria-label', SK.COLORS[i][0] + (u ? ' (locked)' : ''));
    });
    const chipsRender = (id, key, items, kind) => [...$(id).children].forEach((b, i) => {
      const u = kind && lockedItem(kind, i);
      b.classList.toggle('locked', !!u);
      b.innerHTML = chipIcon(kind || key, i) + '<span>' + items[i] + '</span>' + (u ? LOCK : '');
      b.setAttribute('aria-pressed', st[key] === i);
    });
    chipsRender('optPattern', 'pattern', SK.PATTERNS, 'pattern');
    chipsRender('optEyes', 'eyes', SK.EYES, 'eyes');
    const got = SK.UNLOCKS.filter(u => store.isUnlocked(u.id)).length;
    $('unlockSum').innerHTML = '<span class="us-ring" style="--p:' + (got / SK.UNLOCKS.length * 100).toFixed(1) + '%"></span><span><b>' + got + ' of ' + SK.UNLOCKS.length + '</b> rewards unlocked<br><button type="button" class="link" data-go="unlocks">See the roadmap</button></span>';
    chipsRender('optShape', 'shape', SK.SHAPES);
    chipsRender('optHat', 'hat', SK.HATS, 'hat');
    chipsRender('optBurst', 'burst', SK.BURSTS, 'burst');
    chipsRender('optTrail', 'trail', SK.TRAILS, 'trail');
    chipsRender('optFood', 'food', SK.FOODS, 'food');
    chipsRender('optBoardSkin', 'boardSkin', SK.BOARDS, 'board');
  }

  function showModeLock(u) {
    ui.modeLockFocus = u;
    ui.modeLock.querySelector('span').textContent = 'Locked: ' + SK.itemName(u) + '. ' + S.MODE[u.index].desc + ' To unlock: ' + lockText(u).split('. ').slice(1).join('. ') + ' ';
    ui.modeLock.hidden = false; ui.modeLock.scrollIntoView({ block: 'nearest', behavior: S.render.reduced ? 'auto' : 'smooth' }); h.click();
  }
  function hideModeLock() { if (ui.modeLock) ui.modeLock.hidden = true; }

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
  function patternSwatch(i) {
    const n = SK.PATTERNS[i];
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
      const nx = sc.querySelector('.stop.next') || sc.querySelector('.stop:last-of-type');
      if (nx) sc.scrollLeft = Math.max(0, nx.offsetLeft - sc.clientWidth * 0.6);
    }
  }

  function onRoadClick(e) {
    const b = e.target.closest('.stop'); if (!b) return;
    const u = SK.UNLOCKS.find(x => x.id === b.dataset.id), note = b.closest('.track').querySelector('[data-note]');
    if (store.isUnlocked(u.id)) {   // wear it
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
    ui.el.panels.scrollTop = tr.offsetTop - ui.el.panels.offsetTop - 8;
    const sc = stop.closest('.road-scroll'); if (sc) sc.scrollLeft = Math.max(0, stop.offsetLeft - sc.clientWidth / 2);
    stop.classList.add('focus'); setTimeout(() => stop.classList.remove('focus'), 1800);
    tr.querySelector('[data-note]').innerHTML = '<b>' + SK.itemName(u) + ':</b> ' + u.text + ' <small>(' + Math.min(u.value(store.progress()), u.goal) + '/' + u.goal + ')</small>';
  };

  // Re-render everything that depends on settings or saved data.
  ui.refresh = function () {
    renderModes(); renderSkins(); ui.renderLevel();
    if (ui.tab === 'stats') renderStats();
    const m = S.MODE[st.mode];
    const line = m.name + ' · ' + BOARD_NAMES[st.board] + ' · ' + st.apples + (m.portal ? ' pair' : ' apple') + (st.apples > 1 ? 's' : '') + ' · ' + SK.SPEEDS[st.speed] + (st.ramp ? ' +' : '');
    ui.el.modeLine.textContent = line;
    ui.el.modeTag.textContent = m.name;
  };

  ui.setTab = function (name, scrollToBest) {
    ui.tab = name;
    for (const b of $('tabs').querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === name);
    ui.moveInk();
    for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
    hideLock();
    if (name === 'stats') renderStats();
    if (name === 'unlocks') renderRoadmap();
    ui.el.panels.scrollTop = 0;
    if (scrollToBest) { const hd = $('bestHeading'); ui.el.panels.scrollTop = hd.offsetTop - ui.el.panels.offsetTop - 8; }
  };

  // Sliding highlight behind the active tab.
  ui.moveInk = () => {
    const b = $('tabs').querySelector('[aria-selected="true"]'), ink = $('tabInk');
    if (!b || !b.offsetWidth) return;
    ink.style.width = b.offsetWidth + 'px'; ink.style.transform = 'translateX(' + b.offsetLeft + 'px)';
  };

  // Player level + XP bar in the menu header.
  ui.renderLevel = function () {
    const xp = store.data.stats.xp, L = SK.levelOf(xp), a = SK.xpForLevel(L), b = SK.xpForLevel(L + 1);
    const pct = L >= 100 ? 100 : Math.min(100, (xp - a) / (b - a) * 100);
    $('lvl').innerHTML = '<span class="lv-n">' + L + '</span><span class="lv-t"><b>' + SK.titleOf(L) + '</b><small>' +
      (L >= 100 ? 'Max level!' : (b - xp) + ' XP to level ' + (L + 1)) + '</small></span><i class="lv-bar"><i style="width:' + pct.toFixed(1) + '%"></i></i>';
  };
  ui.toastLevel = function (L, title) {
    const t = el('div', 'toast toast-lvl', '<i class="rw rw-lvl">' + L + '</i><span><small>Level up!</small><b>' + title + '</b></span>');
    $('toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2800); setTimeout(() => t.remove(), 3300);
    return t.getBoundingClientRect();
  };

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
  ui.menuOpen = () => !ui.el.overlay.hidden;
  // o = { title, score, best, btn, badge, tab }
  ui.showMenu = o => {
    const E = ui.el;
    E.title.textContent = o.title; E.mScore.textContent = o.score; E.mBest.textContent = o.best; E.play.textContent = o.btn;
    E.badge.hidden = !o.badge; if (o.badge) E.badge.textContent = o.badge;
    E.nextGoal.hidden = !o.next; if (o.next) E.nextGoal.textContent = o.next;
    E.overlay.hidden = false;
    requestAnimationFrame(ui.moveInk);
    // Pause shows a compact card (no tabs, never scrolls); everything else shows the full menu.
    $('menu').classList.toggle('compact', !!o.compact); $('pauseBox').hidden = !o.compact;
    ui.renderMute();
    ui.refresh();
    if (o.tab) ui.setTab(o.tab, o.tab === 'stats');
    else if (ui.tab === 'stats') renderStats();
    else if (ui.tab === 'unlocks') renderRoadmap();
    (o.compact ? $('resumeBtn') : E.play).focus({ preventScroll: true });
  };
  // Open the full tabbed menu from the pause card.
  ui.expand = () => { $('menu').classList.remove('compact'); $('pauseBox').hidden = true; requestAnimationFrame(ui.moveInk); };
  ui.setPlayLabel = t => { ui.el.play.textContent = t; };
  ui.hideMenu = () => {
    ui.el.overlay.hidden = true;
    const a = document.activeElement; if (a && a.blur) a.blur();
  };
  ui.bump = (node, big) => {
    if (S.render.reduced) return;
    try { node.animate([{ transform: 'scale(' + (big ? 1.6 : 1.4) + ')' }, { transform: 'scale(1)' }], { duration: big ? 420 : 240, easing: 'ease-out' }); } catch (e) {}
  };
})(window);
