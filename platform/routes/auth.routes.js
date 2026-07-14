const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const { getPool } = require('../db');

const router = express.Router();

// FR-1.3: short sessions
const MFA_TOKEN_TTL = '5m';
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_HOURS = 12;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function signAccess(admin) {
  return jwt.sign(
    { typ: 'pa', id: admin.id, role: admin.role, email: admin.email },
    process.env.PLATFORM_JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

async function issueRefresh(adminId) {
  const token = crypto.randomBytes(32).toString('hex');
  await getPool().query(
    'INSERT INTO sa_refresh_tokens (admin_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))',
    [adminId, sha256(token), REFRESH_HOURS]
  );
  return token;
}

// One vague message for every credential failure
const LOGIN_FAILED = { error: 'Invalid email, password or code' };

// Step 1: email + password → short-lived MFA token (never a session by itself)
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const [[admin]] = await getPool().query(
      'SELECT id, email, password_hash, is_active FROM super_admins WHERE email = ?',
      [String(email).trim().toLowerCase()]
    );
    if (!admin || !admin.is_active || !bcrypt.compareSync(String(password), admin.password_hash)) {
      return res.status(401).json(LOGIN_FAILED);
    }
    const mfaToken = jwt.sign({ typ: 'mfa', id: admin.id }, process.env.PLATFORM_JWT_SECRET, { expiresIn: MFA_TOKEN_TTL });
    res.json({ mfa_required: true, mfa_token: mfaToken });
  } catch (err) { next(err); }
});

// Step 2: TOTP code (or a one-time recovery code) → access + refresh tokens
router.post('/totp', async (req, res, next) => {
  try {
    const { mfa_token, code } = req.body;
    if (!mfa_token || !code) return res.status(400).json({ error: 'Code required' });

    let decoded;
    try {
      decoded = jwt.verify(mfa_token, process.env.PLATFORM_JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Sign-in expired — start again' });
    }
    if (decoded.typ !== 'mfa') return res.status(401).json({ error: 'Invalid token type' });

    const pool = getPool();
    const [[admin]] = await pool.query(
      'SELECT id, email, name, role, totp_secret, is_active FROM super_admins WHERE id = ?',
      [decoded.id]
    );
    if (!admin || !admin.is_active) return res.status(401).json(LOGIN_FAILED);

    const clean = String(code).replace(/\s+/g, '');
    let ok = authenticator.check(clean, admin.totp_secret);
    if (!ok) {
      // Recovery code path — single use
      const [result] = await pool.query(
        'UPDATE sa_recovery_codes SET used_at = NOW() WHERE admin_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1',
        [admin.id, sha256(clean.toUpperCase())]
      );
      ok = result.affectedRows > 0;
    }
    if (!ok) return res.status(401).json(LOGIN_FAILED);

    await pool.query('UPDATE super_admins SET last_login_at = NOW() WHERE id = ?', [admin.id]);
    await pool.query(
      `INSERT INTO audit_log (admin_id, role, action, ip) VALUES (?, ?, 'login', ?)`,
      [admin.id, admin.role, req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress]
    );
    res.json({
      token: signAccess(admin),
      refresh_token: await issueRefresh(admin.id),
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role }
    });
  } catch (err) { next(err); }
});

// Rotation with reuse detection (FR-1.3): a replayed old token nukes every
// session for that admin — the classic sign the refresh token was stolen.
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

    const pool = getPool();
    const hash = sha256(String(refresh_token));
    const [[row]] = await pool.query(
      'SELECT id, admin_id, revoked_at, expires_at > NOW() AS alive FROM sa_refresh_tokens WHERE token_hash = ?',
      [hash]
    );
    if (!row) return res.status(401).json({ error: 'Session expired' });

    if (row.revoked_at) {
      await pool.query('UPDATE sa_refresh_tokens SET revoked_at = NOW() WHERE admin_id = ? AND revoked_at IS NULL', [row.admin_id]);
      await pool.query(
        `INSERT INTO audit_log (admin_id, action, ip) VALUES (?, 'refresh_reuse_detected', ?)`,
        [row.admin_id, req.socket.remoteAddress]
      );
      return res.status(401).json({ error: 'Session expired' });
    }
    if (!Number(row.alive)) return res.status(401).json({ error: 'Session expired' });

    const [[admin]] = await pool.query(
      'SELECT id, email, name, role, is_active FROM super_admins WHERE id = ?', [row.admin_id]
    );
    if (!admin || !admin.is_active) return res.status(401).json({ error: 'Session expired' });

    await pool.query('UPDATE sa_refresh_tokens SET revoked_at = NOW() WHERE id = ?', [row.id]);
    res.json({ token: signAccess(admin), refresh_token: await issueRefresh(admin.id) });
  } catch (err) { next(err); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await getPool().query(
        'UPDATE sa_refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
        [sha256(String(refresh_token))]
      );
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
