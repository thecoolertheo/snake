// All sounds are synthesised with the Web Audio API; no files needed.
// Graph: sfx bus ─┐
//        music bus (lowpass) ─┴─> master (volume / mute) ─> speakers
(function (root) {
  'use strict';
  const S = root.Snake;

  let actx = null, master = null, sfxBus = null, musicBus = null, musicFilter = null;
  const A = S.audio = { muted: false, volume: 0.8, sfxOn: true, musicOn: false, duck: false };

  // Browsers only allow audio after a user gesture, so this is called from input handlers.
  A.unlock = function () {
    if (!actx) {
      try {
        actx = new (root.AudioContext || root.webkitAudioContext)();
        master = actx.createGain();
        sfxBus = actx.createGain();
        musicBus = actx.createGain(); musicBus.gain.value = 0;
        musicFilter = actx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 1800;
        sfxBus.connect(master); musicBus.connect(musicFilter).connect(master); master.connect(actx.destination);
        A.apply();
      } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended' && !document.hidden) actx.resume();
    return actx;
  };

  const ramp = (param, v, t = 0.08) => { const now = actx.currentTime; param.cancelScheduledValues(now); param.setTargetAtTime(v, now, t / 3); };
  // Smooth linear fade from wherever the value is right now.
  const fade = (param, v, secs) => {
    const now = actx.currentTime;
    param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); param.linearRampToValueAtTime(v, now + secs);
  };
  const MUSIC_IN = 2.2, MUSIC_OUT = 1.6, DUCK = 0.8;
  let musicPlaying = false, stopTimer = 0, lastDuck = null;

  // Push current settings into the audio graph.
  A.apply = function () {
    if (!actx) return;
    ramp(master.gain, A.muted ? 0 : A.volume * A.volume);   // squared feels more even on a slider
    const level = A.duck ? 0.16 : 0.3;
    if (A.musicOn && !musicPlaying) {          // fade in
      musicPlaying = true; clearTimeout(stopTimer);
      startMusic(); fade(musicBus.gain, level, MUSIC_IN);
    } else if (!A.musicOn && musicPlaying) {   // fade out, then stop scheduling notes
      musicPlaying = false;
      fade(musicBus.gain, 0, MUSIC_OUT);
      clearTimeout(stopTimer); stopTimer = setTimeout(stopMusic, MUSIC_OUT * 1000 + 100);
    } else if (musicPlaying && lastDuck !== A.duck) {
      fade(musicBus.gain, level, DUCK);        // menu open/closed: dip smoothly
    }
    lastDuck = A.duck;
  };
  A.musicLevel = () => (musicBus ? musicBus.gain.value : 0);   // for checks/debugging
  A.set = function (o) { Object.assign(A, o); A.apply(); };
  A.suspend = () => { if (actx && actx.state === 'running') actx.suspend(); };
  A.resume = () => { if (actx && actx.state === 'suspended') actx.resume(); };

  function tone(freq, dur, o = {}) {
    if (A.muted || !A.sfxOn) return;
    const a = A.unlock(); if (!a) return;
    const type = o.type || 'sine', vol = o.vol == null ? 0.2 : o.vol, slide = o.slide || 0, delay = o.delay || 0;
    const t0 = a.currentTime + delay, osc = a.createOscillator(), g = a.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  A.sfx = {
    eat() { tone(520, 0.08, { type: 'square', vol: 0.06, slide: 400 }); tone(900, 0.14, { vol: 0.14, delay: 0.05, slide: 350 }); },
    turn() { tone(320, 0.03, { type: 'triangle', vol: 0.035 }); },
    start() { tone(440, 0.08, { type: 'triangle', vol: 0.1 }); tone(660, 0.12, { type: 'triangle', vol: 0.1, delay: 0.08 }); },
    tick() { tone(520, 0.07, { type: 'triangle', vol: 0.08 }); },
    die() { tone(240, 0.16, { type: 'square', vol: 0.08, slide: -120 }); tone(170, 0.4, { type: 'sawtooth', vol: 0.05, delay: 0.12, slide: -110 }); },
    click() { tone(620, 0.04, { type: 'triangle', vol: 0.05 }); },
    poison() { tone(300, 0.18, { type: 'square', vol: 0.06, slide: -140 }); tone(200, 0.22, { vol: 0.12, delay: 0.06, slide: -90 }); },
    portal() { tone(300, 0.22, { vol: 0.12, slide: 900 }); tone(600, 0.2, { type: 'triangle', vol: 0.06, delay: 0.08, slide: 700 }); },
    gold() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.07, delay: 0.04 + i * 0.05 })); },
    wall() { tone(110, 0.12, { type: 'triangle', vol: 0.12, slide: -40 }); },
    passBest() { [784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.08, delay: i * 0.08 })); },
    newBest() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i === 4 ? 0.5 : 0.16, { type: 'triangle', vol: 0.1, delay: i * 0.09 })); },
    unlock() { [988, 1319, 1760].forEach((f, i) => tone(f, 0.22, { vol: 0.08, delay: 0.5 + i * 0.07 })); }
  };

  // ---------- background music: a slow, soft chord loop with a sparse arpeggio ----------
  const BPM = 76, EIGHTH = 60 / BPM / 2;
  const CHORDS = [[45, 57, 60, 64, 67], [41, 53, 57, 60, 64], [48, 55, 59, 64, 67], [43, 55, 59, 62, 66]];   // Am7 Fmaj7 Cmaj7 G
  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
  let timer = 0, nextT = 0, stepN = 0, rnd = 1;
  const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;

  function note(freq, t, dur, vol, type, attack) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function schedule() {
    if (!actx || actx.state !== 'running') return;
    while (nextT < actx.currentTime + 0.5) {
      const bar = Math.floor(stepN / 8) % CHORDS.length, ch = CHORDS[bar], beat = stepN % 8;
      if (beat === 0) {   // pad: bass + three soft voices for the whole bar
        const len = EIGHTH * 8 + 0.6;
        note(mtof(ch[0]), nextT, len, 0.16, 'sine', 0.4);
        for (let i = 1; i < 4; i++) note(mtof(ch[i]), nextT, len, 0.045, 'triangle', 0.8);
      }
      if (rand() > 0.35) {   // sparse arpeggio
        const n = ch[1 + Math.floor(rand() * 4)] + 12;
        note(mtof(n), nextT, 0.9, 0.05, 'sine', 0.01);
      }
      nextT += EIGHTH; stepN++;
    }
  }
  function startMusic() {
    if (timer || !actx) return;
    nextT = actx.currentTime + 0.1;
    timer = setInterval(schedule, 120);
    schedule();
  }
  function stopMusic() { if (timer) { clearInterval(timer); timer = 0; } }
})(window);
