# Snake Plus

## Single-file build: keep it updated

`snake-plus.html` is the whole game compiled into one file. It must match the source in every commit.

- After any change to the app, run `node tools/build-single.js` and commit `snake-plus.html` with that change.
- It is generated. Never edit it by hand; change the source files, then rebuild.
- If you add a new script, stylesheet or image to `index.html`, make sure the build still inlines it.
  The build fails if the file would still point at something local.
- `snake.html` is the original backup of the game. Leave it alone.

## Checks

- Rule tests: `node -e "require('./js/util.js');require('./js/game.js');require('./js/sync-core.js');require('./tests.js')"`
- Single file up to date: `node tools/build-single.js --check`
