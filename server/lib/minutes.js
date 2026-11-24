const fs = require('fs');
const path = require('path');
const files = require('./privateFiles');
const media = require('./minutesMedia');
const { sendPushToAllMembers, sendPushToMembers } = require('./push');
const { societyToday } = require('./attendance');

// Meeting minutes (docs/MEETING-MINUTES-REQUIREMENTS.md §5–§9). Routes resolve
// WHO is acting into an actor and call these functions; every permission is
// decided here so the member app and the office web share one set of rules.
//
// actor = {
//   kind: 'member' | 'staff', memberId?, userId?,
//   name, position ('secretary' | 'office'), ref,
//   canPublish, canModerate, canWithdraw
// }

const MAX_PAGES = 40;
const MAX_AUDIO_BYTES = 80 * 1024 * 1024;
const MAX_AUDIO_MS = 90 * 60 * 1000;
const COMMENT_MAX = 1000;
const DELETE_OWN_MINUTES = 15;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(statusCode, code, message, extra) {
  return Object.assign(new Error(message), { statusCode, code }, extra || {});
}

async function withTx(pool, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

const reportArea = (reportId) => ['minutes', String(reportId)];
const relOf = (tenant, reportId, name) => files.rel(tenant, ...reportArea(reportId), name);
const absOf = (tenant, reportId, name) => files.abs(relOf(tenant, reportId, name));
const urlOf = (tenant, reportId, name, opts) => (name ? files.signedUrl(relOf(tenant, reportId, name), opts) : null);
const thumbName = (file) => file.replace(/\.jpg$/, '_t.jpg');

function requirePublisher(actor) {
  if (!actor.canPublish) {
    throw fail(403, actor.kind === 'member' ? 'NOT_SECRETARY' : 'NOT_PUBLISHER', 'Only the Secretary can prepare and publish meeting minutes');
  }
}

function readDetails(body, { partial }) {
  const out = {};
  if (body.title !== undefined || !partial) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) throw fail(400, 'TITLE_REQUIRED', 'Give the report a title');
    out.title = title.slice(0, 200);
  }
  if (body.meeting_date !== undefined || !partial) {
    const d = String(body.meeting_date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw fail(400, 'MEETING_DATE_REQUIRED', 'Choose the date of the meeting');
    if (d > societyToday()) throw fail(400, 'MEETING_DATE_FUTURE', 'The meeting date cannot be in the future');
    if (d < '2000-01-01') throw fail(400, 'MEETING_DATE_REQUIRED', 'Choose the date of the meeting');
    out.meeting_date = d;
  }
  if (body.change_summary !== undefined) {
    const s = typeof body.change_summary === 'string' ? body.change_summary.trim() : '';
    out.change_summary = s ? s.slice(0, 500) : null;
  }
  return out;
}

// ── Reading ─────────────────────────────────────────────────

async function loadReport(db, reportId, { lock = false } = {}) {
  const [[report]] = await db.query(
    `SELECT id, category, current_version_id, deleted_at FROM meeting_reports WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [reportId]
  );
  if (!report || report.deleted_at) throw fail(404, 'NOT_FOUND', 'Meeting minutes not found');
  return report;
}

async function loadDraft(db, reportId, { lock = false } = {}) {
  const [[draft]] = await db.query(
    `SELECT * FROM meeting_report_versions WHERE report_id = ? AND state = 'draft'${lock ? ' FOR UPDATE' : ''}`,
    [reportId]
  );
  if (!draft) throw fail(404, 'NO_DRAFT', 'There is no draft for this report');
  return draft;
}

async function pagesOf(db, versionId) {
  const [rows] = await db.query(
    'SELECT id, position, file, thumb, rotation, width, height, bytes, client_ref FROM meeting_report_pages WHERE version_id = ? ORDER BY position ASC, id ASC',
    [versionId]
  );
  return rows;
}

const ymd = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : d);

function versionSummary(v) {
  return {
    version_no: v.version_no,
    state: v.state,
    published_at: v.published_at,
    author_name: v.author_name,
    author_position: v.author_position,
    change_summary: v.change_summary,
    withdrawn_at: v.withdrawn_at || null,
    withdrawn_reason: v.withdrawn_reason || null
  };
}

// One version with signed links to everything in it
async function versionView(db, tenant, reportId, v, societyName) {
  const pages = await pagesOf(db, v.id);
  const pdfName = `${societyName || 'eSamithi'} minutes ${ymd(v.meeting_date)}${v.version_no ? ` v${v.version_no}` : ''}.pdf`;
  return {
    ...versionSummary(v),
    title: v.title,
    meeting_date: ymd(v.meeting_date),
    page_count: pages.length,
    pages: pages.map((p, i) => ({
      id: p.id,
      n: i + 1,
      url: urlOf(tenant, reportId, p.file),
      thumb_url: urlOf(tenant, reportId, p.thumb),
      width: p.width,
      height: p.height
    })),
    pdf_url: v.pdf_file ? urlOf(tenant, reportId, v.pdf_file, { name: pdfName }) : null,
    pdf_bytes: v.pdf_bytes,
    audio_url: v.audio_file ? urlOf(tenant, reportId, v.audio_file) : null,
    audio_ms: v.audio_ms,
    audio_bytes: v.audio_bytes,
    audio_mime: v.audio_mime
  };
}

async function societyName(db) {
  try {
    const [[row]] = await db.query("SELECT `value` FROM settings WHERE `key` = 'society_name'");
    return row ? row.value : null;
  } catch {
    return null;
  }
}

// Browse (§4.3). Members and plain staff see published reports; publishers can
// also list drafts, admins withdrawn versions.
async function browse(pool, actor, { year, month, status = 'published', page = 1 } = {}) {
  const limit = 50;
  const offset = (Math.max(1, Number(page) || 1) - 1) * limit;
  const filters = [];
  const params = [];
  if (year) { filters.push('YEAR(v.meeting_date) = ?'); params.push(Number(year)); }
  if (month) { filters.push('MONTH(v.meeting_date) = ?'); params.push(Number(month)); }
  const where = filters.length ? ` AND ${filters.join(' AND ')}` : '';

  let join;
  if (status === 'drafts') {
    if (!actor.canPublish) throw fail(403, 'NOT_PUBLISHER', 'Only the Secretary can see drafts');
    join = "JOIN meeting_report_versions v ON v.report_id = r.id AND v.state = 'draft'";
  } else if (status === 'withdrawn') {
    if (!actor.canWithdraw) throw fail(403, 'FORBIDDEN', 'Only an administrator can see withdrawn versions');
    join = "JOIN meeting_report_versions v ON v.report_id = r.id AND v.state = 'withdrawn'";
  } else {
    join = 'JOIN meeting_report_versions v ON v.id = r.current_version_id';
  }

  const [rows] = await pool.query(
    `SELECT r.id, v.title, DATE_FORMAT(v.meeting_date, '%Y-%m-%d') AS meeting_date, v.version_no, v.state,
            v.published_at, v.updated_at, v.page_count, v.audio_ms, (v.audio_file IS NOT NULL) AS has_audio,
            v.author_name, v.withdrawn_at,
            (SELECT COUNT(*) FROM meeting_report_comments c WHERE c.report_id = r.id AND c.parent_id IS NULL
               AND c.deleted_at IS NULL AND c.hidden_at IS NULL) AS comment_count,
            (SELECT COUNT(*) FROM meeting_report_comments c WHERE c.report_id = r.id AND c.parent_id IS NULL
               AND c.deleted_at IS NULL AND c.hidden_at IS NULL AND c.status = 'open') AS open_comment_count
       FROM meeting_reports r ${join}
      WHERE r.deleted_at IS NULL${where}
      ORDER BY v.meeting_date DESC, v.published_at DESC, r.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit + 1, offset]
  );
  const [years] = await pool.query(
    `SELECT DISTINCT YEAR(v.meeting_date) AS y FROM meeting_reports r ${join} WHERE r.deleted_at IS NULL ORDER BY y DESC`
  );
  return {
    years: years.map((r) => Number(r.y)),
    items: rows.slice(0, limit).map((r) => ({
      ...r,
      has_audio: Number(r.has_audio) === 1,
      comment_count: Number(r.comment_count),
      open_comment_count: Number(r.open_comment_count)
    })),
    has_more: rows.length > limit
  };
}

