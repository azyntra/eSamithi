const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Staff management for Puruka: view/filter all posts, review reports,
// deactivate/reactivate posts, and manage the category list. No per-post
// pre-approval in v1 (requirement P7.2).
const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/puruka-admin?status=&category=&q=&reported=1 — all posts
router.get('/', async (req, res, next) => {
  try {
    const params = [];
    const conds = [];
    if (req.query.reported === '1') conds.push('p.report_count > 0');
    if (req.query.status) { conds.push('p.status = ?'); params.push(req.query.status); }
    const categoryId = parseInt(req.query.category);
    if (Number.isFinite(categoryId)) { conds.push('p.category_id = ?'); params.push(categoryId); }
    if (req.query.q) {
      conds.push('(p.title LIKE ? OR m.full_name LIKE ? OR m.society_id LIKE ?)');
      const like = `%${req.query.q}%`;
      params.push(like, like, like);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const [rows] = await getPool().query(`
      SELECT p.id, p.title, p.price, p.negotiable, p.location, p.status, p.report_count,
             p.created_at, p.expires_at,
             c.label_en AS category_label, c.id AS category_id,
             m.full_name AS seller_name, m.society_id AS seller_society_id, m.phone AS seller_phone,
             (SELECT GROUP_CONCAT(CONCAT(rm.full_name, ': ', COALESCE(r.reason, '-')) SEPARATOR ' | ')
              FROM puruka_reports r JOIN members rm ON rm.id = r.member_id
              WHERE r.post_id = p.id) AS report_reasons
      FROM puruka_posts p
      JOIN puruka_categories c ON c.id = p.category_id
      JOIN members m ON m.id = p.member_id
      ${where}
      ORDER BY p.report_count DESC, p.created_at DESC
      LIMIT 300
    `, params);
    res.json(rows.map(r => ({ ...r, price: r.price === null ? null : Number(r.price) })));
  } catch (err) { next(err); }
});

// PATCH /api/v1/puruka-admin/:id/deactivate — admin takedown
router.patch('/:id/deactivate', async (req, res, next) => {
  try {
    const [result] = await getPool().query(
      "UPDATE puruka_posts SET status = 'Removed' WHERE id = ?", [parseInt(req.params.id)]
    );
    if (result.affectedRows === 0) throw Object.assign(new Error('Post not found'), { statusCode: 404 });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/v1/puruka-admin/:id/reactivate — undo a takedown
router.patch('/:id/reactivate', async (req, res, next) => {
  try {
    const [result] = await getPool().query(
      "UPDATE puruka_posts SET status = 'Active' WHERE id = ? AND status = 'Removed'",
      [parseInt(req.params.id)]
    );
    if (result.affectedRows === 0) throw Object.assign(new Error('Post not found'), { statusCode: 404 });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Category management ────────────────────────────────────────
// GET /api/v1/puruka-admin/categories — all, including disabled
router.get('/categories', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM puruka_categories ORDER BY sort_order ASC, id ASC'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/v1/puruka-admin/categories — add a category
router.post('/categories', async (req, res, next) => {
  try {
    const { code, label_en, label_si } = req.body;
    if (!code || !/^[a-z0-9_-]{2,30}$/.test(code)) {
      throw Object.assign(new Error('Code must be 2-30 chars: a-z, 0-9, -, _'), { statusCode: 400 });
    }
    if (!label_en || !label_si) {
      throw Object.assign(new Error('Both English and Sinhala labels are required'), { statusCode: 400 });
    }
    const [[{ maxOrder }]] = await getPool().query(
      'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM puruka_categories'
    );
    const [result] = await getPool().query(
      'INSERT INTO puruka_categories (code, label_en, label_si, sort_order) VALUES (?, ?, ?, ?)',
      [code, label_en, label_si, maxOrder + 1]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return next(Object.assign(new Error('A category with this code already exists'), { statusCode: 400 }));
    }
    next(err);
  }
});

// PATCH /api/v1/puruka-admin/categories/:id — rename / enable / disable
router.patch('/categories/:id', async (req, res, next) => {
  try {
    const { label_en, label_si, is_active } = req.body;
    const [result] = await getPool().query(
      'UPDATE puruka_categories SET label_en = COALESCE(?, label_en), label_si = COALESCE(?, label_si), is_active = COALESCE(?, is_active) WHERE id = ?',
      [label_en ?? null, label_si ?? null, is_active === undefined ? null : (is_active ? 1 : 0), parseInt(req.params.id)]
    );
    if (result.affectedRows === 0) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
