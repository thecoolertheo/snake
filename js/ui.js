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
    peaceful: '<path d="M15 3a9 9 0 1 0 6.5 13.5A7.5 7.5 0 0 1 15 3z" fill="#27c2b0"/>'
  };
  const BOARD_NAMES = { s: 'Small', m: 'Medium', l: 'Large' };

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
      badge: $('badge'), modeLine: $('modeLine'), modeTag: $('modeTag'), panels: $('panels'), lockNote: $('lockNote')
    };
    const E = ui.el;

    // Tabs
    $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { ui.setTab(b.dataset.tab); h.click(); } });

    // Modes
    const grid = $('modeGrid');
    for (const m of S.MODES) {
      const b = el('button', 'mode-card');
      b.type = 'button'; b.dataset.mode = m.id; b.title = m.desc;
      b.innerHTML = svg(MODE_ICONS[m.id]) + '<b>' + m.name + '</b><small></small>';
      b.addEventListener('click', () => { st.mode = m.id; h.gameChanged(); h.click(); });
      grid.appendChild(b);
    }
    ui.modeDesc = el('p', 'mode-desc'); grid.after(ui.modeDesc);
    seg('segBoard', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']], 'board', true);
    seg('segApples', [[1, '1'], [3, '3'], [5, '5']], 'apples', true);
    seg('segSpeed', SK.SPEEDS.map((n, i) => [i, n]), 'speed', false);
    toggle('swRamp', 'ramp');

    // Snake
    buildSkinPickers();

    // Settings
    const vol = $('volume'), volOut = $('volOut');
    vol.value = Math.round(st.volume * 100); volOut.textContent = vol.value + '%';
    vol.addEventListener('input', () => { st.volume = vol.value / 100; volOut.textContent = vol.value + '%'; h.settingsChanged('volume'); });
    vol.addEventListener('change', () => h.click());
    toggle('swSfx', 'sfx'); toggle('swMusic', 'music'); toggle('swDpad', 'dpad'); toggle('swVibrate', 'vibrate');
    if (!navigator.vibrate) $('vibNote').textContent = 'Not supported on this device (iPhone and iPad can’t vibrate from a web page)';

    // Bar + header buttons
    E.play.addEventListener('click', h.play);
    E.menu.addEventListener('click', h.pause);
    E.bestBtn.addEventListener('click', h.openBest);
    E.mBestBtn.addEventListener('click', () => { ui.setTab('stats', true); h.click(); });
    E.mute.addEventListener('click', () => { st.muted = !st.muted; ui.renderMute(); h.settingsChanged('muted'); if (!st.muted) h.click(); });
    ui.renderMute();
    ui.refresh();
  };

  function seg(id, items, key, isGame) {
    const box = $(id);
    for (const [v, label] of items) {
      const b = el('button', null, label); b.type = 'button';
      b.addEventListener('click', () => {
        st[key] = v; pressed(box, (c, i) => items[i][0] === st[key]);
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
        st.color = i; hideLock(); h.settingsChanged('color'); h.click(); renderSkins();
      });
      colorBox.appendChild(b);
    });
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
    chips('optEyes', 'eyes', SK.EYES);
    chips('optShape', 'shape', SK.SHAPES);
  }
  function showLock(u) { const n = ui.el.lockNote; n.textContent = lockText(u); n.hidden = false; h.click(); }
  function hideLock() { ui.el.lockNote.hidden = true; }

  function renderSkins() {
    const colorBox = $('optColor');
    [...colorBox.children].forEach((b, i) => {
      const u = lockedItem('color', i);
      b.classList.toggle('locked', !!u); b.innerHTML = u ? LOCK : '';
      b.setAttribute('aria-pressed', st.color === i);
      b.setAttribute('aria-label', SK.COLORS[i][0] + (u ? ' (locked)' : ''));
    });
    const chipsRender = (id, key, items, kind) => [...$(id).children].forEach((b, i) => {
      const u = kind && lockedItem(kind, i);
      b.classList.toggle('locked', !!u);
      b.innerHTML = (u ? LOCK : '') + items[i];
      b.setAttribute('aria-pressed', st[key] === i);
    });
    chipsRender('optPattern', 'pattern', SK.PATTERNS, 'pattern');
    chipsRender('optEyes', 'eyes', SK.EYES);
    chipsRender('optShape', 'shape', SK.SHAPES);
  }

  function renderModes() {
    const cards = $('modeGrid').children;
    for (const b of cards) {
      const id = b.dataset.mode;
      b.setAttribute('aria-pressed', st.mode === id);
      b.querySelector('small').textContent = 'Best ' + store.getBest(id, st.board, st.apples);
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
    $('statTiles').innerHTML = [
      ['Games played', s.games], ['Apples eaten', s.apples], ['Longest snake', s.longest], ['Time played', fmtTime(s.timeMs)]
    ].map(([k, v]) => '<div class="tile"><b>' + v + '</b><small>' + k + '</small></div>').join('');

    // Every best score in one place: one card per mode with a board × apples grid.
    const list = $('bestList'); list.innerHTML = '';
    for (const m of S.MODES) {
      const card = el('div', 'best-mode');
      let html = '<b>' + svg(MODE_ICONS[m.id]) + m.name + '</b><span class="top">' + store.bestMode(m.id) + '</span><div class="best-grid">';
      html += '<span class="h rh"></span><span class="h">1 apple</span><span class="h">3 apples</span><span class="h">5 apples</span>';
      for (const b of ['s', 'm', 'l']) {
        html += '<span class="h rh">' + BOARD_NAMES[b] + '</span>';
        for (const a of [1, 3, 5]) {
          const v = store.getBest(m.id, b, a), cur = m.id === st.mode && b === st.board && a === st.apples;
          html += '<span class="v' + (v ? '' : ' zero') + (cur ? ' cur' : '') + '">' + (v || '–') + '</span>';
        }
      }
      card.innerHTML = html + '</div>';
      list.appendChild(card);
    }

    const ul = $('unlockList'), p = store.progress(); ul.innerHTML = '';
    for (const u of SK.UNLOCKS) {
      const done = store.isUnlocked(u.id), v = Math.min(u.value(p), u.goal);
      const row = el('div', 'unlock' + (done ? ' done' : ''));
      const prev = u.kind === 'color' ? '<i class="prev" style="background:' + SK.COLORS[u.index][1] + '"></i>'
        : '<i class="prev" style="background:' + patternSwatch(u.index) + '"></i>';
      row.innerHTML = prev + '<span><b>' + SK.itemName(u) + '</b><br><small>' + u.text + '</small></span><small>' + (done ? 'Unlocked' : v + '/' + u.goal) + '</small>' +
        '<span class="bar-p"><i style="width:' + Math.round(v / u.goal * 100) + '%"></i></span>';
      ul.appendChild(row);
    }
  }
  function patternSwatch(i) {
    const n = SK.PATTERNS[i];
    if (n === 'Sunset') return 'linear-gradient(135deg,#ffcf5c,#ff6f61,#7a5cff)';
    if (n === 'Duo') return 'linear-gradient(90deg,#9db8ff 50%,#5b8cff 50%)';
    if (n === 'Spots') return 'radial-gradient(circle at 35% 40%,rgba(0,0,0,.35) 18%,transparent 20%),radial-gradient(circle at 68% 65%,rgba(0,0,0,.35) 18%,transparent 20%),#5b8cff';
    return '#5b8cff';
  }

  // Re-render everything that depends on settings or saved data.
  ui.refresh = function () {
    renderModes(); renderSkins();
    if (ui.tab === 'stats') renderStats();
    const m = S.MODE[st.mode];
    const line = m.name + ' · ' + BOARD_NAMES[st.board] + ' · ' + st.apples + (m.portal ? ' pair' : ' apple') + (st.apples > 1 ? 's' : '') + ' · ' + SK.SPEEDS[st.speed] + (st.ramp ? ' +' : '');
    ui.el.modeLine.textContent = line;
    ui.el.modeTag.textContent = m.name;
  };

  ui.setTab = function (name, scrollToBest) {
    ui.tab = name;
    for (const b of $('tabs').children) b.setAttribute('aria-selected', b.dataset.tab === name);
    for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
    hideLock();
    if (name === 'stats') renderStats();
    ui.el.panels.scrollTop = 0;
    if (scrollToBest) { const hd = $('bestHeading'); ui.el.panels.scrollTop = hd.offsetTop - ui.el.panels.offsetTop - 8; }
  };

  ui.renderMute = () => {
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
    E.overlay.hidden = false;
    ui.refresh();
    if (o.tab) ui.setTab(o.tab, o.tab === 'stats');
    else if (ui.tab === 'stats') renderStats();
    E.play.focus({ preventScroll: true });
  };
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
