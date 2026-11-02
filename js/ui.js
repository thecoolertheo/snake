// DOM side of the app: the top bar, the menu overlay and the skin options.
(function (root) {
  'use strict';
  const S = root.Snake, SK = S.skins;
  const $ = id => document.getElementById(id);

  const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

  const ui = S.ui = {};

  // h = { play(), pause(), settingsChanged(), click() }
  ui.init = function (settings, h) {
    ui.el = {
      score: $('score'), best: $('best'), overlay: $('overlay'), title: $('ovTitle'),
      mScore: $('mScore'), mBest: $('mBest'), play: $('playBtn'), mute: $('muteBtn'), menu: $('menuBtn'),
      stage: $('stage'), wrap: $('wrap'), bar: $('bar'), pv: $('pv')
    };
    const el = ui.el;

    const colorBox = $('optColor');
    SK.COLORS.forEach(([name, hex], i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sw'; b.style.background = hex; b.title = name;
      b.setAttribute('aria-label', name); b.setAttribute('aria-pressed', settings.color === i);
      b.addEventListener('click', () => {
        settings.color = i; h.settingsChanged(); h.click();
        [...colorBox.children].forEach((c, j) => c.setAttribute('aria-pressed', j === i));
      });
      colorBox.appendChild(b);
    });
    const fill = (id, key, items) => {
      const sel = $(id);
      items.forEach((n, i) => sel.add(new Option(n, i)));
      sel.value = settings[key];
      sel.addEventListener('change', () => { settings[key] = +sel.value; h.settingsChanged(); h.click(); });
    };
    fill('optPattern', 'pattern', SK.PATTERNS);
    fill('optEyes', 'eyes', SK.EYES);
    fill('optShape', 'shape', SK.SHAPES);
    fill('optSpeed', 'speed', SK.SPEEDS);

    el.play.addEventListener('click', h.play);
    el.menu.addEventListener('click', h.pause);
    el.mute.addEventListener('click', () => { settings.muted = !settings.muted; ui.renderMute(settings.muted); h.settingsChanged(); if (!settings.muted) h.click(); });
    ui.renderMute(settings.muted);
  };

  ui.renderMute = muted => {
    ui.el.mute.innerHTML = muted ? ICON_OFF : ICON_ON;
    ui.el.mute.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
  };
  ui.setScore = (n, bump) => { ui.el.score.textContent = n; if (bump) ui.bump(ui.el.score); };
  ui.setBest = n => { ui.el.best.textContent = n; };
  ui.menuOpen = () => !ui.el.overlay.hidden;
  ui.showMenu = (title, score, best, btn) => {
    const el = ui.el;
    el.title.textContent = title; el.mScore.textContent = score; el.mBest.textContent = best; el.play.textContent = btn;
    el.overlay.hidden = false; el.play.focus({ preventScroll: true });
  };
  ui.hideMenu = () => {
    ui.el.overlay.hidden = true;
    const a = document.activeElement; if (a && a.blur) a.blur();
  };
  ui.bump = el => { try { el.animate([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' }); } catch (e) {} };
})(window);
