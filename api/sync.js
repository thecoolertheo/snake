// Sync server (Vercel function). One row per sync code in the Neon Postgres database.
// POST { code, doc, mode }  mode: 'create' (new code), 'join' (code must exist) or 'sync'
//   -> 200 { doc } with the merged save, 404 unknown code, 409 code already taken (create)
// Saves are merged with the same rules as the game (js/sync-core.js), so nothing is ever lost.
const core = require('../js/sync-core.js');

const { sql, cors } = require('./_db.js');
const MAX_BODY = 64 * 1024;

let ready = null;
function setup() {
  ready = ready || sql('CREATE TABLE IF NOT EXISTS snake_sync (code text PRIMARY KEY, doc text NOT NULL, ver integer NOT NULL DEFAULT 0, updated timestamptz NOT NULL DEFAULT now())')
    .catch(e => { ready = null; throw e; });
  return ready;
}

async function handle(body) {
  const code = core.cleanCode(body.code);
  if (!code) return [400, { error: 'bad code' }];
  const mode = body.mode || 'sync';
  const incoming = core.sanitize(body.doc);
  await setup();

  if (mode === 'create') {
    const rows = await sql('INSERT INTO snake_sync (code, doc) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING RETURNING code', [code, JSON.stringify(incoming)]);
    return rows.length ? [200, { doc: incoming }] : [409, { error: 'taken' }];
  }
  // Read, merge, write back only if nobody else wrote in between (otherwise try again).
  for (let i = 0; i < 6; i++) {
    const rows = await sql('SELECT doc, ver FROM snake_sync WHERE code = $1', [code]);
    if (!rows.length) return [404, { error: 'not found' }];
    const stored = JSON.parse(rows[0][0]), ver = +rows[0][1];
    const merged = core.mergeDocs(stored, incoming);
    const out = JSON.stringify(merged);
    if (out === JSON.stringify(core.sanitize(stored))) return [200, { doc: merged }];   // nothing new
    const ok = await sql('UPDATE snake_sync SET doc = $2, ver = ver + 1, updated = now() WHERE code = $1 AND ver = $3 RETURNING ver', [code, out, ver]);
    if (ok.length) return [200, { doc: merged }];
  }
  return [503, { error: 'busy' }];
}

module.exports = async (req, res) => {
  // The game can also run from a file on your computer, so allow any origin. The code is the key.
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { if (body.length > MAX_BODY) return res.status(413).json({ error: 'too big' }); try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad body' });
  if (JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ error: 'too big' });
  try {
    const [status, out] = await handle(body);
    res.status(status).json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server' });
  }
};
