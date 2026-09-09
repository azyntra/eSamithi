// Staff password hashing (web programme, requirements §6.5 — "Deploy A").
// Legacy rows hold unsalted SHA-256 hex. verify() accepts both that and
// bcrypt, so rows can move to bcrypt opportunistically once PASSWORD_REHASH=on
// ("Deploy B"). While the flag is off, hash() keeps producing SHA-256 and no
// stored row is ever rewritten, which keeps this change fully reversible.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_COST = 10; // ≈100 ms on the 1-core ARM production host

function sha256(plain) {
  return crypto.createHash('sha256').update(String(plain)).digest('hex');
}

function isBcrypt(stored) {
  return typeof stored === 'string' && /^\$2[aby]\$\d\d\$/.test(stored);
}

function rehashEnabled() {
  return String(process.env.PASSWORD_REHASH || 'off').toLowerCase() === 'on';
}

// Constant-time comparison for the legacy hex hashes
function legacyMatches(plain, stored) {
  const a = Buffer.from(sha256(plain), 'utf8');
  const b = Buffer.from(String(stored), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function verify(plain, stored) {
  const candidate = plain == null ? '' : String(plain);
  if (candidate.length === 0 || !stored) return false;
  if (isBcrypt(stored)) return bcrypt.compare(candidate, stored);
  return legacyMatches(candidate, stored);
}

async function hash(plain) {
  return rehashEnabled() ? bcrypt.hash(String(plain), BCRYPT_COST) : sha256(plain);
}

// True when a successful login should transparently upgrade the stored hash
function needsRehash(stored) {
  return rehashEnabled() && !isBcrypt(stored);
}

module.exports = { verify, hash, needsRehash, isBcrypt, sha256, rehashEnabled, BCRYPT_COST };
