// Web staff sessions — integration suite against a real MySQL (CI service or
// a scratch database). Exercises rotation, reuse detection, the two-tab race
// leeway, lockout scope, change-password survival, sessions list/revoke,
// logout(all), opportunistic bcrypt re-hash, admin reset, disabled users and
// absolute expiry. Skips itself when DB_HOST is not set.
//   DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=citest node --test test/staffAuth.db.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

if (!process.env.DB_HOST) {
  test('staff session DB suite', { skip: 'DB_HOST not set — no database available' }, () => {});
  return;
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'ci1';
process.env.TENANTS_FILE = process.env.TENANTS_FILE || path.join(__dirname, 'fixtures', 'tenants.ci.json');
process.env.STAFF_LOCKOUT_MAX_FAILS = '3';
process.env.STAFF_LOCKOUT_MINUTES = '15';
process.env.STAFF_REUSE_LEEWAY_SECONDS = '0';
delete process.env.STAFF_LOCKOUT_SCOPE;
delete process.env.PASSWORD_REHASH;

const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { getPool } = require('../db');
const { migrateTenant } = require('../migrations/runner');
const { tenantMiddleware } = require('../middleware/tenant');
const passwords = require('../lib/passwords');
const authRoutes = require('../routes/auth.routes');
const usersRoutes = require('../routes/users.routes');

const T = 'ci1';
const PW = 'Secret123!';
let pool;
let server;
let base;
const ids = {};

test.before(async () => {
  pool = getPool(T);
  await migrateTenant(pool, T);
  await pool.query("DELETE FROM users WHERE username LIKE 'wst\\_%'");
  await pool.query("DELETE FROM staff_auth_events WHERE username LIKE 'wst\\_%'");
  for (const [name, role] of [['wst_admin', 'admin'], ['wst_user', 'user'], ['wst_viewer', 'viewer']]) {
    const [r] = await pool.query(
      'INSERT INTO users (username, password, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, passwords.sha256(PW), `WST ${role}`, role]
    );
    ids[name] = r.insertId;
  }
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1', tenantMiddleware);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}/api/v1`;
      resolve();
    });
  });
});

test.after(async () => {
  server.close();
  await pool.query("DELETE FROM users WHERE username LIKE 'wst\\_%'");
  await pool.query("DELETE FROM staff_auth_events WHERE username LIKE 'wst\\_%'");
  await pool.end();
});

// ── helpers ──────────────────────────────────────────────────────────────────
const H = (extra = {}) => ({ 'Content-Type': 'application/json', 'X-Samithi': T, ...extra });
const post = (p, body, extra = {}) => fetch(base + p, { method: 'POST', headers: H(extra), body: JSON.stringify(body || {}) });
const get = (p, extra = {}) => fetch(base + p, { headers: H(extra) });
const del = (p, extra = {}) => fetch(base + p, { method: 'DELETE', headers: H(extra) });
const cookieOf = (res) => {
  const c = (res.headers.getSetCookie() || []).find((x) => x.startsWith('es_rt='));
  return c ? c.slice('es_rt='.length, c.indexOf(';')) : null;
};
const clearedCookie = (res) => (res.headers.getSetCookie() || []).some((x) => /^es_rt=; /.test(x));
const withCookie = (value, extra = {}) => ({ 'X-Requested-With': 'eSamithi', Cookie: `es_rt=${value}`, ...extra });
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function signIn(username, password = PW, extra = {}) {
  const res = await post('/auth/session', { username, password }, extra);
  assert.strictEqual(res.status, 200, `sign-in ${username}: ${res.status} ${await res.clone().text()}`);
  const body = await res.json();
  return { cookie: cookieOf(res), token: body.access_token, sid: jwt.decode(body.access_token).sid, body };
}
const refresh = (cookie) => post('/auth/refresh', {}, withCookie(cookie));

// ── flows ────────────────────────────────────────────────────────────────────
test('desktop login contract is intact against the real schema', async () => {
  const res = await post('/auth/login', { username: 'wst_admin', password: PW });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(Object.keys(body), ['success', 'user', 'token']);
  assert.deepStrictEqual(body.user, { id: ids.wst_admin, username: 'wst_admin', full_name: 'WST admin', role: 'admin' });
  assert.strictEqual(jwt.decode(body.token).typ, undefined);
  assert.strictEqual(cookieOf(res), null);
  const [[row]] = await pool.query('SELECT last_login_at, failed_attempts FROM users WHERE id = ?', [ids.wst_admin]);
  assert.ok(row.last_login_at);
  assert.strictEqual(row.failed_attempts, 0);
});

