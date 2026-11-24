// Society officers (docs/MEETING-MINUTES-REQUIREMENTS.md §3): an administrator
// gives a system user a Society Position and links the member account they use
// in the app. One Secretary per society; handing the post over needs consent;
// the Secretary's member account gains permissions:'minutes' and loses it the
// moment the post, the user or the member goes. Skips without DB_HOST.
//   DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=root DB_PASSWORD=citest node --test test/officers.db.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

if (!process.env.DB_HOST) {
  test('officers DB suite', { skip: 'DB_HOST not set — no database available' }, () => {});
  return;
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'ci1';
process.env.TENANTS_FILE = process.env.TENANTS_FILE || path.join(__dirname, 'fixtures', 'tenants.ci.json');

const express = require('express');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { migrateTenant } = require('../migrations/runner');
const { tenantMiddleware } = require('../middleware/tenant');
const { generateToken } = require('../middleware/auth');
const usersRoutes = require('../routes/users.routes');
const meRoutes = require('../routes/me.routes');
const membersRoutes = require('../routes/members.routes');

const T = 'ci1';
let pool;
let server;
let base;
let adminToken;
let adminId;
const m = {};      // member ids: kamal, sunil, other
const mt = {};     // member tokens

async function call(method, pathname, token, body) {
  const res = await fetch(base + pathname, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'X-Samithi': T, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function cleanup() {
  await pool.query("DELETE FROM officer_events WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'off\\_%')");
  await pool.query("DELETE FROM users WHERE username LIKE 'off\\_%'");
  await pool.query("DELETE FROM members WHERE society_id LIKE 'OFF-%'");
}

const permissionsOf = async (who) => (await call('GET', '/me/profile', mt[who])).body.permissions;

test.before(async () => {
  pool = getPool(T);
  await migrateTenant(pool, T);
  await cleanup();
  const [u] = await pool.query("INSERT INTO users (username, password, full_name, role) VALUES ('off_admin', 'x', 'Office Admin', 'admin')");
  adminId = u.insertId;
  adminToken = generateToken({ id: adminId, username: 'off_admin', role: 'admin' }, T);
  for (const [key, num, name] of [['kamal', 'OFF-001', 'Kamal Perera'], ['sunil', 'OFF-002', 'Sunil Silva'], ['other', 'OFF-003', 'Other Member']]) {
    const [r] = await pool.query("INSERT INTO members (society_id, full_name, is_active, pin_hash) VALUES (?, ?, 1, 'x')", [num, name]);
    m[key] = r.insertId;
    mt[key] = jwt.sign({ member_id: r.insertId, typ: 'member', sam: T }, process.env.JWT_SECRET, { expiresIn: '10m' });
  }

  const app = express();
  app.use(express.json());
  app.use('/api/v1', tenantMiddleware);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/me', meRoutes);
  app.use('/api/v1/members', membersRoutes);
  app.use((err, _req, res, _next) => {
    const body = { error: err.message };
    if (err.statusCode && typeof err.code === 'string') body.code = err.code;
    res.status(err.statusCode || 500).json(body);
  });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}/api/v1`;
      resolve();
    });
  });
});

test.after(async () => {
  await cleanup();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

let kamalUser;
let sunilUser;

test('a Secretary needs a linked member (V1)', async () => {
  const r = await call('POST', '/users', adminToken, { username: 'off_kamal', password: 'password1', full_name: 'Kamal Perera', role: 'user', society_position: 'secretary' });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.body.code, 'SECRETARY_NEEDS_MEMBER');
  const none = await pool.query("SELECT id FROM users WHERE username = 'off_kamal'");
  assert.strictEqual(none[0].length, 0, 'the failed create left nothing behind');
});

test('creating a linked Secretary grants the member permissions:minutes', async () => {
  assert.ok(!(await permissionsOf('kamal')).includes('minutes'));
  const r = await call('POST', '/users', adminToken, { username: 'off_kamal', password: 'password1', full_name: 'Kamal Perera', role: 'user', society_position: 'secretary', member_id: m.kamal });
  assert.strictEqual(r.status, 200);
  kamalUser = r.body.id;
  const profile = (await call('GET', '/me/profile', mt.kamal)).body;
  assert.ok(profile.permissions.includes('minutes'));
  assert.strictEqual(profile.officer_position, 'secretary');
  assert.ok(!(await permissionsOf('sunil')).includes('minutes'));

  const list = (await call('GET', '/users', adminToken)).body;
  const row = list.find((u) => u.id === kamalUser);
  assert.strictEqual(row.society_position, 'secretary');
  assert.strictEqual(row.member_name, 'Kamal Perera');
  assert.strictEqual(row.member_society_id, 'OFF-001');
  assert.strictEqual(row.is_active, 1);
});

test('a member links to at most one user (V2)', async () => {
  const r = await call('POST', '/users', adminToken, { username: 'off_sunil', password: 'password1', full_name: 'Sunil Silva', role: 'viewer', member_id: m.kamal });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.body.code, 'MEMBER_LINKED');
  const ok = await call('POST', '/users', adminToken, { username: 'off_sunil', password: 'password1', full_name: 'Sunil Silva', role: 'viewer' });
  assert.strictEqual(ok.status, 200);
  sunilUser = ok.body.id;
});

test('one Secretary: a second needs confirmation and then takes over (V4, §3.3)', async () => {
  const taken = await call('PATCH', `/users/${sunilUser}`, adminToken, { society_position: 'secretary', member_id: m.sunil });
  assert.strictEqual(taken.status, 409);
  assert.strictEqual(taken.body.code, 'SECRETARY_TAKEN');
  assert.strictEqual(taken.body.current.full_name, 'Kamal Perera');
  assert.strictEqual(taken.body.current.member_name, 'Kamal Perera');
  // Nothing changed
  assert.ok((await permissionsOf('kamal')).includes('minutes'));

  const moved = await call('PATCH', `/users/${sunilUser}`, adminToken, { society_position: 'secretary', member_id: m.sunil, replace_secretary: true });
  assert.strictEqual(moved.status, 200);
  assert.strictEqual(moved.body.society_position, 'secretary');
  assert.ok((await permissionsOf('sunil')).includes('minutes'));
  assert.ok(!(await permissionsOf('kamal')).includes('minutes'), 'the old Secretary loses the power at once');
  const [[k]] = await pool.query('SELECT society_position, member_id FROM users WHERE id = ?', [kamalUser]);
  assert.strictEqual(k.society_position, null);
  assert.strictEqual(k.member_id, m.kamal, 'the old Secretary stays linked, just without the post');

  const events = (await call('GET', `/users/${kamalUser}/events`, adminToken)).body;
  assert.ok(events.some((e) => e.field === 'society_position' && e.before_value === 'secretary' && e.after_value === null && e.by_name === 'Office Admin'));
  const sevents = (await call('GET', `/users/${sunilUser}/events`, adminToken)).body;
  assert.ok(sevents.some((e) => e.field === 'member_id' && e.after_member === 'Sunil Silva'));
});

test('disabling the Secretary user, or the member, revokes the power', async () => {
  assert.strictEqual((await call('PATCH', `/users/${sunilUser}`, adminToken, { is_active: false })).status, 200);
  assert.ok(!(await permissionsOf('sunil')).includes('minutes'));
  const list = (await call('GET', '/users', adminToken)).body;
  assert.strictEqual(list.find((u) => u.id === sunilUser).is_active, 0);
  assert.strictEqual((await call('PATCH', `/users/${sunilUser}`, adminToken, { is_active: true })).status, 200);
  assert.ok((await permissionsOf('sunil')).includes('minutes'), 're-enabling restores it (position kept)');

  await pool.query('UPDATE members SET app_enabled = 0 WHERE id = ?', [m.sunil]);
  assert.ok(!(await permissionsOf('sunil')).includes('minutes'));
  await pool.query('UPDATE members SET app_enabled = 1 WHERE id = ?', [m.sunil]);
});

test('a linked member cannot be deleted', async () => {
  const r = await call('DELETE', `/members/${m.sunil}`, adminToken);
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.body.code, 'MEMBER_LINKED_TO_USER');
  assert.match(r.body.error, /off_sunil/);
  const free = await call('DELETE', `/members/${m.other}`, adminToken);
  assert.strictEqual(free.status, 200, 'an unlinked member still deletes');
});

test('admin guards: no self-disable, never lose the last active admin (V5, V6)', async () => {
  const self = await call('PATCH', `/users/${adminId}`, adminToken, { is_active: false });
  assert.strictEqual(self.status, 400);
  assert.strictEqual(self.body.code, 'CANNOT_DISABLE_SELF');
  // off_admin may be the only admin in this throwaway DB; if so demoting fails
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND (is_active IS NULL OR is_active = 1) AND id <> ?", [adminId]);
  if (Number(n) === 0) {
    const demote = await call('PATCH', `/users/${adminId}`, adminToken, { role: 'user' });
    assert.strictEqual(demote.status, 403);
    assert.strictEqual(demote.body.code, 'LAST_ADMIN');
  }
});

test('deleting the Secretary user ends the power and the trail keeps it', async () => {
  assert.strictEqual((await call('DELETE', `/users/${sunilUser}`, adminToken)).status, 200);
  assert.ok(!(await permissionsOf('sunil')).includes('minutes'));
  const [[e]] = await pool.query("SELECT field, before_value FROM officer_events WHERE user_id = ? AND field = 'deleted'", [sunilUser]);
  assert.strictEqual(e.before_value, 'secretary');
  await pool.query('DELETE FROM officer_events WHERE user_id = ?', [sunilUser]);
});

test('bad input is refused with a code', async () => {
  assert.strictEqual((await call('PATCH', `/users/${kamalUser}`, adminToken, { society_position: 'king' })).body.code, 'INVALID_POSITION');
  assert.strictEqual((await call('PATCH', `/users/${kamalUser}`, adminToken, { member_id: 99999999 })).body.code, 'UNKNOWN_MEMBER');
  assert.strictEqual((await call('PATCH', `/users/${kamalUser}`, adminToken, { full_name: '  ' })).body.code, 'FULL_NAME_REQUIRED');
  assert.strictEqual((await call('PATCH', `/users/${kamalUser}`, adminToken, {})).status, 400);
  assert.strictEqual((await call('PATCH', '/users/99999999', adminToken, { full_name: 'X' })).status, 404);
});
