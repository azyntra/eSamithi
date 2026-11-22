// Announcement retention — old notices drop out of the member app by
// themselves (lib/announcements.js), staff can override the date, and the
// staff list keeps everything with an "expired" flag.
// Skips itself when DB_HOST is not set.
//   DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=citest node --test test/announcements.db.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

if (!process.env.DB_HOST) {
  test('announcement retention DB suite', { skip: 'DB_HOST not set — no database available' }, () => {});
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
const { societyToday } = require('../lib/attendance');
const announcementsRoutes = require('../routes/announcements.routes');
const meRoutes = require('../routes/me.routes');

const T = 'ci1';
let pool;
let server;
let base;
let staffToken;
let memberToken;

const shift = (days) => {
  const [y, m, d] = societyToday().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

async function call(method, pathname, token, body) {
  const res = await fetch(base + pathname, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'X-Samithi': T, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// A notice posted `postedDaysAgo` days ago (midday, so the date is unambiguous)
async function seed(title, type, postedDaysAgo, extra = {}) {
  const row = { funeral_date: null, event_date: null, show_until: null, is_active: 1, deceased_name: type === 'death' ? 'RET person' : null, ...extra };
  const [r] = await pool.query(
    `INSERT INTO announcements (type, title, deceased_name, funeral_date, event_date, show_until, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [type, title, row.deceased_name, row.funeral_date, row.event_date, row.show_until, row.is_active, `${shift(-postedDaysAgo)} 12:00:00`]
  );
  return r.insertId;
}

async function memberTitles() {
  const res = await call('GET', '/me/announcements', memberToken);
  assert.strictEqual(res.status, 200);
  return res.body.map((a) => a.title).filter((t) => t.startsWith('RET '));
}

async function cleanup() {
  await pool.query("DELETE FROM announcements WHERE title LIKE 'RET %'");
  await pool.query("DELETE FROM members WHERE society_id = 'RET-001'");
  await pool.query("DELETE FROM users WHERE username = 'ret_admin'");
}

test.before(async () => {
  pool = getPool(T);
  await migrateTenant(pool, T);
  await cleanup();

  const [u] = await pool.query("INSERT INTO users (username, password, full_name, role) VALUES ('ret_admin', 'x', 'RET admin', 'admin')");
  staffToken = generateToken({ id: u.insertId, username: 'ret_admin', role: 'admin' }, T);
  const [m] = await pool.query("INSERT INTO members (society_id, full_name, is_active) VALUES ('RET-001', 'RET member', 1)");
  memberToken = jwt.sign({ member_id: m.insertId, typ: 'member', sam: T }, process.env.JWT_SECRET, { expiresIn: '10m' });

  const app = express();
  app.use(express.json());
  app.use('/api/v1', tenantMiddleware);
  app.use('/api/v1/announcements', announcementsRoutes);
  app.use('/api/v1/me', meRoutes);
  app.use((err, _req, res, _next) => {
    res.status(err.statusCode || 500).json({ error: err.message });
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

test('general notices show for three weeks after posting', async () => {
  await seed('RET general 21d', 'general', 21)
  await seed('RET general 22d', 'general', 22)
  const titles = await memberTitles()
  assert.ok(titles.includes('RET general 21d'), 'the 21st day is still shown')
  assert.ok(!titles.includes('RET general 22d'))
});

test('death notices show until a week after the funeral, or two weeks without a date', async () => {
  await seed('RET death funeral -7', 'death', 12, { funeral_date: shift(-7) })
  await seed('RET death funeral -8', 'death', 12, { funeral_date: shift(-8) })
  await seed('RET death no date 14d', 'death', 14)
  await seed('RET death no date 15d', 'death', 15)
  // A funeral far ahead keeps the notice up even though it was posted long ago
  await seed('RET death funeral +3', 'death', 30, { funeral_date: shift(3) })
  const titles = await memberTitles()
  assert.ok(titles.includes('RET death funeral -7'))
  assert.ok(!titles.includes('RET death funeral -8'))
  assert.ok(titles.includes('RET death no date 14d'))
  assert.ok(!titles.includes('RET death no date 15d'))
  assert.ok(titles.includes('RET death funeral +3'))
});

test('meeting notices show until the day after the meeting', async () => {
  await seed('RET meeting -1', 'meeting', 10, { event_date: shift(-1) })
  await seed('RET meeting -2', 'meeting', 10, { event_date: shift(-2) })
  const titles = await memberTitles()
  assert.ok(titles.includes('RET meeting -1'))
  assert.ok(!titles.includes('RET meeting -2'))
});

test('a staff "show until" date overrides the automatic period both ways', async () => {
  await seed('RET override longer', 'general', 60, { show_until: shift(0) })
  await seed('RET override shorter', 'general', 1, { show_until: shift(-1) })
  await seed('RET hidden', 'general', 1, { is_active: 0 })
  const titles = await memberTitles()
  assert.ok(titles.includes('RET override longer'))
  assert.ok(!titles.includes('RET override shorter'))
  assert.ok(!titles.includes('RET hidden'), 'hidden notices stay hidden')
});

test('staff keep every notice, with the last day shown and an expired flag', async () => {
  const res = await call('GET', '/announcements', staffToken)
  assert.strictEqual(res.status, 200)
  const byTitle = Object.fromEntries(res.body.map((a) => [a.title, a]))
  assert.strictEqual(byTitle['RET general 22d'].expired, 1)
  assert.strictEqual(byTitle['RET general 22d'].visible_until, shift(-1))
  assert.strictEqual(byTitle['RET general 21d'].expired, 0)
  assert.strictEqual(byTitle['RET death funeral -8'].visible_until, shift(-1))
  assert.strictEqual(byTitle['RET override longer'].show_until, shift(0))
  assert.strictEqual(byTitle['RET override longer'].visible_until, shift(0))
  assert.strictEqual(byTitle['RET general 21d'].show_until, null)
});

test('show_until round-trips through create and edit, and bad dates are refused', async () => {
  const create = await call('POST', '/announcements', staffToken, { type: 'general', title: 'RET api', show_until: shift(5) })
  assert.strictEqual(create.status, 200)
  const id = create.body.id
  let row = (await call('GET', '/announcements', staffToken)).body.find((a) => a.id === id)
  assert.strictEqual(row.show_until, shift(5))
  assert.strictEqual(row.visible_until, shift(5))

  // Clearing it goes back to the automatic three weeks
  const edit = await call('PUT', `/announcements/${id}`, staffToken, { type: 'general', title: 'RET api', show_until: null })
  assert.strictEqual(edit.status, 200)
  row = (await call('GET', '/announcements', staffToken)).body.find((a) => a.id === id)
  assert.strictEqual(row.show_until, null)
  assert.strictEqual(row.visible_until, shift(21))

  const bad = await call('PUT', `/announcements/${id}`, staffToken, { type: 'general', title: 'RET api', show_until: 'next week' })
  assert.strictEqual(bad.status, 400)
});
