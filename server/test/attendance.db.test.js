// Mobile staff attendance — integration suite against a real MySQL (CI
// service or a scratch database). Covers the acceptance criteria in
// docs/MOBILE-STAFF-ATTENDANCE-REQUIREMENTS.md §12 that the server owns:
// who may grant the permission, instant revocation, the open window, one row
// per member however many scanners race, own-marks-only undo, and a phone
// roster that never carries NIC or phone numbers.
// Skips itself when DB_HOST is not set.
//   DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=citest node --test test/attendance.db.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

if (!process.env.DB_HOST) {
  test('mobile attendance DB suite', { skip: 'DB_HOST not set — no database available' }, () => {});
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
const membersRoutes = require('../routes/members.routes');
const eventsRoutes = require('../routes/events.routes');
const meAttendanceRoutes = require('../routes/meAttendance.routes');
const meRoutes = require('../routes/me.routes');

const T = 'ci1';
let pool;
let server;
let base;
const users = {};
const members = {};
const tokens = {};

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

async function cleanup() {
  await pool.query("DELETE FROM society_events WHERE title LIKE 'ATT %'");
  await pool.query("DELETE FROM member_staff_events WHERE member_id IN (SELECT id FROM members WHERE society_id LIKE 'ATT-%')");
  await pool.query("DELETE FROM members WHERE society_id LIKE 'ATT-%'");
  await pool.query("DELETE FROM users WHERE username LIKE 'att\\_%'");
  await pool.query("UPDATE settings SET `value` = '1' WHERE `key` = 'app_attendance_enabled'");
}

test.before(async () => {
  pool = getPool(T);
  await migrateTenant(pool, T);
  await cleanup();

  for (const [name, role] of [['att_admin', 'admin'], ['att_user', 'user'], ['att_viewer', 'viewer']]) {
    const [r] = await pool.query(
      'INSERT INTO users (username, password, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, 'x', `ATT ${role}`, role]
    );
    users[name] = r.insertId;
    tokens[name] = generateToken({ id: r.insertId, username: name, role }, T);
  }
  for (const [key, sid, name, active] of [
    ['staff', 'ATT-001', 'Att Staff', 1], ['other', 'ATT-002', 'Att Other', 1],
    ['plain', 'ATT-003', 'Att Plain', 1], ['gone', 'ATT-004', 'Att Inactive', 0]
  ]) {
    const [r] = await pool.query(
      'INSERT INTO members (society_id, full_name, nic, phone, is_active) VALUES (?, ?, ?, ?, ?)',
      [sid, name, `9${sid.slice(-3)}00000V`, '0770000000', active]
    );
    members[key] = r.insertId;
    tokens[key] = jwt.sign({ member_id: r.insertId, typ: 'member', sam: T }, process.env.JWT_SECRET, { expiresIn: '10m' });
  }

  const app = express();
  app.use(express.json());
  app.use('/api/v1', tenantMiddleware);
  app.use('/api/v1/members', membersRoutes);
  app.use('/api/v1/events', eventsRoutes);
  app.use('/api/v1/me/attendance', meAttendanceRoutes);
  app.use('/api/v1/me', meRoutes);
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
  await cleanup().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  await pool.end().catch(() => {});
});

let eventId;

test('a member without the permission sees nothing and is refused everywhere', async () => {
  const profile = await call('GET', '/me/profile', tokens.staff);
  assert.strictEqual(profile.status, 200);
  assert.deepStrictEqual(profile.body.permissions, []);

  for (const [method, p] of [['GET', '/me/attendance/events'], ['POST', '/me/attendance/events'], ['GET', '/me/attendance/members?q=att']]) {
    const res = await call(method, p, tokens.staff, method === 'POST' ? { type: 'meeting', title: 'ATT x', event_date: shift(0) } : undefined);
    assert.strictEqual(res.status, 403, `${method} ${p}`);
    assert.strictEqual(res.body.code, 'NOT_STAFF');
  }
});

test('view-only cannot grant; office Staff can, and the trail names the officer', async () => {
  const viewer = await call('PUT', `/members/${members.staff}/app-staff`, tokens.att_viewer, { attendance: 1 });
  assert.strictEqual(viewer.status, 403);

  const bad = await call('PUT', `/members/${members.staff}/app-staff`, tokens.att_user, { attendance: 'yes' });
  assert.strictEqual(bad.status, 400);

  const grant = await call('PUT', `/members/${members.staff}/app-staff`, tokens.att_user, { attendance: 1 });
  assert.strictEqual(grant.status, 200);
  assert.strictEqual(grant.body.changed, true);

  const again = await call('PUT', `/members/${members.staff}/app-staff`, tokens.att_user, { attendance: 1 });
  assert.strictEqual(again.body.changed, false, 'granting twice is a no-op');

  const [trail] = await pool.query('SELECT action, by_name FROM member_staff_events WHERE member_id = ?', [members.staff]);
  assert.deepStrictEqual(trail.map((r) => [r.action, r.by_name]), [['grant', 'ATT user']]);

  const profile = await call('GET', '/me/profile', tokens.staff);
  assert.deepStrictEqual(profile.body.permissions, ['attendance']);

  const list = await call('GET', '/members/app-staff', tokens.att_viewer);
  assert.strictEqual(list.status, 200);
  const row = list.body.find((r) => r.id === members.staff);
  assert.ok(row, 'granted member is listed');
  assert.strictEqual(row.granted_by_name, 'ATT user');

  const detail = await call('GET', `/members/${members.staff}`, tokens.att_user);
  assert.strictEqual(Number(detail.body.app_staff_attendance), 1);
  assert.strictEqual(detail.body.app_staff_granted_by_name, 'ATT user');
});

test('an inactive member cannot be made attendance staff', async () => {
  const res = await call('PUT', `/members/${members.gone}/app-staff`, tokens.att_admin, { attendance: 1 });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.code, 'MEMBER_INACTIVE');
});

