const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Private files (docs/MEETING-MINUTES-REQUIREMENTS.md §6.1–§6.2). Unlike
// uploads/ — served to anyone who knows a filename — these live outside every
// static route and leave the server only through short-lived signed links:
//   /api/v1/files/<payload>.<hmac>
// The payload names the tenant, the file and an expiry; nothing else is needed
// to serve it, so <img>, <audio> and a PDF opened in a new tab all work
// without an Authorization header.
//
// In production the folder must be a mounted volume (lost on every container
// rebuild otherwise). The host creates it with a marker file; without the
// marker every write is refused with STORAGE_NOT_READY instead of silently
// writing into the container.

const ROOT = process.env.PRIVATE_DIR || path.join(__dirname, '..', 'private');
const MARKER = '.esamithi-private';
const TTL_SECONDS = 30 * 60;

function fail(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
}

function ready() {
  const marker = path.join(ROOT, MARKER);
  if (fs.existsSync(marker)) return true;
  if (process.env.NODE_ENV === 'production') return false;
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(marker, 'dev/test private storage\n');
  return true;
}

function assertReady() {
  if (!ready()) throw fail(503, 'STORAGE_NOT_READY', 'File storage is not set up on this server yet');
}

const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;

// Absolute directory for one tenant's area, created on demand
function dir(tenant, ...parts) {
  if (!SLUG.test(tenant)) throw fail(400, 'BAD_TENANT', 'Bad tenant');
  const full = path.join(ROOT, tenant, ...parts.map(String));
  fs.mkdirSync(full, { recursive: true });
  return full;
}

// Path relative to ROOT, the form that goes into a signed link
function rel(tenant, ...parts) {
  return [tenant, ...parts.map(String)].join('/');
}

function abs(relPath) {
  return path.join(ROOT, ...relPath.split('/'));
}

function newName(ext) {
  return crypto.randomBytes(16).toString('hex') + ext;
}

function secret() {
  const base = process.env.FILES_SECRET || process.env.JWT_SECRET;
  if (!base) throw new Error('FILES_SECRET or JWT_SECRET must be set');
  // A separate key derived from the JWT secret: a file link can never be
  // mistaken for a token, and FILES_SECRET can rotate links on its own.
  return crypto.createHash('sha256').update('esamithi-files:' + base).digest();
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

// A link to one private file, valid for ttl seconds. name is the download
// filename suggested to the browser (PDF "Save as").
function signedUrl(relPath, { ttl = TTL_SECONDS, name } = {}) {
  const payload = b64(JSON.stringify({ f: relPath, e: Math.floor(Date.now() / 1000) + ttl, ...(name ? { n: name } : {}) }));
  const mac = b64(crypto.createHmac('sha256', secret()).update(payload).digest());
  return `/api/v1/files/${payload}.${mac}`;
}

// Only files this module writes can be named: tenant/area/…/<hex>.<ext>
const SAFE_REL = /^[a-z0-9][a-z0-9_-]{0,63}(\/[a-z0-9_-]{1,64})*\/[a-f0-9]{32}(_t)?\.(jpg|pdf|m4a|mp3|aac|wav|ogg)$/;

function verify(token) {
  const dot = typeof token === 'string' ? token.indexOf('.') : -1;
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = b64(crypto.createHmac('sha256', secret()).update(payload).digest());
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (!data || typeof data.f !== 'string' || !SAFE_REL.test(data.f)) return null;
  if (!Number.isFinite(data.e) || data.e < Math.floor(Date.now() / 1000)) return null;
  return data;
}

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
  '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg'
};

// GET /api/v1/files/:token — mounted before the tenant middleware: the signed
// token is the whole authorisation. res.sendFile answers Range requests, so
// audio can seek without downloading the whole recording.
function serve(req, res) {
  const data = verify(req.params.token);
  if (!data) return res.status(404).json({ error: 'This link has expired. Go back and open it again.', code: 'LINK_EXPIRED' });
  const file = abs(data.f);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
  const ext = path.extname(file);
  res.setHeader('Cache-Control', 'private, max-age=1800');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
  if (ext === '.pdf') {
    const safe = String(data.n || 'minutes.pdf').replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 120) || 'minutes.pdf';
    res.setHeader('Content-Disposition', `inline; filename="minutes.pdf"; filename*=UTF-8''${encodeURIComponent(safe)}`);
  }
  res.sendFile(file, { headers: {}, acceptRanges: true, lastModified: false, etag: true }, (err) => {
    if (err && !res.headersSent) res.status(err.statusCode || 500).end();
  });
}

function remove(relPath) {
  try { fs.unlinkSync(abs(relPath)); } catch { /* already gone */ }
}

module.exports = { ROOT, ready, assertReady, dir, rel, abs, newName, signedUrl, verify, serve, remove, TTL_SECONDS };
