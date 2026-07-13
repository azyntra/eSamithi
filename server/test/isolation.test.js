// Cross-tenant isolation regression tests ("data-isolation insurance",
// multi-samithi plan §4.1). No database needed: these exercise the tenant
// middleware + JWT `sam` binding with stub routes.
//   cd server && node --test test/
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

process.env.JWT_SECRET = 'test-secret';
process.env.DEFAULT_TENANT = 'ci1';
process.env.TENANTS_FILE = path.join(__dirname, 'fixtures', 'tenants.ci.json');

const express = require('express');
const jwt = require('jsonwebtoken');
const { tenantMiddleware } = require('../middleware/tenant');
const { authMiddleware, generateToken } = require('../middleware/auth');
const { memberAuthMiddleware } = require('../middleware/memberAuth');
const { getPool } = require('../db');

let server;
let base;

function get(pathname, token, sam) {
  return fetch(base + pathname, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(sam ? { 'X-Samithi': sam } : {})
    }
  });
}

const staff1 = generateToken({ id: 1, username: 'a', role: 'admin' }, 'ci1');
const staff2 = generateToken({ id: 1, username: 'a', role: 'admin' }, 'ci2');
const legacyStaff = jwt.sign({ id: 1, username: 'a', role: 'admin' }, 'test-secret');
const member2 = jwt.sign({ member_id: 5, typ: 'member', sam: 'ci2' }, 'test-secret');

test.before(() => {
  const app = express();
  app.use('/api/v1', tenantMiddleware);
  app.get('/api/v1/staff', authMiddleware, (req, res) => res.json({ tenant: req.tenant }));
  app.get('/api/v1/member', memberAuthMiddleware, (req, res) => res.json({ tenant: req.tenant }));
  app.get('/api/v1/als', (req, res) => {
    // getPool() with no args must resolve the tenant via AsyncLocalStorage,
    // including across async boundaries
    setTimeout(() => {
      try {
        getPool();
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }, 10);
  });
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}/api/v1`;
      resolve();
    });
  });
});

test.after(() => server.close());

test('same-tenant staff token is accepted', async () => {
  assert.strictEqual((await get('/staff', staff1, 'ci1')).status, 200);
});

test('staff token for tenant A is 403 on tenant B (both directions)', async () => {
  assert.strictEqual((await get('/staff', staff1, 'ci2')).status, 403);
  assert.strictEqual((await get('/staff', staff2, 'ci1')).status, 403);
});

test('member token for tenant B is 403 on tenant A', async () => {
  assert.strictEqual((await get('/member', member2, 'ci1')).status, 403);
  assert.strictEqual((await get('/member', member2, 'ci2')).status, 200);
});

test('legacy token (no sam claim) maps to DEFAULT_TENANT only', async () => {
  assert.strictEqual((await get('/staff', legacyStaff)).status, 200);
  assert.strictEqual((await get('/staff', legacyStaff, 'ci2')).status, 403);
});

test('missing header falls back to DEFAULT_TENANT, non-default tokens still rejected', async () => {
  assert.strictEqual((await get('/staff', staff1)).status, 200);
  assert.strictEqual((await get('/staff', staff2)).status, 403);
});

test('unknown and suspended samithis are rejected', async () => {
  assert.strictEqual((await get('/staff', staff1, 'nope99')).status, 403);
  const res = await get('/staff', staff1, 'gone03');
  assert.strictEqual(res.status, 403);
  assert.match((await res.json()).error, /suspended/i);
});

test('AsyncLocalStorage tenant context survives async boundaries', async () => {
  assert.strictEqual((await get('/als', staff1, 'ci1')).status, 200);
});
