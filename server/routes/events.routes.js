const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Attendance register: staff create an event (meeting/funeral/other) and scan
// members' membership-card QR codes (payload = society_id) to mark presence.
//
// Two ways to record an event, chosen per event via attendance_mode:
//   'present' — mark who came; everyone else counts as absent (the original)
//   'absent'  — mark who did NOT come; everyone else counts as present, which
//               is far less work for a well-attended meeting
// event_attendance always holds the *marked* members; the mode decides whether
// being marked means present or absent.
const router = express.Router();
router.use(authMiddleware);

const EVENT_TYPES = ['meeting', 'funeral', 'other'];
const MODES = ['present', 'absent'];

// GET /api/v1/events — newest first. attendee_count always means "present",
// so the list reads the same whichever way the event was recorded.
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(`
      SELECT e.*,
        CASE WHEN e.attendance_mode = 'absent'
             THEN (SELECT COUNT(*) FROM members WHERE is_active = 1)
                  - COALESCE(SUM(CASE WHEN m.is_active = 1 THEN 1 ELSE 0 END), 0)
             ELSE COUNT(a.id)
        END AS attendee_count
      FROM society_events e
      LEFT JOIN event_attendance a ON a.event_id = e.id
      LEFT JOIN members m ON m.id = a.member_id
      GROUP BY e.id
      ORDER BY e.event_date DESC, e.id DESC
    `);
    res.json(rows.map(r => ({ ...r, attendee_count: Math.max(0, Number(r.attendee_count)) })));
  } catch (err) { next(err); }
});

// POST /api/v1/events — { type, title, event_date, attendance_mode? }
router.post('/', async (req, res, next) => {
  try {
    const { type, title, event_date } = req.body;
    const mode = req.body.attendance_mode || 'present';
    if (!EVENT_TYPES.includes(type)) {
      throw Object.assign(new Error('Invalid event type'), { statusCode: 400 });
    }
    if (!MODES.includes(mode)) {
      throw Object.assign(new Error('Invalid attendance mode'), { statusCode: 400 });
    }
    if (!title || !String(title).trim()) {
      throw Object.assign(new Error('Title is required'), { statusCode: 400 });
    }
    if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
      throw Object.assign(new Error('Valid event date is required'), { statusCode: 400 });
    }
    const [result] = await getPool().query(
      'INSERT INTO society_events (type, title, event_date, attendance_mode, created_by) VALUES (?, ?, ?, ?, ?)',
      [type, String(title).trim(), event_date, mode, req.user.id]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

// PATCH /api/v1/events/:id — switch how this event is recorded.
// Marks are cleared: "not yet marked" means the opposite thing in each mode,
// so carrying the rows over would silently invent attendance data.
router.patch('/:id', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    const eventId = parseInt(req.params.id);
    const mode = req.body.attendance_mode;
    if (!MODES.includes(mode)) {
      throw Object.assign(new Error('Invalid attendance mode'), { statusCode: 400 });
    }
    await conn.beginTransaction();
    const [[event]] = await conn.query(
      'SELECT id, attendance_mode FROM society_events WHERE id = ? FOR UPDATE', [eventId]
    );
    if (!event) throw Object.assign(new Error('Event not found'), { statusCode: 404 });

    let cleared = 0;
    if (event.attendance_mode !== mode) {
      const [del] = await conn.query('DELETE FROM event_attendance WHERE event_id = ?', [eventId]);
      cleared = del.affectedRows;
      await conn.query('UPDATE society_events SET attendance_mode = ? WHERE id = ?', [mode, eventId]);
    }
    await conn.commit();
    res.json({ success: true, attendance_mode: mode, cleared });
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
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

// GET /api/v1/events/:id/attendance — event + present list + absentee list.
// Both lists carry the same columns; marked_at is null for the members the
// mode derives (never individually marked), which is also how the UI knows
// which side is editable.
router.get('/:id/attendance', async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.id);
    const pool = getPool();
    const [[event]] = await pool.query('SELECT * FROM society_events WHERE id = ?', [eventId]);
    if (!event) throw Object.assign(new Error('Event not found'), { statusCode: 404 });

    const [marked] = await pool.query(`
      SELECT a.member_id, a.marked_at, m.society_id, m.full_name, m.nic, m.phone
      FROM event_attendance a
      JOIN members m ON m.id = a.member_id
      WHERE a.event_id = ?
      ORDER BY a.marked_at DESC, a.id DESC
    `, [eventId]);

    const [unmarked] = await pool.query(`
      SELECT m.id AS member_id, NULL AS marked_at, m.society_id, m.full_name, m.nic, m.phone
      FROM members m
      WHERE m.is_active = 1
        AND m.id NOT IN (SELECT member_id FROM event_attendance WHERE event_id = ?)
      ORDER BY m.society_id ASC
    `, [eventId]);

    const byAbsence = event.attendance_mode === 'absent';
    res.json({
      event,
      present: byAbsence ? unmarked : marked,
      absent: byAbsence ? marked : unmarked
    });
  } catch (err) { next(err); }
});

// POST /api/v1/events/:id/attendance — mark a member. { society_id } comes
// from a card scan; { member_id } from picking a name off the list (an
// absentee is not there to scan their own card).
router.post('/:id/attendance', async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.id);
    const societyId = String(req.body.society_id || '').trim();
    const memberId = req.body.member_id ? parseInt(req.body.member_id) : null;
    if (!societyId && !memberId) {
      throw Object.assign(new Error('society_id or member_id is required'), { statusCode: 400 });
    }

    const pool = getPool();
    const [[event]] = await pool.query('SELECT id FROM society_events WHERE id = ?', [eventId]);
    if (!event) throw Object.assign(new Error('Event not found'), { statusCode: 404 });

    const [[member]] = memberId
      ? await pool.query('SELECT id, society_id, full_name, is_active FROM members WHERE id = ?', [memberId])
      : await pool.query(
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
