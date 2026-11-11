const test = require('node:test');
const assert = require('node:assert');
const { usageStatus, ONLINE_SECONDS, ACTIVE_DAYS, OCCASIONAL_DAYS, WRITE_INTERVAL_MS } = require('../lib/memberActivity');

const DAY = 86400;
const s = (o) => usageStatus({ enrolled: true, appEnabled: true, secondsAgo: null, ...o });

test('a member who never set a PIN is not enrolled, whatever the activity', () => {
  assert.strictEqual(s({ enrolled: false }), 'not_enrolled');
  assert.strictEqual(s({ enrolled: false, secondsAgo: 5 }), 'not_enrolled');
});

test('disabled app access wins over every other state', () => {
  assert.strictEqual(s({ appEnabled: false, secondsAgo: 5 }), 'blocked');
  assert.strictEqual(s({ appEnabled: false, enrolled: false }), 'blocked');
});

test('recency buckets, boundaries inclusive', () => {
  assert.strictEqual(s({ secondsAgo: 0 }), 'online');
  assert.strictEqual(s({ secondsAgo: ONLINE_SECONDS }), 'online');
  assert.strictEqual(s({ secondsAgo: ONLINE_SECONDS + 1 }), 'active');
  assert.strictEqual(s({ secondsAgo: ACTIVE_DAYS * DAY }), 'active');
  assert.strictEqual(s({ secondsAgo: ACTIVE_DAYS * DAY + 1 }), 'occasional');
  assert.strictEqual(s({ secondsAgo: OCCASIONAL_DAYS * DAY }), 'occasional');
  assert.strictEqual(s({ secondsAgo: OCCASIONAL_DAYS * DAY + 1 }), 'dormant');
});

test('enrolled but never seen is dormant', () => {
  assert.strictEqual(s({ secondsAgo: null }), 'dormant');
});

test('the online window is wider than the write throttle, so active users never flicker offline', () => {
  assert.ok(ONLINE_SECONDS * 1000 > WRITE_INTERVAL_MS);
});