// A report as a reader sees it: the latest published version (or versionNo)
async function getReport(pool, tenant, actor, reportId, versionNo) {
  const report = await loadReport(pool, reportId);
  let v;
  if (versionNo !== undefined) {
    const [[row]] = await pool.query('SELECT * FROM meeting_report_versions WHERE report_id = ? AND version_no = ?', [reportId, Number(versionNo)]);
    if (!row) throw fail(404, 'NOT_FOUND', 'That version does not exist');
    if (row.state === 'withdrawn' && !actor.canWithdraw) throw fail(410, 'VERSION_WITHDRAWN', 'This version was withdrawn by the society');
    v = row;
  } else {
    if (!report.current_version_id) throw fail(404, 'NOT_FOUND', 'Meeting minutes not found');
    const [[row]] = await pool.query('SELECT * FROM meeting_report_versions WHERE id = ?', [report.current_version_id]);
    v = row;
  }
  const states = actor.canWithdraw ? "('published','withdrawn')" : "('published')";
  const [versions] = await pool.query(
    `SELECT * FROM meeting_report_versions WHERE report_id = ? AND state IN ${states} ORDER BY version_no DESC`,
    [reportId]
  );
  let hasDraft = false;
  if (actor.canPublish) {
    const [[d]] = await pool.query("SELECT id FROM meeting_report_versions WHERE report_id = ? AND state = 'draft'", [reportId]);
    hasDraft = Boolean(d);
  }
  const latest = versions.find((x) => x.state === 'published');
  return {
    report: { id: report.id, category: report.category, latest_version_no: latest ? latest.version_no : null, has_draft: hasDraft },
    version: await versionView(pool, tenant, reportId, v, await societyName(pool)),
    versions: versions.map(versionSummary)
  };
}

// ── Drafts (Secretary / office publisher) ───────────────────

async function draftView(pool, tenant, reportId) {
  const report = await loadReport(pool, reportId);
  const draft = await loadDraft(pool, reportId);
  const view = await versionView(pool, tenant, reportId, draft, await societyName(pool));
  const pages = await pagesOf(pool, draft.id);
  const fresh = draft.pdf_file && draft.pdf_hash === media.pagesHash(pages.map((p) => p.file));
  const [uploads] = await pool.query(
    'SELECT id, total_bytes, received_bytes FROM meeting_audio_uploads WHERE version_id = ? AND completed_at IS NULL AND expires_at > NOW()',
    [draft.id]
  );
  const [[{ n }]] = await pool.query("SELECT COALESCE(MAX(version_no), 0) AS n FROM meeting_report_versions WHERE report_id = ? AND state <> 'draft'", [reportId]);
  return {
    report_id: report.id,
    is_revision: Number(n) > 0,
    next_version_no: Number(n) + 1,
    updated_at: draft.updated_at,
    ...view,
    pages: view.pages.map((p, i) => ({ ...p, rotation: pages[i].rotation, client_ref: pages[i].client_ref })),
    pdf_url: fresh ? view.pdf_url : null,
    pdf_stale: !fresh,
    audio_uploads: uploads,
    max_pages: MAX_PAGES
  };
}

async function createReport(pool, tenant, actor, body) {
  requirePublisher(actor);
  const ref = body.client_ref;
  if (!UUID.test(String(ref || ''))) throw fail(400, 'CLIENT_REF_REQUIRED', 'client_ref must be a UUID');
  const details = readDetails(body, { partial: false });
  const reportId = await withTx(pool, async (conn) => {
    const [[existing]] = await conn.query('SELECT id FROM meeting_reports WHERE client_ref = ?', [ref]);
    if (existing) return existing.id;
    const [r] = await conn.query(
      'INSERT INTO meeting_reports (category, created_by_member_id, created_by_user_id, client_ref) VALUES (?, ?, ?, ?)',
      ['minutes', actor.memberId || null, actor.userId || null, ref]
    );
    await conn.query(
      'INSERT INTO meeting_report_versions (report_id, title, meeting_date) VALUES (?, ?, ?)',
      [r.insertId, details.title, details.meeting_date]
    );
    return r.insertId;
  }).catch(async (err) => {
    if (err.code === 'ER_DUP_ENTRY') {
      const [[row]] = await pool.query('SELECT id FROM meeting_reports WHERE client_ref = ?', [ref]);
      if (row) return row.id;
    }
    throw err;
  });
  return draftView(pool, tenant, reportId);
}

