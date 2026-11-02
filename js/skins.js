// Skin catalogue (colours, patterns, eyes, hats, eat effects, tails) and the roadmap of
// milestones that unlock them.
(function (root) {
  'use strict';
  const S = root.Snake = root.Snake || {};

  const SK = S.skins = {
    COLORS: [['Blue', '#5b8cff'], ['Green', '#4cc35b'], ['Purple', '#9b6bff'], ['Pink', '#ff6fb1'],
             ['Orange', '#ff9838'], ['Yellow', '#f2cd3f'], ['Teal', '#27c2b0'], ['Ghost', '#dfe6e2'],
             ['Gold', '#ffc83d'], ['Coral', '#ff7a6b'], ['Mint', '#7debc0'], ['Lilac', '#c9a2ff'],
             ['Ruby', '#ff4d6d'], ['Lime', '#b5e550'], ['Midnight', '#4f63e0'], ['Sky', '#7cc8ff'], ['Peach', '#ffb38a'],
             ['Rose', '#ff8fab'], ['Forest', '#2e9e5b'], ['Copper', '#d9824b'], ['Ice', '#c8f1ff'], ['Cherry', '#e5383b'],
             ['Neon', '#39ff88'], ['Plum', '#8e4fbf'], ['Sand', '#e2c290'], ['Steel', '#8fa3b8'],
             ['Lagoon', '#1fb5c9'], ['Tangerine', '#ff7b2e'], ['Bubblegum', '#ff9ad5'], ['Lemon', '#fff06b'], ['Moss', '#7a9a3a'],
             ['Violet', '#7d5cff'], ['Crimson', '#c9184a'], ['Cyan', '#3ef0ff'], ['Mauve', '#c48ab8'], ['Slate', '#5d6d7e'],
             ['Honey', '#f0b429'], ['Seafoam', '#9ff2d0'], ['Brick', '#b5523b'], ['Pearl', '#f4efe6'],
             ['Indigo', '#3b2a99'], ['Orchid', '#da70d6'], ['Lavender', '#e6d6ff'], ['Fuchsia', '#ff1fa6'], ['Cocoa', '#6b4430'],
             ['Blush', '#ffc4d6'], ['Chartreuse', '#c4ff2e'],
             ['Custom', '#5b8cff']],   // always last: your own colour (see SK.CUSTOM)
    PATTERNS: ['Solid', 'Stripes', 'Fade', 'Rainbow', 'Spots', 'Duo', 'Sunset', 'Zebra', 'Ocean', 'Ember',
               'Aurora', 'Candy', 'Galaxy', 'Tiger', 'Lava', 'Forest', 'Pastel', 'Frost', 'Twilight', 'Mono', 'Bee', 'Melon',
               'Royal', 'Sherbet', 'Toxic', 'Racing'],
    EYES: ['Classic', 'Big', 'Sleepy', 'Shades', 'Star', 'Heart', 'Cyclops', 'Angry', 'Wink', 'Dizzy', 'Robot',
           'Glasses', 'Monocle', 'Sparkly', 'Sus', 'Laser', 'Cute', 'Happy', 'Owl', 'Cat'],
    HATS: ['None', 'Party', 'Crown', 'Top hat', 'Wizard', 'Halo', 'Bow', 'Flower',
           'Beanie', 'Cowboy', 'Chef', 'Viking', 'Pirate', 'Santa', 'Cat ears', 'Antenna', 'Propeller', 'Laurel',
           'Headphones', 'Graduation', 'Bunny ears'],
    BURSTS: ['Classic', 'Confetti', 'Bubbles', 'Sparkle', 'Hearts', 'Pixels', 'Snow', 'Leaves', 'Coins', 'Fireworks', 'Ink', 'Gems', 'Bolts', 'Blossoms'],
    TRAILS: ['None', 'Sparkle', 'Bubbles', 'Embers', 'Hearts', 'Stars', 'Snow', 'Rainbow', 'Smoke', 'Petals', 'Sparks', 'Mist'],
    FOODS: ['Apple', 'Cherry', 'Orange', 'Strawberry', 'Grape', 'Donut', 'Star', 'Gem', 'Mushroom', 'Cookie', 'Pizza', 'Watermelon', 'Blueberry'],
    BOARDS: ['Match mode', 'Midnight', 'Sakura', 'Abyss', 'Desert', 'Retro', 'Neon', 'Snowfield', 'Candy', 'Space', 'Volcano'],
    SHAPES: ['Round', 'Tapered'],
    SPEEDS: ['Slow', 'Normal', 'Fast'],
    SPEED_MS: [190, 150, 110]
  };
  // Multi-stop gradient patterns, tail → head.
  SK.GRADIENTS = {
    Sunset: [[255, 207, 92], [255, 111, 97], [122, 92, 255]],
    Ocean: [[120, 240, 220], [60, 160, 255], [70, 60, 200]],
    Ember: [[255, 236, 120], [255, 140, 50], [220, 40, 40]],
    Aurora: [[90, 255, 170], [60, 200, 230], [170, 90, 255]],
    Galaxy: [[40, 40, 120], [110, 50, 170], [235, 90, 190]],
    Lava: [[255, 220, 80], [255, 80, 30], [120, 10, 10]],
    Forest: [[170, 230, 120], [60, 160, 80], [20, 80, 45]],
    Pastel: [[255, 190, 220], [190, 220, 255], [200, 255, 210]],
    Frost: [[255, 255, 255], [170, 230, 255], [80, 140, 255]],
    Twilight: [[255, 150, 90], [160, 80, 200], [40, 40, 110]],
    Royal: [[255, 210, 90], [150, 60, 200], [40, 20, 90]],
    Sherbet: [[255, 170, 120], [255, 230, 140], [160, 230, 170]],
    Toxic: [[200, 255, 60], [60, 200, 90], [20, 90, 60]]
  };
  // Banded patterns with their own colours (they ignore the chosen colour): main, band, band width (fraction of a cell)
  SK.FIXED_BANDS = {
    Candy: [[255, 77, 109], [255, 240, 245], 0.35],
    Tiger: [[255, 152, 56], [40, 22, 10], 0.22],
    Mono: [[235, 235, 235], [30, 30, 30], 0.5],
    Bee: [[255, 200, 40], [30, 25, 10], 0.4],
    Melon: [[90, 190, 90], [190, 240, 160], 0.3],
    Racing: [[230, 40, 40], [255, 255, 255], 0.15]
  };
  // Eat effects: particle colours and shape.
  SK.BURST_STYLES = {
    Classic:  { colors: ['#ff5a4e', '#5fd16a', '#ffd5cf'], shape: 'dot' },
    Confetti: { colors: ['#ff5a4e', '#ffc83d', '#5b8cff', '#4cc35b', '#ff6fb1'], shape: 'rect' },
    Bubbles:  { colors: ['#9fe3ff', '#d6f3ff', '#6cc4ff'], shape: 'ring' },
    Sparkle:  { colors: ['#fff3b0', '#ffc83d', '#ffffff'], shape: 'star' },
    Hearts:   { colors: ['#ff4d7a', '#ff8fab', '#ffd1dc'], shape: 'heart' },
    Pixels:   { colors: ['#39ff88', '#7cc8ff', '#ffffff'], shape: 'square' },
    Snow:     { colors: ['#ffffff', '#d6f3ff', '#a9dcff'], shape: 'star' },
    Leaves:   { colors: ['#7ac74f', '#f2a541', '#d9534f'], shape: 'leaf' },
    Coins:    { colors: ['#ffc83d', '#ffe08a', '#d99a00'], shape: 'coin' },
    Fireworks:{ colors: ['#ff5a4e', '#ffc83d', '#5b8cff', '#ff6fb1', '#39ff88', '#ffffff'], shape: 'dot', count: 26 },
    Ink:      { colors: ['#8e6bff', '#5a3fc0', '#c9a2ff'], shape: 'dot' },
    Gems:     { colors: ['#4ff0ff', '#c77dff', '#ff4d7a'], shape: 'gem' },
    Bolts:    { colors: ['#ffe36b', '#ffffff', '#7cc8ff'], shape: 'bolt' },
    Blossoms: { colors: ['#ffb7d5', '#ffffff', '#ffe36b'], shape: 'flower' }
  };
  // Trails: little particles left behind the tail as you move. [colours, shape]
  SK.TRAIL_STYLES = {
    Sparkle: [['#fff3b0', '#ffffff'], 'star'], Bubbles: [['#9fe3ff', '#d6f3ff'], 'ring'], Embers: [['#ff9838', '#ffc83d', '#ff5a4e'], 'dot'],
    Hearts: [['#ff4d7a', '#ff8fab'], 'heart'], Stars: [['#ffe36b', '#c9a2ff', '#7cc8ff'], 'star'], Snow: [['#ffffff', '#d6f3ff'], 'dot'],
    Rainbow: [['#ff5a4e', '#ffc83d', '#4cc35b', '#27c2b0', '#5b8cff', '#9b6bff'], 'dot'], Smoke: [['#8a9a90', '#5a6a60', '#b0bab4'], 'puff'],
    Petals: [['#ffb7d5', '#ff8fab', '#fff0f5'], 'leaf'], Sparks: [['#ffe36b', '#4ff0ff', '#ffffff'], 'dot'],
    Mist: [['#c8f1ff', '#e6f7ff', '#a9dcff'], 'puff']
  };
  // Board skins override the mode's board (Match mode keeps it).
  SK.BOARD_THEMES = {
    Midnight:  { a: '#161b33', b: '#12172c', light: '140,160,255', glow: 'rgba(80,100,255,.12)',  accent: '#7c8cff', amb: 'stars' },
    Sakura:    { a: '#2e1f27', b: '#281a21', light: '255,190,215', glow: 'rgba(255,143,171,.14)', accent: '#ff8fab', amb: 'petals' },
    Abyss:     { a: '#0f2230', b: '#0c1d29', light: '90,200,255',  glow: 'rgba(31,181,201,.14)',  accent: '#1fb5c9', amb: 'bubbles' },
    Desert:    { a: '#3a2f1f', b: '#332919', light: '255,220,160', glow: 'rgba(226,194,144,.14)', accent: '#e2c290', amb: 'dust' },
    Retro:     { a: '#8bac0f', b: '#7a9a0c', light: '220,255,140', glow: 'rgba(139,172,15,.18)',  accent: '#9bbc0f', amb: null, flat: true },
    Neon:      { a: '#0d0d16', b: '#0a0a12', light: '255,80,220',  glow: 'rgba(255,80,220,.14)',  accent: '#ff50dc', amb: 'streaks', grid: '255,80,220' },
    Snowfield: { a: '#2a3540', b: '#24303a', light: '220,240,255', glow: 'rgba(200,241,255,.12)', accent: '#c8f1ff', amb: 'snow' },
    Candy:     { a: '#3a2236', b: '#331d2f', light: '255,170,230', glow: 'rgba(255,154,213,.14)', accent: '#ff9ad5', amb: 'sparkle' },
    Space:     { a: '#0b0c14', b: '#08090f', light: '160,170,255', glow: 'rgba(120,130,255,.10)', accent: '#9aa4ff', amb: 'stars' },
    Volcano:   { a: '#2d1410', b: '#26100c', light: '255,110,60',  glow: 'rgba(255,90,40,.15)',   accent: '#ff6a3d', amb: 'embers' }
  };

  // ---------- Custom colour ----------
  // The last colour is your own. It must be clearly different from every built-in colour
  // (perceptual distance, CIE ΔE76 in Lab space).
  SK.CUSTOM = SK.COLORS.length - 1;
  SK.CUSTOM_MIN = 15;
  SK.colorHex = st => (st.color === SK.CUSTOM && st.customColor) ? st.customColor : (SK.COLORS[st.color] || SK.COLORS[0])[1];
  const lab = hex => {
    const lin = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92);
    const [r, g, b] = lin, f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  SK.colorDistance = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  // Closest built-in colour to hex: { name, hex, dist }
  SK.nearestColor = hex => {
    let best = null;
    for (let i = 0; i < SK.CUSTOM; i++) {
      const d = SK.colorDistance(hex, SK.COLORS[i][1]);
      if (!best || d < best.dist) best = { name: SK.COLORS[i][0], hex: SK.COLORS[i][1], dist: d };
    }
    return best;
  };

  // Player level: XP from apples (10 each), finished games (15) and new bests (50).
  // Level n → n+1 needs 60 + 20n XP, so level 100 is a very long road.
  SK.xpForLevel = L => { let t = 0; for (let i = 1; i < L; i++) t += 60 + 20 * i; return t; };
  SK.levelOf = xp => { let L = 1; while (L < 100 && xp >= SK.xpForLevel(L + 1)) L++; return L; };
  SK.TITLES = [[1, 'Hatchling'], [3, 'Wriggler'], [6, 'Slitherer'], [10, 'Coiler'], [15, 'Garden Snake'], [20, 'Grass Snake'],
    [25, 'Rat Snake'], [30, 'Python'], [40, 'Cobra'], [50, 'Mamba'], [60, 'Viper'], [70, 'Anaconda'], [80, 'Basilisk'], [90, 'Hydra'], [100, 'Ouroboros']];
  SK.titleOf = L => { let t = SK.TITLES[0][1]; for (const [l, n] of SK.TITLES) if (L >= l) t = n; return t; };

  // The roadmap: one path per stat, each with rewards at milestones (like a level map).
  // Rewards can be colours, patterns, eyes, hats, eat effects or whole game modes.
  // p = progress snapshot: { games, apples, longest, bestAny, minutes, bestMode(id) }
  // Reward ids never change, so saved unlocks survive edits to goals or order.
  const C = (id, goal, index) => ({ id, goal, kind: 'color', index });
  const P = (id, goal, index) => ({ id, goal, kind: 'pattern', index });
  const E = (id, goal, index) => ({ id, goal, kind: 'eyes', index });
  const H = (id, goal, index) => ({ id, goal, kind: 'hat', index });
  const B = (id, goal, index) => ({ id, goal, kind: 'burst', index });
  const M = (id, goal, mode) => ({ id, goal, kind: 'mode', index: mode });
  const T = (id, goal, index) => ({ id, goal, kind: 'trail', index });
  const F = (id, goal, index) => ({ id, goal, kind: 'food', index });
  const BD = (id, goal, index) => ({ id, goal, kind: 'board', index });
  const modeTrack = (mode, name, steps) => ({
    id: mode, name: name + ' mode', unit: 'points', how: 'Best score in ' + name + ' mode, any board size.',
    value: p => p.bestMode(mode), verb: g => 'Score ' + g + ' in ' + name + ' mode', steps
  });
  SK.TRACKS = [
    { id: 'level', name: 'Player level', unit: 'level', how: 'Earn XP from every apple, every finished game and every new best.',
      value: p => p.level, verb: g => 'Reach level ' + g,
      steps: [T('t-sparkle', 2, 1), F('f-cherry', 3, 1), C('c-lagoon', 4, 26), H('h-beanie', 5, 8), B('b-snow', 6, 6), BD('bd-midnight', 8, 1),
              E('e-glasses', 10, 11), T('t-bubbles', 12, 2), F('f-orange', 14, 2), P('p-pastel', 16, 16), H('h-cowboy', 18, 9), BD('bd-sakura', 20, 2),
              C('c-violet', 23, 31), T('t-stars', 26, 5), E('e-sparkly', 30, 13), F('f-donut', 35, 5), H('h-viking', 40, 11), BD('bd-neon', 45, 6),
              P('p-twilight', 50, 18), C('c-pearl', 55, 39), T('t-rainbow', 60, 7), H('h-propeller', 70, 16), F('f-gem', 80, 7), BD('bd-candy', 90, 8),
              C('c-indigo', 65, 40), H('h-graduation', 75, 19), P('p-sherbet', 85, 23), B('b-bolts', 95, 12), H('h-laurel', 100, 17)] },
    { id: 'apples', name: 'Apples eaten', unit: 'apples', how: 'Eat apples in any mode. Every apple counts.',
      value: p => p.apples, verb: g => 'Eat ' + g + ' apples in total', cumulative: true,
      steps: [C('c-rose', 25, 17), C('c-mint', 50, 10), B('b-confetti', 100, 1), P('p-zebra', 150, 7), M('m-gold', 200, 'gold'),
              P('p-sunset', 300, 6), H('h-party', 400, 1), E('e-star', 600, 4), P('p-galaxy', 800, 12), H('h-crown', 1000, 2),
              F('f-strawberry', 1500, 3), B('b-coins', 2000, 8), P('p-lava', 3000, 14), H('h-santa', 5000, 13),
              F('f-watermelon', 7500, 11), BD('bd-volcano', 10000, 10)] },
    { id: 'games', name: 'Games played', unit: 'games', how: 'Finish games. Any mode, any score.',
      value: p => p.games, verb: g => 'Play ' + g + ' games', cumulative: true,
      steps: [C('c-forest', 3, 18), C('c-coral', 5, 9), E('e-wink', 10, 8), M('m-mirror', 15, 'mirror'), C('c-lime', 25, 13),
              B('b-bubbles', 40, 2), H('h-tophat', 50, 3), E('e-cyclops', 75, 6), C('c-plum', 100, 23), H('h-wizard', 150, 4),
              T('t-embers', 200, 3), C('c-crimson', 300, 32), E('e-monocle', 500, 12), E('e-owl', 750, 18), C('c-orchid', 1000, 41)] },
    { id: 'best', name: 'Best score', unit: 'points', how: 'Your highest score in a single game, any mode.',
      value: p => p.bestAny, verb: g => 'Score ' + g + ' in one game',
      steps: [C('c-cherry', 10, 21), C('c-ruby', 15, 12), M('m-turbo', 20, 'turbo'), C('c-gold', 25, 8), M('m-runaway', 30, 'runaway'),
              E('e-heart', 40, 5), H('h-halo', 50, 5), C('c-neon', 60, 22), P('p-aurora', 75, 10),
              BD('bd-abyss', 90, 3), B('b-fireworks', 100, 9), P('p-frost', 125, 17), E('e-laser', 150, 15),
              T('t-mist', 175, 11), C('c-lavender', 200, 42)] },
    { id: 'length', name: 'Longest snake', unit: 'long', how: 'How long your snake has ever grown in one game.',
      value: p => p.longest, verb: g => 'Grow to ' + g + ' long',
      steps: [H('h-bow', 15, 6), M('m-dark', 25, 'dark'), P('p-spots', 30, 4), P('p-tiger', 40, 13), C('c-midnight', 50, 14),
              E('e-dizzy', 75, 9), C('c-ice', 100, 20),
              T('t-petals', 125, 9), H('h-chef', 150, 10), C('c-cyan', 200, 33), E('e-cat', 250, 19), C('c-fuchsia', 300, 43)] },
    { id: 'time', name: 'Time played', unit: 'minutes', how: 'Minutes spent actually playing (paused time doesn’t count).',
      value: p => p.minutes, cumulative: true,
      verb: g => 'Play for ' + (g >= 60 ? (g / 60) + ' hour' + (g > 60 ? 's' : '') : g + ' minutes'),
      steps: [C('c-sky', 10, 15), C('c-sand', 20, 24), M('m-hunger', 30, 'hunger'), P('p-ocean', 60, 8), B('b-sparkle', 120, 3),
              E('e-angry', 180, 7), E('e-robot', 300, 10), H('h-flower', 600, 7),
              F('f-mushroom', 900, 8), BD('bd-retro', 1200, 5), H('h-pirate', 1800, 12), H('h-bunny', 2400, 20), P('p-toxic', 3000, 24)] },
    modeTrack('classic', 'Classic', [C('c-tangerine', 10, 27), C('c-honey', 25, 36), H('h-catears', 50, 14), C('c-cocoa', 75, 44)]),
    modeTrack('borderless', 'Borderless', [C('c-copper', 15, 19), P('p-ember', 25, 9), T('t-snow', 40, 6)]),
    modeTrack('walls', 'Walls', [C('c-steel', 5, 25), P('p-duo', 10, 5), B('b-pixels', 20, 5), C('c-brick', 35, 38), B('b-blossoms', 50, 13)]),
    modeTrack('portal', 'Portal', [C('c-lilac', 10, 11), P('p-candy', 20, 11), B('b-gems', 35, 11), H('h-antenna', 50, 15), C('c-blush', 75, 45)]),
    modeTrack('poison', 'Poison', [C('c-peach', 10, 16), B('b-hearts', 20, 4), C('c-mauve', 35, 34)]),
    modeTrack('peaceful', 'Peaceful', [C('c-seafoam', 25, 37), T('t-smoke', 75, 8), F('f-cookie', 150, 9), F('f-blueberry', 250, 12)]),
    modeTrack('turbo', 'Turbo', [C('c-lemon', 10, 29), B('b-leaves', 25, 7), BD('bd-desert', 40, 4), P('p-racing', 60, 25)]),
    modeTrack('mirror', 'Mirror', [C('c-bubblegum', 10, 28), E('e-sus', 25, 14), P('p-mono', 40, 19)]),
    modeTrack('dark', 'Dark', [C('c-slate', 10, 35), B('b-ink', 25, 10), BD('bd-snowfield', 40, 7), C('c-chartreuse', 60, 46)]),
    modeTrack('gold', 'Gold Rush', [C('c-moss', 10, 30), F('f-grape', 25, 4), P('p-bee', 50, 20)]),
    modeTrack('hunger', 'Hunger', [T('t-hearts', 10, 4), P('p-forest', 25, 15)]),
    modeTrack('runaway', 'Runaway', [F('f-star', 10, 6), P('p-melon', 25, 21), E('e-cute', 40, 16)]),
    // The collection itself: unlock rewards to earn more. The final stop needs every other reward.
    { id: 'collector', name: 'Collector', unit: 'rewards', how: 'Every reward you unlock counts. The last stop needs all of them.',
      value: p => p.collected, verb: g => 'Unlock ' + g + ' rewards',
      steps: [E('e-happy', 20, 17), T('t-sparks', 40, 10), H('h-headphones', 60, 18), P('p-royal', 80, 22), BD('bd-space', 100, 9),
              F('f-pizza', 120, 10), C('c-custom', 149, 47)] }
  ];

  for (const t of SK.TRACKS) t.steps.sort((a, b) => a.goal - b.goal);   // stops always run in goal order

  // Flat list of every reward, with its track, for lookups.
  SK.UNLOCKS = [];
  for (const t of SK.TRACKS) for (const s of t.steps) {
    SK.UNLOCKS.push({ id: s.id, kind: s.kind, index: s.index, goal: s.goal, track: t, text: t.verb(s.goal), value: t.value });
  }

  SK.unlockFor = (kind, index) => SK.UNLOCKS.find(u => u.kind === kind && u.index === index) || null;
  const KIND_NAMES = { color: 'colour', pattern: 'pattern', eyes: 'eyes', hat: 'hat', burst: 'eat effect', mode: 'mode',
                       trail: 'trail', food: 'food', board: 'board' };
  const LISTS = { pattern: 'PATTERNS', eyes: 'EYES', hat: 'HATS', burst: 'BURSTS', trail: 'TRAILS', food: 'FOODS', board: 'BOARDS' };
  SK.itemName = u => {
    const n = u.kind === 'color' ? SK.COLORS[u.index][0] : u.kind === 'mode' ? S.MODE[u.index].name : SK[LISTS[u.kind]][u.index];
    return n + ' ' + KIND_NAMES[u.kind];
  };
  // Which setting a reward changes when you use it.
  SK.settingKey = kind => (kind === 'board' ? 'boardSkin' : kind);   // 'board' is already the board size
})(typeof window !== 'undefined' ? window : globalThis);
