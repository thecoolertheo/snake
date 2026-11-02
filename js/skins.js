// Skin catalogue: colours, patterns, eyes and tail shapes.
(function (root) {
  'use strict';
  const S = root.Snake = root.Snake || {};
  S.skins = {
    COLORS: [['Blue', '#5b8cff'], ['Green', '#4cc35b'], ['Purple', '#9b6bff'], ['Pink', '#ff6fb1'],
             ['Orange', '#ff9838'], ['Yellow', '#f2cd3f'], ['Teal', '#27c2b0'], ['Ghost', '#dfe6e2']],
    PATTERNS: ['Solid', 'Stripes', 'Fade', 'Rainbow'],
    EYES: ['Classic', 'Big', 'Sleepy', 'Shades'],
    SHAPES: ['Round', 'Tapered'],
    SPEEDS: ['Slow', 'Normal', 'Fast'],
    SPEED_MS: [190, 150, 110]
  };
})(typeof window !== 'undefined' ? window : globalThis);
