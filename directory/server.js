// eSamithi directory service (multi-samithi plan §2.4): resolves a samithi
// join code to its API endpoint, so one app build serves every samithi and
// failover is a directory flip — no client rebuilds.
//
//   GET /v1/resolve/TST-2481
//   → { slug, name, api_url, status, min_app_version }
//
// Zero dependencies. Records live in directory.json (mounted read-only in
// Docker); edits are picked up within 30 s without a restart. This service is
// absorbed by platform-api when the super-admin panel lands.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8080');
const FILE = process.env.DIRECTORY_FILE || path.join(__dirname, 'directory.json');
const CACHE_MS = 30 * 1000;

let cache = { at: 0, data: {} };
function records() {
  if (Date.now() - cache.at > CACHE_MS) {
    try {
      cache = { at: Date.now(), data: JSON.parse(fs.readFileSync(FILE, 'utf-8')) };
    } catch (err) {
      console.error('directory.json unreadable:', err.message);
      cache.at = Date.now(); // keep serving the last good copy
    }
  }
  return cache.data;
}

http
  .createServer((req, res) => {
    const send = (code, body) => {
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify(body));
    };

    if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
    if (req.url === '/health') return send(200, { status: 'ok', codes: Object.keys(records()).length });

    const match = req.url.match(/^\/v1\/resolve\/([A-Za-z0-9-]{2,20})$/);
    if (match) {
      const record = records()[match[1].toUpperCase()];
      if (!record) return send(404, { error: 'Unknown samithi code' });
      return send(200, record);
    }
    send(404, { error: 'Not found' });
  })
  .listen(PORT, '0.0.0.0', () => console.log(`✓ directory service on :${PORT}`));