test('web sign-in issues a session; /me and /sessions describe it', async () => {
  const s = await signIn('wst_admin');
  assert.match(s.cookie, new RegExp(`^${T}\\.[0-9a-f]{64}$`));
  assert.strictEqual(s.body.user.must_change_password, false);
  const me = await (await get('/auth/me', bearer(s.token))).json();
  assert.strictEqual(me.username, 'wst_admin');
  assert.deepStrictEqual(me.samithi, { slug: T, name: 'CI Tenant One' });
  assert.strictEqual(me.session.id, s.sid);
  assert.strictEqual(me.session.client, 'web');
  assert.strictEqual(me.support, null);
  const list = await (await get('/auth/sessions', bearer(s.token))).json();
  assert.ok(list.some((x) => x.id === s.sid && x.current === true));
  const [[row]] = await pool.query('SELECT client, ip, revoked_at, TIMESTAMPDIFF(HOUR, NOW(), absolute_expires_at) AS abs_h, TIMESTAMPDIFF(HOUR, NOW(), expires_at) AS idle_h FROM staff_refresh_tokens WHERE family_id = ?', [s.sid]);
  assert.strictEqual(row.revoked_at, null);
  assert.ok(row.idle_h >= 11 && row.idle_h <= 12, `idle ${row.idle_h}`);
  assert.ok(row.abs_h >= 23 && row.abs_h <= 24, `absolute ${row.abs_h}`);
  const [events] = await pool.query("SELECT event FROM staff_auth_events WHERE user_id = ? AND event = 'login_ok'", [ids.wst_admin]);
  assert.ok(events.length >= 1);
});

test('refresh rotates the cookie; replaying a spent token revokes every session of the user', async () => {
  const s = await signIn('wst_admin');
  const r1 = await refresh(s.cookie);
  assert.strictEqual(r1.status, 200);
  const c2 = cookieOf(r1);
  assert.ok(c2 && c2 !== s.cookie);
  const b1 = await r1.json();
  assert.strictEqual(b1.expires_in, 900);
  assert.strictEqual(jwt.decode(b1.access_token).sid, s.sid, 'family id is stable across rotations');
  assert.strictEqual((await get('/auth/me', bearer(b1.access_token))).status, 200);

  const [[old]] = await pool.query("SELECT revoke_reason, replaced_by FROM staff_refresh_tokens WHERE family_id = ? ORDER BY id ASC LIMIT 1", [s.sid]);
  assert.strictEqual(old.revoke_reason, 'rotated');
  assert.ok(old.replaced_by);

  const replay = await refresh(s.cookie); // leeway is 0 in this suite → theft
  assert.strictEqual(replay.status, 401);
  assert.strictEqual((await replay.json()).code, 'REUSE');
  assert.ok(clearedCookie(replay));
  const after = await refresh(c2);
  assert.strictEqual(after.status, 401, 'the legitimate successor is dead too');
  const [[left]] = await pool.query('SELECT COUNT(*) AS n FROM staff_refresh_tokens WHERE user_id = ? AND revoked_at IS NULL', [ids.wst_admin]);
  assert.strictEqual(Number(left.n), 0);
  const [ev] = await pool.query("SELECT COUNT(*) AS n FROM staff_auth_events WHERE user_id = ? AND event = 'refresh_reuse'", [ids.wst_admin]);
  assert.strictEqual(Number(ev[0].n) >= 1, true);
});

test('two-tab race: a token rotated moments ago answers RACED without clearing or revoking anything', async () => {
  process.env.STAFF_REUSE_LEEWAY_SECONDS = '5';
  try {
    const s = await signIn('wst_admin');
    const r1 = await refresh(s.cookie);
    assert.strictEqual(r1.status, 200);
    const c2 = cookieOf(r1);
    const raced = await refresh(s.cookie);
    assert.strictEqual(raced.status, 401);
    assert.strictEqual((await raced.json()).code, 'RACED');
    assert.strictEqual((raced.headers.getSetCookie() || []).length, 0, 'must not wipe the successor cookie');
    const ok = await refresh(c2);
    assert.strictEqual(ok.status, 200, 'the successor keeps working');
  } finally {
    process.env.STAFF_REUSE_LEEWAY_SECONDS = '0';
  }
});

