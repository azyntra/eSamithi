const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { getPool } = require('../db');
const { memberAuthMiddleware } = require('../middleware/memberAuth');

// Puruka (පුරුක) — community exchange platform. Members post goods/services/
// food/farming items with up to 3 photos; buyers call/WhatsApp and settle
// face-to-face. No pre-approval — post-moderation via reports
// (purukaAdmin.routes.js). Statuses: Active|Sold|Inactive|Removed|Deleted;
// nothing is hard-deleted.
const router = express.Router();
router.use(memberAuthMiddleware);

const MAX_ACTIVE_PER_MEMBER = 5;
const SOLD_VISIBLE_DAYS = 7;
const PAGE_SIZE = 20;

// Photos live under uploads/<tenant>/puruka/ so each samithi's files can be
// backed up, restored, or moved on their own.
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

function tenantUploadDir(tenant) {
  const dir = path.join(UPLOADS_ROOT, tenant, 'puruka');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => cb(null, tenantUploadDir(req.tenant)),
    filename: (_req, file, cb) => {
      cb(null, crypto.randomBytes(16).toString('hex') + (EXT_BY_MIME[file.mimetype] || '.jpg'));
    }
  }),
  fileFilter: (_req, file, cb) => cb(null, Boolean(EXT_BY_MIME[file.mimetype])),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 }
});

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

// Post lifetime is configurable from the desktop admin (settings table)
async function getExpiryDays(pool) {
  try {
    const [[row]] = await pool.query("SELECT `value` FROM settings WHERE `key` = 'puruka_expiry_days'");
    const days = row ? parseInt(row.value) : NaN;
    return Number.isFinite(days) && days > 0 ? days : 30;
  } catch {
    return 30;
  }
}

// Expired Active posts drop to Inactive before any read (no cron needed).
// They stay renewable by the owner forever (requirement P9.3).
async function sweepExpired(pool) {
  await pool.query("UPDATE puruka_posts SET status = 'Inactive' WHERE status = 'Active' AND expires_at < CURDATE()");
}

async function attachPhotos(pool, posts, tenant) {
  if (posts.length === 0) return posts;
  const ids = posts.map(p => p.id);
  const [photos] = await pool.query(
    'SELECT post_id, filename, sort_order FROM puruka_photos WHERE post_id IN (?) ORDER BY sort_order ASC',
    [ids]
  );
  const byPost = new Map();
  for (const p of photos) {
    if (!byPost.has(p.post_id)) byPost.set(p.post_id, []);
    byPost.get(p.post_id).push(`/api/v1/uploads/${tenant}/puruka/${p.filename}`);
  }
  return posts.map(p => ({ ...p, photos: byPost.get(p.id) || [] }));
}

function serialize(row) {
  return { ...row, price: row.price === null ? null : Number(row.price) };
}

// GET /api/v1/puruka/categories — active categories for the post form/filters
router.get('/categories', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(
      'SELECT id, code, label_en, label_si FROM puruka_categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/v1/puruka?category=&q=&location=&min_price=&max_price=&avail=&page=
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    await sweepExpired(pool);

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const params = [];
    let where;
    if (req.query.avail === 'available') {
      where = "WHERE p.status = 'Active'";
    } else if (req.query.avail === 'sold') {
      where = "WHERE p.status = 'Sold'";
    } else {
      where = "WHERE (p.status = 'Active' OR (p.status = 'Sold' AND p.sold_at >= DATE_SUB(NOW(), INTERVAL ? DAY)))";
      params.push(SOLD_VISIBLE_DAYS);
    }
    const categoryId = parseInt(req.query.category);
    if (Number.isFinite(categoryId)) {
      where += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    if (req.query.q) {
      where += ' AND (p.title LIKE ? OR p.description LIKE ?)';
      const like = `%${req.query.q}%`;
      params.push(like, like);
    }
    if (req.query.location) {
      where += ' AND p.location LIKE ?';
      params.push(`%${req.query.location}%`);
    }
    const minPrice = parseInt(req.query.min_price);
    if (Number.isFinite(minPrice)) { where += ' AND p.price >= ?'; params.push(minPrice); }
    const maxPrice = parseInt(req.query.max_price);
    if (Number.isFinite(maxPrice)) { where += ' AND p.price <= ?'; params.push(maxPrice); }

    const [rows] = await pool.query(`
      SELECT p.id, p.member_id, p.category_id, p.title, p.description, p.price, p.negotiable,
             p.phone, p.location, p.status, p.created_at,
             c.code AS category_code, c.label_en AS category_en, c.label_si AS category_si,
             m.full_name AS seller_name, m.date_of_joining AS seller_since
      FROM puruka_posts p
      JOIN puruka_categories c ON c.id = p.category_id
      JOIN members m ON m.id = p.member_id
      ${where}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `, [...params, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE]);

    const hasMore = rows.length > PAGE_SIZE;
    const items = await attachPhotos(pool, rows.slice(0, PAGE_SIZE).map(serialize), req.tenant);
    res.json({ items, page, has_more: hasMore });
  } catch (err) { next(err); }
});

