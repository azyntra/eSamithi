const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { getPool } = require('../db');
const { enrollAuthMiddleware } = require('../middleware/memberAuth');

const router = express.Router();

// ── Tunables ─────────────────────────────────────────────────────
const ENROLL_TOKEN_TTL = '10m';
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_DAYS = 30;
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Brute-force guard on the identity/PIN endpoints. Keyed by IP + samithi so
// one samithi's lockout never affects members of another behind the same IP.
const { ipKeyGenerator } = rateLimit;
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${req.tenant || ''}`,
  message: { error: 'Too many attempts. Please try again later.' }
});

// One generic message for every identity failure — never reveal whether the
// NIC exists, the DOB mismatched, or the account is disabled.
const VERIFY_FAILED = { error: 'Verification failed. Check your details or contact the society office.' };

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function signEnrollToken(memberId, tenant) {
  return jwt.sign({ member_id: memberId, typ: 'enroll', sam: tenant }, process.env.JWT_SECRET, { expiresIn: ENROLL_TOKEN_TTL });
}

function signAccessToken(memberId, tenant) {
  return jwt.sign({ member_id: memberId, typ: 'member', sam: tenant }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

async function issueRefreshToken(runner, memberId) {
  const token = crypto.randomBytes(32).toString('hex');
  await runner.query(
    'INSERT INTO member_refresh_tokens (member_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [memberId, sha256(token), REFRESH_TOKEN_DAYS]
  );
  return token;
}

// 4–6 digits, and not a trivially guessable sequence/repeat
function validatePin(pin) {
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
    return 'PIN must be 4 to 6 digits';
  }
  if (/^(\d)\1+$/.test(pin)) return 'PIN cannot be a repeated digit';
  const digits = pin.split('').map(Number);
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  if (ascending || descending) return 'PIN cannot be a simple sequence';
  return null;
}

// NIC + DOB → short enrollment token. Used by both first-time setup and PIN
// reset (identical flow; two paths so clients and logs can tell them apart).
async function verifyIdentityHandler(req, res, next) {
  try {
    const { nic, date_of_birth } = req.body;
    if (!nic || !date_of_birth) {
      return res.status(400).json({ error: 'NIC and date of birth are required' });
    }

    const [rows] = await getPool().query(
      `SELECT id, is_active, app_enabled FROM members
       WHERE nic = ? AND DATE_FORMAT(date_of_birth, '%Y-%m-%d') = ?`,
      [String(nic).trim(), String(date_of_birth).trim()]
    );
    if (rows.length === 0) return res.status(401).json(VERIFY_FAILED);

    const member = rows[0];
    const active = member.is_active === null || Number(member.is_active) === 1;
    const enabled = member.app_enabled === null || Number(member.app_enabled) === 1;
    if (!active || !enabled) return res.status(401).json(VERIFY_FAILED);

    res.json({ success: true, enroll_token: signEnrollToken(member.id, req.tenant) });
  } catch (err) { next(err); }
}

// POST /api/v1/member-auth/verify-identity
router.post('/verify-identity', authLimiter, verifyIdentityHandler);

// POST /api/v1/member-auth/reset-pin
router.post('/reset-pin', authLimiter, verifyIdentityHandler);

// POST /api/v1/member-auth/set-pin — requires the enrollment token
router.post('/set-pin', enrollAuthMiddleware, async (req, res, next) => {
  try {
    const { pin } = req.body;
    const pinError = validatePin(pin);
    if (pinError) return res.status(400).json({ error: pinError });

    const pool = getPool();
    const hash = bcrypt.hashSync(pin, 10);
    await pool.query(
      `UPDATE members SET pin_hash = ?, pin_set_at = NOW(), failed_pin_attempts = 0, pin_locked_until = NULL
       WHERE id = ?`,
      [hash, req.member.id]
    );
    // Setting a new PIN invalidates every existing session
    await pool.query('UPDATE member_refresh_tokens SET revoked_at = NOW() WHERE member_id = ? AND revoked_at IS NULL', [req.member.id]);

    const refreshToken = await issueRefreshToken(pool, req.member.id);
    res.json({ success: true, token: signAccessToken(req.member.id, req.tenant), refresh_token: refreshToken });
  } catch (err) { next(err); }
});

// POST /api/v1/member-auth/login — NIC + PIN
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { nic, pin } = req.body;
    if (!nic || !pin) return res.status(400).json({ error: 'NIC and PIN are required' });

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, pin_hash, is_active, app_enabled, failed_pin_attempts,
              (pin_locked_until IS NOT NULL AND pin_locked_until > NOW()) AS locked
       FROM members WHERE nic = ?`,
      [String(nic).trim()]
    );
    if (rows.length === 0) return res.status(401).json(VERIFY_FAILED);

    const member = rows[0];
    const active = member.is_active === null || Number(member.is_active) === 1;
    const enabled = member.app_enabled === null || Number(member.app_enabled) === 1;
    if (!active || !enabled) return res.status(401).json(VERIFY_FAILED);
    if (!member.pin_hash) {
      // `code` lets the app show a friendly "set up the app" path (§1.7)
      return res.status(401).json({ error: 'No PIN set for this account. Please set up the app first.', code: 'NO_PIN' });
    }
    if (Number(member.locked)) {
      return res.status(423).json({ error: 'Account temporarily locked after too many wrong attempts. Try again later.' });
    }

    if (!bcrypt.compareSync(String(pin), member.pin_hash)) {
      const attempts = Number(member.failed_pin_attempts) + 1;
      if (attempts >= MAX_PIN_ATTEMPTS) {
        await pool.query(
          'UPDATE members SET failed_pin_attempts = 0, pin_locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
          [LOCKOUT_MINUTES, member.id]
        );
        return res.status(423).json({ error: 'Account temporarily locked after too many wrong attempts. Try again later.' });
      }
      await pool.query('UPDATE members SET failed_pin_attempts = ? WHERE id = ?', [attempts, member.id]);
      return res.status(401).json({ error: 'Incorrect PIN' });
    }

    await pool.query('UPDATE members SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = ?', [member.id]);
    const refreshToken = await issueRefreshToken(pool, member.id);
    res.json({ success: true, token: signAccessToken(member.id, req.tenant), refresh_token: refreshToken });
  } catch (err) { next(err); }
});

// POST /api/v1/member-auth/refresh — rotate the refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT rt.id, rt.member_id, m.is_active, m.app_enabled
       FROM member_refresh_tokens rt
       JOIN members m ON m.id = rt.member_id
       WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
      [sha256(String(refresh_token))]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });

    const row = rows[0];
    const active = row.is_active === null || Number(row.is_active) === 1;
    const enabled = row.app_enabled === null || Number(row.app_enabled) === 1;
    if (!active || !enabled) return res.status(401).json({ error: 'Session expired. Please log in again.' });

    // Rotation: the presented token is spent whether or not anything else fails
    await pool.query('UPDATE member_refresh_tokens SET revoked_at = NOW() WHERE id = ?', [row.id]);
    const refreshToken = await issueRefreshToken(pool, row.member_id);
    res.json({ success: true, token: signAccessToken(row.member_id, req.tenant), refresh_token: refreshToken });
  } catch (err) { next(err); }
});

// POST /api/v1/member-auth/logout — revoke the presented refresh token
router.post('/logout', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await getPool().query(
        'UPDATE member_refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
        [sha256(String(refresh_token))]
      );
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