test('lockout: three misses lock the web sign-in; the desktop still signs in (scope=web) and thereby unlocks', async () => {
  const wrong = () => post('/auth/session', { username: 'wst_user', password: 'nope' });
  assert.strictEqual((await wrong()).status, 401);
  assert.strictEqual((await wrong()).status, 401);
  const third = await wrong();
  assert.strictEqual(third.status, 423);
  assert.strictEqual((await third.json()).code, 'LOCKED');
  const rightButLocked = await post('/auth/session', { username: 'wst_user', password: PW });
  assert.strictEqual(rightButLocked.status, 423);
  assert.ok((await rightButLocked.json()).retry_after_seconds > 0);
  const [[locked]] = await pool.query('SELECT (locked_until > NOW()) AS locked FROM users WHERE id = ?', [ids.wst_user]);
  assert.strictEqual(Number(locked.locked), 1);
  const [ev] = await pool.query("SELECT COUNT(*) AS n FROM staff_auth_events WHERE user_id = ? AND event = 'locked'", [ids.wst_user]);
  assert.strictEqual(Number(ev[0].n), 1);

  const desktop = await post('/auth/login', { username: 'wst_user', password: PW });
  assert.strictEqual(desktop.status, 200, 'desktop 1.3.x is out of scope for the lockout');
  const [[unlocked]] = await pool.query('SELECT locked_until, failed_attempts FROM users WHERE id = ?', [ids.wst_user]);
  assert.strictEqual(unlocked.locked_until, null);
  assert.strictEqual(unlocked.failed_attempts, 0);
  assert.strictEqual((await post('/auth/session', { username: 'wst_user', password: PW })).status, 200);
});

test('change-password: every other session dies, the current one is re-issued, old password stops working', async () => {
  const a = await signIn('wst_admin');
  const b = await signIn('wst_admin');
  const res = await post('/auth/change-password', { current_password: PW, new_password: 'Changed456!' }, withCookie(a.cookie, bearer(a.token)));
  assert.strictEqual(res.status, 200, await res.clone().text());
  const aNext = cookieOf(res);
  assert.ok(aNext && aNext !== a.cookie, 'current session got a fresh cookie');
  assert.strictEqual((await refresh(b.cookie)).status, 401, 'other session revoked');
  assert.strictEqual((await refresh(aNext)).status, 200, 'current session survives');
  assert.strictEqual((await post('/auth/login', { username: 'wst_admin', password: PW })).status, 401);
  assert.strictEqual((await post('/auth/login', { username: 'wst_admin', password: 'Changed456!' })).status, 200);
  const [[row]] = await pool.query('SELECT revoke_reason FROM staff_refresh_tokens WHERE family_id = ? AND revoked_at IS NOT NULL ORDER BY id DESC LIMIT 1', [b.sid]);
  assert.strictEqual(row.revoke_reason, 'password');
  // restore for the remaining tests
  await pool.query('UPDATE users SET password = ?, password_changed_at = NULL WHERE id = ?', [passwords.sha256(PW), ids.wst_admin]);
});

test('sessions: list marks the current one; a user (even a viewer) can revoke their own sessions', async () => {
  const a = await signIn('wst_admin');
  const b = await signIn('wst_admin');
  let list = await (await get('/auth/sessions', bearer(a.token))).json();
  const mine = list.filter((x) => [a.sid, b.sid].includes(x.id));
  assert.strictEqual(mine.length, 2);
  assert.deepStrictEqual(mine.map((x) => x.current).sort(), [false, true]);
  assert.strictEqual((await del(`/auth/sessions/${b.sid}`, bearer(a.token))).status, 200);
  assert.strictEqual((await refresh(b.cookie)).status, 401);
  assert.strictEqual((await del(`/auth/sessions/${b.sid}`, bearer(a.token))).status, 404, 'already gone');
  list = await (await get('/auth/sessions', bearer(a.token))).json();
  assert.ok(!list.some((x) => x.id === b.sid));

  const v = await signIn('wst_viewer');
  assert.strictEqual((await del(`/auth/sessions/${v.sid}`, bearer(v.token))).status, 200);
  assert.strictEqual((await del(`/auth/sessions/${a.sid}`, bearer(v.token))).status, 404, 'cannot touch another user\'s session');
});

