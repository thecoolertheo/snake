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
             ['Custom', '#5b8cff']],   // your own colour (see SK.CUSTOM)
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

  // ---------- Added later ----------
  // Saved looks store an index into these lists, so new items always go on the end. Never reorder them.
  SK.COLORS.push(
    ['Fern', '#4f9d69'], ['Clover', '#3fbf7f'], ['Pine', '#1f6f54'], ['Olive', '#8a8f3c'], ['Sage', '#a3b899'],
    ['Jade', '#00a86b'], ['Horizon', '#6f9fd8'], ['Azure', '#2f8fe8'], ['Cerulean', '#2a7fa8'], ['Drift', '#9fb8c8'],
    ['Zephyr', '#b8e0e8'], ['Granite', '#7a7f85'], ['Iron', '#4a5560'], ['Rust', '#a84a2a'], ['Clay', '#c0704a'],
    ['Concrete', '#a8a8a0'], ['Terracotta', '#e0704f'], ['Warp', '#6a3df0'], ['Nebula', '#a040d0'], ['Rift', '#d046e0'],
    ['Quasar', '#38d8c8'], ['Ion', '#58a0ff'], ['Vortex', '#5c2fb0'], ['Venom', '#7fe04a'], ['Slime', '#a0d820'],
    ['Bile', '#c8c030'], ['Nightshade', '#5a2d82'], ['Acid', '#d4f000'], ['Blight', '#6a7a2a'], ['Linen', '#efe6d0'],
    ['Dew', '#cfead8'], ['Mist', '#cdd9e0'], ['Petal', '#f8cfe0'], ['Butter', '#fbe7a1'], ['Wisteria', '#b9a7e6'],
    ['Nitro', '#00d4ff'], ['Redline', '#ff2a2a'], ['Volt', '#e8ff1a'], ['Afterburn', '#ff5a00'], ['Chrome', '#7f9cc0'],
    ['Silver', '#c0c6cc'], ['Reflect', '#a8d8f0'], ['Prism', '#d8c0ff'], ['Quicksilver', '#b5c7c0'], ['Inverse', '#00e0a0'],
    ['Obsidian', '#3a3f4a'], ['Shadow', '#4a4458'], ['Raven', '#2e3550'], ['Ember Glow', '#e8622a'], ['Moonlight', '#c3d0ff'],
    ['Glowworm', '#c8f050'], ['Bullion', '#d4a017'], ['Bronze', '#a97142'], ['Champagne', '#f0dfae'], ['Amber', '#ffb000'],
    ['Saffron', '#f58a0a'], ['Treasure', '#b8860b'], ['Paprika', '#d2401e'], ['Mustard', '#c4a000'], ['Cinnamon', '#a85a32'],
    ['Pumpkin', '#e0700a'], ['Beetroot', '#8c1f4a'], ['Avocado', '#6a9a3c'], ['Toffee', '#c88a4e'], ['Chase', '#ff5f7e'],
    ['Dash', '#4fd2ff'], ['Sprint', '#7dff5f'], ['Scamper', '#ffae5f'], ['Rabbit', '#d8c4b0'], ['Pippin', '#d8e04a'],
    ['Crabapple', '#d6304a'], ['Cider', '#c8842a'], ['Granny', '#8fe060'], ['Russet', '#a8622e'], ['Veteran', '#6a8a9a'],
    ['Marathon', '#f0507a'], ['Stayer', '#3a8f9e'], ['Champion', '#ffd400'], ['Trophy', '#e8b923'], ['Podium', '#e9c9a8'],
    ['Long Green', '#4fa83a'], ['Boa', '#8a6a4a'], ['Mamba', '#6a8a6a'], ['Python', '#b8a050'], ['Anaconda', '#3a6a50'],
    ['Hourglass', '#d8b878'], ['Dusk', '#7a5a90'], ['Dawn', '#ffb79a'], ['Autumn', '#c8602a'], ['Winter', '#a8c8e8'],
    ['Patina', '#5fa89e'], ['Apprentice', '#5fa8d3'], ['Adept', '#8f6fd8'], ['Master', '#c95fa8'], ['Elder', '#9a8a70'],
    ['Sage Green', '#7fae8f'], ['Mythic', '#ff3df0'], ['Legend', '#ffbe0f'], ['Hero', '#2f6fe8'], ['Curio', '#c0805a'],
    ['Heirloom', '#8a3a4a'], ['Rarity', '#40c0a0'], ['Antique', '#b8a888']
  );
  SK.EYES.push('Googly', 'Moon', 'Ring', 'Diamond', 'Snake', 'Flame', 'Teary');
  SK.HATS.push('Beret', 'Hard hat', 'Sprout', 'Fez', 'Sailor', 'Tiara', 'Astronaut', 'Witch',
    'Jester', 'Mohawk');
  SK.BURSTS.push('Clovers', 'Seeds', 'Comets', 'Ripples', 'Gusts', 'Rubble', 'Bricks', 'Warps',
    'Sparks', 'Spit', 'Skulls', 'Fumes', 'Dewdrops', 'Feathers', 'Daisies', 'Sonic',
    'Nitrous', 'Tyre Smoke', 'Shards', 'Prisms', 'Fireflies', 'Bats', 'Doubloons', 'Nuggets',
    'Glitter', 'Crumbs', 'Sugar', 'Paw Prints', 'Dust Up', 'Pips', 'Slices', 'Tickets',
    'Dice', 'Trophies', 'Applause', 'Supernova', 'Scales', 'Shed', 'Sand', 'Maple',
    'Runes', 'Magic', 'Level Up', 'Baubles', 'Treasures');
  SK.TRAILS.push('Grass', 'Dandelion', 'Contrail', 'Wisps', 'Stardust', 'Gravel', 'Dust', 'Static',
    'Orbit', 'Ooze', 'Spores', 'Pollen', 'Feather', 'Afterburner', 'Lightning', 'Glints',
    'Echoes', 'Glow', 'Shade', 'Gold Dust', 'Trickle', 'Crumb Trail', 'Syrup', 'Footprints',
    'Blur', 'Peel', 'Juice', 'Tally', 'Ribbons', 'Victory', 'Glory', 'Slither',
    'Skin Flakes', 'Sandfall', 'Falling Leaves', 'Magic Dust', 'Halo Ring', 'Aura', 'Trinkets', 'Prism Dust');
  SK.FOODS.push('Banana', 'Burger', 'Peach', 'Pear', 'Pretzel', 'Carrot', 'Ice cream', 'Cheese');
  SK.BOARDS.push('Garden', 'Hedgerow', 'Horizon', 'Open Sky', 'Bunker', 'Rift', 'Swamp', 'Zen',
    'Racetrack', 'Hall', 'Funhouse', 'Crypt', 'Cavern', 'Vault', 'Picnic', 'Thicket',
    'Burrow', 'Orchard', 'Arcade', 'Stadium', 'Jungle', 'Serpent Pit', 'Clocktower', 'Tower',
    'Temple', 'Citadel', 'Gallery');
  SK.PATTERNS.push(
    'Meadow', 'Orchard', 'Garter', 'Ladder', 'Skyline', 'Tropics', 'Mirage', 'Daybreak',
    'Dashes', 'Runway', 'Masonry', 'Forge', 'Hazard', 'Brickwork', 'Barrier', 'Wormhole',
    'Singularity', 'Interdimension', 'Blink', 'Rings', 'Glitch', 'Antidote', 'Hemlock', 'Sludge',
    'Foxglove', 'Hornet', 'Warning', 'Coral Snake', 'Dreamy', 'Lullaby', 'Sorbet', 'Tidepool',
    'Ribbon', 'Picnic', 'Overdrive', 'Slipstream', 'Hyperdrive', 'Burnout', 'Checkered', 'Pit Lane',
    'Speedway', 'Looking Glass', 'Opposite', 'Refraction', 'Double Take', 'Twin', 'Barcode', 'Mime',
    'Eclipse', 'Abyssal', 'Midnight Sun', 'Candlelight', 'Skeleton', 'Night Watch', 'Midas', 'Rose Gold',
    'Prospector', 'Jackpot', 'Royal Sash', 'Pharaoh', 'Coinstack', 'Spice', 'Caramel', 'Berry Mix',
    'Smoothie', 'Bacon', 'Licorice', 'Sprinkles', 'Getaway', 'Pursuit', 'Fox Hunt', 'Jackrabbit',
    'Fox', 'Crosswalk', 'Hare', 'Harvest', 'Bramble', 'Citrus', 'Red Delicious', 'Cidermill',
    'Old Friend', 'Regular', 'Scarf', 'Referee', 'Podium Finish', 'Hall of Fame', 'Laurels', 'Medal',
    'Cobra', 'Coil', 'Coral', 'King Snake', 'Sea Snake', 'Seasons', 'Sundown', 'Moonrise',
    'Pendulum', 'Sailor Stripes', 'Ascent', 'Enchanted', 'Prestige', 'Ouroboros', 'Knight', 'Crusader',
    'Museum', 'Opaline', 'Kaleidoscope', 'Cabinet', 'Tartan',
    'Gradient'   // your own two-colour gradient (see SK.gradCheck)
  );
  Object.assign(SK.GRADIENTS, {
    'Meadow': [[215,240,130], [110,200,90], [30,120,90]],
    'Orchard': [[255,210,120], [240,110,80], [120,170,70]],
    'Skyline': [[255,230,180], [140,200,240], [60,100,200]],
    'Tropics': [[80,240,200], [40,160,220], [40,80,180]],
    'Mirage': [[255,200,160], [230,120,180], [90,80,200]],
    'Daybreak': [[255,180,120], [255,140,160], [120,160,240]],
    'Masonry': [[220,200,170], [170,120,85], [80,60,50]],
    'Forge': [[255,200,80], [210,80,40], [60,50,50]],
    'Wormhole': [[60,240,255], [100,80,240], [220,60,200]],
    'Singularity': [[255,255,255], [160,80,240], [20,20,60]],
    'Interdimension': [[255,80,160], [160,64,240], [48,216,232]],
    'Blink': [[120,240,210], [60,120,240], [240,80,210]],
    'Antidote': [[230,255,120], [80,220,130], [40,160,160]],
    'Hemlock': [[220,120,255], [110,60,200], [40,120,60]],
    'Sludge': [[190,170,50], [110,140,40], [40,60,40]],
    'Foxglove': [[255,180,220], [200,80,180], [80,40,140]],
    'Dreamy': [[255,220,240], [210,200,255], [180,230,255]],
    'Lullaby': [[200,220,255], [230,200,240], [255,230,200]],
    'Sorbet': [[255,210,180], [255,180,200], [200,180,255]],
    'Tidepool': [[200,240,220], [120,210,210], [90,150,220]],
    'Overdrive': [[255,240,80], [255,90,20], [220,10,80]],
    'Slipstream': [[255,255,255], [80,210,255], [30,80,240]],
    'Hyperdrive': [[160,255,60], [20,220,220], [20,80,220]],
    'Burnout': [[220,220,220], [255,110,40], [60,20,20]],
    'Looking Glass': [[230,245,255], [160,200,230], [100,130,180]],
    'Opposite': [[255,80,80], [255,255,255], [80,80,255]],
    'Refraction': [[255,160,200], [255,240,160], [160,240,230]],
    'Double Take': [[80,220,180], [230,230,230], [220,80,180]],
    'Eclipse': [[255,220,120], [230,80,40], [30,20,40]],
    'Abyssal': [[40,230,200], [20,100,160], [10,30,60]],
    'Midnight Sun': [[255,230,150], [220,60,110], [40,30,90]],
    'Candlelight': [[255,230,170], [230,150,50], [100,50,20]],
    'Midas': [[255,245,180], [255,200,50], [180,120,0]],
    'Rose Gold': [[255,230,210], [240,170,150], [190,110,110]],
    'Prospector': [[255,220,100], [160,100,40], [60,40,20]],
    'Jackpot': [[255,230,80], [80,200,100], [20,140,90]],
    'Spice': [[255,200,80], [230,90,40], [140,30,50]],
    'Caramel': [[255,230,180], [210,150,90], [100,60,30]],
    'Berry Mix': [[255,180,210], [200,60,140], [90,30,120]],
    'Smoothie': [[255,200,160], [255,140,160], [180,120,220]],
    'Getaway': [[255,230,90], [255,110,140], [140,60,240]],
    'Pursuit': [[80,255,180], [240,240,80], [255,90,80]],
    'Fox Hunt': [[255,180,120], [230,100,40], [255,245,230]],
    'Jackrabbit': [[240,230,210], [190,150,120], [90,70,50]],
    'Harvest': [[255,220,100], [240,140,50], [180,60,40]],
    'Bramble': [[210,100,160], [120,40,140], [40,30,80]],
    'Citrus': [[255,240,130], [255,180,50], [120,220,80]],
    'Old Friend': [[230,200,160], [180,140,100], [80,60,50]],
    'Regular': [[120,200,240], [120,144,230], [160,100,220]],
    'Podium Finish': [[255,230,120], [220,220,230], [200,130,80]],
    'Hall of Fame': [[255,200,50], [220,60,80], [60,30,120]],
    'Cobra': [[220,190,110], [140,100,50], [60,40,20]],
    'Coil': [[200,255,160], [80,200,130], [30,110,110]],
    'Seasons': [[160,220,100], [255,200,60], [220,90,40]],
    'Sundown': [[255,220,140], [255,120,120], [90,60,140]],
    'Moonrise': [[230,230,200], [120,150,200], [42,40,80]],
    'Ascent': [[120,240,200], [80,160,240], [120,80,230]],
    'Enchanted': [[80,240,220], [160,100,240], [240,90,180]],
    'Prestige': [[255,240,200], [220,170,80], [90,50,150]],
    'Ouroboros': [[80,220,120], [220,200,80], [220,60,60]],
    'Museum': [[240,220,180], [190,140,80], [100,60,40]],
    'Opaline': [[220,240,255], [240,200,230], [200,240,220]],
    'Kaleidoscope': [[255,220,50], [240,60,160], [50,100,240]]
  });
  Object.assign(SK.FIXED_BANDS, {
    'Garter': [[70,160,90], [240,220,120], 0.3],
    'Ladder': [[90,120,220], [220,230,255], 0.25],
    'Dashes': [[60,140,220], [230,244,255], 0.2],
    'Runway': [[90,100,112], [240,240,240], 0.12],
    'Hazard': [[255,200,40], [30,30,30], 0.45],
    'Brickwork': [[180,80,60], [230,210,190], 0.12],
    'Barrier': [[240,240,240], [224,60,50], 0.5],
    'Rings': [[106,61,240], [60,240,255], 0.22],
    'Glitch': [[240,60,180], [60,230,240], 0.4],
    'Hornet': [[230,210,40], [50,10,80], 0.3],
    'Warning': [[160,230,40], [40,30,50], 0.35],
    'Coral Snake': [[230,60,50], [240,220,80], 0.28],
    'Ribbon': [[255,180,200], [255,245,220], 0.3],
    'Picnic': [[240,110,110], [255,245,240], 0.5],
    'Checkered': [[245,245,245], [20,20,20], 0.5],
    'Pit Lane': [[255,220,0], [30,80,200], 0.3],
    'Speedway': [[0,200,100], [245,245,245], 0.2],
    'Twin': [[240,90,120], [90,200,240], 0.5],
    'Barcode': [[30,30,30], [240,240,240], 0.35],
    'Mime': [[245,245,245], [30,30,30], 0.22],
    'Skeleton': [[220,220,220], [26,26,30], 0.3],
    'Night Watch': [[40,80,160], [255,220,100], 0.15],
    'Royal Sash': [[120,20,180], [255,200,50], 0.2],
    'Pharaoh': [[30,80,200], [255,200,50], 0.38],
    'Coinstack': [[200,150,20], [255,230,140], 0.3],
    'Bacon': [[200,60,50], [245,200,160], 0.3],
    'Licorice': [[30,30,30], [200,200,200], 0.15],
    'Sprinkles': [[255,140,200], [255,240,245], 0.12],
    'Fox': [[230,100,40], [255,245,230], 0.35],
    'Crosswalk': [[42,46,52], [245,245,245], 0.4],
    'Hare': [[190,150,120], [240,230,210], 0.4],
    'Red Delicious': [[220,30,50], [255,220,220], 0.15],
    'Cidermill': [[160,90,40], [240,210,140], 0.3],
    'Scarf': [[200,60,80], [230,230,230], 0.4],
    'Referee': [[30,30,30], [245,245,245], 0.5],
    'Laurels': [[30,140,80], [255,210,80], 0.2],
    'Medal': [[40,80,200], [230,60,60], 0.5],
    'Coral': [[224,60,60], [30,30,30], 0.3],
    'King Snake': [[240,224,160], [40,30,30], 0.25],
    'Sea Snake': [[30,120,180], [240,240,230], 0.4],
    'Pendulum': [[200,150,50], [40,30,20], 0.15],
    'Sailor Stripes': [[245,245,245], [30,60,140], 0.3],
    'Knight': [[160,170,180], [60,80,160], 0.3],
    'Crusader': [[245,245,245], [220,40,50], 0.25],
    'Cabinet': [[90,45,30], [230,200,140], 0.2],
    'Tartan': [[20,60,140], [200,30,50], 0.42]
  });
  Object.assign(SK.BURST_STYLES, {
    'Clovers': { colors: ['#3fbf7f', '#a8e6a1', '#1f6f54'], shape: 'leaf' },
    'Seeds': { colors: ['#e2c290', '#8a6a3c', '#fff3c9'], shape: 'dot' },
    'Comets': { colors: ['#7cc8ff', '#ffffff', '#2f8fe8'], shape: 'star' },
    'Ripples': { colors: ['#6f9fd8', '#b8e0e8', '#ffffff'], shape: 'ring' },
    'Gusts': { colors: ['#dff4ff', '#b8e0e8', '#9fb8c8'], shape: 'puff' },
    'Rubble': { colors: ['#a8a8a0', '#7a7f85', '#c0704a'], shape: 'square' },
    'Bricks': { colors: ['#b5523b', '#e0704f', '#e6d2be'], shape: 'rect' },
    'Warps': { colors: ['#6a3df0', '#3cf0ff', '#d046e0'], shape: 'ring' },
    'Sparks': { colors: ['#3cf0ff', '#ffffff', '#6a3df0'], shape: 'bolt' },
    'Spit': { colors: ['#7fe04a', '#a0d820', '#d4f000'], shape: 'dot' },
    'Skulls': { colors: ['#dcdcdc', '#7fe04a', '#5a2d82'], shape: 'gem' },
    'Fumes': { colors: ['#a0d820', '#6a7a2a', '#c8c030'], shape: 'puff' },
    'Dewdrops': { colors: ['#cfead8', '#ffffff', '#9fe3ff'], shape: 'ring' },
    'Feathers': { colors: ['#ffffff', '#efe6d0', '#cdd9e0'], shape: 'leaf' },
    'Daisies': { colors: ['#ffffff', '#fff3b0', '#ffe36b'], shape: 'flower' },
    'Sonic': { colors: ['#00d4ff', '#ffffff', '#e8ff1a'], shape: 'bolt' },
    'Nitrous': { colors: ['#ff5a00', '#ffc83d', '#00d4ff'], shape: 'star' },
    'Tyre Smoke': { colors: ['#b0b4b8', '#7a7f85', '#e0e0e0'], shape: 'puff' },
    'Shards': { colors: ['#c0c6cc', '#a8d8f0', '#ffffff'], shape: 'gem' },
    'Prisms': { colors: ['#ff8fab', '#fff06b', '#7cc8ff'], shape: 'gem' },
    'Fireflies': { colors: ['#e8ff6b', '#c8f050', '#fff3b0'], shape: 'dot' },
    'Bats': { colors: ['#3a3f4a', '#6a5a8a', '#1e1e28'], shape: 'leaf' },
    'Doubloons': { colors: ['#d4a017', '#fff3b0', '#a97142'], shape: 'coin' },
    'Nuggets': { colors: ['#ffc83d', '#d4a017', '#fff5b4'], shape: 'gem' },
    'Glitter': { colors: ['#ffe08a', '#ffffff', '#ffc83d'], shape: 'star' },
    'Crumbs': { colors: ['#d9a066', '#b97f45', '#f0d0a0'], shape: 'square' },
    'Sugar': { colors: ['#ffffff', '#ffc4d6', '#fff0f5'], shape: 'star' },
    'Paw Prints': { colors: ['#d8c4b0', '#a88a70', '#fff0e0'], shape: 'heart' },
    'Dust Up': { colors: ['#d8c4b0', '#c8b89a', '#ffffff'], shape: 'puff' },
    'Pips': { colors: ['#6b4430', '#d8e04a', '#ff5a4e'], shape: 'dot' },
    'Slices': { colors: ['#ff5a4e', '#fff0d0', '#8fe060'], shape: 'leaf' },
    'Tickets': { colors: ['#ffc83d', '#ff5a4e', '#ffffff'], shape: 'rect' },
    'Dice': { colors: ['#ffffff', '#ff5a4e', '#1e1e1e'], shape: 'square' },
    'Trophies': { colors: ['#ffd400', '#fff3b0', '#e8b923'], shape: 'star' },
    'Applause': { colors: ['#ffd400', '#ff5a4e', '#5b8cff'], shape: 'rect' },
    'Supernova': { colors: ['#ffffff', '#ff50dc', '#3ef0ff'], shape: 'star' },
    'Scales': { colors: ['#38a860', '#b8a050', '#3a6a50'], shape: 'gem' },
    'Shed': { colors: ['#dcd2b4', '#c0b48c', '#f0ead0'], shape: 'puff' },
    'Sand': { colors: ['#e2c290', '#d8b878', '#fff0d0'], shape: 'dot' },
    'Maple': { colors: ['#e0602a', '#f0a830', '#b8321e'], shape: 'leaf' },
    'Runes': { colors: ['#8f6fd8', '#d8c4ff', '#ffffff'], shape: 'bolt' },
    'Magic': { colors: ['#d85f8f', '#8f6fd8', '#5fa8d3'], shape: 'star' },
    'Level Up': { colors: ['#50f0dc', '#ffc83d', '#ffffff'], shape: 'star' },
    'Baubles': { colors: ['#c77dff', '#ffc83d', '#4ff0ff'], shape: 'ring' },
    'Treasures': { colors: ['#ffc83d', '#c77dff', '#4ff0ff'], shape: 'gem' }
  });
  Object.assign(SK.TRAIL_STYLES, {
    'Grass': [['#7ac74f', '#3fbf7f'], 'leaf'],
    'Dandelion': [['#fffbe0', '#e8e4c0'], 'puff'],
    'Contrail': [['#ffffff', '#dff4ff'], 'puff'],
    'Wisps': [['#b8e0e8', '#ffffff', '#7cc8ff'], 'dot'],
    'Stardust': [['#dff4ff', '#9fb8ff', '#ffffff'], 'star'],
    'Gravel': [['#8a8f8a', '#5d6d7e'], 'dot'],
    'Dust': [['#c8b89a', '#a8957a'], 'puff'],
    'Static': [['#3cf0ff', '#d046e0'], 'square'],
    'Orbit': [['#a040d0', '#58a0ff'], 'ring'],
    'Ooze': [['#7fe04a', '#a0d820'], 'dot'],
    'Spores': [['#d4f000', '#7fe04a'], 'ring'],
    'Pollen': [['#fff3b0', '#ffe36b'], 'dot'],
    'Feather': [['#ffffff', '#efe6d0'], 'leaf'],
    'Afterburner': [['#ff5a00', '#ffc83d', '#ffffff'], 'dot'],
    'Lightning': [['#e8ff1a', '#00d4ff'], 'bolt'],
    'Glints': [['#ffffff', '#c0c6cc'], 'star'],
    'Echoes': [['#a8d8f0', '#ffffff'], 'ring'],
    'Glow': [['#c8f050', '#e8ff6b'], 'dot'],
    'Shade': [['#4a4458', '#3a3f4a'], 'puff'],
    'Gold Dust': [['#ffc83d', '#ffe08a'], 'dot'],
    'Trickle': [['#ffc83d', '#d99a00'], 'coin'],
    'Crumb Trail': [['#d9a066', '#b97f45'], 'dot'],
    'Syrup': [['#c8782a', '#f0b429'], 'dot'],
    'Footprints': [['#d8c4b0', '#a88a70'], 'dot'],
    'Blur': [['#4fd2ff', '#ff5f7e'], 'puff'],
    'Peel': [['#ff5a4e', '#8fe060'], 'leaf'],
    'Juice': [['#ff7a6b', '#ffd0a0'], 'dot'],
    'Tally': [['#ffffff', '#c0c6cc'], 'rect'],
    'Ribbons': [['#ff5a4e', '#5b8cff', '#ffc83d'], 'leaf'],
    'Victory': [['#ffd400', '#ffffff'], 'star'],
    'Glory': [['#ffd400', '#fff3b0'], 'ring'],
    'Slither': [['#38a860', '#8a6a4a'], 'leaf'],
    'Skin Flakes': [['#dcd2b4', '#b8a050'], 'square'],
    'Sandfall': [['#e2c290', '#d8b878'], 'dot'],
    'Falling Leaves': [['#e0602a', '#f0a830'], 'leaf'],
    'Magic Dust': [['#8f6fd8', '#d85f8f'], 'star'],
    'Halo Ring': [['#ffe36b', '#ffffff'], 'ring'],
    'Aura': [['#a080f0', '#d0c0ff'], 'puff'],
    'Trinkets': [['#c77dff', '#ffc83d'], 'gem'],
    'Prism Dust': [['#ff8fab', '#fff06b', '#7cc8ff'], 'dot']
  });
  const boardTheme = (a, accent, amb) => {   // [base colour, accent, ambient effect]
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), c = rgb(accent);
    const b = '#' + rgb(a).map(v => Math.round(v * 0.86).toString(16).padStart(2, '0')).join('');
    return { a, b, light: c.join(','), glow: 'rgba(' + c.join(',') + ',.14)', accent, amb };
  };
  for (const [name, a, accent, amb] of [
    ['Garden', '#1c2e1e', '#7ac74f', 'pollen'],
    ['Hedgerow', '#1f2a18', '#a3c94f', 'fireflies'],
    ['Horizon', '#142533', '#6fb8e8', 'drift'],
    ['Open Sky', '#1a2a40', '#8cc8f0', 'stars'],
    ['Bunker', '#22262a', '#e0a040', 'dust'],
    ['Rift', '#150f2e', '#a050ff', 'sparkle'],
    ['Swamp', '#1a2616', '#a0d820', 'fireflies'],
    ['Zen', '#24302a', '#b8d8c0', 'drift'],
    ['Racetrack', '#1c1e22', '#ff4a2a', 'streaks'],
    ['Hall', '#1e2228', '#c0d0e0', 'sparkle'],
    ['Funhouse', '#2a1e2e', '#ff8fd0', 'glitter'],
    ['Crypt', '#101218', '#8870c0', 'drift'],
    ['Cavern', '#12141a', '#58c0a8', 'fireflies'],
    ['Vault', '#2a2212', '#ffc83d', 'glitter'],
    ['Picnic', '#2e2418', '#f0b429', 'dust'],
    ['Thicket', '#1e2a1a', '#ffae5f', 'pollen'],
    ['Burrow', '#2a2018', '#d8a878', 'dust'],
    ['Orchard', '#231e14', '#e0604a', 'pollen'],
    ['Arcade', '#181428', '#ff50a0', 'streaks'],
    ['Stadium', '#16281e', '#ffd400', 'streaks'],
    ['Jungle', '#142416', '#58c870', 'fireflies'],
    ['Serpent Pit', '#241c14', '#c8a050', 'embers'],
    ['Clocktower', '#1e1c28', '#d8b878', 'dust'],
    ['Tower', '#1a1a2e', '#8f6fd8', 'sparkle'],
    ['Temple', '#2a2416', '#e0c060', 'glitter'],
    ['Citadel', '#1e2228', '#5fa8d3', 'embers'],
    ['Gallery', '#241e2a', '#c77dff', 'sparkle']
  ]) SK.BOARD_THEMES[name] = boardTheme(a, accent, amb);

  // ---------- Custom colour ----------
  // One colour is your own. It must be clearly different from every built-in colour
  // (perceptual distance, CIE ΔE76 in Lab space).
  SK.CUSTOM = SK.COLORS.findIndex(c => c[0] === 'Custom');
  SK.CUSTOM_MIN = 10;
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
    for (let i = 0; i < SK.COLORS.length; i++) {
      if (i === SK.CUSTOM) continue;
      const d = SK.colorDistance(hex, SK.COLORS[i][1]);
      if (!best || d < best.dist) best = { name: SK.COLORS[i][0], hex: SK.COLORS[i][1], dist: d };
    }
    return best;
  };


  // ---------- Your own gradient ----------
  // The final Collector reward: two colours and the direction they fade in.
  // Saved as "#aabbcc,#ddeeff,dir". dir 0-7 are 45° steps around the snake's body:
  // 0 runs tail to head, 2 is one side to the other, 4 is head to tail, the rest are the diagonals between.
  SK.GRAD = SK.PATTERNS.indexOf('Gradient');
  SK.GRAD_DEFAULT = '#ff5a1f,#2bd4ff,0';
  SK.GRAD_DIRS = ['Tail to head', 'Diagonal', 'Side to side', 'Diagonal', 'Head to tail', 'Diagonal', 'Side to side', 'Diagonal'];
  SK.GRAD_MIN = 18;        // how different from a built-in pattern's fade (average ΔE along the body)
  SK.GRAD_SOLID = 28;      // two colours closer than this just look like one solid colour
  SK.GRAD_PAIR = 12;       // the second colour can't be a built-in pattern's tint of the first one
  SK.okGrad = v => typeof v === 'string' && /^#[0-9a-f]{6},#[0-9a-f]{6},[0-7]$/i.test(v);
  SK.gradOf = st => {
    const p = (SK.okGrad(st.customGrad) ? st.customGrad : SK.GRAD_DEFAULT).split(',');
    return { a: p[0], b: p[1], dir: +p[2] };
  };
  const hexOf = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // Three stops, tail to head, like the built-in gradients: what a pattern's colours are, or null if it has no fade.
  SK.stopsFor = st => {
    const n = SK.PATTERNS[st.pattern];
    if (n !== 'Gradient') return SK.GRADIENTS[n] || null;
    const G = SK.gradOf(st), a = rgbOf(G.a), b = rgbOf(G.b);
    return [a, mixRgb(a, b, 0.5), b];
  };
  const SAMPLES = 5;
  const along = (stops, t) => {
    const s = t * (stops.length - 1), i = Math.min(stops.length - 2, s | 0);
    return mixRgb(stops[i], stops[i + 1], s - i);
  };
  const fadeSamples = stops => { const o = []; for (let i = 0; i < SAMPLES; i++) o.push(lab(hexOf(along(stops, i / (SAMPLES - 1))))); return o; };
  const avgGap = (A, B, flip) => { let d = 0; for (let i = 0; i < SAMPLES; i++) { const x = A[i], y = B[flip ? SAMPLES - 1 - i : i]; d += Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); } return d / SAMPLES; };
  // Sharing both end colours is enough to look like the same pattern, even if the middle differs.
  const endGap = (A, B, flip) => {
    const x = A[0], y = B[flip ? SAMPLES - 1 : 0], u = A[SAMPLES - 1], v = B[flip ? 0 : SAMPLES - 1];
    return (Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) + Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2])) / 2;
  };
  let builtIn = null;
  // Is this pair of colours its own thing, or just a built-in pattern again?
  // The direction is left out on purpose: turning a gradient round doesn't stop it being Sunset.
  // -> { ok, name (closest pattern), dist, why: '' | 'solid' | 'pair' | 'pattern' }
  SK.gradCheck = (a, b) => {
    builtIn = builtIn || Object.keys(SK.GRADIENTS).map(name => ({ name, s: fadeSamples(SK.GRADIENTS[name]) }))
      .concat(Object.keys(SK.FIXED_BANDS).map(name => ({ name, s: fadeSamples(SK.FIXED_BANDS[name].slice(0, 2)) })));
    if (SK.colorDistance(a, b) < SK.GRAD_SOLID) return { ok: false, name: 'Solid', dist: 0, why: 'solid' };
    // Fade, Duo, Stripes and Zebra work from any one colour, so test the pair against what they'd make of it.
    const A = rgbOf(a), B = rgbOf(b);
    for (const [name, to, f] of [['Fade', [15, 22, 18], 0.6], ['Duo', [255, 255, 255], 0.38], ['Stripes', [0, 0, 0], 0.3], ['Zebra', [0, 0, 0], 0.55]]) {
      if (SK.colorDistance(hexOf(mixRgb(A, to, f)), b) < SK.GRAD_PAIR || SK.colorDistance(hexOf(mixRgb(B, to, f)), a) < SK.GRAD_PAIR) return { ok: false, name, dist: 0, why: 'pair' };
    }
    const me = fadeSamples([A, B]);
    let near = null;
    for (const p of builtIn) {
      const dist = Math.min(avgGap(me, p.s, false), avgGap(me, p.s, true), endGap(me, p.s, false), endGap(me, p.s, true));
      if (!near || dist < near.dist) near = { name: p.name, dist };
    }
    const ok = near.dist >= SK.GRAD_MIN;
    return { ok, name: near.name, dist: near.dist, why: ok ? '' : 'pattern' };
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
    { id: 'collector', name: 'Collector', unit: 'rewards', how: 'Every reward you unlock counts. The last stop needs all of them, and lets you make your own gradient.',
      value: p => p.collected, verb: g => 'Unlock ' + g + ' rewards',
      steps: [E('e-happy', 20, 17), T('t-sparks', 40, 10), H('h-headphones', 60, 18), P('p-royal', 80, 22), BD('bd-space', 100, 9),
              F('f-pizza', 120, 10), C('c-custom', 149, 47)] }
  ];

  // The later rewards, by path. Goals here are new stops between and beyond the original ones.
  const LATER = {
    classic: [C('c-olive', 4, 51), C('c-pine', 5, 50), T('t-dandelion', 6, 13), BD('bd-garden', 7, 11), P('p-orchard', 8, 27),
      P('p-ladder', 11, 29), BD('bd-hedgerow', 13, 12), T('t-grass', 16, 12), C('c-jade', 20, 53), B('b-seeds', 30, 15),
      P('p-garter', 35, 28), C('c-clover', 40, 49), C('c-fern', 60, 48), F('f-banana', 95, 13), P('p-meadow', 120, 26),
      C('c-sage', 150, 52), B('b-clovers', 170, 14), H('h-beret', 200, 21)],
    borderless: [C('c-zephyr', 4, 58), T('t-wisps', 5, 15), B('b-comets', 6, 16), P('p-skyline', 7, 30), T('t-stardust', 8, 16),
      P('p-runway', 10, 35), T('t-contrail', 12, 14), B('b-gusts', 19, 18), B('b-ripples', 20, 17), C('c-drift', 30, 57),
      C('c-azure', 35, 55), P('p-dashes', 50, 34), C('c-horizon', 60, 54), P('p-tropics', 75, 31), P('p-daybreak', 90, 33),
      BD('bd-horizon', 110, 13), P('p-mirage', 135, 32), C('c-cerulean', 160, 56), BD('bd-opensky', 200, 14)],
    walls: [P('p-barrier', 4, 40), P('p-forge', 6, 37), P('p-masonry', 7, 36), C('c-terracotta', 8, 64), B('b-rubble', 12, 19),
      C('c-granite', 14, 59), B('b-bricks', 17, 20), C('c-clay', 25, 62), T('t-gravel', 30, 17), C('c-rust', 40, 61),
      T('t-dust', 65, 18), BD('bd-bunker', 75, 15), P('p-brickwork', 85, 39), C('c-iron', 100, 60), P('p-hazard', 115, 38),
      C('c-concrete', 130, 63), H('h-hardhat', 150, 22)],
    portal: [P('p-glitch', 4, 46), C('c-quasar', 5, 68), C('c-warp', 6, 65), C('c-ion', 7, 69), B('b-warps', 8, 21),
      C('c-nebula', 9, 66), C('c-rift', 12, 67), B('b-sparks', 14, 22), P('p-blink', 17, 44), T('t-static', 25, 19),
      C('c-vortex', 30, 70), T('t-orbit', 40, 20), P('p-interdimension', 60, 43), P('p-rings', 90, 45), P('p-singularity', 105, 42),
      P('p-wormhole', 125, 41), BD('bd-rift', 150, 16)],
    poison: [C('c-blight', 4, 76), C('c-venom', 5, 71), P('p-coralsnake', 6, 53), C('c-nightshade', 7, 74), B('b-spit', 8, 23),
      C('c-bile', 9, 73), B('b-skulls', 12, 24), P('p-antidote', 14, 47), P('p-sludge', 17, 49), T('t-spores', 25, 22),
      C('c-slime', 30, 72), P('p-foxglove', 40, 50), C('c-acid', 50, 75), P('p-hemlock', 55, 48), P('p-warning', 65, 52),
      P('p-hornet', 75, 51), B('b-fumes', 90, 25), T('t-ooze', 105, 21), BD('bd-swamp', 120, 17)],
    peaceful: [P('p-sorbet', 4, 56), B('b-dewdrops', 5, 26), C('c-butter', 6, 81), C('c-petal', 7, 80), T('t-feather', 9, 24),
      C('c-linen', 12, 77), P('p-dreamy', 15, 54), C('c-dew', 19, 78), T('t-pollen', 30, 23), B('b-feathers', 35, 27),
      P('p-lullaby', 45, 55), P('p-tidepool', 60, 57), B('b-daisies', 105, 28), P('p-picnic', 125, 59), C('c-wisteria', 190, 82),
      P('p-ribbon', 350, 58), C('c-mist', 425, 79), BD('bd-zen', 500, 18)],
    turbo: [P('p-burnout', 4, 63), B('b-nitrous', 5, 30), B('b-sonic', 6, 29), P('p-speedway', 7, 66), T('t-lightning', 8, 26),
      C('c-volt', 9, 85), C('c-afterburn', 11, 86), C('c-nitro', 13, 83), P('p-overdrive', 16, 60), P('p-slipstream', 18, 61),
      C('c-chrome', 20, 87), P('p-hyperdrive', 30, 62), B('b-tyresmoke', 35, 31), T('t-afterburner', 50, 25), P('p-pitlane', 70, 65),
      P('p-checkered', 85, 64), C('c-redline', 100, 84), BD('bd-racetrack', 120, 19)],
    mirror: [C('c-silver', 4, 88), P('p-lookingglass', 5, 67), T('t-glints', 6, 27), BD('bd-hall', 7, 20), P('p-doubletake', 8, 70),
      T('t-echoes', 11, 28), B('b-prisms', 13, 33), P('p-barcode', 16, 72), C('c-prism', 20, 90), C('c-reflect', 30, 89),
      P('p-refraction', 35, 69), B('b-shards', 45, 32), BD('bd-funhouse', 55, 21), C('c-quicksilver', 60, 91), P('p-mime', 70, 73),
      C('c-inverse', 80, 92), P('p-twin', 90, 71), P('p-opposite', 105, 68), E('e-googly', 120, 20)],
    dark: [BD('bd-crypt', 4, 22), C('c-moonlight', 5, 97), P('p-midnightsun', 6, 76), P('p-abyssal', 7, 75), C('c-obsidian', 8, 93),
      T('t-glow', 9, 29), C('c-glowworm', 11, 98), B('b-fireflies', 13, 34), P('p-candlelight', 16, 77), T('t-shade', 18, 30),
      C('c-shadow', 20, 94), C('c-raven', 30, 95), C('c-emberglow', 35, 96), P('p-eclipse', 50, 74), P('p-skeleton', 70, 78),
      P('p-nightwatch', 85, 79), B('b-bats', 100, 35), BD('bd-cavern', 120, 23)],
    gold: [C('c-amber', 4, 102), P('p-rosegold', 5, 81), C('c-bronze', 6, 100), B('b-glitter', 7, 38), B('b-doubloons', 8, 36),
      C('c-saffron', 13, 103), P('p-coinstack', 16, 86), B('b-nuggets', 20, 37), P('p-pharaoh', 30, 85), P('p-royalsash', 35, 84),
      T('t-golddust', 40, 31), C('c-treasure', 60, 104), T('t-trickle', 75, 32), P('p-midas', 95, 80), C('c-champagne', 120, 101),
      C('c-bullion', 150, 99), P('p-jackpot', 190, 83), P('p-prospector', 240, 82), BD('bd-vault', 300, 24)],
    hunger: [T('t-crumbtrail', 4, 33), C('c-beetroot', 5, 109), P('p-caramel', 6, 88), C('c-avocado', 7, 110), C('c-cinnamon', 8, 107),
      P('p-bacon', 9, 91), P('p-berrymix', 11, 89), B('b-crumbs', 13, 39), P('p-sprinkles', 16, 93), C('c-mustard', 18, 106),
      B('b-sugar', 20, 40), C('c-paprika', 30, 105), C('c-toffee', 35, 111), P('p-smoothie', 40, 90), P('p-spice', 45, 87),
      C('c-pumpkin', 50, 108), T('t-syrup', 60, 34), BD('bd-picnic', 70, 25), P('p-licorice', 85, 92), F('f-burger', 100, 14)],
    runaway: [B('b-pawprints', 4, 41), P('p-getaway', 5, 94), B('b-dustup', 6, 42), T('t-blur', 7, 36), P('p-crosswalk', 8, 99),
      P('p-foxhunt', 9, 96), P('p-jackrabbit', 11, 97), BD('bd-burrow', 13, 27), C('c-sprint', 16, 114), P('p-pursuit', 18, 95),
      T('t-footprints', 20, 35), BD('bd-thicket', 30, 26), C('c-dash', 35, 113), C('c-chase', 45, 112), P('p-fox', 50, 98),
      P('p-hare', 55, 100), C('c-scamper', 65, 115), C('c-rabbit', 80, 116), H('h-sprout', 100, 23)],
    apples: [B('b-slices', 4, 44), P('p-reddelicious', 5, 104), C('c-granny', 7, 120), C('c-pippin', 9, 117), B('b-pips', 12, 43),
      P('p-cidermill', 15, 105), P('p-bramble', 19, 102), F('f-pear', 35, 16), T('t-juice', 70, 38), P('p-harvest', 120, 101),
      T('t-peel', 240, 37), C('c-cider', 500, 119), C('c-crabapple', 1200, 118), C('c-russet', 2400, 121), P('p-citrus', 3900, 103),
      H('h-fez', 15000, 24), BD('bd-orchard', 22500, 28), F('f-peach', 33500, 15), E('e-moon', 50000, 21)],
    games: [P('p-oldfriend', 4, 106), B('b-tickets', 7, 45), T('t-ribbons', 12, 40), P('p-referee', 19, 109), T('t-tally', 30, 39),
      H('h-sailor', 60, 25), P('p-scarf', 120, 108), C('c-marathon', 240, 123), P('p-regular', 375, 107), F('f-pretzel', 600, 17),
      C('c-veteran', 1500, 122), B('b-dice', 2200, 46), BD('bd-arcade', 3300, 29), C('c-stayer', 4100, 124), E('e-ring', 5000, 22)],
    best: [P('p-medal', 4, 113), C('c-champion', 5, 125), C('c-podium', 6, 127), B('b-trophies', 7, 47), B('b-supernova', 8, 49),
      C('c-trophy', 9, 126), P('p-halloffame', 12, 111), H('h-tiara', 13, 26), P('p-laurels', 17, 112), T('t-victory', 35, 41),
      T('t-glory', 45, 42), B('b-applause', 240, 48), P('p-podiumfinish', 280, 110), BD('bd-stadium', 325, 30), E('e-diamond', 400, 23)],
    length: [T('t-skinflakes', 4, 44), C('c-boa', 5, 129), F('f-carrot', 6, 18), P('p-seasnake', 7, 118), C('c-mamba', 8, 130),
      P('p-kingsnake', 9, 117), BD('bd-jungle', 10, 31), C('c-python', 12, 131), B('b-scales', 13, 50), P('p-coral', 17, 116),
      C('c-anaconda', 19, 132), T('t-slither', 20, 43), C('c-longgreen', 35, 128), B('b-shed', 60, 51), P('p-cobra', 85, 114),
      BD('bd-serpentpit', 170, 32), P('p-coil', 375, 115), E('e-snake', 450, 24)],
    time: [P('p-seasons', 5, 119), C('c-dawn', 15, 135), B('b-maple', 25, 53), C('c-hourglass', 40, 133), P('p-moonrise', 50, 121),
      C('c-winter', 75, 137), P('p-sailorstripes', 90, 123), P('p-pendulum', 240, 122), C('c-patina', 420, 138), BD('bd-clocktower', 480, 33),
      P('p-sundown', 720, 120), T('t-sandfall', 1440, 45), T('t-fallingleaves', 3600, 46), C('c-autumn', 4260, 136), C('c-dusk', 6000, 134),
      B('b-sand', 8460, 52), H('h-astronaut', 12000, 27)],
    level: [C('c-sagegreen', 7, 143), BD('bd-citadel', 9, 36), T('t-haloring', 11, 48), T('t-magicdust', 13, 47), C('c-apprentice', 15, 139),
      P('p-enchanted', 17, 125), P('p-ascent', 19, 124), H('h-witch', 21, 28), B('b-runes', 22, 54), B('b-levelup', 24, 56),
      C('c-hero', 25, 146), T('t-aura', 27, 49), P('p-ouroboros', 28, 127), H('h-jester', 29, 29), C('c-adept', 31, 140),
      P('p-prestige', 32, 126), P('p-crusader', 33, 129), C('c-mythic', 37, 144), B('b-magic', 38, 55), C('c-legend', 42, 145),
      P('p-knight', 43, 128), C('c-elder', 47, 142), BD('bd-temple', 52, 35), C('c-master', 57, 141), BD('bd-tower', 62, 34),
      E('e-flame', 67, 25), F('f-icecream', 72, 19)],
    collector: [T('t-trinkets', 30, 50), H('h-mohawk', 50, 30), C('c-antique', 70, 150), C('c-heirloom', 90, 148), T('t-prismdust', 110, 51),
      P('p-kaleidoscope', 135, 132), C('c-curio', 165, 147), P('p-tartan', 190, 134), C('c-rarity', 215, 149), P('p-opaline', 240, 131),
      B('b-treasures', 270, 58), P('p-cabinet', 300, 133), F('f-cheese', 330, 20), BD('bd-gallery', 360, 37), B('b-baubles', 400, 57),
      P('p-museum', 440, 130), E('e-teary', 475, 26)]
  };
  for (const t of SK.TRACKS) t.steps.push(...LATER[t.id]);
  SK.TRACKS.find(t => t.id === 'collector').steps.push(P('p-gradient', 499, SK.GRAD));

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