test('staff create an event from the phone, inside the window only', async () => {
  const far = await call('POST', '/me/attendance/events', tokens.staff, { type: 'funeral', title: 'ATT old', event_date: shift(-3) });
  assert.strictEqual(far.status, 400);
  assert.strictEqual(far.body.code, 'DATE_OUT_OF_WINDOW');

  const made = await call('POST', '/me/attendance/events', tokens.staff, { type: 'funeral', title: 'ATT funeral', event_date: shift(0) });
  assert.strictEqual(made.status, 201);
  eventId = made.body.id;

  const phone = await call('GET', '/me/attendance/events', tokens.staff);
  const mine = phone.body.events.find((e) => e.id === eventId);
  assert.ok(mine);
  assert.strictEqual(mine.event_date, shift(0));
  assert.strictEqual(mine.attendance_mode, 'present');

  const office = await call('GET', '/events', tokens.att_user);
  const seen = office.body.find((e) => e.id === eventId);
  assert.ok(seen, 'the office register lists the phone-created event');
  assert.strictEqual(seen.created_by_name, 'Att Staff');
  assert.strictEqual(Number(seen.created_by_member_id), members.staff);
});

test('one row per member however many scanners race', async () => {
  const first = await call('POST', `/me/attendance/events/${eventId}/marks`, tokens.staff, { society_id: 'att-002' });
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.already, false);
  assert.strictEqual(first.body.member.full_name, 'Att Other');
  assert.strictEqual(first.body.mine, true);
  assert.strictEqual(first.body.meaning, 'present');

  const second = await call('POST', `/me/attendance/events/${eventId}/marks`, tokens.staff, { society_id: 'ATT-002' });
  assert.strictEqual(second.body.already, true);
  assert.strictEqual(second.body.marked_by_name, 'Att Staff');

  const office = await call('POST', `/events/${eventId}/attendance`, tokens.att_user, { society_id: 'ATT-002' });
  assert.strictEqual(office.body.already, true);
  assert.strictEqual(office.body.source, 'app');

  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM event_attendance WHERE event_id = ? AND member_id = ?', [eventId, members.other]);
  assert.strictEqual(Number(n), 1);
});

