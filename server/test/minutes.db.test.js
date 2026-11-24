// Meeting minutes end to end (docs/MEETING-MINUTES-REQUIREMENTS.md §12.1):
// permissions, drafts, page order → PDF order, rotation, resumable audio,
// idempotent publish with exactly one notice, revisions that keep history and
// the comment thread, a successor Secretary, withdraw/restore, browsing by
// month, signed links. Runs on tenant ci2 so it never races the officers suite
// (which owns ci1's Secretary). Skips without DB_HOST.
//   DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=root DB_PASSWORD=citest node --test test/minutes.db.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

if (!process.env.DB_HOST) {
  test('meeting minutes DB suite', { skip: 'DB_HOST not set — no database available' }, () => {});
  return;
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'ci1';
process.env.TENANTS_FILE = process.env.TENANTS_FILE || path.join(__dirname, 'fixtures', 'tenants.ci.json');
process.env.PRIVATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'esm-private-'));

const express = require('express');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const { PDFDocument, PDFName } = require('pdf-lib');
const { getPool } = require('../db');
const { migrateTenant } = require('../migrations/runner');
const { tenantMiddleware } = require('../middleware/tenant');
const { generateToken } = require('../middleware/auth');
const privateFiles = require('../lib/privateFiles');
const meMeetingRecords = require('../routes/meMeetingRecords.routes');
const meetingRecords = require('../routes/meetingRecords.routes');
const usersRoutes = require('../routes/users.routes');

const T = 'ci2';
let pool;
let server;
let origin;
const M = {};   // member ids
const MT = {};  // member tokens
const S = {};   // staff tokens
const U = {};   // staff user ids
const uuid = () => crypto.randomUUID();

