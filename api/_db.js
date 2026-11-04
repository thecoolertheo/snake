// Shared by the server functions: talking to the Neon Postgres database.
// (A leading underscore tells Vercel this isn't a web address of its own.)
const DB_TIMEOUT = 3000;

async function query1(query, params) {
  const DB = process.env.DATABASE_URL;
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

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

module.exports = { sql, cors };
