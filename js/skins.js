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
             ['Neon', '#39ff88'], ['Plum', '#8e4fbf'], ['Sand', '#e2c290'], ['Steel', '#8fa3b8']],
    PATTERNS: ['Solid', 'Stripes', 'Fade', 'Rainbow', 'Spots', 'Duo', 'Sunset', 'Zebra', 'Ocean', 'Ember',
               'Aurora', 'Candy', 'Galaxy', 'Tiger'],
    EYES: ['Classic', 'Big', 'Sleepy', 'Shades', 'Star', 'Heart', 'Cyclops', 'Angry', 'Wink', 'Dizzy', 'Robot'],
    HATS: ['None', 'Party', 'Crown', 'Top hat', 'Wizard', 'Halo', 'Bow', 'Flower'],
    BURSTS: ['Classic', 'Confetti', 'Bubbles', 'Sparkle', 'Hearts', 'Pixels'],
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
    Galaxy: [[40, 40, 120], [110, 50, 170], [235, 90, 190]]
  };
  // Banded patterns with their own colours (they ignore the chosen colour): main, band, band width (fraction of a cell)
  SK.FIXED_BANDS = {
    Candy: [[255, 77, 109], [255, 240, 245], 0.35],
    Tiger: [[255, 152, 56], [40, 22, 10], 0.22]
  };
  // Eat effects: particle colours and shape.
  SK.BURST_STYLES = {
    Classic:  { colors: ['#ff5a4e', '#5fd16a', '#ffd5cf'], shape: 'dot' },
    Confetti: { colors: ['#ff5a4e', '#ffc83d', '#5b8cff', '#4cc35b', '#ff6fb1'], shape: 'rect' },
    Bubbles:  { colors: ['#9fe3ff', '#d6f3ff', '#6cc4ff'], shape: 'ring' },
    Sparkle:  { colors: ['#fff3b0', '#ffc83d', '#ffffff'], shape: 'star' },
    Hearts:   { colors: ['#ff4d7a', '#ff8fab', '#ffd1dc'], shape: 'heart' },
    Pixels:   { colors: ['#39ff88', '#7cc8ff', '#ffffff'], shape: 'square' }
  };

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
  const modeTrack = (mode, name, steps) => ({
    id: mode, name: name + ' mode', unit: 'points', how: 'Best score in ' + name + ' mode, any board size.',
    value: p => p.bestMode(mode), verb: g => 'Score ' + g + ' in ' + name + ' mode', steps
  });
  SK.TRACKS = [
    { id: 'apples', name: 'Apples eaten', unit: 'apples', how: 'Eat apples in any mode. Every apple counts.',
      value: p => p.apples, verb: g => 'Eat ' + g + ' apples in total', cumulative: true,
      steps: [C('c-rose', 25, 17), C('c-mint', 50, 10), B('b-confetti', 100, 1), P('p-zebra', 150, 7), M('m-gold', 200, 'gold'),
              P('p-sunset', 300, 6), H('h-party', 400, 1), E('e-star', 600, 4), P('p-galaxy', 800, 12), H('h-crown', 1000, 2)] },
    { id: 'games', name: 'Games played', unit: 'games', how: 'Finish games. Any mode, any score.',
      value: p => p.games, verb: g => 'Play ' + g + ' games', cumulative: true,
      steps: [C('c-forest', 3, 18), C('c-coral', 5, 9), E('e-wink', 10, 8), M('m-mirror', 15, 'mirror'), C('c-lime', 25, 13),
              B('b-bubbles', 40, 2), H('h-tophat', 50, 3), E('e-cyclops', 75, 6), C('c-plum', 100, 23), H('h-wizard', 150, 4)] },
    { id: 'best', name: 'Best score', unit: 'points', how: 'Your highest score in a single game, any mode.',
      value: p => p.bestAny, verb: g => 'Score ' + g + ' in one game',
      steps: [C('c-cherry', 10, 21), C('c-ruby', 15, 12), M('m-turbo', 20, 'turbo'), C('c-gold', 25, 8), M('m-runaway', 30, 'runaway'),
              E('e-heart', 40, 5), H('h-halo', 50, 5), C('c-neon', 60, 22), P('p-aurora', 75, 10)] },
    { id: 'length', name: 'Longest snake', unit: 'long', how: 'How long your snake has ever grown in one game.',
      value: p => p.longest, verb: g => 'Grow to ' + g + ' long',
      steps: [H('h-bow', 15, 6), M('m-dark', 25, 'dark'), P('p-spots', 30, 4), P('p-tiger', 40, 13), C('c-midnight', 50, 14),
              E('e-dizzy', 75, 9), C('c-ice', 100, 20)] },
    { id: 'time', name: 'Time played', unit: 'minutes', how: 'Minutes spent actually playing (paused time doesn’t count).',
      value: p => p.minutes, cumulative: true,
      verb: g => 'Play for ' + (g >= 60 ? (g / 60) + ' hour' + (g > 60 ? 's' : '') : g + ' minutes'),
      steps: [C('c-sky', 10, 15), C('c-sand', 20, 24), M('m-hunger', 30, 'hunger'), P('p-ocean', 60, 8), B('b-sparkle', 120, 3),
              E('e-angry', 180, 7), E('e-robot', 300, 10), H('h-flower', 600, 7)] },
    modeTrack('walls', 'Walls', [C('c-steel', 5, 25), P('p-duo', 10, 5), B('b-pixels', 20, 5)]),
    modeTrack('portal', 'Portal', [C('c-lilac', 10, 11), P('p-candy', 20, 11)]),
    modeTrack('poison', 'Poison', [C('c-peach', 10, 16), B('b-hearts', 20, 4)]),
    modeTrack('borderless', 'Borderless', [C('c-copper', 15, 19), P('p-ember', 25, 9)])
  ];

  // Flat list of every reward, with its track, for lookups.
  SK.UNLOCKS = [];
  for (const t of SK.TRACKS) for (const s of t.steps) {
    SK.UNLOCKS.push({ id: s.id, kind: s.kind, index: s.index, goal: s.goal, track: t, text: t.verb(s.goal), value: t.value });
  }

  SK.unlockFor = (kind, index) => SK.UNLOCKS.find(u => u.kind === kind && u.index === index) || null;
  const KIND_NAMES = { color: 'colour', pattern: 'pattern', eyes: 'eyes', hat: 'hat', burst: 'eat effect', mode: 'mode' };
  SK.itemName = u => {
    const n = u.kind === 'color' ? SK.COLORS[u.index][0] : u.kind === 'pattern' ? SK.PATTERNS[u.index]
      : u.kind === 'eyes' ? SK.EYES[u.index] : u.kind === 'hat' ? SK.HATS[u.index]
      : u.kind === 'burst' ? SK.BURSTS[u.index] : S.MODE[u.index].name;
    return n + ' ' + KIND_NAMES[u.kind];
  };
  // Which setting a reward changes when you use it.
  SK.settingKey = kind => kind;
})(typeof window !== 'undefined' ? window : globalThis);