// Update a published report: a draft that starts as a copy of the latest
// version. Its page rows point at the same files until a page changes.
async function startRevision(pool, tenant, actor, reportId) {
  requirePublisher(actor);
  await withTx(pool, async (conn) => {
    const report = await loadReport(conn, reportId, { lock: true });
    const [[open]] = await conn.query("SELECT id FROM meeting_report_versions WHERE report_id = ? AND state = 'draft'", [reportId]);
    if (open) return;
    if (!report.current_version_id) throw fail(409, 'NOT_PUBLISHED', 'Publish the report before updating it');
    const [[v]] = await conn.query('SELECT * FROM meeting_report_versions WHERE id = ?', [report.current_version_id]);
    const [r] = await conn.query(
      `INSERT INTO meeting_report_versions (report_id, title, meeting_date, page_count, audio_file, audio_ms, audio_bytes, audio_mime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reportId, v.title, ymd(v.meeting_date), v.page_count, v.audio_file, v.audio_ms, v.audio_bytes, v.audio_mime]
    );
    await conn.query(
      `INSERT INTO meeting_report_pages (version_id, position, file, thumb, rotation, width, height, bytes, client_ref)
       SELECT ?, position, file, thumb, rotation, width, height, bytes, client_ref FROM meeting_report_pages WHERE version_id = ?`,
      [r.insertId, v.id]
    );
  });
  return draftView(pool, tenant, reportId);
}

async function updateDraft(pool, tenant, actor, reportId, body) {
  requirePublisher(actor);
  const changes = readDetails(body, { partial: true });
  if (Object.keys(changes).length) {
    const draft = await loadDraft(pool, reportId);
    await pool.query('UPDATE meeting_report_versions SET ? WHERE id = ?', [changes, draft.id]);
  }
  return draftView(pool, tenant, reportId);
}

// Remove page files no row points at any more (a published version's pages,
// shared with a revision draft, stay until nothing uses them)
async function removeUnusedPageFiles(db, tenant, reportId, names) {
  for (const name of names) {
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM meeting_report_pages WHERE file = ?', [name]);
    if (Number(n) === 0) {
      files.remove(relOf(tenant, reportId, name));
      files.remove(relOf(tenant, reportId, thumbName(name)));
    }
  }
}

async function removeUnusedVersionFile(db, tenant, reportId, column, name) {
  if (!name) return;
  const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM meeting_report_versions WHERE ${column} = ?`, [name]);
  if (Number(n) === 0) files.remove(relOf(tenant, reportId, name));
}

async function writePage(tenant, reportId, processed) {
  const file = files.newName('.jpg');
  files.dir(tenant, ...reportArea(reportId));
  fs.writeFileSync(absOf(tenant, reportId, file), processed.data);
  fs.writeFileSync(absOf(tenant, reportId, thumbName(file)), processed.thumb);
  return file;
}

// Add a page at the end, or replace one (replace_page_id). Idempotent on
// client_ref: a retried upload returns the page already stored.
async function addPage(pool, tenant, actor, reportId, { clientRef, buffer, replacePageId }) {
  requirePublisher(actor);
  files.assertReady();
  if (!UUID.test(String(clientRef || ''))) throw fail(400, 'CLIENT_REF_REQUIRED', 'client_ref must be a UUID');
  if (!buffer || !buffer.length) throw fail(400, 'PHOTO_REQUIRED', 'Choose a photo of the page');
  const draft = await loadDraft(pool, reportId);
  const [[dupe]] = await pool.query('SELECT id FROM meeting_report_pages WHERE version_id = ? AND client_ref = ?', [draft.id, clientRef]);
  if (dupe) return draftView(pool, tenant, reportId);
  if (!replacePageId && draft.page_count >= MAX_PAGES) throw fail(400, 'TOO_MANY_PAGES', `A report can have at most ${MAX_PAGES} pages`);

  const processed = await media.processPage(buffer);
  const file = await writePage(tenant, reportId, processed);
  let replaced = null;
  try {
    await withTx(pool, async (conn) => {
      const d = await loadDraft(conn, reportId, { lock: true });
      const row = { file, thumb: thumbName(file), rotation: 0, width: processed.width, height: processed.height, bytes: processed.data.length, client_ref: clientRef };
      if (replacePageId) {
        const [[old]] = await conn.query('SELECT id, file FROM meeting_report_pages WHERE id = ? AND version_id = ?', [Number(replacePageId), d.id]);
        if (!old) throw fail(404, 'PAGE_NOT_FOUND', 'That page is no longer in the draft');
        await conn.query('UPDATE meeting_report_pages SET ? WHERE id = ?', [row, old.id]);
        replaced = old.file;
      } else {
        const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM meeting_report_pages WHERE version_id = ?', [d.id]);
        if (Number(n) >= MAX_PAGES) throw fail(400, 'TOO_MANY_PAGES', `A report can have at most ${MAX_PAGES} pages`);
        const [[{ p }]] = await conn.query('SELECT COALESCE(MAX(position), 0) AS p FROM meeting_report_pages WHERE version_id = ?', [d.id]);
        await conn.query('INSERT INTO meeting_report_pages SET ?', [{ ...row, version_id: d.id, position: Number(p) + 1 }]);
        await conn.query('UPDATE meeting_report_versions SET page_count = ? WHERE id = ?', [Number(n) + 1, d.id]);
      }
    });
  } catch (err) {
    files.remove(relOf(tenant, reportId, file));
    files.remove(relOf(tenant, reportId, thumbName(file)));
    if (err.code === 'ER_DUP_ENTRY') return draftView(pool, tenant, reportId); // raced a retry
    throw err;
  }
  if (replaced) await removeUnusedPageFiles(pool, tenant, reportId, [replaced]);
  return draftView(pool, tenant, reportId);
}

// The complete page order, as the Secretary arranged it
async function reorderPages(pool, tenant, actor, reportId, pageIds) {
  requirePublisher(actor);
  if (!Array.isArray(pageIds) || pageIds.some((x) => !Number.isInteger(Number(x)))) {
    throw fail(400, 'ORDER_MISMATCH', 'page_ids must list every page of the draft');
  }
  await withTx(pool, async (conn) => {
    const d = await loadDraft(conn, reportId, { lock: true });
    const pages = await pagesOf(conn, d.id);
    const want = pageIds.map(Number);
    const have = pages.map((p) => p.id);
    if (want.length !== have.length || new Set(want).size !== want.length || want.some((id) => !have.includes(id))) {
      throw fail(409, 'ORDER_MISMATCH', 'The pages changed since you last loaded the draft. Reload and try again.');
    }
    for (let i = 0; i < want.length; i++) {
      await conn.query('UPDATE meeting_report_pages SET position = ? WHERE id = ?', [i + 1, want[i]]);
    }
  });
  return draftView(pool, tenant, reportId);
}

// Turn a page by 90/180/270 degrees. The stored image is rotated, so every
// viewer and the PDF show it upright with no client-side work.
async function rotatePage(pool, tenant, actor, reportId, pageId, body) {
  requirePublisher(actor);
  files.assertReady();
  const draft = await loadDraft(pool, reportId);
  const [[page]] = await pool.query('SELECT * FROM meeting_report_pages WHERE id = ? AND version_id = ?', [Number(pageId), draft.id]);
  if (!page) throw fail(404, 'PAGE_NOT_FOUND', 'That page is no longer in the draft');
  let delta;
  if (body.rotate !== undefined) delta = Number(body.rotate);
  else if (body.rotation !== undefined) delta = (Number(body.rotation) - page.rotation + 360) % 360;
  if (![0, 90, 180, 270].includes(delta)) throw fail(400, 'BAD_ROTATION', 'Rotate by 90, 180 or 270 degrees');
  if (delta === 0) return draftView(pool, tenant, reportId);

  const processed = await media.processPage(fs.readFileSync(absOf(tenant, reportId, page.file)), { rotate: delta });
  const file = await writePage(tenant, reportId, processed);
  await pool.query(
    'UPDATE meeting_report_pages SET file = ?, thumb = ?, rotation = ?, width = ?, height = ?, bytes = ? WHERE id = ?',
    [file, thumbName(file), (page.rotation + delta) % 360, processed.width, processed.height, processed.data.length, page.id]
  );
  await removeUnusedPageFiles(pool, tenant, reportId, [page.file]);
  return draftView(pool, tenant, reportId);
}

async function deletePage(pool, tenant, actor, reportId, pageId) {
  requirePublisher(actor);
  let removed = null;
  await withTx(pool, async (conn) => {
    const d = await loadDraft(conn, reportId, { lock: true });
    const [[page]] = await conn.query('SELECT id, file FROM meeting_report_pages WHERE id = ? AND version_id = ?', [Number(pageId), d.id]);
    if (!page) return;
    removed = page.file;
    await conn.query('DELETE FROM meeting_report_pages WHERE id = ?', [page.id]);
    const rest = await pagesOf(conn, d.id);
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].position !== i + 1) await conn.query('UPDATE meeting_report_pages SET position = ? WHERE id = ?', [i + 1, rest[i].id]);
    }
    await conn.query('UPDATE meeting_report_versions SET page_count = ? WHERE id = ?', [rest.length, d.id]);
  });
  if (removed) await removeUnusedPageFiles(pool, tenant, reportId, [removed]);
  return draftView(pool, tenant, reportId);
}

