// Web staff sessions — unit tests without a database. Covers the password
// helpers, cookie/token plumbing, the frozen desktop login contract (fake
// pool) and the request-shape guards of the new session endpoints. The
// DB-backed rotation/lockout flows live in staffAuth.db.test.js.
//   cd server && node --test test/staffAuth.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

process.env.JWT_SECRET = 'test-secret';
process.env.DEFAULT_TENANT = 'ci1';
process.env.TENANTS_FILE = path.join(__dirname, 'fixtures', 'tenants.ci.json');
delete process.env.PASSWORD_REHASH;
delete process.env.STAFF_LOCKOUT_SCOPE;

const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

// Swap the pool BEFORE the routes capture it (they destructure at require time)
const db = require('../db');
let currentPool = null;
db.getPool = () => currentPool;

const passwords = require('../lib/passwords');
const sessions = require('../lib/staffSessions');
const staffAuth = require('../lib/staffAuth');
const { tenantMiddleware } = require('../middleware/tenant');
const { authMiddleware } = require('../middleware/auth');
const authRoutes = require('../routes/auth.routes');
const usersRoutes = require('../routes/users.routes');

const SHA = passwords.sha256('Secret123!');
const baseUser = {
  id: 42, username: 'admin', full_name: 'Test Admin', role: 'admin', is_active: 1, password: SHA,
  failed_attempts: 0, locked_until: null, password_changed_at: null, must_change_password: 0, locked: 0, lock_seconds_left: 0
};

function fakePool(userRow, opts = {}) {
  const calls = [];
  const pool = {
    calls,
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (/FROM users WHERE username = \?/.test(sql)) {
        if (opts.badField && /failed_attempts/.test(sql)) {
          throw Object.assign(new Error("Unknown column 'failed_attempts'"), { code: 'ER_BAD_FIELD_ERROR' });
        }
        return [userRow && userRow.username === params[0] ? [{ ...userRow }] : []];
      }
      if (/FROM users WHERE id = \?/.test(sql)) return [userRow && userRow.id === params[0] ? [{ ...userRow }] : []];
      if (/^INSERT INTO staff_refresh_tokens/.test(sql)) return [{ insertId: 7, affectedRows: 1 }];
      if (/^INSERT INTO staff_auth_events/.test(sql)) return [{ insertId: 1, affectedRows: 1 }];
      if (/^UPDATE/.test(sql)) return [{ affectedRows: 1 }];
      if (/^DELETE/.test(sql)) return [{ affectedRows: 0 }];
      if (/^SELECT/.test(sql)) return [[]];
      return [{}];
    }
  };
  pool.query = pool.execute;
  return pool;
}

