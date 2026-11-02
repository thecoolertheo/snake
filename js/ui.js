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
    $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { ui.setTab(b.dataset.tab); h.click(); } });

    // Modes
    const grid = $('modeGrid');
    for (const m of S.MODES) {
      const b = el('button', 'mode-card');
      b.type = 'button'; b.dataset.mode = m.id; b.title = m.desc;
      b.innerHTML = svg(MODE_ICONS[m.id]) + '<b>' + m.name + '</b><small></small>';
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
    chips('optEyes', 'eyes', SK.EYES, 'eyes');
    $('lockRoad').addEventListener('click', () => { ui.showOnRoad(ui.lockFocus); h.click(); });
    $('roadmap').addEventListener('click', onRoadClick);
    chips('optShape', 'shape', SK.SHAPES);
  }
  function showLock(u) { ui.lockFocus = u; ui.el.lockText.textContent = lockText(u) + ' '; ui.el.lockNote.hidden = false; ui.el.lockNote.scrollIntoView({ block: 'nearest', behavior: S.render.reduced ? 'auto' : 'smooth' }); h.click(); }
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
    chipsRender('optEyes', 'eyes', SK.EYES, 'eyes');
    const got = SK.UNLOCKS.filter(u => store.isUnlocked(u.id)).length;
    $('unlockSum').innerHTML = '<span><b>' + got + ' of ' + SK.UNLOCKS.length + '</b> extra items unlocked</span><button type="button" class="link" data-go="unlocks">See how to unlock them</button>';
    chipsRender('optShape', 'shape', SK.SHAPES);
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
    $('statTiles').innerHTML = [
      ['Games played', s.games], ['Apples eaten', s.apples], ['Longest snake', s.longest], ['Time played', fmtTime(s.timeMs)]
    ].map(([k, v]) => '<div class="tile"><b>' + v + '</b><small>' + k + '</small></div>').join('');

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
    if (n === 'Spots') return 'radial-gradient(circle at 35% 40%,rgba(0,0,0,.35) 18%,transparent 20%),radial-gradient(circle at 68% 65%,rgba(0,0,0,.35) 18%,transparent 20%),#5b8cff';
    return '#5b8cff';
  }

  // Small snake-head picture showing an eye style (for the roadmap).
  function eyePreview(i) {
    const n = SK.EYES[i], pupil = (x, y) => n === 'Star'
      ? '<path transform="translate(' + x + ' ' + y + ')" d="M0-3.2l.9 2 2.2.2-1.7 1.4.5 2.2L0 1.5l-1.9 1.1.5-2.2-1.7-1.4 2.2-.2z" fill="#f0a500"/>'
      : n === 'Heart' ? '<path transform="translate(' + x + ' ' + y + ')" d="M0 2.6C-3.6 0-3 -3 -1.4-3 -.6-3 0-2.4 0-1.8 0-2.4.6-3 1.4-3 3-3 3.6 0 0 2.6z" fill="#ff4d7a"/>'
      : '<circle cx="' + x + '" cy="' + y + '" r="2" fill="#0f1512"/>';
    const eyes = n === 'Cyclops' ? '<circle cx="14" cy="13" r="6.5" fill="#fff"/><circle cx="14" cy="13" r="3.2" fill="#0f1512"/><circle cx="15.3" cy="11.6" r="1" fill="#fff"/>'
      : '<circle cx="9.5" cy="12" r="4.2" fill="#fff"/><circle cx="18.5" cy="12" r="4.2" fill="#fff"/>' + pupil(9.5, 12.4) + pupil(18.5, 12.4);
    return '<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="15" r="12" fill="#5b8cff"/>' + eyes + '</svg>';
  }
  function rewardPreview(u) {
    if (u.kind === 'mode') return '<i class="rw rw-mode">' + svg(MODE_ICONS[u.index]) + '</i>';
    if (u.kind === 'color') return '<i class="rw" style="background:' + SK.COLORS[u.index][1] + '"></i>';
    if (u.kind === 'pattern') return '<i class="rw" style="background:' + patternSwatch(u.index) + '"></i>';
    return '<i class="rw rw-eyes">' + eyePreview(u.index) + '</i>';
  }
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const TRACK_ICONS = {
    apples: '<circle cx="12" cy="14" r="8" fill="#ff5a4e"/><path d="M12 6c0-2 1-3 3-4" stroke="#5fd16a" stroke-width="2" fill="none" stroke-linecap="round"/>',
    games: '<path d="M7 5v14l12-7z" fill="#5b8cff"/>',
    best: '<path d="M5 4h14v4a7 7 0 0 1-14 0zM9 18h6v3H9zM11 14h2v4h-2z" fill="#f2c94c"/>',
    length: '<path d="M3 16h10a4 4 0 0 0 0-8H9" stroke="#4cc35b" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="19" cy="16" r="3" fill="#4cc35b"/>',
    walls: MODE_ICONS.walls, portal: MODE_ICONS.portal
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
    let html = '';
    for (const t of SK.TRACKS) {
      const v = t.value(p), n = t.steps.length;
      let next = null;
      html += '<article class="track" data-track="' + t.id + '"><header>' + svg(TRACK_ICONS[t.id]) + '<b>' + t.name + '</b><span class="cur">' + v + '</span></header>';
      html += '<p class="how">' + t.how + '</p>';
      html += '<div class="road' + (n >= 5 ? ' many' : '') + '"><div class="rail"><i style="width:' + (trackFill(t, v) * 100).toFixed(1) + '%"></i></div><span class="start">0</span>';
      t.steps.forEach((s, i) => {
        const u = SK.UNLOCKS.find(x => x.id === s.id), done = store.isUnlocked(u.id);
        if (!done && !next) next = u;
        const cls = done ? 'done' : (next === u ? 'next' : 'locked');
        const worn = done && st[SK.settingKey(u.kind)] === u.index;
        html += '<button type="button" class="stop ' + cls + (worn ? ' worn' : '') + '" data-id="' + u.id + '" style="left:' + ((i + 1) / n * 100) + '%" ' +
          'aria-label="' + SK.itemName(u) + ': ' + u.text + (done ? ', unlocked' : '') + '">' + rewardPreview(u) +
          '<span class="mark">' + (done ? CHECK : LOCK) + '</span><span class="goal">' + s.goal + '</span></button>';
      });
      html += '</div><p class="next" data-note>' + (next
        ? '<b>Next:</b> ' + SK.itemName(next) + ' at ' + next.goal + ' ' + t.unit + ' <small>(' + Math.max(0, next.goal - v) + ' to go)</small>'
        : '<b class="ok">All rewards on this path unlocked!</b>') + '</p></article>';
    }
    box.innerHTML = html;
  }

  function onRoadClick(e) {
    const b = e.target.closest('.stop'); if (!b) return;
    const u = SK.UNLOCKS.find(x => x.id === b.dataset.id), note = b.closest('.track').querySelector('[data-note]');
    if (store.isUnlocked(u.id)) {   // wear it
      st[SK.settingKey(u.kind)] = u.index; h.click();
      if (u.kind === 'mode') h.gameChanged(); else h.settingsChanged(u.kind);
      renderRoadmap(); renderSkins();
      const n2 = $('roadmap').querySelector('[data-track="' + u.track.id + '"] [data-note]');
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
    stop.classList.add('focus'); setTimeout(() => stop.classList.remove('focus'), 1800);
    tr.querySelector('[data-note]').innerHTML = '<b>' + SK.itemName(u) + ':</b> ' + u.text + ' <small>(' + Math.min(u.value(store.progress()), u.goal) + '/' + u.goal + ')</small>';
  };

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
    if (name === 'unlocks') renderRoadmap();
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
    E.nextGoal.hidden = !o.next; if (o.next) E.nextGoal.textContent = o.next;
    E.overlay.hidden = false;
    ui.refresh();
    if (o.tab) ui.setTab(o.tab, o.tab === 'stats');
    else if (ui.tab === 'stats') renderStats();
    else if (ui.tab === 'unlocks') renderRoadmap();
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