async function call(method, pathname, token, body, extraHeaders = {}) {
  const isBuf = Buffer.isBuffer(body);
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(origin + '/api/v1' + pathname, {
    method,
    headers: {
      Authorization: `Bearer ${token}`, 'X-Samithi': T,
      ...(body && !isBuf && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders
    },
    body: body === undefined ? undefined : isBuf || isForm ? body : JSON.stringify(body)
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const me = (who, method, p, body, h) => call(method, `/me/meeting-records${p}`, MT[who], body, h);
const office = (who, method, p, body, h) => call(method, `/meeting-records${p}`, S[who], body, h);

// A page whose width identifies it after it has been through the PDF
async function pagePhoto(width, height = 800) {
  return sharp({ create: { width, height, channels: 3, background: { r: 240, g: 240, b: 235 } } }).jpeg().toBuffer();
}
async function addPage(who, reportId, width, height) {
  const form = new FormData();
  form.append('client_ref', uuid());
  form.append('photo', new Blob([await pagePhoto(width, height)], { type: 'image/jpeg' }), 'page.jpg');
  return me(who, 'POST', `/${reportId}/draft/pages`, form);
}

// Embedded image widths, page by page, read back from a built PDF
async function pdfImageWidths(url) {
  const res = await fetch(origin + url);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
  const doc = await PDFDocument.load(Buffer.from(await res.arrayBuffer()));
  return doc.getPages().map((page) => {
    const xobjects = page.node.Resources().lookup(PDFName.of('XObject'));
    const [key] = xobjects.keys();
    return xobjects.lookup(key).dict.get(PDFName.of('Width')).asNumber();
  });
}

async function cleanup() {
  for (const t of ['meeting_report_comments', 'meeting_audio_uploads', 'meeting_report_pages']) await pool.query(`DELETE FROM ${t}`);
  await pool.query('UPDATE meeting_reports SET current_version_id = NULL');
  await pool.query('DELETE FROM meeting_report_versions');
  await pool.query('DELETE FROM meeting_reports');
  await pool.query("DELETE FROM announcements WHERE type = 'minutes'");
  await pool.query("DELETE FROM member_requests WHERE member_id IN (SELECT id FROM members WHERE society_id LIKE 'MIN-%')");
  await pool.query("DELETE FROM officer_events WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'min\\_%')");
  await pool.query("DELETE FROM users WHERE username LIKE 'min\\_%'");
  await pool.query("DELETE FROM members WHERE society_id LIKE 'MIN-%'");
}

test.before(async () => {
  pool = getPool(T);
  await migrateTenant(pool, T);
  await cleanup();
  for (const [key, num, name] of [['kamal', 'MIN-001', 'Kamal Perera'], ['sunil', 'MIN-002', 'Sunil Silva'], ['nimali', 'MIN-003', 'Nimali Fernando']]) {
    const [r] = await pool.query("INSERT INTO members (society_id, full_name, is_active, pin_hash) VALUES (?, ?, 1, 'x')", [num, name]);
    M[key] = r.insertId;
    MT[key] = jwt.sign({ member_id: r.insertId, typ: 'member', sam: T }, process.env.JWT_SECRET, { expiresIn: '30m' });
  }
  for (const [key, role, extra] of [['admin', 'admin', {}], ['staff', 'user', {}], ['viewer', 'viewer', {}], ['kamal', 'user', { society_position: 'secretary', member_id: M.kamal }], ['sunil', 'user', { member_id: M.sunil }]]) {
    const [r] = await pool.query('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)', [`min_${key}`, 'x', `Staff ${key}`, role]);
    U[key] = r.insertId;
    if (Object.keys(extra).length) await pool.query('UPDATE users SET ? WHERE id = ?', [extra, r.insertId]);
    S[key] = generateToken({ id: r.insertId, username: `min_${key}`, role }, T);
  }

  const app = express();
  app.use(express.json());
  app.get('/api/v1/files/:token', privateFiles.serve);
  app.use('/api/v1', tenantMiddleware);
  app.use('/api/v1/me/meeting-records', meMeetingRecords);
  app.use('/api/v1/meeting-records', meetingRecords);
  app.use('/api/v1/users', usersRoutes);
  app.use((err, _req, res, _next) => {
    if (!err.statusCode) console.error('[minutes test] unexpected', err.stack);
    const body = { error: err.message };
    if (err.statusCode && typeof err.code === 'string') body.code = err.code;
    res.status(err.statusCode || 500).json(body);
  });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      origin = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await cleanup();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
  fs.rmSync(process.env.PRIVATE_DIR, { recursive: true, force: true });
});

let reportId;
const createRef = uuid();

test('only the Secretary (or an office publisher) can start minutes', async () => {
  const body = { client_ref: uuid(), title: 'Monthly general meeting', meeting_date: '2026-11-16' };
  assert.strictEqual((await me('nimali', 'POST', '', body)).body.code, 'NOT_SECRETARY');
  assert.strictEqual((await office('staff', 'POST', '', body)).body.code, 'NOT_PUBLISHER');
  assert.strictEqual((await office('viewer', 'POST', '', body)).status, 403);
  assert.strictEqual((await me('kamal', 'POST', '', { ...body, meeting_date: '2999-01-01' })).body.code, 'MEETING_DATE_FUTURE');

  const first = await me('kamal', 'POST', '', { ...body, client_ref: createRef });
  assert.strictEqual(first.status, 200);
  reportId = first.body.report_id;
  assert.strictEqual(first.body.is_revision, false);
  const again = await me('kamal', 'POST', '', { ...body, client_ref: createRef });
  assert.strictEqual(again.body.report_id, reportId, 'a retried create returns the same report');

  // Drafts are invisible to members
  assert.strictEqual((await me('nimali', 'GET', '')).body.items.length, 0);
  assert.strictEqual((await me('nimali', 'GET', `/${reportId}/draft`)).body.code, 'NOT_SECRETARY');
});

test('pages: idempotent upload, reorder → the PDF has exactly that order, rotate', async () => {
  const a = await addPage('kamal', reportId, 600);
  const b = await addPage('kamal', reportId, 610);
  const c = await addPage('kamal', reportId, 620);
  assert.strictEqual(c.status, 200);
  assert.strictEqual(c.body.page_count, 3);
  assert.ok(a.body && b.body);

  // A retried upload with the same client_ref adds nothing
  const form = new FormData();
  const ref = c.body.pages[2].client_ref;
  form.append('client_ref', ref);
  form.append('photo', new Blob([await pagePhoto(999)], { type: 'image/jpeg' }), 'p.jpg');
  assert.strictEqual((await me('kamal', 'POST', `/${reportId}/draft/pages`, form)).body.page_count, 3);

  const [p1, p2, p3] = c.body.pages.map((p) => p.id);
  assert.strictEqual((await me('kamal', 'PUT', `/${reportId}/draft/pages/order`, { page_ids: [p1, p2] })).body.code, 'ORDER_MISMATCH');
  const ordered = await me('kamal', 'PUT', `/${reportId}/draft/pages/order`, { page_ids: [p3, p1, p2] });
  assert.deepStrictEqual(ordered.body.pages.map((p) => p.id), [p3, p1, p2]);

  const pdf = await me('kamal', 'POST', `/${reportId}/draft/pdf`);
  assert.strictEqual(pdf.status, 200);
  assert.deepStrictEqual(await pdfImageWidths(pdf.body.pdf_url), [620, 600, 610]);

  // Rotating page 1 (the 620×800 one) makes it 800 wide, in the PDF too
  const rotated = await me('kamal', 'PATCH', `/${reportId}/draft/pages/${p3}`, { rotate: 90 });
  assert.strictEqual(rotated.body.pages[0].width, 800);
  assert.strictEqual(rotated.body.pdf_stale, true, 'the old PDF no longer matches');
  const pdf2 = await me('kamal', 'POST', `/${reportId}/draft/pdf`);
  assert.deepStrictEqual(await pdfImageWidths(pdf2.body.pdf_url), [800, 600, 610]);

  // A page image is served through its signed link
  const img = await fetch(origin + rotated.body.pages[0].url);
  assert.strictEqual(img.status, 200);
  assert.strictEqual(img.headers.get('content-type'), 'image/jpeg');
});

test('audio: resumable chunks, and publishing waits for them', async () => {
  const head = Buffer.from([0, 0, 0, 0x18, ...Buffer.from('ftypM4A '), 0, 0, 0, 0]);
  const audio = Buffer.concat([head, crypto.randomBytes(9000)]);
  const uploadId = uuid();
  const init = await me('kamal', 'POST', `/${reportId}/draft/audio/uploads`, { upload_id: uploadId, total_bytes: audio.length, duration_ms: 62000 });
  assert.strictEqual(init.body.received_bytes, 0);

  const chunk = (from, to) => me('kamal', 'PUT', `/${reportId}/draft/audio/uploads/${uploadId}`, audio.subarray(from, to + 1), {
    'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${from}-${to}/${audio.length}`
  });
  assert.strictEqual((await chunk(0, 4999)).body.received_bytes, 5000);
  const wrong = await chunk(0, 4999);
  assert.strictEqual(wrong.status, 409);
  assert.strictEqual(wrong.body.code, 'OFFSET_MISMATCH');
  assert.strictEqual(wrong.body.received_bytes, 5000, 'the server says where to resume');

  const early = await me('kamal', 'POST', `/${reportId}/draft/publish`, { publish_ref: uuid() });
  assert.strictEqual(early.body.code, 'AUDIO_UPLOADING');

  assert.strictEqual((await chunk(5000, audio.length - 1)).body.received_bytes, audio.length);
  const done = await me('kamal', 'POST', `/${reportId}/draft/audio/uploads/${uploadId}/complete`);
  assert.strictEqual(done.body.audio_ms, 62000);
  assert.strictEqual(done.body.audio_mime, 'audio/mp4');

  // Range requests let a player seek
  const ranged = await fetch(origin + done.body.audio_url, { headers: { Range: 'bytes=100-199' } });
  assert.strictEqual(ranged.status, 206);
  assert.strictEqual((await ranged.arrayBuffer()).byteLength, 100);
});

const publishRef = uuid();

test('publishing is idempotent: one version, one notice', async () => {
  const first = await me('kamal', 'POST', `/${reportId}/draft/publish`, { publish_ref: publishRef });
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.version_no, 1);
  assert.strictEqual(first.body.notified, true);
  const second = await me('kamal', 'POST', `/${reportId}/draft/publish`, { publish_ref: publishRef });
  assert.strictEqual(second.body.already, true);
  assert.strictEqual(second.body.version_no, 1);

  const [notices] = await pool.query("SELECT id, meeting_report_id FROM announcements WHERE type = 'minutes'");
  assert.strictEqual(notices.length, 1);
  assert.strictEqual(notices[0].meeting_report_id, reportId);

  const read = await me('nimali', 'GET', `/${reportId}`);
  assert.strictEqual(read.status, 200);
  assert.strictEqual(read.body.version.version_no, 1);
  assert.strictEqual(read.body.version.author_name, 'Kamal Perera');
  assert.strictEqual(read.body.version.author_position, 'secretary');
  assert.strictEqual(read.body.version.page_count, 3);
  assert.ok(read.body.version.pdf_url && read.body.version.audio_url);
  assert.strictEqual(read.body.report.has_draft, false);
});

let commentId;

test('members comment on a version; one thread; retries do not duplicate', async () => {
  const ref = uuid();
  const c = await me('nimali', 'POST', `/${reportId}/comments`, { client_ref: ref, body: 'On page 2 the figure should be 12,500.', version_no: 1 });
  assert.strictEqual(c.status, 200);
  commentId = c.body.id;
  assert.strictEqual((await me('nimali', 'POST', `/${reportId}/comments`, { client_ref: ref, body: 'On page 2 the figure should be 12,500.' })).body.id, commentId);
  assert.strictEqual((await me('nimali', 'POST', `/${reportId}/comments`, { client_ref: uuid(), body: '  ' })).body.code, 'COMMENT_REQUIRED');

  const list = await me('sunil', 'GET', `/${reportId}/comments`);
  assert.strictEqual(list.body.items.length, 1);
  assert.strictEqual(list.body.items[0].version_no, 1);
  assert.strictEqual(list.body.items[0].author_name, 'Nimali Fernando');
  assert.strictEqual(list.body.items[0].is_mine, false);

  assert.strictEqual((await me('sunil', 'POST', `/comments/${commentId}/reply`, { body: 'x' })).body.code, 'NOT_SECRETARY');
  assert.strictEqual((await me('kamal', 'POST', `/comments/${commentId}/reply`, { body: 'Thank you, I will correct it.' })).status, 200);
});

test('a revision keeps v1, needs a summary, and may publish quietly', async () => {
  const rev = await me('kamal', 'POST', `/${reportId}/revision`);
  assert.strictEqual(rev.body.is_revision, true);
  assert.strictEqual(rev.body.next_version_no, 2);
  assert.strictEqual(rev.body.page_count, 3, 'the revision starts from v1');
  assert.ok(rev.body.audio_url, 'and keeps its recording');

  // v1 stays readable while the revision is prepared
  assert.strictEqual((await me('nimali', 'GET', `/${reportId}`)).body.version.version_no, 1);

  await addPage('kamal', reportId, 630);
  const noSummary = await me('kamal', 'POST', `/${reportId}/draft/publish`, { publish_ref: uuid() });
  assert.strictEqual(noSummary.body.code, 'CHANGE_SUMMARY_REQUIRED');
  const v2 = await me('kamal', 'POST', `/${reportId}/draft/publish`, { publish_ref: uuid(), change_summary: 'Corrected the figure on page 2', notify: false });
  assert.strictEqual(v2.body.version_no, 2);
  assert.strictEqual(v2.body.notified, false);
  const [notices] = await pool.query("SELECT id FROM announcements WHERE type = 'minutes'");
  assert.strictEqual(notices.length, 1, 'a quiet revision adds no notice');

  const latest = await me('nimali', 'GET', `/${reportId}`);
  assert.strictEqual(latest.body.version.version_no, 2);
  assert.strictEqual(latest.body.version.page_count, 4);
  assert.strictEqual(latest.body.version.change_summary, 'Corrected the figure on page 2');
  assert.deepStrictEqual(latest.body.versions.map((v) => v.version_no), [2, 1]);
  const old = await me('nimali', 'GET', `/${reportId}/versions/1`);
  assert.strictEqual(old.body.version.page_count, 3, 'v1 is exactly as published');
  assert.deepStrictEqual(await pdfImageWidths(old.body.version.pdf_url), [800, 600, 610]);

  // The thread survives with its v1 tag; the correction is fixed in v2
  assert.strictEqual((await me('kamal', 'POST', `/comments/${commentId}/addressed`, { version_no: 2 })).status, 200);
  const list = await me('nimali', 'GET', `/${reportId}/comments`);
  const top = list.body.items.find((c) => c.id === commentId);
  assert.strictEqual(top.version_no, 1);
  assert.strictEqual(top.status, 'addressed');
  assert.strictEqual(top.addressed_in_version_no, 2);
  assert.ok(list.body.items.some((c) => c.parent_id === commentId && c.is_secretary));
});

test('a new Secretary continues the drafts; history keeps the old author', async () => {
  await me('kamal', 'POST', `/${reportId}/revision`);
  const moved = await call('PATCH', `/users/${U.sunil}`, S.admin, { society_position: 'secretary', replace_secretary: true });
  assert.strictEqual(moved.status, 200);
  assert.strictEqual((await me('kamal', 'GET', `/${reportId}/draft`)).body.code, 'NOT_SECRETARY', 'the old Secretary is refused at once');

  const hub = await me('sunil', 'GET', '/secretary');
  assert.ok(hub.body.drafts.some((d) => d.report_id === reportId && d.is_revision));
  const v3 = await me('sunil', 'POST', `/${reportId}/draft/publish`, { publish_ref: uuid(), change_summary: 'Added the attendance list' });
  assert.strictEqual(v3.body.version_no, 3);

  const v1 = await me('nimali', 'GET', `/${reportId}/versions/1`);
  assert.strictEqual(v1.body.version.author_name, 'Kamal Perera');
  const v3r = await me('nimali', 'GET', `/${reportId}`);
  assert.strictEqual(v3r.body.version.author_name, 'Sunil Silva');
});

test('an administrator withdraws a version; members fall back to the previous one', async () => {
  assert.strictEqual((await office('staff', 'POST', `/${reportId}/versions/3/withdraw`, { reason: 'x' })).status, 403);
  assert.strictEqual((await office('admin', 'POST', `/${reportId}/versions/3/withdraw`, {})).body.code, 'REASON_REQUIRED');
  assert.strictEqual((await office('admin', 'POST', `/${reportId}/versions/3/withdraw`, { reason: 'Wrong page photographed' })).status, 200);
  assert.strictEqual((await me('nimali', 'GET', `/${reportId}`)).body.version.version_no, 2);
  assert.strictEqual((await me('nimali', 'GET', `/${reportId}/versions/3`)).body.code, 'VERSION_WITHDRAWN');
  const adminView = await office('admin', 'GET', `/${reportId}/versions/3`);
  assert.strictEqual(adminView.body.version.state, 'withdrawn');
  assert.strictEqual((await office('admin', 'POST', `/${reportId}/versions/3/restore`)).status, 200);
  assert.strictEqual((await me('nimali', 'GET', `/${reportId}`)).body.version.version_no, 3);
});

test('two meetings in one month each have their own report; browse by year and month', async () => {
  // The office publishes this one (D2): an Administrator is a publisher
  const r = await office('admin', 'POST', '', { client_ref: uuid(), title: 'Special meeting: funeral fund', meeting_date: '2026-11-03' });
  assert.strictEqual(r.status, 200);
  const form = new FormData();
  form.append('client_ref', uuid());
  form.append('photo', new Blob([await pagePhoto(700)], { type: 'image/jpeg' }), 'p.jpg');
  assert.strictEqual((await office('admin', 'POST', `/${r.body.report_id}/draft/pages`, form)).status, 200);
  const pub = await office('admin', 'POST', `/${r.body.report_id}/draft/publish`, { publish_ref: uuid() });
  assert.strictEqual(pub.body.version_no, 1);

  const nov = await me('nimali', 'GET', '?year=2026&month=11');
  assert.deepStrictEqual(nov.body.items.map((i) => i.title), ['Monthly general meeting', 'Special meeting: funeral fund']);
  assert.deepStrictEqual(nov.body.years, [2026]);
  assert.strictEqual((await me('nimali', 'GET', '?year=2026&month=10')).body.items.length, 0);
  const fromOffice = await me('nimali', 'GET', `/${r.body.report_id}`);
  assert.strictEqual(fromOffice.body.version.author_position, 'office');
  assert.strictEqual(fromOffice.body.version.author_name, 'Staff admin');
});

test('moderation: staff hide a comment, members see that it was hidden', async () => {
  assert.strictEqual((await office('viewer', 'POST', `/comments/${commentId}/hide`, { reason: 'x' })).status, 403);
  assert.strictEqual((await office('staff', 'POST', `/comments/${commentId}/hide`, { reason: 'Personal remark' })).status, 200);
  const member = (await me('sunil', 'GET', `/${reportId}/comments`)).body.items.find((c) => c.id === commentId);
  // sunil is now the Secretary, so he moderates and sees the text; nimali does not
  assert.strictEqual(member.hidden, true);
  const plain = (await me('nimali', 'GET', `/${reportId}/comments`)).body.items.find((c) => c.id === commentId);
  assert.strictEqual(plain.body, null);
  assert.strictEqual((await me('nimali', 'POST', `/comments/${commentId}/report`)).status, 200);
  const [[req]] = await pool.query("SELECT type, purpose FROM member_requests WHERE member_id = ? ORDER BY id DESC LIMIT 1", [M.nimali]);
  assert.deepStrictEqual({ ...req }, { type: 'concern', purpose: 'content' });
});

test('signed links: tampered or expired links are refused', async () => {
  const read = await me('nimali', 'GET', `/${reportId}`);
  const url = read.body.version.pdf_url;
  const tampered = url.slice(0, -3) + (url.endsWith('AAA') ? 'BBB' : 'AAA');
  assert.strictEqual((await fetch(origin + tampered)).status, 404);
  const rel = privateFiles.verify(url.split('/').pop()).f;
  const expired = privateFiles.signedUrl(rel, { ttl: -10 });
  assert.strictEqual((await fetch(origin + expired)).status, 404);
  const fresh = privateFiles.signedUrl(rel);
  assert.strictEqual((await fetch(origin + fresh)).status, 200);
});

test('discarding a never-published draft removes the report', async () => {
  const r = await me('sunil', 'POST', '', { client_ref: uuid(), title: 'Draft to throw away', meeting_date: '2026-10-05' });
  const id = r.body.report_id;
  await addPage('sunil', id, 640);
  assert.strictEqual((await me('sunil', 'DELETE', `/${id}/draft`)).status, 200);
  assert.strictEqual((await me('sunil', 'GET', `/${id}`)).status, 404);
  const [[row]] = await pool.query('SELECT deleted_at FROM meeting_reports WHERE id = ?', [id]);
  assert.ok(row.deleted_at);
});