let server;
let base;
test.before(() => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1', tenantMiddleware);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.get('/api/v1/probe', authMiddleware, (req, res) => res.json({ user: req.user }));
  app.post('/api/v1/probe', authMiddleware, (req, res) => res.json({ ok: true }));
  app.post('/api/v1/self', sessions.requireStaffToken, (req, res) => res.json({ id: req.user.id }));
  app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}/api/v1`;
      resolve();
    });
  });
});
test.after(() => server.close());

const post = (p, body, headers = {}) => fetch(base + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Samithi': 'ci1', ...headers }, body: JSON.stringify(body || {})
});
const get = (p, headers = {}) => fetch(base + p, { headers: { 'X-Samithi': 'ci1', ...headers } });
const setCookies = (res) => res.headers.getSetCookie();

// ── passwords ────────────────────────────────────────────────────────────────
test('passwords: legacy sha256 and bcrypt both verify; wrong password does not', async () => {
  assert.strictEqual(await passwords.verify('Secret123!', SHA), true);
  assert.strictEqual(await passwords.verify('Secret123', SHA), false);
  const bc = await bcrypt.hash('Secret123!', 4);
  assert.strictEqual(await passwords.verify('Secret123!', bc), true);
  assert.strictEqual(await passwords.verify('nope', bc), false);
  assert.strictEqual(await passwords.verify('', SHA), false);
  assert.strictEqual(await passwords.verify(undefined, SHA), false);
  assert.strictEqual(await passwords.verify(123456, passwords.sha256('123456')), true, 'numeric bodies are coerced');
});

test('passwords: hash() stays sha256 until PASSWORD_REHASH=on (Deploy A is reversible)', async () => {
  assert.strictEqual(await passwords.hash('x'), passwords.sha256('x'));
  assert.strictEqual(passwords.needsRehash(SHA), false);
  process.env.PASSWORD_REHASH = 'on';
  try {
    const h = await passwords.hash('x');
    assert.ok(passwords.isBcrypt(h));
    assert.strictEqual(passwords.needsRehash(SHA), true);
    assert.strictEqual(passwords.needsRehash(h), false);
  } finally {
    delete process.env.PASSWORD_REHASH;
  }
});

// ── plumbing ─────────────────────────────────────────────────────────────────
test('staffSessions: cookie parsing, names and ttl parsing', () => {
  const tok = 'a'.repeat(64);
  assert.deepStrictEqual(sessions.readCookie({ cookies: { '__Secure-es_rt': `samithi01.${tok}` } }), { slug: 'samithi01', token: tok });
  assert.deepStrictEqual(sessions.readCookie({ cookies: { es_rt: `ci1.${tok}` } }), { slug: 'ci1', token: tok });
  assert.strictEqual(sessions.readCookie({ cookies: { es_rt: 'ci1.short' } }), null);
  assert.strictEqual(sessions.readCookie({ cookies: { es_rt: tok } }), null);
  assert.strictEqual(sessions.readCookie({}), null);
  assert.strictEqual(sessions.cookieName({ secure: false, headers: {} }), 'es_rt');
  assert.strictEqual(sessions.cookieName({ secure: false, headers: { 'x-forwarded-proto': 'https' } }), '__Secure-es_rt');
  assert.strictEqual(sessions.accessTtlSeconds(), 900);
  process.env.STAFF_ACCESS_TTL = '2h';
  assert.strictEqual(sessions.accessTtlSeconds(), 7200);
  process.env.STAFF_ACCESS_TTL = '1m';
  assert.strictEqual(sessions.accessTtlSeconds(), 60);
  delete process.env.STAFF_ACCESS_TTL;
  assert.strictEqual(sessions.COOKIE_PATH, '/api/v1/auth');
});

test('staffAuth: lockout scope — web only by default', () => {
  assert.strictEqual(staffAuth.lockoutEnforced('desktop'), false);
  assert.strictEqual(staffAuth.lockoutEnforced('web'), true);
  assert.strictEqual(staffAuth.lockoutEnforced('shell'), true);
  process.env.STAFF_LOCKOUT_SCOPE = 'all';
  assert.strictEqual(staffAuth.lockoutEnforced('desktop'), true);
  process.env.STAFF_LOCKOUT_SCOPE = 'off';
  assert.strictEqual(staffAuth.lockoutEnforced('web'), false);
  delete process.env.STAFF_LOCKOUT_SCOPE;
});

test('access token carries the legacy claims and passes middleware/auth.js unchanged', async () => {
  const token = sessions.signAccessToken(baseUser, 'ci1', 'f'.repeat(32));
  const claims = jwt.verify(token, 'test-secret');
  assert.strictEqual(claims.sam, 'ci1');
  assert.strictEqual(claims.typ, 'access');
  assert.strictEqual(claims.sid, 'f'.repeat(32));
  assert.strictEqual(claims.role, 'admin');
  assert.ok(claims.exp - claims.iat === 900);
  assert.strictEqual((await get('/probe', { Authorization: `Bearer ${token}` })).status, 200);
  assert.strictEqual((await get('/probe', { Authorization: `Bearer ${token}`, 'X-Samithi': 'ci2' })).status, 403, 'tenant binding still enforced');
});

test('requireStaffToken: lets a viewer act on their own session, rejects member/support/foreign tokens', async () => {
  const viewer = sessions.signAccessToken({ ...baseUser, role: 'viewer' }, 'ci1', 'e'.repeat(32));
  assert.strictEqual((await post('/probe', {}, { Authorization: `Bearer ${viewer}` })).status, 403, 'authMiddleware keeps viewers read-only');
  assert.strictEqual((await post('/self', {}, { Authorization: `Bearer ${viewer}` })).status, 200, 'self-service endpoints allow viewers');
  const member = jwt.sign({ member_id: 5, typ: 'member', sam: 'ci1' }, 'test-secret');
  assert.strictEqual((await post('/self', {}, { Authorization: `Bearer ${member}` })).status, 401);
  const support = jwt.sign({ id: 1, username: 'sa', role: 'admin', sam: 'ci1', act: 'sa:1', sid: 'x' }, 'test-secret');
  assert.strictEqual((await post('/self', {}, { Authorization: `Bearer ${support}` })).status, 403);
  const foreign = sessions.signAccessToken(baseUser, 'ci2', 'e'.repeat(32));
  assert.strictEqual((await post('/self', {}, { Authorization: `Bearer ${foreign}` })).status, 403);
  assert.strictEqual((await post('/self', {})).status, 401);
});

// ── POST /auth/login — the frozen desktop contract ───────────────────────────
test('login: success body is exactly {success,user{id,username,full_name,role},token} with the legacy 24h claims', async () => {
  currentPool = fakePool(baseUser);
  const res = await post('/auth/login', { username: 'admin', password: 'Secret123!' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(Object.keys(body), ['success', 'user', 'token']);
  assert.deepStrictEqual(Object.keys(body.user), ['id', 'username', 'full_name', 'role']);
  assert.deepStrictEqual(body.user, { id: 42, username: 'admin', full_name: 'Test Admin', role: 'admin' });
  const claims = jwt.verify(body.token, 'test-secret');
  assert.deepStrictEqual(Object.keys(claims).sort(), ['exp', 'iat', 'id', 'role', 'sam', 'username']);
  assert.strictEqual(claims.exp - claims.iat, 24 * 3600);
  assert.strictEqual(setCookies(res).length, 0, 'desktop login sets no cookie');
  assert.ok(currentPool.calls.some((c) => /UPDATE users SET last_login_at = NOW\(\), failed_attempts = 0, locked_until = NULL/.test(c.sql)));
});

test('login: 400 / 401 / 403 texts unchanged', async () => {
  currentPool = fakePool(baseUser);
  let res = await post('/auth/login', { username: 'admin' });
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(await res.json(), { error: 'Username and password required' });
  res = await post('/auth/login', { username: 'admin', password: 'wrong' });
  assert.strictEqual(res.status, 401);
  assert.deepStrictEqual(await res.json(), { error: 'Invalid username or password' });
  res = await post('/auth/login', { username: 'ghost', password: 'wrong' });
  assert.strictEqual(res.status, 401);
  assert.deepStrictEqual(await res.json(), { error: 'Invalid username or password' });
  currentPool = fakePool({ ...baseUser, is_active: 0 });
  res = await post('/auth/login', { username: 'admin', password: 'Secret123!' });
  assert.strictEqual(res.status, 403);
  assert.deepStrictEqual(await res.json(), { error: 'This account has been disabled. Contact your administrator.' });
});

test('login: bcrypt rows sign in too, and a pre-014 tenant falls back to the legacy column set', async () => {
  currentPool = fakePool({ ...baseUser, password: await bcrypt.hash('Secret123!', 4) });
  assert.strictEqual((await post('/auth/login', { username: 'admin', password: 'Secret123!' })).status, 200);
  currentPool = fakePool({ id: 42, username: 'admin', full_name: 'Test Admin', role: 'admin', is_active: null, password: SHA }, { badField: true });
  const res = await post('/auth/login', { username: 'admin', password: 'Secret123!' });
  assert.strictEqual(res.status, 200);
  assert.ok(currentPool.calls.some((c) => /SELECT id, username, full_name, role, is_active, password FROM users/.test(c.sql)));
  assert.ok(!currentPool.calls.some((c) => /failed_attempts = 0/.test(c.sql)), 'no writes to columns that do not exist yet');
});

test('login: a locked account still signs in from the desktop while STAFF_LOCKOUT_SCOPE=web, not when =all', async () => {
  currentPool = fakePool({ ...baseUser, locked: 1, lock_seconds_left: 600 });
  assert.strictEqual((await post('/auth/login', { username: 'admin', password: 'Secret123!' })).status, 200);
  process.env.STAFF_LOCKOUT_SCOPE = 'all';
  try {
    const res = await post('/auth/login', { username: 'admin', password: 'Secret123!' });
    assert.strictEqual(res.status, 423);
    const body = await res.json();
    assert.strictEqual(body.code, 'LOCKED');
    assert.strictEqual(body.retry_after_seconds, 600);
    assert.match(body.error, /10 minutes/);
  } finally {
    delete process.env.STAFF_LOCKOUT_SCOPE;
  }
});

// ── POST /auth/session and the cookie endpoints ──────────────────────────────
test('session: sets an HttpOnly SameSite=Strict cookie scoped to /api/v1/auth and returns a 15-minute access token', async () => {
  currentPool = fakePool(baseUser);
  const res = await post('/auth/session', { username: 'admin', password: 'Secret123!' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.deepStrictEqual(body.user, { id: 42, username: 'admin', full_name: 'Test Admin', role: 'admin', must_change_password: false });
  assert.strictEqual(body.expires_in, 900);
  const claims = jwt.verify(body.access_token, 'test-secret');
  assert.strictEqual(claims.typ, 'access');
  assert.match(claims.sid, /^[0-9a-f]{32}$/);
  const cookies = setCookies(res);
  assert.strictEqual(cookies.length, 1);
  assert.match(cookies[0], /^es_rt=ci1\.[0-9a-f]{64}; Max-Age=43200; Path=\/api\/v1\/auth; Expires=.*; HttpOnly; SameSite=Strict$/);
  assert.ok(!/Secure/.test(cookies[0]), 'plain http (CI/dev) gets the un-prefixed cookie');
});

test('session: behind HTTPS (X-Forwarded-Proto) the cookie is __Secure- prefixed and Secure', async () => {
  currentPool = fakePool(baseUser);
  const res = await post('/auth/session', { username: 'admin', password: 'Secret123!' }, { 'X-Forwarded-Proto': 'https' });
  assert.strictEqual(res.status, 200);
  assert.match(setCookies(res)[0], /^__Secure-es_rt=ci1\.[0-9a-f]{64}; .*; HttpOnly; Secure; SameSite=Strict$/);
});

test('session: a locked account is refused with 423 (web is in scope)', async () => {
  currentPool = fakePool({ ...baseUser, locked: 1, lock_seconds_left: 30 });
  const res = await post('/auth/session', { username: 'admin', password: 'Secret123!' });
  assert.strictEqual(res.status, 423);
  assert.match((await res.json()).error, /1 minute\./);
});

test('refresh/logout: same-origin guards and cookie presence', async () => {
  currentPool = fakePool(baseUser);
  let res = await post('/auth/refresh', {});
  assert.strictEqual(res.status, 403, 'X-Requested-With is mandatory');
  res = await post('/auth/refresh', {}, { 'X-Requested-With': 'eSamithi', 'Sec-Fetch-Site': 'cross-site' });
  assert.strictEqual(res.status, 403);
  res = await post('/auth/refresh', {}, { 'X-Requested-With': 'eSamithi' });
  assert.strictEqual(res.status, 401);
  assert.strictEqual((await res.json()).code, 'NO_SESSION');
  res = await post('/auth/refresh', {}, { 'X-Requested-With': 'eSamithi', Cookie: `es_rt=ci2.${'b'.repeat(64)}` });
  assert.strictEqual(res.status, 401);
  assert.strictEqual((await res.json()).code, 'WRONG_SAMITHI');
  assert.match(setCookies(res)[0], /^es_rt=; Path=\/api\/v1\/auth; Expires=Thu, 01 Jan 1970/);
  res = await post('/auth/refresh', {}, { 'X-Requested-With': 'eSamithi', Cookie: `es_rt=ci1.${'b'.repeat(64)}` });
  assert.strictEqual(res.status, 401, 'unknown token');
  assert.strictEqual((await res.json()).code, 'INVALID');
  res = await post('/auth/logout', {}, { 'X-Requested-With': 'eSamithi' });
  assert.strictEqual(res.status, 200);
  assert.match(setCookies(res)[0], /^es_rt=; Path=\/api\/v1\/auth; Expires=Thu, 01 Jan 1970/);
});

test('change-password: validation before any write', async () => {
  currentPool = fakePool(baseUser);
  const token = sessions.signAccessToken(baseUser, 'ci1', 'c'.repeat(32));
  const auth = { Authorization: `Bearer ${token}` };
  assert.strictEqual((await post('/auth/change-password', { current_password: 'x' }, auth)).status, 400);
  let res = await post('/auth/change-password', { current_password: 'wrong', new_password: 'LongEnough1' }, auth);
  assert.strictEqual(res.status, 401);
  res = await post('/auth/change-password', { current_password: 'Secret123!', new_password: 'short' }, auth);
  assert.strictEqual(res.status, 400);
  res = await post('/auth/change-password', { current_password: 'Secret123!', new_password: 'Secret123!' }, auth);
  assert.strictEqual(res.status, 400);
  assert.ok(!currentPool.calls.some((c) => /UPDATE users SET password/.test(c.sql)));
  res = await post('/auth/change-password', { current_password: 'Secret123!', new_password: 'BrandNew123' }, auth);
  assert.strictEqual(res.status, 200);
  assert.ok(currentPool.calls.some((c) => /UPDATE users SET password = \?, password_changed_at = NOW\(\), must_change_password = 0/.test(c.sql)));
  assert.ok(currentPool.calls.some((c) => /revoke_reason = \? WHERE user_id = \? AND revoked_at IS NULL AND family_id <> \?/.test(c.sql)), 'other sessions revoked, current kept');
});

test('users: role is validated on create and the admin reset endpoint exists', async () => {
  currentPool = fakePool(baseUser);
  const admin = sessions.signAccessToken(baseUser, 'ci1', 'd'.repeat(32));
  const auth = { Authorization: `Bearer ${admin}` };
  let res = await post('/users', { username: 'x', password: 'LongEnough1', full_name: 'X', role: 'root' }, auth);
  assert.strictEqual(res.status, 400);
  res = await fetch(`${base}/users/42/password`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Samithi': 'ci1', ...auth }, body: JSON.stringify({ new_password: 'short' }) });
  assert.strictEqual(res.status, 400);
  res = await fetch(`${base}/users/42/password`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Samithi': 'ci1', ...auth }, body: JSON.stringify({ new_password: 'TempPass123' }) });
  assert.strictEqual(res.status, 200);
  assert.ok(currentPool.calls.some((c) => /must_change_password = 1/.test(c.sql)));
  const viewer = sessions.signAccessToken({ ...baseUser, role: 'viewer' }, 'ci1', 'd'.repeat(32));
  res = await fetch(`${base}/users/42/password`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Samithi': 'ci1', Authorization: `Bearer ${viewer}` }, body: JSON.stringify({ new_password: 'TempPass123' }) });
  assert.strictEqual(res.status, 403);
});