test('logout revokes the presented session; logout?all=1 revokes every session', async () => {
  const s = await signIn('wst_user');
  const other = await signIn('wst_user');
  const out = await post('/auth/logout', {}, withCookie(s.cookie));
  assert.strictEqual(out.status, 200);
  assert.ok(clearedCookie(out));
  const dead = await refresh(s.cookie);
  assert.strictEqual(dead.status, 401);
  assert.strictEqual((await dead.json()).code, 'REVOKED', 'a logged-out token is dead, not "stolen"');
  assert.strictEqual((await refresh(other.cookie)).status, 200, 'no collateral revocation of the other session');

  const a = await signIn('wst_user');
  const b = await signIn('wst_user');
  assert.strictEqual((await post('/auth/logout?all=1', {}, withCookie(a.cookie))).status, 200);
  assert.strictEqual((await refresh(a.cookie)).status, 401);
  assert.strictEqual((await refresh(b.cookie)).status, 401);
  assert.strictEqual((await post('/auth/logout', {})).status, 403, 'guard header required');
});

test('PASSWORD_REHASH=on upgrades a legacy hash on the next successful login', async () => {
  process.env.PASSWORD_REHASH = 'on';
  try {
    const [[before]] = await pool.query('SELECT password FROM users WHERE id = ?', [ids.wst_user]);
    assert.ok(!passwords.isBcrypt(before.password));
    assert.strictEqual((await post('/auth/login', { username: 'wst_user', password: PW })).status, 200);
    const [[after]] = await pool.query('SELECT password FROM users WHERE id = ?', [ids.wst_user]);
    assert.ok(passwords.isBcrypt(after.password), 'stored hash is now bcrypt');
    assert.strictEqual((await post('/auth/login', { username: 'wst_user', password: PW })).status, 200);
    assert.strictEqual((await post('/auth/session', { username: 'wst_user', password: PW })).status, 200);
    assert.strictEqual((await post('/auth/login', { username: 'wst_user', password: 'nope' })).status, 401);
  } finally {
    delete process.env.PASSWORD_REHASH;
  }
});

test('admin reset: target sessions die, the temporary password must be changed', async () => {
  const admin = await signIn('wst_admin');
  const target = await signIn('wst_user');
  const res = await fetch(`${base}/users/${ids.wst_user}/password`, { method: 'PATCH', headers: H(bearer(admin.token)), body: JSON.stringify({ new_password: 'Temp0rary!' }) });
  assert.strictEqual(res.status, 200, await res.clone().text());
  assert.strictEqual((await refresh(target.cookie)).status, 401);
  const again = await signIn('wst_user', 'Temp0rary!');
  assert.strictEqual(again.body.user.must_change_password, true);
  const me = await (await get('/auth/me', bearer(again.token))).json();
  assert.strictEqual(me.must_change_password, true);
  const change = await post('/auth/change-password', { current_password: 'Temp0rary!', new_password: PW }, withCookie(again.cookie, bearer(again.token)));
  assert.strictEqual(change.status, 200);
  const me2 = await (await get('/auth/me', bearer(again.token))).json();
  assert.strictEqual(me2.must_change_password, false);
});

test('a disabled account cannot refresh or sign in; absolute expiry ends a session', async () => {
  const v = await signIn('wst_viewer');
  await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [ids.wst_viewer]);
  try {
    const r = await refresh(v.cookie);
    assert.strictEqual(r.status, 401);
    assert.strictEqual((await r.json()).code, 'DISABLED');
    assert.strictEqual((await post('/auth/session', { username: 'wst_viewer', password: PW })).status, 403);
  } finally {
    await pool.query('UPDATE users SET is_active = 1 WHERE id = ?', [ids.wst_viewer]);
  }
  const s = await signIn('wst_viewer');
  await pool.query('UPDATE staff_refresh_tokens SET absolute_expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE family_id = ?', [s.sid]);
  const r = await refresh(s.cookie);
  assert.strictEqual(r.status, 401);
  assert.strictEqual((await r.json()).code, 'EXPIRED');
});
