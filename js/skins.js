// Skin catalogue (colours, patterns, eyes, tails) and the roadmap of milestones that unlock extra skins.
(function (root) {
  'use strict';
  const S = root.Snake = root.Snake || {};

  const SK = S.skins = {
    COLORS: [['Blue', '#5b8cff'], ['Green', '#4cc35b'], ['Purple', '#9b6bff'], ['Pink', '#ff6fb1'],
             ['Orange', '#ff9838'], ['Yellow', '#f2cd3f'], ['Teal', '#27c2b0'], ['Ghost', '#dfe6e2'],
             ['Gold', '#ffc83d'], ['Coral', '#ff7a6b'], ['Mint', '#7debc0'], ['Lilac', '#c9a2ff'],
             ['Ruby', '#ff4d6d'], ['Lime', '#b5e550'], ['Midnight', '#4f63e0']],
    PATTERNS: ['Solid', 'Stripes', 'Fade', 'Rainbow', 'Spots', 'Duo', 'Sunset', 'Zebra'],
    EYES: ['Classic', 'Big', 'Sleepy', 'Shades', 'Star', 'Heart', 'Cyclops'],
    SHAPES: ['Round', 'Tapered'],
    SPEEDS: ['Slow', 'Normal', 'Fast'],
    SPEED_MS: [190, 150, 110]
  };

  // The roadmap: one track per stat, each with rewards at milestones (like a level path).
  // p = progress snapshot: { games, apples, longest, bestAny, bestMode(id) }
  // Reward ids never change, so saved unlocks survive edits to goals or order.
  SK.TRACKS = [
    { id: 'apples', name: 'Apples eaten', unit: 'apples', how: 'Eat apples in any mode. Every apple counts.',
      value: p => p.apples, verb: g => 'Eat ' + g + ' apples in total',
      steps: [
        { id: 'c-mint',   goal: 50,  kind: 'color',   index: 10 },
        { id: 'p-zebra',  goal: 150, kind: 'pattern', index: 7 },
        { id: 'p-sunset', goal: 300, kind: 'pattern', index: 6 },
        { id: 'e-star',   goal: 600, kind: 'eyes',    index: 4 }
      ] },
    { id: 'games', name: 'Games played', unit: 'games', how: 'Finish games. Any mode, any score.',
      value: p => p.games, verb: g => 'Play ' + g + ' games',
      steps: [
        { id: 'c-coral',   goal: 5,  kind: 'color', index: 9 },
        { id: 'c-lime',    goal: 25, kind: 'color', index: 13 },
        { id: 'e-cyclops', goal: 75, kind: 'eyes',  index: 6 }
      ] },
    { id: 'best', name: 'Best score', unit: 'points', how: 'Your highest score in a single game, any mode.',
      value: p => p.bestAny, verb: g => 'Score ' + g + ' in one game',
      steps: [
        { id: 'c-ruby',  goal: 15, kind: 'color', index: 12 },
        { id: 'c-gold',  goal: 25, kind: 'color', index: 8 },
        { id: 'e-heart', goal: 40, kind: 'eyes',  index: 5 }
      ] },
    { id: 'length', name: 'Longest snake', unit: 'long', how: 'How long your snake has ever grown in one game.',
      value: p => p.longest, verb: g => 'Grow to ' + g + ' long',
      steps: [
        { id: 'p-spots',    goal: 30, kind: 'pattern', index: 4 },
        { id: 'c-midnight', goal: 50, kind: 'color',   index: 14 }
      ] },
    { id: 'walls', name: 'Walls mode', unit: 'points', how: 'Best score in Walls mode, any board size.',
      value: p => p.bestMode('walls'), verb: g => 'Score ' + g + ' in Walls mode',
      steps: [{ id: 'p-duo', goal: 10, kind: 'pattern', index: 5 }] },
    { id: 'portal', name: 'Portal mode', unit: 'points', how: 'Best score in Portal mode, any board size.',
      value: p => p.bestMode('portal'), verb: g => 'Score ' + g + ' in Portal mode',
      steps: [{ id: 'c-lilac', goal: 10, kind: 'color', index: 11 }] }
  ];

  // Flat list of every reward, with its track, for lookups.
  SK.UNLOCKS = [];
  for (const t of SK.TRACKS) for (const s of t.steps) {
    SK.UNLOCKS.push({ id: s.id, kind: s.kind, index: s.index, goal: s.goal, track: t, text: t.verb(s.goal), value: t.value });
  }

  SK.unlockFor = (kind, index) => SK.UNLOCKS.find(u => u.kind === kind && u.index === index) || null;
  SK.itemName = u => u.kind === 'color' ? SK.COLORS[u.index][0] + ' colour'
    : u.kind === 'pattern' ? SK.PATTERNS[u.index] + ' pattern' : SK.EYES[u.index] + ' eyes';
})(typeof window !== 'undefined' ? window : globalThis);