test('unknown cards, foreign QR codes and inactive members', async () => {
  const unknown = await call('POST', `/me/attendance/events/${eventId}/marks`, tokens.staff, { society_id: 'ATT-999' });
  assert.strictEqual(unknown.status, 404);
  assert.strictEqual(unknown.body.code, 'MEMBER_NOT_FOUND');

  const link = await call('POST', `/me/attendance/events/${eventId}/marks`, tokens.staff, { society_id: 'https://example.com/x' });
  assert.strictEqual(link.status, 400);

  // Warn-and-mark, as the office does: the mark is recorded, the app is told
  const inactive = await call('POST', `/me/attendance/events/${eventId}/marks`, tokens.staff, { member_id: members.gone });
  assert.strictEqual(inactive.status, 200);
  assert.strictEqual(inactive.body.member.is_active, 0);
});

test('the phone roster carries names and society IDs only', async () => {
  const office = await call('POST', `/events/${eventId}/attendance`, tokens.att_user, { member_id: members.plain });
  assert.strictEqual(office.body.already, false);

  const roster = await call('GET', `/me/attendance/events/${eventId}`, tokens.staff);
  assert.strictEqual(roster.status, 200);
  const all = [...roster.body.present, ...roster.body.absent];
  assert.ok(all.length >= 3);
  for (const row of all) {
    assert.ok(!('nic' in row) && !('phone' in row), 'no NIC or phone on a phone');
  }
  const byId = Object.fromEntries(roster.body.present.map((r) => [r.member_id, r]));
  assert.strictEqual(byId[members.other].mine, true);
  assert.strictEqual(byId[members.plain].mine, false);
  assert.strictEqual(byId[members.plain].marked_by_name, 'ATT user');
  assert.strictEqual(byId[members.plain].source, 'office');

  // The office roster keeps its contact columns and gains who/where
  const full = await call('GET', `/events/${eventId}/attendance`, tokens.att_user);
  const officeRow = full.body.present.find((r) => r.member_id === members.other);
  assert.strictEqual(officeRow.source, 'app');
  assert.strictEqual(officeRow.marked_by_name, 'Att Staff');
  assert.ok('phone' in officeRow);
});

test('staff undo their own marks, never anyone else\'s', async () => {
  const notMine = await call('DELETE', `/me/attendance/events/${eventId}/marks/${members.plain}`, tokens.staff);
  assert.strictEqual(notMine.status, 403);
  assert.strictEqual(notMine.body.code, 'NOT_YOUR_MARK');

  const mine = await call('DELETE', `/me/attendance/events/${eventId}/marks/${members.other}`, tokens.staff);
  assert.strictEqual(mine.status, 200);

  const twice = await call('DELETE', `/me/attendance/events/${eventId}/marks/${members.other}`, tokens.staff);
  assert.strictEqual(twice.status, 404);
});

test('manual lookup finds active members by name or society ID', async () => {
  const byName = await call('GET', '/me/attendance/members?q=Att%20Pl', tokens.staff);
  assert.deepStrictEqual(byName.body.map((r) => r.society_id), ['ATT-003']);
  assert.deepStrictEqual(Object.keys(byName.body[0]).sort(), ['full_name', 'member_id', 'society_id']);

  const byId = await call('GET', '/me/attendance/members?q=att-00', tokens.staff);
  assert.ok(byId.body.length >= 3);
  assert.ok(!byId.body.some((r) => r.society_id === 'ATT-004'), 'inactive members are not offered');

  const short = await call('GET', '/me/attendance/members?q=a', tokens.staff);
  assert.deepStrictEqual(short.body, []);
});

