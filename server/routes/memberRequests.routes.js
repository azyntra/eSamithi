const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Staff review queue for member-submitted requests (loan / correction).
// Members create these via POST /api/v1/me/requests.
const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/member-requests?status=Pending
router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status;
    const params = [];
    let where = '';
    if (status) { where = 'WHERE r.status = ?'; params.push(status); }

    const [rows] = await getPool().query(`
      SELECT r.*, m.full_name as member_name, m.society_id as member_society_id, m.phone as member_phone
      FROM member_requests r
      JOIN members m ON r.member_id = m.id
      ${where}
      ORDER BY r.created_at DESC, r.id DESC
    `, params);
    res.json(rows.map(r => ({ ...r, amount: r.amount === null ? null : Number(r.amount) })));
  } catch (err) { next(err); }
});

// PATCH /api/v1/member-requests/:id — review decision
router.patch('/:id', async (req, res, next) => {
  try {
    const { status, staff_note } = req.body;
    if (!['Approved', 'Rejected', 'Done'].includes(status)) {
      throw Object.assign(new Error('Invalid status'), { statusCode: 400 });
    }
    const [result] = await getPool().query(
      `UPDATE member_requests SET status = ?, staff_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [status, staff_note || null, req.user.id, parseInt(req.params.id)]
    );
    if (result.affectedRows === 0) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
