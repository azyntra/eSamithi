#!/usr/bin/env node
// Create (or reset) a super-admin account. Prints the password, TOTP setup
// URI and recovery codes ONCE — store them in a password manager.
//   node scripts/bootstrap-admin.js <email> "<Name>" [--role superadmin|operator|auditor]
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const { initDb, getPool } = require('../db');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

(async () => {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const roleFlag = process.argv.indexOf('--role');
  const role = roleFlag > -1 ? process.argv[roleFlag + 1] : 'superadmin';
  const [email, name] = args;
  if (!email || !name) {
    console.error('Usage: node scripts/bootstrap-admin.js <email> "<Name>" [--role superadmin|operator|auditor]');
    process.exit(1);
  }
  if (!['superadmin', 'operator', 'auditor'].includes(role)) {
    console.error('Role must be superadmin, operator or auditor');
    process.exit(1);
  }

  await initDb();
  const pool = getPool();

  const password = crypto.randomBytes(12).toString('base64url');
  const totpSecret = authenticator.generateSecret();
  const [result] = await pool.query(
    `INSERT INTO super_admins (email, name, password_hash, totp_secret, role)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), totp_secret = VALUES(totp_secret),
                             role = VALUES(role), is_active = 1, id = LAST_INSERT_ID(id)`,
    [String(email).trim().toLowerCase(), name, bcrypt.hashSync(password, 10), totpSecret, role]
  );
  const adminId = result.insertId;

  // Fresh recovery codes on every bootstrap/reset
  await pool.query('DELETE FROM sa_recovery_codes WHERE admin_id = ?', [adminId]);
  const recovery = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
  for (const code of recovery) {
    await pool.query('INSERT INTO sa_recovery_codes (admin_id, code_hash) VALUES (?, ?)', [adminId, sha256(code)]);
  }

  console.log('\n── Super admin ready — SHOWN ONCE, store it safely ─────────');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  role:     ${role}`);
  console.log('\n  Add to your authenticator app (Google Authenticator / Aegis):');
  console.log(`  ${authenticator.keyuri(email, 'eSamithi Platform', totpSecret)}`);
  console.log(`  (manual entry secret: ${totpSecret})`);
  console.log('\n  Recovery codes (single use):');
  console.log('  ' + recovery.join('  '));
  process.exit(0);
})().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});