// ── Audio: chunked, resumable (§6.5) ────────────────────────

function tmpPath(tenant, uploadId) {
  return path.join(files.dir(tenant, 'tmp'), `${uploadId}.part`);
}

async function initAudio(pool, tenant, actor, reportId, body) {
  requirePublisher(actor);
  files.assertReady();
  const id = String(body.upload_id || '');
  if (!UUID.test(id)) throw fail(400, 'CLIENT_REF_REQUIRED', 'upload_id must be a UUID');
  const total = Number(body.total_bytes);
  if (!Number.isInteger(total) || total <= 0) throw fail(400, 'BAD_SIZE', 'total_bytes is required');
  if (total > MAX_AUDIO_BYTES) throw fail(400, 'FILE_TOO_LARGE', 'The recording is too large (at most 80 MB)');
  const duration = body.duration_ms === undefined || body.duration_ms === null ? null : Number(body.duration_ms);
  if (duration !== null && (!Number.isFinite(duration) || duration < 0)) throw fail(400, 'BAD_DURATION', 'duration_ms must be a number');
  if (duration !== null && duration > MAX_AUDIO_MS) throw fail(400, 'AUDIO_TOO_LONG', 'The recording is longer than 90 minutes');
  const draft = await loadDraft(pool, reportId);

  const [[existing]] = await pool.query('SELECT * FROM meeting_audio_uploads WHERE id = ?', [id]);
  if (existing) {
    if (existing.version_id !== draft.id) throw fail(409, 'UPLOAD_MISMATCH', 'That upload belongs to another draft');
    return { upload_id: id, received_bytes: existing.received_bytes, total_bytes: existing.total_bytes, completed: Boolean(existing.completed_at) };
  }
  fs.writeFileSync(tmpPath(tenant, id), Buffer.alloc(0));
  await pool.query(
    'INSERT INTO meeting_audio_uploads (id, version_id, total_bytes, duration_ms, tmp_file, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 48 HOUR))',
    [id, draft.id, total, duration, `${id}.part`]
  );
  return { upload_id: id, received_bytes: 0, total_bytes: total, completed: false };
}

// One chunk. It must start exactly where the server's copy ends; otherwise
// the answer says where to resume (OFFSET_MISMATCH + received_bytes).
async function audioChunk(pool, tenant, actor, reportId, uploadId, range, buffer) {
  requirePublisher(actor);
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(String(range || ''));
  if (!m) throw fail(400, 'BAD_RANGE', 'Content-Range: bytes start-end/total is required');
  const [start, end, total] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!buffer || buffer.length !== end - start + 1) throw fail(400, 'BAD_RANGE', 'The chunk size does not match Content-Range');
  return withTx(pool, async (conn) => {
    const draft = await loadDraft(conn, reportId);
    const [[up]] = await conn.query('SELECT * FROM meeting_audio_uploads WHERE id = ? FOR UPDATE', [uploadId]);
    if (!up || up.version_id !== draft.id) throw fail(404, 'UPLOAD_NOT_FOUND', 'Start the upload again');
    if (up.completed_at) return { received_bytes: up.received_bytes, total_bytes: up.total_bytes };
    if (total !== up.total_bytes || end >= total) throw fail(400, 'BAD_RANGE', 'The chunk does not fit this upload');
    if (start !== up.received_bytes) {
      throw fail(409, 'OFFSET_MISMATCH', 'Resume from the server’s offset', { received_bytes: up.received_bytes });
    }
    fs.appendFileSync(tmpPath(tenant, up.id), buffer);
    await conn.query('UPDATE meeting_audio_uploads SET received_bytes = ? WHERE id = ?', [end + 1, up.id]);
    return { received_bytes: end + 1, total_bytes: up.total_bytes };
  });
}