// GET /api/v1/puruka/mine — own posts (soft-deleted ones stay hidden)
router.get('/mine', async (req, res, next) => {
  try {
    const pool = getPool();
    await sweepExpired(pool);
    const [rows] = await pool.query(`
      SELECT p.*, c.code AS category_code, c.label_en AS category_en, c.label_si AS category_si
      FROM puruka_posts p
      JOIN puruka_categories c ON c.id = p.category_id
      WHERE p.member_id = ? AND p.status != 'Deleted'
      ORDER BY p.created_at DESC, p.id DESC
    `, [req.member.id]);
    res.json(await attachPhotos(pool, rows.map(serialize), req.tenant));
  } catch (err) { next(err); }
});

// GET /api/v1/puruka/:id — detail (owner can see any status except Deleted)
router.get('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const [[row]] = await pool.query(`
      SELECT p.*, c.code AS category_code, c.label_en AS category_en, c.label_si AS category_si,
             m.full_name AS seller_name, m.date_of_joining AS seller_since
      FROM puruka_posts p
      JOIN puruka_categories c ON c.id = p.category_id
      JOIN members m ON m.id = p.member_id
      WHERE p.id = ?
    `, [parseInt(req.params.id)]);

    const isOwner = row && row.member_id === req.member.id;
    const publiclyVisible = row && (row.status === 'Active' || row.status === 'Sold');
    if (!row || row.status === 'Deleted' || (!publiclyVisible && !isOwner)) {
      throw httpError('Post not found', 404);
    }

    const [withPhotos] = await attachPhotos(pool, [serialize(row)], req.tenant);
    res.json({ ...withPhotos, is_owner: isOwner });
  } catch (err) { next(err); }
});

// POST /api/v1/puruka — create (multipart: fields + up to 3 `photos`)
router.post('/', upload.array('photos', 3), async (req, res, next) => {
  try {
    const pool = getPool();
    const { title, description, phone, location } = req.body;
    const categoryId = parseInt(req.body.category_id);
    const negotiable = req.body.negotiable === '1' || req.body.negotiable === 'true' ? 1 : 0;
    const price = req.body.price ? parseInt(req.body.price) : null;

    if (!title || !String(title).trim()) throw httpError('Title is required', 400);
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw httpError('Invalid price', 400);
    if (price === null && !negotiable) throw httpError('Set a price or mark as negotiable', 400);

    const [[cat]] = await pool.query('SELECT id FROM puruka_categories WHERE id = ? AND is_active = 1', [categoryId]);
    if (!cat) throw httpError('Invalid category', 400);

    const [[member]] = await pool.query('SELECT is_active FROM members WHERE id = ?', [req.member.id]);
    if (!member || member.is_active !== 1) throw httpError('Only active members can post', 403);

    const [[{ activeCount }]] = await pool.query(
      "SELECT COUNT(*) AS activeCount FROM puruka_posts WHERE member_id = ? AND status = 'Active'",
      [req.member.id]
    );
    if (activeCount >= MAX_ACTIVE_PER_MEMBER) {
      throw httpError(`You can have at most ${MAX_ACTIVE_PER_MEMBER} active posts`, 400);
    }

    const expiryDays = await getExpiryDays(pool);
    const [result] = await pool.query(`
      INSERT INTO puruka_posts
        (member_id, category_id, title, description, price, negotiable, phone, location, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY))
    `, [req.member.id, categoryId, String(title).trim(), description || null, price, negotiable,
        phone || null, location || null, expiryDays]);

    const files = req.files || [];
    for (let i = 0; i < files.length; i++) {
      await pool.query(
        'INSERT INTO puruka_photos (post_id, filename, sort_order) VALUES (?, ?, ?)',
        [result.insertId, files[i].filename, i]
      );
    }
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    // Creation failed after upload: don't leave orphan files on disk
    for (const f of req.files || []) fs.unlink(f.path, () => {});
    next(err);
  }
});

// PATCH /api/v1/puruka/:id — owner: edit fields, or {action:'sold'|'available'|'renew'|'deactivate'}
router.patch('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const id = parseInt(req.params.id);
    const [[row]] = await pool.query("SELECT * FROM puruka_posts WHERE id = ? AND status != 'Deleted'", [id]);
    if (!row || row.member_id !== req.member.id) throw httpError('Post not found', 404);

    const action = req.body.action;
    if (action === 'sold') {
      await pool.query("UPDATE puruka_posts SET status = 'Sold', sold_at = NOW() WHERE id = ?", [id]);
    } else if (action === 'available' || action === 'renew') {
      const expiryDays = await getExpiryDays(pool);
      await pool.query(
        "UPDATE puruka_posts SET status = 'Active', sold_at = NULL, expiry_notified = 0, expires_at = DATE_ADD(CURDATE(), INTERVAL ? DAY) WHERE id = ?",
        [expiryDays, id]
      );
    } else if (action === 'deactivate') {
      await pool.query("UPDATE puruka_posts SET status = 'Inactive' WHERE id = ?", [id]);
    } else {
      const { title, description, phone, location } = req.body;
      const categoryId = parseInt(req.body.category_id);
      const negotiable = req.body.negotiable ? 1 : 0;
      const price = req.body.price === null || req.body.price === undefined || req.body.price === '' ? null : parseInt(req.body.price);
      if (!title || !String(title).trim()) throw httpError('Title is required', 400);
      if (price !== null && (!Number.isFinite(price) || price < 0)) throw httpError('Invalid price', 400);
      if (price === null && !negotiable) throw httpError('Set a price or mark as negotiable', 400);
      const [[cat]] = await pool.query('SELECT id FROM puruka_categories WHERE id = ? AND is_active = 1', [categoryId]);
      if (!cat) throw httpError('Invalid category', 400);
      await pool.query(`
        UPDATE puruka_posts
        SET title = ?, category_id = ?, description = ?, price = ?, negotiable = ?, phone = ?, location = ?
        WHERE id = ?
      `, [String(title).trim(), categoryId, description || null, price, negotiable, phone || null, location || null, id]);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/puruka/:id — owner soft-delete (photos stay on disk; nothing hard-deleted)
router.delete('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const id = parseInt(req.params.id);
    const [[row]] = await pool.query("SELECT member_id FROM puruka_posts WHERE id = ? AND status != 'Deleted'", [id]);
    if (!row || row.member_id !== req.member.id) throw httpError('Post not found', 404);
    await pool.query("UPDATE puruka_posts SET status = 'Deleted' WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/v1/puruka/:id/report — one report per member per post
router.post('/:id/report', async (req, res, next) => {
  try {
    const pool = getPool();
    const id = parseInt(req.params.id);
    const [[row]] = await pool.query(
      "SELECT id FROM puruka_posts WHERE id = ? AND status IN ('Active', 'Sold')", [id]
    );
    if (!row) throw httpError('Post not found', 404);

    const [result] = await pool.query(
      'INSERT IGNORE INTO puruka_reports (post_id, member_id, reason) VALUES (?, ?, ?)',
      [id, req.member.id, String(req.body.reason || '').slice(0, 255) || null]
    );
    if (result.affectedRows > 0) {
      await pool.query('UPDATE puruka_posts SET report_count = report_count + 1 WHERE id = ?', [id]);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
