// Skin catalogue (colours, patterns, eyes, tails) and the milestones that unlock extra skins.
(function (root) {
  'use strict';
  const S = root.Snake = root.Snake || {};

  const SK = S.skins = {
    COLORS: [['Blue', '#5b8cff'], ['Green', '#4cc35b'], ['Purple', '#9b6bff'], ['Pink', '#ff6fb1'],
             ['Orange', '#ff9838'], ['Yellow', '#f2cd3f'], ['Teal', '#27c2b0'], ['Ghost', '#dfe6e2'],
             ['Gold', '#ffc83d'], ['Coral', '#ff7a6b'], ['Mint', '#7debc0'], ['Lilac', '#c9a2ff']],
    PATTERNS: ['Solid', 'Stripes', 'Fade', 'Rainbow', 'Spots', 'Duo', 'Sunset'],
    EYES: ['Classic', 'Big', 'Sleepy', 'Shades'],
    SHAPES: ['Round', 'Tapered'],
    SPEEDS: ['Slow', 'Normal', 'Fast'],
    SPEED_MS: [190, 150, 110]
  };

  // p = progress snapshot: { games, apples, longest, bestAny, bestMode(id) }
  SK.UNLOCKS = [
    { id: 'c-gold',   kind: 'color',   index: 8,  text: 'Score 25 in one game',     goal: 25,  value: p => p.bestAny },
    { id: 'c-coral',  kind: 'color',   index: 9,  text: 'Play 10 games',            goal: 10,  value: p => p.games },
    { id: 'c-mint',   kind: 'color',   index: 10, text: 'Eat 100 apples in total',  goal: 100, value: p => p.apples },
    { id: 'c-lilac',  kind: 'color',   index: 11, text: 'Score 10 in Portal mode',  goal: 10,  value: p => p.bestMode('portal') },
    { id: 'p-spots',  kind: 'pattern', index: 4,  text: 'Grow to 30 long',          goal: 30,  value: p => p.longest },
    { id: 'p-duo',    kind: 'pattern', index: 5,  text: 'Score 10 in Walls mode',   goal: 10,  value: p => p.bestMode('walls') },
    { id: 'p-sunset', kind: 'pattern', index: 6,  text: 'Eat 300 apples in total',  goal: 300, value: p => p.apples }
  ];

  SK.unlockFor = (kind, index) => SK.UNLOCKS.find(u => u.kind === kind && u.index === index) || null;
  SK.itemName = u => (u.kind === 'color' ? SK.COLORS[u.index][0] + ' colour' : SK.PATTERNS[u.index] + ' pattern');
})(typeof window !== 'undefined' ? window : globalThis);