async function completeAudio(pool, tenant, actor, reportId, uploadId) {
  requirePublisher(actor);
  const draft = await loadDraft(pool, reportId);
  const [[up]] = await pool.query('SELECT * FROM meeting_audio_uploads WHERE id = ?', [uploadId]);
  if (!up || up.version_id !== draft.id) throw fail(404, 'UPLOAD_NOT_FOUND', 'Start the upload again');
  if (up.completed_at) return draftView(pool, tenant, reportId);
  if (up.received_bytes !== up.total_bytes) {
    throw fail(409, 'AUDIO_INCOMPLETE', 'The recording has not finished uploading', { received_bytes: up.received_bytes });
  }
  const tmp = tmpPath(tenant, up.id);
  const fd = fs.openSync(tmp, 'r');
  const head = Buffer.alloc(12);
  fs.readSync(fd, head, 0, 12, 0);
  fs.closeSync(fd);
  const kind = media.sniffAudio(head);
  if (!kind) {
    fs.rmSync(tmp, { force: true });
    await pool.query('DELETE FROM meeting_audio_uploads WHERE id = ?', [up.id]);
    throw fail(400, 'UNSUPPORTED_TYPE', 'That file is not a recording eSamithi can play. Use an m4a, mp3, aac, wav or ogg file.');
  }
  const name = files.newName(kind.ext);
  files.dir(tenant, ...reportArea(reportId));
  fs.renameSync(tmp, absOf(tenant, reportId, name));
  let old = null;
  await withTx(pool, async (conn) => {
    const d = await loadDraft(conn, reportId, { lock: true });
    old = d.audio_file;
    await conn.query(
      'UPDATE meeting_report_versions SET audio_file = ?, audio_ms = ?, audio_bytes = ?, audio_mime = ? WHERE id = ?',
      [name, up.duration_ms, up.total_bytes, kind.mime, d.id]
    );
    await conn.query('UPDATE meeting_audio_uploads SET completed_at = NOW() WHERE id = ?', [up.id]);
  });
  if (old && old !== name) await removeUnusedVersionFile(pool, tenant, reportId, 'audio_file', old);
  return draftView(pool, tenant, reportId);
}

async function deleteAudio(pool, tenant, actor, reportId) {
  requirePublisher(actor);
  const draft = await loadDraft(pool, reportId);
  const [pending] = await pool.query('SELECT id FROM meeting_audio_uploads WHERE version_id = ? AND completed_at IS NULL', [draft.id]);
  for (const p of pending) fs.rmSync(tmpPath(tenant, p.id), { force: true });
  await pool.query('DELETE FROM meeting_audio_uploads WHERE version_id = ? AND completed_at IS NULL', [draft.id]);
  await pool.query('UPDATE meeting_report_versions SET audio_file = NULL, audio_ms = NULL, audio_bytes = NULL, audio_mime = NULL WHERE id = ?', [draft.id]);
  await removeUnusedVersionFile(pool, tenant, reportId, 'audio_file', draft.audio_file);
  return draftView(pool, tenant, reportId);
}

// ── PDF ─────────────────────────────────────────────────────

// Build the draft's PDF if its pages changed since the last build
async function ensurePdf(pool, tenant, reportId) {
  files.assertReady();
  const draft = await loadDraft(pool, reportId);
  const pages = await pagesOf(pool, draft.id);
  if (pages.length === 0) throw fail(409, 'DRAFT_INCOMPLETE', 'Add at least one page first');
  const hash = media.pagesHash(pages.map((p) => p.file));
  if (draft.pdf_file && draft.pdf_hash === hash) return draft;
  let pdf;
  try {
    pdf = await media.buildPdf(pages.map((p) => absOf(tenant, reportId, p.file)), {
      title: draft.title,
      author: (await societyName(pool)) || undefined,
      subject: `Meeting minutes ${ymd(draft.meeting_date)}`
    });
  } catch (err) {
    console.error('[minutes] PDF build failed:', err.message);
    throw fail(500, 'PDF_FAILED', 'The PDF could not be made. Try again.');
  }
  const name = files.newName('.pdf');
  fs.writeFileSync(absOf(tenant, reportId, name), pdf);
  await pool.query('UPDATE meeting_report_versions SET pdf_file = ?, pdf_hash = ?, pdf_bytes = ? WHERE id = ?', [name, hash, pdf.length, draft.id]);
  await removeUnusedVersionFile(pool, tenant, reportId, 'pdf_file', draft.pdf_file);
  return { ...draft, pdf_file: name, pdf_hash: hash, pdf_bytes: pdf.length };
}

async function previewPdf(pool, tenant, actor, reportId) {
  requirePublisher(actor);
  await ensurePdf(pool, tenant, reportId);
  const view = await draftView(pool, tenant, reportId);
  return { pdf_url: view.pdf_url, pdf_bytes: view.pdf_bytes, page_count: view.page_count };
}

// ── Publish (§7.4) ──────────────────────────────────────────

function noticeText(title, meetingDate, versionNo) {
  return versionNo > 1
    ? { title, body: `සභා වාර්තාව යාවත්කාලීන කෙරිණි (v${versionNo}) · Meeting minutes updated (v${versionNo}) — ${meetingDate}` }
    : { title, body: `සභා වාර්තාව ප්‍රකාශයට පත් කෙරිණි · Meeting minutes published — ${meetingDate}` };
}