test('an event outside the window is invisible to phones and closed to marks', async () => {
  const [old] = await pool.query(
    "INSERT INTO society_events (type, title, event_date, attendance_mode) VALUES ('meeting', 'ATT last week', ?, 'present')", [shift(-5)]
  );
  const list = await call('GET', '/me/attendance/events', tokens.staff);
  assert.ok(!list.body.events.some((e) => e.id === old.insertId));

  for (const [method, p, body] of [
    ['GET', `/me/attendance/events/${old.insertId}`],
    ['POST', `/me/attendance/events/${old.insertId}/marks`, { society_id: 'ATT-002' }]
  ]) {
    const res = await call(method, p, tokens.staff, body);
    assert.strictEqual(res.status, 409, `${method} ${p}`);
    assert.strictEqual(res.body.code, 'EVENT_CLOSED');
  }

  // The office is not bound by the window
  const office = await call('POST', `/events/${old.insertId}/attendance`, tokens.att_user, { society_id: 'ATT-002' });
  assert.strictEqual(office.status, 200);
});

test('printed-card data is society ID and name, nothing more', async () => {
  const all = await call('GET', '/members/qr-cards?scope=all', tokens.att_user);
  const mine = all.body.filter((r) => String(r.society_id).startsWith('ATT-'));
  assert.deepStrictEqual(mine.map((r) => r.society_id), ['ATT-001', 'ATT-002', 'ATT-003']);
  assert.deepStrictEqual(Object.keys(mine[0]).sort(), ['full_name', 'id', 'society_id']);

  const picked = await call('GET', `/members/qr-cards?scope=ids&ids=${members.gone},${members.plain}`, tokens.att_user);
  assert.deepStrictEqual(picked.body.map((r) => r.society_id), ['ATT-003', 'ATT-004']);

  const bad = await call('GET', '/members/qr-cards?scope=everyone', tokens.att_user);
  assert.strictEqual(bad.status, 400);
});

test('the society-wide switch turns the feature off for everyone', async () => {
  await pool.query("UPDATE settings SET `value` = '0' WHERE `key` = 'app_attendance_enabled'");
  const res = await call('GET', '/me/attendance/events', tokens.staff);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.code, 'FEATURE_OFF');
  const profile = await call('GET', '/me/profile', tokens.staff);
  assert.deepStrictEqual(profile.body.permissions, []);
  await pool.query("UPDATE settings SET `value` = '1' WHERE `key` = 'app_attendance_enabled'");
});

test('removal is immediate, and disabling app access removes the permission too', async () => {
  const off = await call('PUT', `/members/${members.staff}/app-staff`, tokens.att_user, { attendance: 0 });
  assert.strictEqual(off.body.changed, true);
  // Same token as before — no waiting for it to expire
  const refused = await call('POST', `/me/attendance/events/${eventId}/marks`, tokens.staff, { society_id: 'ATT-002' });
  assert.strictEqual(refused.status, 403);
  assert.strictEqual(refused.body.code, 'NOT_STAFF');

  await call('PUT', `/members/${members.staff}/app-staff`, tokens.att_admin, { attendance: 1 });
  const disable = await call('PUT', `/members/${members.staff}/app-access`, tokens.att_admin, { app_enabled: 0 });
  assert.strictEqual(disable.status, 200);
  const [[m]] = await pool.query('SELECT app_staff_attendance FROM members WHERE id = ?', [members.staff]);
  assert.strictEqual(Number(m.app_staff_attendance), 0);
  const [trail] = await pool.query('SELECT action, reason FROM member_staff_events WHERE member_id = ? ORDER BY id', [members.staff]);
  assert.deepStrictEqual(trail.map((r) => `${r.action}:${r.reason || ''}`), ['grant:', 'revoke:', 'grant:', 'revoke:app_disabled']);

  const regrant = await call('PUT', `/members/${members.staff}/app-staff`, tokens.att_admin, { attendance: 1 });
  assert.strictEqual(regrant.status, 400);
  assert.strictEqual(regrant.body.code, 'APP_DISABLED');
});
