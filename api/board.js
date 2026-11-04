// Daily Challenge leaderboard (Vercel function).
// POST { mode: 'top', day, id }   -> 200 { top: [{ name, score, me }], count, you: { rank, score } | null }
// POST { mode: 'submit', day, id, name, score, ticks, log }  -> 200 { rank, score }
//   400 bad request, 409 name not allowed, 422 the moves don't give that score
// A score is only accepted if replaying the moves through the real game rules gives the same score,
// so a made-up number gets nowhere. id is a private random string; only a hash of it is stored.
const crypto = require('crypto');
const { sql, cors } = require('./_db.js');
require('../js/util.js'); require('../js/game.js');
const D = globalThis.Snake.daily || (require('../js/daily.js'), globalThis.Snake.daily);

const MAX_BODY = 64 * 1024, TOP = 20;
const hash = id => crypto.createHash('sha256').update('snake-board:' + id).digest('hex').slice(0, 32);
const okDay = day => {
  if (typeof day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(day)) return false;
  return Math.abs(D.dayNum(day) - Math.floor(Date.now() / 864e5)) <= 1 && D.keyOf(D.dayNum(day)) === day;   // time zones span about a day either way
};
const okId = id => typeof id === 'string' && /^[0-9a-z]{16,32}$/.test(id);

let ready = null;
function setup() {
  ready = ready || sql('CREATE TABLE IF NOT EXISTS snake_board (day text NOT NULL, player text NOT NULL, name text NOT NULL, score integer NOT NULL, ticks integer NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (day, player))')
    .then(() => sql('CREATE INDEX IF NOT EXISTS snake_board_rank ON snake_board (day, score DESC, ticks ASC)'))
    .catch(e => { ready = null; throw e; });
  return ready;
}

async function rankOf(day, score, ticks) {
  const r = await sql('SELECT count(*) FROM snake_board WHERE day = $1 AND (score > $2 OR (score = $2 AND ticks < $3))', [day, score, ticks]);
  return +r[0][0] + 1;
}

async function top(body) {
  const me = okId(body.id) ? hash(body.id) : '';
  const rows = await sql('SELECT player, name, score FROM snake_board WHERE day = $1 ORDER BY score DESC, ticks ASC, at ASC LIMIT ' + TOP, [body.day]);
  const count = +(await sql('SELECT count(*) FROM snake_board WHERE day = $1', [body.day]))[0][0];
  const mine = me ? await sql('SELECT score, ticks FROM snake_board WHERE day = $1 AND player = $2', [body.day, me]) : [];
  const you = mine.length ? { score: +mine[0][0], rank: await rankOf(body.day, +mine[0][0], +mine[0][1]) } : null;
  return [200, { top: rows.map(r => ({ name: r[1], score: +r[2], me: r[0] === me })), count, you }];
}

async function submit(body) {
  if (!okId(body.id)) return [400, { error: 'bad id' }];
  const name = D.cleanName(body.name);
  if (!name) return [409, { error: 'name' }];
  const game = D.replay(D.challenge(body.day), body.log, body.ticks);
  if (!game || game.score !== body.score || game.score < 1) return [422, { error: 'replay' }];
  // The first run of the day stands. Sending it again only changes the name.
  await sql('INSERT INTO snake_board (day, player, name, score, ticks) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (day, player) DO UPDATE SET name = EXCLUDED.name', [body.day, hash(body.id), name, game.score, game.ticks]);
  const out = await sql('SELECT score, ticks FROM snake_board WHERE day = $1 AND player = $2', [body.day, hash(body.id)]);
  return [200, { score: +out[0][0], rank: await rankOf(body.day, +out[0][0], +out[0][1]) }];
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { if (body.length > MAX_BODY) return res.status(413).json({ error: 'too big' }); try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object' || !okDay(body.day)) return res.status(400).json({ error: 'bad request' });
  if (JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ error: 'too big' });
  try {
    await setup();
    const [status, out] = await (body.mode === 'submit' ? submit(body) : top(body));
    res.status(status).json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server' });
  }
};
