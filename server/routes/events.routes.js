const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Attendance register: staff create an event (meeting/funeral/other) and scan
// members' membership-card QR codes (payload = society_id) to mark presence.
const router = express.Router();
router.use(authMiddleware);

const EVENT_TYPES = ['meeting', 'funeral', 'other'];

// GET /api/v1/events — newest first, with attendee counts
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(`
      SELECT e.*, COUNT(a.id) AS attendee_count
      FROM society_events e
      LEFT JOIN event_attendance a ON a.event_id = e.id
      GROUP BY e.id
      ORDER BY e.event_date DESC, e.id DESC
    `);
    res.json(rows.map(r => ({ ...r, attendee_count: Number(r.attendee_count) })));
  } catch (err) { next(err); }
});

// POST /api/v1/events — { type, title, event_date }
router.post('/', async (req, res, next) => {
  try {
    const { type, title, event_date } = req.body;
    if (!EVENT_TYPES.includes(type)) {
      throw Object.assign(new Error('Invalid event type'), { statusCode: 400 });
    }
    if (!title || !String(title).trim()) {
      throw Object.assign(new Error('Title is required'), { statusCode: 400 });
    }
    if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
      throw Object.assign(new Error('Valid event date is required'), { statusCode: 400 });
    }
    const [result] = await getPool().query(
      'INSERT INTO society_events (type, title, event_date, created_by) VALUES (?, ?, ?, ?)',
      [type, String(title).trim(), event_date, req.user.id]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

// DELETE /api/v1/events/:id — removes its attendance rows too (FK cascade)
router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await getPool().query(
      'DELETE FROM society_events WHERE id = ?', [parseInt(req.params.id)]
    );
    if (result.affectedRows === 0) throw Object.assign(new Error('Event not found'), { statusCode: 404 });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/v1/events/:id/attendance — event + present list + absentee list
router.get('/:id/attendance', async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.id);
    const pool = getPool();
    const [[event]] = await pool.query('SELECT * FROM society_events WHERE id = ?', [eventId]);
    if (!event) throw Object.assign(new Error('Event not found'), { statusCode: 404 });

    const [present] = await pool.query(`
      SELECT a.member_id, a.marked_at, m.society_id, m.full_name, m.nic
      FROM event_attendance a
      JOIN members m ON m.id = a.member_id
      WHERE a.event_id = ?
      ORDER BY a.marked_at DESC, a.id DESC
    `, [eventId]);

    // Absentees = active members not yet marked for this event
    const [absent] = await pool.query(`
      SELECT m.id AS member_id, m.society_id, m.full_name, m.phone
      FROM members m
      WHERE m.is_active = 1
        AND m.id NOT IN (SELECT member_id FROM event_attendance WHERE event_id = ?)
      ORDER BY m.society_id ASC
    `, [eventId]);

    res.json({ event, present, absent });
  } catch (err) { next(err); }
});

// POST /api/v1/events/:id/attendance — { society_id } from a card scan
router.post('/:id/attendance', async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.id);
    const societyId = String(req.body.society_id || '').trim();
    if (!societyId) throw Object.assign(new Error('society_id is required'), { statusCode: 400 });

    const pool = getPool();
    const [[event]] = await pool.query('SELECT id FROM society_events WHERE id = ?', [eventId]);
    if (!event) throw Object.assign(new Error('Event not found'), { statusCode: 404 });

    const [[member]] = await pool.query(
      'SELECT id, society_id, full_name, is_active FROM members WHERE LOWER(society_id) = LOWER(?)',
      [societyId]
    );
    if (!member) throw Object.assign(new Error('Member not found'), { statusCode: 404 });

    const [result] = await pool.query(
      'INSERT IGNORE INTO event_attendance (event_id, member_id, marked_by) VALUES (?, ?, ?)',
      [eventId, member.id, req.user.id]
    );
    res.json({ success: true, member, already: result.affectedRows === 0 });
  } catch (err) { next(err); }
});

// DELETE /api/v1/events/:id/attendance/:memberId — undo a mistaken scan
router.delete('/:id/attendance/:memberId', async (req, res, next) => {
  try {
    const [result] = await getPool().query(
      'DELETE FROM event_attendance WHERE event_id = ? AND member_id = ?',
      [parseInt(req.params.id), parseInt(req.params.memberId)]
    );
    if (result.affectedRows === 0) throw Object.assign(new Error('Attendance row not found'), { statusCode: 404 });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
