// In-app concern reporting (Google Play Child Safety Standards, Nov 2026):
// a member can always report a concern to the society's officers from the
// app, it is never held back by the 3-pending limit, and the office sees it.
// Skips itself when DB_HOST is not set.
//   DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=citest node --test test/concerns.db.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

if (!process.env.DB_HOST) {
  test('concern reporting DB suite', { skip: 'DB_HOST not set — no database available' }, () => {});
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
const meRoutes = require('../routes/me.routes');
const memberRequestsRoutes = require('../routes/memberRequests.routes');

const T = 'ci1';
let pool;
let server;
let base;
let memberToken;
let staffToken;
let memberId;

async function call(method, pathname, token, body) {
  const res = await fetch(base + pathname, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'X-Samithi': T, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function cleanup() {
  await pool.query("DELETE FROM member_requests WHERE member_id IN (SELECT id FROM members WHERE society_id = 'CON-001')");
  await pool.query("DELETE FROM members WHERE society_id = 'CON-001'");
  await pool.query("DELETE FROM users WHERE username = 'con_admin'");
}

test.before(async () => {
  pool = getPool(T);
  await migrateTenant(pool, T);
  await cleanup();
  const [u] = await pool.query("INSERT INTO users (username, password, full_name, role) VALUES ('con_admin', 'x', 'CON admin', 'admin')");
  staffToken = generateToken({ id: u.insertId, username: 'con_admin', role: 'admin' }, T);
  const [m] = await pool.query("INSERT INTO members (society_id, full_name, is_active) VALUES ('CON-001', 'CON member', 1)");
  memberId = m.insertId;
  memberToken = jwt.sign({ member_id: memberId, typ: 'member', sam: T }, process.env.JWT_SECRET, { expiresIn: '10m' });

  const app = express();
  app.use(express.json());
  app.use('/api/v1', tenantMiddleware);
  app.use('/api/v1/me', meRoutes);
  app.use('/api/v1/member-requests', memberRequestsRoutes);
  app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));
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

test('a concern needs a known category and a description', async () => {
  assert.strictEqual((await call('POST', '/me/requests', memberToken, { type: 'concern', purpose: 'nonsense', message: 'x' })).status, 400);
  assert.strictEqual((await call('POST', '/me/requests', memberToken, { type: 'concern', purpose: 'child_safety', message: '  ' })).status, 400);
  const ok = await call('POST', '/me/requests', memberToken, { type: 'concern', purpose: 'child_safety', message: 'A Puruka post shows a child inappropriately' });
  assert.strictEqual(ok.status, 200);
});

test('a concern goes through even with three requests already waiting', async () => {
  for (let i = 0; i < 3; i++) {
    const r = await call('POST', '/me/requests', memberToken, { type: 'correction', message: `fix ${i}` });
    assert.strictEqual(r.status, 200)
  }
  const blocked = await call('POST', '/me/requests', memberToken, { type: 'correction', message: 'fourth' });
  assert.strictEqual(blocked.status, 400, 'loan/correction still capped at 3 pending');
  const concern = await call('POST', '/me/requests', memberToken, { type: 'concern', purpose: 'content', message: 'Spam listing' });
  assert.strictEqual(concern.status, 200, 'a concern is never held back');
});

test('the office sees concerns with their category and can mark them handled', async () => {
  const list = await call('GET', '/member-requests?status=Pending', staffToken);
  assert.strictEqual(list.status, 200);
  const mine = list.body.filter((r) => r.member_id === memberId && r.type === 'concern');
  assert.strictEqual(mine.length, 2);
  assert.deepStrictEqual(mine.map((r) => r.purpose).sort(), ['child_safety', 'content']);
  const done = await call('PATCH', `/member-requests/${mine[0].id}`, staffToken, { status: 'Done', staff_note: 'Post removed' });
  assert.strictEqual(done.status, 200);
  const own = await call('GET', '/me/requests', memberToken);
  const handled = own.body.find((r) => r.id === mine[0].id);
  assert.strictEqual(handled.status, 'Done');
  assert.strictEqual(handled.staff_note, 'Post removed');
});
