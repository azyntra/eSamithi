const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { sendPushToAllMembers } = require('../lib/push');

// Staff-authored notices (death / meeting / general) shown in the member
// app's Notices tab. Viewers are read-only via authMiddleware's method guard.
const router = express.Router();
router.use(authMiddleware);

const TYPES = ['death', 'meeting', 'general'];

function validate(d) {
  if (!TYPES.includes(d.type)) throw Object.assign(new Error('Invalid announcement type'), { statusCode: 400 });
  if (!d.title || !String(d.title).trim()) throw Object.assign(new Error('Title is required'), { statusCode: 400 });
  if (d.type === 'death' && (!d.deceased_name || !String(d.deceased_name).trim())) {
    throw Object.assign(new Error('The deceased person\'s name is required for a death notice'), { statusCode: 400 });
  }
  if (d.type === 'meeting' && !d.event_date) {
    throw Object.assign(new Error('The meeting date is required'), { statusCode: 400 });
  }
}

// GET /api/v1/announcements — staff sees everything, inactive included
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(`
      SELECT a.*, m.full_name as deceased_member_name
      FROM announcements a
      LEFT JOIN members m ON a.deceased_member_id = m.id
      ORDER BY a.created_at DESC, a.id DESC
    `);
    res.json(rows.map(r => ({ ...r, is_active: Number(r.is_active) })));
  } catch (err) { next(err); }
});

// POST /api/v1/announcements — create + notify all app members
router.post('/', async (req, res, next) => {
  try {
    const d = req.body;
    validate(d);

    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO announcements (type, title, body, deceased_name, deceased_member_id, funeral_date, funeral_location, event_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.type, String(d.title).trim(), d.body || null,
        d.deceased_name || null, d.deceased_member_id || null,
        d.funeral_date || null, d.funeral_location || null,
        d.event_date || null, req.user.id
      ]
    );

    // Fire-and-forget: never let a push hiccup fail the create
    sendPushToAllMembers(pool, {
      title: String(d.title).trim(),
      body: d.type === 'death'
        ? [d.deceased_name, d.funeral_date, d.funeral_location].filter(Boolean).join(' · ')
        : (d.body || ''),
      data: { type: 'announcement', id: result.insertId }
    });

    res.json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

// PUT /api/v1/announcements/:id
router.put('/:id', async (req, res, next) => {
  try {
    const d = req.body;
    validate(d);
    await getPool().query(
      `UPDATE announcements SET type=?, title=?, body=?, deceased_name=?, deceased_member_id=?, funeral_date=?, funeral_location=?, event_date=?
       WHERE id=?`,
      [
        d.type, String(d.title).trim(), d.body || null,
        d.deceased_name || null, d.deceased_member_id || null,
        d.funeral_date || null, d.funeral_location || null,
        d.event_date || null, parseInt(req.params.id)
      ]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/v1/announcements/:id/toggle — hide/show in the member app
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    await getPool().query('UPDATE announcements SET is_active = 1 - is_active WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/announcements/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await getPool().query('DELETE FROM announcements WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