async function publish(pool, tenant, actor, reportId, body) {
  requirePublisher(actor);
  const ref = String(body.publish_ref || '');
  if (!UUID.test(ref)) throw fail(400, 'CLIENT_REF_REQUIRED', 'publish_ref must be a UUID');

  const already = async () => {
    const [[v]] = await pool.query('SELECT * FROM meeting_report_versions WHERE publish_ref = ?', [ref]);
    if (!v) return null;
    if (v.report_id !== Number(reportId)) throw fail(409, 'REF_REUSED', 'That publish_ref belongs to another report');
    return { already: true, report_id: v.report_id, version_no: v.version_no, published_at: v.published_at, notified: Boolean(v.notified_at) };
  };
  const prior = await already();
  if (prior) return prior;

  await loadReport(pool, reportId);
  const draft = await loadDraft(pool, reportId);
  if (draft.page_count < 1) throw fail(409, 'DRAFT_INCOMPLETE', 'Add at least one page before publishing');
  const [[{ pending }]] = await pool.query(
    'SELECT COUNT(*) AS pending FROM meeting_audio_uploads WHERE version_id = ? AND completed_at IS NULL AND expires_at > NOW()',
    [draft.id]
  );
  if (Number(pending) > 0) throw fail(409, 'AUDIO_UPLOADING', 'Wait for the recording to finish uploading');
  const [[{ n: published }]] = await pool.query("SELECT COUNT(*) AS n FROM meeting_report_versions WHERE report_id = ? AND state <> 'draft'", [reportId]);
  const isRevision = Number(published) > 0;
  const summary = body.change_summary !== undefined ? readDetails({ change_summary: body.change_summary }, { partial: true }).change_summary : draft.change_summary;
  if (isRevision && !summary) throw fail(400, 'CHANGE_SUMMARY_REQUIRED', 'Say briefly what changed in this version');
  const notify = isRevision ? body.notify === true : true;

  await ensurePdf(pool, tenant, reportId);

  let result;
  try {
    result = await withTx(pool, async (conn) => {
      await loadReport(conn, reportId, { lock: true });
      const [[again]] = await conn.query('SELECT id FROM meeting_report_versions WHERE publish_ref = ?', [ref]);
      if (again) return null;
      const d = await loadDraft(conn, reportId, { lock: true });
      // The PDF must be of exactly these pages (a page may have changed on
      // another device between building it and this transaction)
      const current = media.pagesHash((await pagesOf(conn, d.id)).map((p) => p.file));
      if (d.pdf_hash !== current) throw fail(409, 'DRAFT_CHANGED', 'The pages changed while publishing. Check them and publish again.');
      const [[{ n }]] = await conn.query('SELECT COALESCE(MAX(version_no), 0) AS n FROM meeting_report_versions WHERE report_id = ?', [reportId]);
      const versionNo = Number(n) + 1;
      await conn.query(
        `UPDATE meeting_report_versions SET state = 'published', version_no = ?, published_at = NOW(), publish_ref = ?,
                change_summary = ?, notify = ?, author_member_id = ?, author_user_id = ?, author_name = ?,
                author_position = ?, author_ref = ?, notified_at = ${notify ? 'NOW()' : 'NULL'}
          WHERE id = ?`,
        [versionNo, ref, summary || null, notify ? 1 : 0, actor.memberId || null, actor.userId || null, actor.name, actor.position, actor.ref || null, d.id]
      );
      await conn.query('UPDATE meeting_reports SET current_version_id = ? WHERE id = ?', [d.id, reportId]);
      const text = noticeText(d.title, ymd(d.meeting_date), versionNo);
      if (notify) {
        await conn.query(
          `INSERT INTO announcements (type, title, body, created_by, meeting_report_id, meeting_version_id)
           VALUES ('minutes', ?, ?, ?, ?, ?)`,
          [text.title.slice(0, 255), text.body, actor.userId || null, reportId, d.id]
        );
      }
      const [[v]] = await conn.query('SELECT published_at FROM meeting_report_versions WHERE id = ?', [d.id]);
      return { already: false, report_id: Number(reportId), version_no: versionNo, published_at: v.published_at, notified: notify, text };
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const raced = await already();
      if (raced) return raced;
    }
    throw err;
  }
  if (!result) return already();

  // After commit, once: a push failure never undoes a publication
  if (result.notified) {
    sendPushToAllMembers(pool, {
      title: result.text.title,
      body: result.text.body,
      data: { type: 'minutes', report_id: result.report_id, v: result.version_no, sam: tenant }
    });
  }
  delete result.text;
  return result;
}

async function discardDraft(pool, tenant, actor, reportId) {
  requirePublisher(actor);
  let pageFiles = [];
  let draft;
  await withTx(pool, async (conn) => {
    await loadReport(conn, reportId, { lock: true });
    draft = await loadDraft(conn, reportId, { lock: true });
    pageFiles = (await pagesOf(conn, draft.id)).map((p) => p.file);
    const [pending] = await conn.query('SELECT id FROM meeting_audio_uploads WHERE version_id = ?', [draft.id]);
    for (const p of pending) fs.rmSync(tmpPath(tenant, p.id), { force: true });
    await conn.query('DELETE FROM meeting_audio_uploads WHERE version_id = ?', [draft.id]);
    await conn.query('DELETE FROM meeting_report_pages WHERE version_id = ?', [draft.id]);
    await conn.query('DELETE FROM meeting_report_versions WHERE id = ?', [draft.id]);
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM meeting_report_versions WHERE report_id = ?', [reportId]);
    if (Number(n) === 0) await conn.query('UPDATE meeting_reports SET deleted_at = NOW() WHERE id = ?', [reportId]);
  });
  await removeUnusedPageFiles(pool, tenant, reportId, pageFiles);
  await removeUnusedVersionFile(pool, tenant, reportId, 'pdf_file', draft.pdf_file);
  await removeUnusedVersionFile(pool, tenant, reportId, 'audio_file', draft.audio_file);
  return { success: true };
}

// The Secretary's starting point: drafts, recent reports, comments to answer
async function secretaryHub(pool, actor) {
  requirePublisher(actor);
  const [drafts] = await pool.query(
    `SELECT r.id AS report_id, v.title, DATE_FORMAT(v.meeting_date, '%Y-%m-%d') AS meeting_date, v.page_count,
            v.audio_ms, v.updated_at, (r.current_version_id IS NOT NULL) AS is_revision
       FROM meeting_report_versions v JOIN meeting_reports r ON r.id = v.report_id
      WHERE v.state = 'draft' AND r.deleted_at IS NULL ORDER BY v.updated_at DESC`
  );
  const recent = await browse(pool, actor, {});
  return {
    drafts: drafts.map((d) => ({ ...d, is_revision: Number(d.is_revision) === 1 })),
    published: recent.items.slice(0, 20),
    open_comments: recent.items.reduce((s, r) => s + r.open_comment_count, 0)
  };
}

// ── Withdraw / restore (admin, §7.3) ────────────────────────

async function setWithdrawn(pool, actor, reportId, versionNo, withdraw, reason) {
  if (!actor.canWithdraw) throw fail(403, 'FORBIDDEN', 'Only an administrator can withdraw a version');
  if (withdraw && !(typeof reason === 'string' && reason.trim())) throw fail(400, 'REASON_REQUIRED', 'Give a reason for withdrawing');
  await withTx(pool, async (conn) => {
    await loadReport(conn, reportId, { lock: true });
    const [[v]] = await conn.query('SELECT id, state FROM meeting_report_versions WHERE report_id = ? AND version_no = ? FOR UPDATE', [reportId, Number(versionNo)]);
    if (!v) throw fail(404, 'NOT_FOUND', 'That version does not exist');
    if (withdraw && v.state === 'published') {
      await conn.query(
        "UPDATE meeting_report_versions SET state = 'withdrawn', withdrawn_at = NOW(), withdrawn_by_user_id = ?, withdrawn_reason = ? WHERE id = ?",
        [actor.userId || null, reason.trim().slice(0, 300), v.id]
      );
      await conn.query('UPDATE announcements SET is_active = 0 WHERE meeting_version_id = ?', [v.id]);
    } else if (!withdraw && v.state === 'withdrawn') {
      await conn.query(
        "UPDATE meeting_report_versions SET state = 'published', withdrawn_at = NULL, withdrawn_by_user_id = NULL, withdrawn_reason = NULL WHERE id = ?",
        [v.id]
      );
      await conn.query('UPDATE announcements SET is_active = 1 WHERE meeting_version_id = ?', [v.id]);
    }
    const [[latest]] = await conn.query(
      "SELECT id FROM meeting_report_versions WHERE report_id = ? AND state = 'published' ORDER BY version_no DESC LIMIT 1",
      [reportId]
    );
    await conn.query('UPDATE meeting_reports SET current_version_id = ? WHERE id = ?', [latest ? latest.id : null, reportId]);
  });
  return { success: true };
}

// ── Comments (§8.1.4) ───────────────────────────────────────

async function listComments(pool, actor, reportId) {
  const report = await loadReport(pool, reportId);
  if (!report.current_version_id && !actor.canPublish) throw fail(404, 'NOT_FOUND', 'Meeting minutes not found');
  const [rows] = await pool.query(
    `SELECT c.*, v.version_no, av.version_no AS addressed_in_version_no
       FROM meeting_report_comments c
       JOIN meeting_report_versions v ON v.id = c.version_id
       LEFT JOIN meeting_report_versions av ON av.id = c.addressed_in_version_id
      WHERE c.report_id = ? ORDER BY c.created_at ASC, c.id ASC LIMIT 1000`,
    [reportId]
  );
  return {
    items: rows.map((c) => {
      const hidden = Boolean(c.hidden_at);
      const deleted = Boolean(c.deleted_at);
      const showBody = !deleted && (!hidden || actor.canModerate);
      return {
        id: c.id,
        parent_id: c.parent_id,
        author_name: deleted ? null : c.author_name,
        is_secretary: Number(c.author_is_secretary) === 1,
        is_office: Boolean(c.author_user_id) && Number(c.author_is_secretary) !== 1,
        is_mine: actor.kind === 'member' && c.author_member_id === actor.memberId,
        body: showBody ? c.body : null,
        version_no: c.version_no,
        status: c.status,
        addressed_in_version_no: c.addressed_in_version_no,
        addressed_by_name: c.addressed_by_name,
        created_at: c.created_at,
        hidden,
        hidden_reason: hidden && actor.canModerate ? c.hidden_reason : null,
        hidden_by_name: hidden && actor.canModerate ? c.hidden_by_name : null,
        deleted
      };
    })
  };
}

function readBody(body) {
  const text = typeof body === 'string' ? body.trim() : '';
  if (!text) throw fail(400, 'COMMENT_REQUIRED', 'Write your comment first');
  if (text.length > COMMENT_MAX) throw fail(400, 'COMMENT_TOO_LONG', `A comment can be at most ${COMMENT_MAX} characters`);
  return text;
}

// The Secretary hears about new comments at most once per 30 minutes a report
const lastCommentPush = new Map();
async function notifySecretary(pool, tenant, reportId, authorMemberId) {
  const key = `${tenant}|${reportId}`;
  const now = Date.now();
  if (now - (lastCommentPush.get(key) || 0) < 30 * 60 * 1000) return;
  try {
    const [[sec]] = await pool.query(
      `SELECT u.member_id FROM users u WHERE u.secretary_slot = 1 AND (u.is_active IS NULL OR u.is_active = 1) AND u.member_id IS NOT NULL`
    );
    if (!sec || sec.member_id === authorMemberId) return;
    const [[v]] = await pool.query(
      'SELECT v.title FROM meeting_reports r JOIN meeting_report_versions v ON v.id = r.current_version_id WHERE r.id = ?',
      [reportId]
    );
    lastCommentPush.set(key, now);
    sendPushToMembers(pool, [sec.member_id], {
      title: 'සභා වාර්තාවට අදහසක් · New comment on the minutes',
      body: v ? v.title : '',
      data: { type: 'minutes_comment', report_id: Number(reportId), sam: tenant }
    });
  } catch (err) {
    console.error('[minutes] comment push skipped:', err.message);
  }
}

async function addComment(pool, tenant, actor, reportId, body) {
  if (actor.kind !== 'member') throw fail(403, 'FORBIDDEN', 'Comments come from members in the app');
  const ref = String(body.client_ref || '');
  if (!UUID.test(ref)) throw fail(400, 'CLIENT_REF_REQUIRED', 'client_ref must be a UUID');
  const text = readBody(body.body);
  const report = await loadReport(pool, reportId);
  if (!report.current_version_id) throw fail(404, 'NOT_FOUND', 'Meeting minutes not found');

  const [[dupe]] = await pool.query('SELECT id FROM meeting_report_comments WHERE report_id = ? AND client_ref = ?', [reportId, ref]);
  if (dupe) return { id: dupe.id, already: true };

  let versionId = report.current_version_id;
  if (body.version_no !== undefined && body.version_no !== null) {
    const [[v]] = await pool.query("SELECT id FROM meeting_report_versions WHERE report_id = ? AND version_no = ? AND state = 'published'", [reportId, Number(body.version_no)]);
    if (!v) throw fail(400, 'BAD_VERSION', 'That version is not available');
    versionId = v.id;
  }
  let parentId = null;
  if (body.parent_id !== undefined && body.parent_id !== null) {
    const [[parent]] = await pool.query('SELECT id, parent_id, author_member_id FROM meeting_report_comments WHERE id = ? AND report_id = ?', [Number(body.parent_id), reportId]);
    if (!parent || parent.parent_id) throw fail(400, 'BAD_PARENT', 'You can only reply to a comment, not to a reply');
    if (parent.author_member_id !== actor.memberId && !actor.canPublish) throw fail(403, 'FORBIDDEN', 'You can add to your own comment only');
    parentId = parent.id;
  }
  try {
    const [r] = await pool.query(
      `INSERT INTO meeting_report_comments (report_id, version_id, parent_id, author_member_id, author_name, author_is_secretary, body, client_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reportId, versionId, parentId, actor.memberId, actor.name, actor.canPublish ? 1 : 0, text, ref]
    );
    if (!actor.canPublish) notifySecretary(pool, tenant, reportId, actor.memberId);
    return { id: r.insertId, already: false };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const [[row]] = await pool.query('SELECT id FROM meeting_report_comments WHERE report_id = ? AND client_ref = ?', [reportId, ref]);
      return { id: row.id, already: true };
    }
    throw err;
  }
}

async function loadComment(pool, commentId) {
  const [[c]] = await pool.query('SELECT * FROM meeting_report_comments WHERE id = ?', [Number(commentId)]);
  if (!c) throw fail(404, 'NOT_FOUND', 'Comment not found');
  return c;
}

async function replyToComment(pool, actor, commentId, body) {
  requirePublisher(actor);
  const parent = await loadComment(pool, commentId);
  if (parent.parent_id) throw fail(400, 'BAD_PARENT', 'Reply to the comment, not to a reply');
  const report = await loadReport(pool, parent.report_id);
  const text = readBody(body.body);
  const ref = UUID.test(String(body.client_ref || '')) ? body.client_ref : require('crypto').randomUUID();
  const [[dupe]] = await pool.query('SELECT id FROM meeting_report_comments WHERE report_id = ? AND client_ref = ?', [parent.report_id, ref]);
  if (dupe) return { id: dupe.id, already: true };
  const [r] = await pool.query(
    `INSERT INTO meeting_report_comments (report_id, version_id, parent_id, author_member_id, author_user_id, author_name, author_is_secretary, body, client_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [parent.report_id, report.current_version_id || parent.version_id, parent.id, actor.memberId || null, actor.userId || null,
      actor.name, actor.position === 'secretary' ? 1 : 0, text, ref]
  );
  return { id: r.insertId, already: false };
}

async function setAddressed(pool, tenant, actor, commentId, body) {
  requirePublisher(actor);
  const c = await loadComment(pool, commentId);
  if (c.parent_id) throw fail(400, 'BAD_PARENT', 'Only a comment, not a reply, is marked addressed');
  if (body.status === 'open') {
    await pool.query("UPDATE meeting_report_comments SET status = 'open', addressed_in_version_id = NULL, addressed_at = NULL, addressed_by_name = NULL WHERE id = ?", [c.id]);
    return { success: true };
  }
  const [[cv]] = await pool.query('SELECT version_no FROM meeting_report_versions WHERE id = ?', [c.version_id]);
  const [[v]] = await pool.query(
    "SELECT id, version_no FROM meeting_report_versions WHERE report_id = ? AND version_no = ? AND state = 'published'",
    [c.report_id, Number(body.version_no)]
  );
  if (!v || (cv && v.version_no < cv.version_no)) throw fail(400, 'BAD_VERSION', 'Choose a published version at or after the one the comment was made on');
  await pool.query(
    "UPDATE meeting_report_comments SET status = 'addressed', addressed_in_version_id = ?, addressed_at = NOW(), addressed_by_name = ? WHERE id = ?",
    [v.id, actor.name, c.id]
  );
  if (c.author_member_id && c.author_member_id !== actor.memberId && c.status !== 'addressed') {
    sendPushToMembers(pool, [c.author_member_id], {
      title: `ඔබේ නිවැරදි කිරීම v${v.version_no} හි සලකා බැලිණි · Your correction was addressed in v${v.version_no}`,
      body: c.body.slice(0, 120),
      data: { type: 'minutes_comment', report_id: c.report_id, comment_id: c.id, sam: tenant }
    });
  }
  return { success: true };
}

async function setHidden(pool, actor, commentId, hide, reason) {
  if (!actor.canModerate && !actor.canPublish) throw fail(403, 'FORBIDDEN', 'You cannot moderate comments');
  const c = await loadComment(pool, commentId);
  if (hide) {
    const why = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';
    if (!why) throw fail(400, 'REASON_REQUIRED', 'Give a reason for hiding the comment');
    await pool.query('UPDATE meeting_report_comments SET hidden_at = NOW(), hidden_by_name = ?, hidden_reason = ? WHERE id = ?', [actor.name, why, c.id]);
  } else {
    await pool.query('UPDATE meeting_report_comments SET hidden_at = NULL, hidden_by_name = NULL, hidden_reason = NULL WHERE id = ?', [c.id]);
  }
  return { success: true };
}

// A member removes their own comment within 15 minutes (OD3)
async function deleteOwnComment(pool, actor, commentId) {
  const c = await loadComment(pool, commentId);
  if (actor.kind !== 'member' || c.author_member_id !== actor.memberId) throw fail(403, 'FORBIDDEN', 'You can remove only your own comment');
  if (c.deleted_at) return { success: true };
  const ageMs = Date.now() - new Date(c.created_at).getTime();
  if (ageMs > DELETE_OWN_MINUTES * 60 * 1000) throw fail(403, 'TOO_LATE', `A comment can be removed only within ${DELETE_OWN_MINUTES} minutes`);
  await pool.query('UPDATE meeting_report_comments SET deleted_at = NOW() WHERE id = ?', [c.id]);
  return { success: true };
}

// A member reports an abusive comment: it reaches the office as a concern
// (the same channel as Puruka and child-safety reports)
async function reportComment(pool, actor, commentId) {
  if (actor.kind !== 'member') throw fail(403, 'FORBIDDEN', 'Reports come from members in the app');
  const c = await loadComment(pool, commentId);
  const [[v]] = await pool.query(
    'SELECT v.title FROM meeting_reports r LEFT JOIN meeting_report_versions v ON v.id = r.current_version_id WHERE r.id = ?',
    [c.report_id]
  );
  const message = `Reported comment #${c.id} on meeting minutes "${v && v.title ? v.title : `#${c.report_id}`}" (report ${c.report_id}) by ${c.author_name}: ${c.body.slice(0, 400)}`;
  await pool.query("INSERT INTO member_requests (member_id, type, purpose, message) VALUES (?, 'concern', 'content', ?)", [actor.memberId, message]);
  return { success: true };
}

// ── Housekeeping (12-hour loop) ─────────────────────────────

async function sweep(pool, tenant) {
  const [expired] = await pool.query('SELECT id FROM meeting_audio_uploads WHERE completed_at IS NULL AND expires_at < NOW()');
  for (const up of expired) {
    try { fs.rmSync(tmpPath(tenant, up.id), { force: true }); } catch { /* ignore */ }
  }
  if (expired.length) await pool.query('DELETE FROM meeting_audio_uploads WHERE completed_at IS NULL AND expires_at < NOW()');
  await pool.query('DELETE FROM meeting_audio_uploads WHERE completed_at IS NOT NULL AND completed_at < DATE_SUB(NOW(), INTERVAL 7 DAY)');
  return expired.length;
}

module.exports = {
  MAX_PAGES,
  browse,
  getReport,
  draftView,
  createReport,
  startRevision,
  updateDraft,
  addPage,
  reorderPages,
  rotatePage,
  deletePage,
  initAudio,
  audioChunk,
  completeAudio,
  deleteAudio,
  previewPdf,
  publish,
  discardDraft,
  secretaryHub,
  setWithdrawn,
  listComments,
  addComment,
  replyToComment,
  setAddressed,
  setHidden,
  deleteOwnComment,
  reportComment,
  sweep
};
