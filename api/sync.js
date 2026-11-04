// Sync server (Vercel function). One row per sync code in the Neon Postgres database.
// POST { code, doc, mode }  mode: 'create' (new code), 'join' (code must exist) or 'sync'
//   -> 200 { doc } with the merged save, 404 unknown code, 409 code already taken (create)
// Saves are merged with the same rules as the game (js/sync-core.js), so nothing is ever lost.
const core = require('../js/sync-core.js');

const DB = process.env.DATABASE_URL;
const MAX_BODY = 64 * 1024;
const DB_TIMEOUT = 3000;

async function query1(query, params) {
  const host = new URL(DB).hostname.replace(/^[^.]+\./, 'api.');
  const r = await fetch('https://' + host + '/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': DB, 'Neon-Raw-Text-Output': 'true', 'Neon-Array-Mode': 'true' },
    body: JSON.stringify({ query, params: params || [] }),
    signal: AbortSignal.timeout(DB_TIMEOUT)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error('db ' + r.status + ' ' + (j && j.message));
  return j.rows || [];
}
// A stuck database connection shouldn't hold the request up, so give up on it quickly and try again.
async function sql(query, params) {
  for (let i = 0; ; i++) {
    try { return await query1(query, params); }
    catch (e) { if (e.name !== 'TimeoutError' || i >= 2) throw e; console.error('db call timed out, retrying'); }
  }
}

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
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
