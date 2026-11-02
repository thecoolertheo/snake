// All sounds are synthesised with the Web Audio API; no files needed.
(function (root) {
  'use strict';
  const S = root.Snake;

  let actx = null, master = null;
  const A = S.audio = { muted: false, volume: 0.8 };

  // Browsers only allow audio after a user gesture, so this is called from input handlers.
  A.unlock = function () {
    if (!actx) {
      try {
        actx = new (root.AudioContext || root.webkitAudioContext)();
        master = actx.createGain();
        master.gain.value = A.volume;
        master.connect(actx.destination);
      } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  };

  function tone(freq, dur, o = {}) {
    if (A.muted) return;
    const a = A.unlock(); if (!a) return;
    const type = o.type || 'sine', vol = o.vol == null ? 0.2 : o.vol, slide = o.slide || 0, delay = o.delay || 0;
    const t0 = a.currentTime + delay, osc = a.createOscillator(), g = a.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  A.sfx = {
    eat() { tone(520, 0.08, { type: 'square', vol: 0.06, slide: 400 }); tone(900, 0.14, { vol: 0.14, delay: 0.05, slide: 350 }); },
    turn() { tone(320, 0.03, { type: 'triangle', vol: 0.035 }); },
    start() { tone(440, 0.08, { type: 'triangle', vol: 0.1 }); tone(660, 0.12, { type: 'triangle', vol: 0.1, delay: 0.08 }); },
    die() { tone(240, 0.16, { type: 'square', vol: 0.08, slide: -120 }); tone(170, 0.4, { type: 'sawtooth', vol: 0.05, delay: 0.12, slide: -110 }); },
    click() { tone(620, 0.04, { type: 'triangle', vol: 0.05 }); }
  };
})(window);
