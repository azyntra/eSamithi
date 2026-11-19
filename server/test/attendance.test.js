// Attendance rules that need no database: the society's own "today", the
// phone-marking window, card payload screening and event validation.
const test = require('node:test');
const assert = require('node:assert');
const {
  societyToday, dayOffset, isWithinOpenWindow, parseCardPayload, validateEventInput
} = require('../lib/attendance');

test("societyToday is Sri Lanka's date, not the server's", () => {
  // 20:00 UTC on the 14th is already 01:30 on the 15th in Sri Lanka
  assert.strictEqual(societyToday(new Date('2026-11-14T20:00:00Z')), '2026-11-15');
  // 18:29 UTC is 23:59 local — still the 14th
  assert.strictEqual(societyToday(new Date('2026-11-14T18:29:00Z')), '2026-11-14');
  assert.strictEqual(societyToday(new Date('2026-12-31T19:00:00Z')), '2027-01-01');
});

test('dayOffset counts whole days across month and year ends', () => {
  assert.strictEqual(dayOffset('2026-11-15', '2026-11-15'), 0);
  assert.strictEqual(dayOffset('2026-12-01', '2026-11-30'), 1);
  assert.strictEqual(dayOffset('2026-12-31', '2027-01-01'), -1);
  assert.strictEqual(dayOffset('2026-03-01', '2026-02-27'), 2);
});

test('the open window is yesterday, today and tomorrow — nothing else', () => {
  const today = '2026-11-15';
  assert.strictEqual(isWithinOpenWindow('2026-11-14', today), true);
  assert.strictEqual(isWithinOpenWindow('2026-11-15', today), true);
  assert.strictEqual(isWithinOpenWindow('2026-11-16', today), true);
  assert.strictEqual(isWithinOpenWindow('2026-11-13', today), false);
  assert.strictEqual(isWithinOpenWindow('2026-11-17', today), false);
  assert.strictEqual(isWithinOpenWindow('2025-11-15', today), false);
});

test('a membership card payload is a bare society ID', () => {
  assert.strictEqual(parseCardPayload('S-042'), 'S-042');
  assert.strictEqual(parseCardPayload('  TEST-001\n'), 'TEST-001');
  assert.strictEqual(parseCardPayload('02'), '02');
});

test('other QR codes never reach the database', () => {
  assert.strictEqual(parseCardPayload('https://example.com/pay?x=1'), null);
  assert.strictEqual(parseCardPayload('upi://pay?pa=someone'), null);
  assert.strictEqual(parseCardPayload('WIFI:S:home; T:WPA'), null);
  assert.strictEqual(parseCardPayload(''), null);
  assert.strictEqual(parseCardPayload(null), null);
  assert.strictEqual(parseCardPayload('x'.repeat(51)), null);
});

test('event input: defaults to marking those present, trims the title', () => {
  const ok = validateEventInput({ type: 'funeral', title: '  K. Perera  ', event_date: '2026-11-15' });
  assert.deepStrictEqual(ok, { type: 'funeral', title: 'K. Perera', event_date: '2026-11-15', mode: 'present' });
  assert.strictEqual(validateEventInput({ type: 'meeting', title: 'AGM', event_date: '2026-11-15', attendance_mode: 'absent' }).mode, 'absent');
});

test('event input: every bad field is a 400', () => {
  const bad = [
    { type: 'party', title: 'x', event_date: '2026-11-15' },
    { type: 'meeting', title: '   ', event_date: '2026-11-15' },
    { type: 'meeting', title: 'x', event_date: '15/11/2026' },
    { type: 'meeting', title: 'x', event_date: '2026-11-15', attendance_mode: 'maybe' },
    { type: 'meeting', title: 'x'.repeat(256), event_date: '2026-11-15' }
  ];
  for (const input of bad) {
    assert.throws(() => validateEventInput(input), (err) => err.statusCode === 400, JSON.stringify(input));
  }
});
