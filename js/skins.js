// Skin catalogue (colours, patterns, eyes, tails) and the roadmap of milestones that unlock extra skins.
(function (root) {
  'use strict';
  const S = root.Snake = root.Snake || {};

  const SK = S.skins = {
    COLORS: [['Blue', '#5b8cff'], ['Green', '#4cc35b'], ['Purple', '#9b6bff'], ['Pink', '#ff6fb1'],
             ['Orange', '#ff9838'], ['Yellow', '#f2cd3f'], ['Teal', '#27c2b0'], ['Ghost', '#dfe6e2'],
             ['Gold', '#ffc83d'], ['Coral', '#ff7a6b'], ['Mint', '#7debc0'], ['Lilac', '#c9a2ff'],
             ['Ruby', '#ff4d6d'], ['Lime', '#b5e550'], ['Midnight', '#4f63e0'], ['Sky', '#7cc8ff'], ['Peach', '#ffb38a']],
    PATTERNS: ['Solid', 'Stripes', 'Fade', 'Rainbow', 'Spots', 'Duo', 'Sunset', 'Zebra', 'Ocean', 'Ember'],
    EYES: ['Classic', 'Big', 'Sleepy', 'Shades', 'Star', 'Heart', 'Cyclops', 'Angry'],
    SHAPES: ['Round', 'Tapered'],
    SPEEDS: ['Slow', 'Normal', 'Fast'],
    SPEED_MS: [190, 150, 110]
  };
  // Multi-stop gradient patterns, tail → head.
  SK.GRADIENTS = {
    Sunset: [[255, 207, 92], [255, 111, 97], [122, 92, 255]],
    Ocean: [[120, 240, 220], [60, 160, 255], [70, 60, 200]],
    Ember: [[255, 236, 120], [255, 140, 50], [220, 40, 40]]
  };

  // The roadmap: one track per stat, each with rewards at milestones (like a level path).
  // Rewards can be colours, patterns, eyes or whole game modes.
  // p = progress snapshot: { games, apples, longest, bestAny, minutes, bestMode(id) }
  // Reward ids never change, so saved unlocks survive edits to goals or order.
  const mode = id => ({ kind: 'mode', index: id });
  SK.TRACKS = [
    { id: 'apples', name: 'Apples eaten', unit: 'apples', how: 'Eat apples in any mode. Every apple counts.',
      value: p => p.apples, verb: g => 'Eat ' + g + ' apples in total', cumulative: true,
      steps: [
        { id: 'c-mint',   goal: 50,  kind: 'color',   index: 10 },
        { id: 'p-zebra',  goal: 150, kind: 'pattern', index: 7 },
        { id: 'm-gold',   goal: 200, ...mode('gold') },
        { id: 'p-sunset', goal: 300, kind: 'pattern', index: 6 },
        { id: 'e-star',   goal: 600, kind: 'eyes',    index: 4 }
      ] },
    { id: 'games', name: 'Games played', unit: 'games', how: 'Finish games. Any mode, any score.',
      value: p => p.games, verb: g => 'Play ' + g + ' games', cumulative: true,
      steps: [
        { id: 'c-coral',   goal: 5,  kind: 'color', index: 9 },
        { id: 'm-mirror',  goal: 15, ...mode('mirror') },
        { id: 'c-lime',    goal: 25, kind: 'color', index: 13 },
        { id: 'e-cyclops', goal: 75, kind: 'eyes',  index: 6 }
      ] },
    { id: 'best', name: 'Best score', unit: 'points', how: 'Your highest score in a single game, any mode.',
      value: p => p.bestAny, verb: g => 'Score ' + g + ' in one game',
      steps: [
        { id: 'c-ruby',  goal: 15, kind: 'color', index: 12 },
        { id: 'm-turbo', goal: 20, ...mode('turbo') },
        { id: 'c-gold',    goal: 25, kind: 'color', index: 8 },
        { id: 'm-runaway', goal: 30, ...mode('runaway') },
        { id: 'e-heart',   goal: 40, kind: 'eyes',  index: 5 }
      ] },
    { id: 'length', name: 'Longest snake', unit: 'long', how: 'How long your snake has ever grown in one game.',
      value: p => p.longest, verb: g => 'Grow to ' + g + ' long',
      steps: [
        { id: 'm-dark',     goal: 25, ...mode('dark') },
        { id: 'p-spots',    goal: 30, kind: 'pattern', index: 4 },
        { id: 'c-midnight', goal: 50, kind: 'color',   index: 14 }
      ] },
    { id: 'time', name: 'Time played', unit: 'minutes', how: 'Minutes spent actually playing (paused time doesn’t count).',
      value: p => p.minutes, verb: g => 'Play for ' + (g >= 60 ? g / 60 + ' hour' + (g > 60 ? 's' : '') : g + ' minutes'), cumulative: true,
      steps: [
        { id: 'c-sky',    goal: 10,  kind: 'color',   index: 15 },
        { id: 'm-hunger', goal: 30,  ...mode('hunger') },
        { id: 'p-ocean',  goal: 60,  kind: 'pattern', index: 8 },
        { id: 'e-angry',  goal: 180, kind: 'eyes',    index: 7 }
      ] },
    { id: 'walls', name: 'Walls mode', unit: 'points', how: 'Best score in Walls mode, any board size.',
      value: p => p.bestMode('walls'), verb: g => 'Score ' + g + ' in Walls mode',
      steps: [{ id: 'p-duo', goal: 10, kind: 'pattern', index: 5 }] },
    { id: 'portal', name: 'Portal mode', unit: 'points', how: 'Best score in Portal mode, any board size.',
      value: p => p.bestMode('portal'), verb: g => 'Score ' + g + ' in Portal mode',
      steps: [{ id: 'c-lilac', goal: 10, kind: 'color', index: 11 }] },
    { id: 'poison', name: 'Poison mode', unit: 'points', how: 'Best score in Poison mode, any board size.',
      value: p => p.bestMode('poison'), verb: g => 'Score ' + g + ' in Poison mode',
      steps: [{ id: 'c-peach', goal: 10, kind: 'color', index: 16 }] },
    { id: 'borderless', name: 'Borderless mode', unit: 'points', how: 'Best score in Borderless mode, any board size.',
      value: p => p.bestMode('borderless'), verb: g => 'Score ' + g + ' in Borderless mode',
      steps: [{ id: 'p-ember', goal: 25, kind: 'pattern', index: 9 }] }
  ];

  // Flat list of every reward, with its track, for lookups.
  SK.UNLOCKS = [];
  for (const t of SK.TRACKS) for (const s of t.steps) {
    SK.UNLOCKS.push({ id: s.id, kind: s.kind, index: s.index, goal: s.goal, track: t, text: t.verb(s.goal), value: t.value });
  }

  SK.unlockFor = (kind, index) => SK.UNLOCKS.find(u => u.kind === kind && u.index === index) || null;
  SK.itemName = u => u.kind === 'color' ? SK.COLORS[u.index][0] + ' colour'
    : u.kind === 'pattern' ? SK.PATTERNS[u.index] + ' pattern'
    : u.kind === 'mode' ? S.MODE[u.index].name + ' mode' : SK.EYES[u.index] + ' eyes';
  // Which setting a reward changes when you wear/pick it.
  SK.settingKey = kind => kind === 'color' ? 'color' : kind;
})(typeof window !== 'undefined' ? window : globalThis);
