const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const attendance = require('../lib/attendance');

// Attendance register: staff create an event (meeting/funeral/other) and scan
// members' membership-card QR codes (payload = society_id) to mark presence.
//
// Two ways to record an event, chosen per event via attendance_mode:
//   'present' — mark who came; everyone else counts as absent (the original)
//   'absent'  — mark who did NOT come; everyone else counts as present, which
//               is far less work for a well-attended meeting
// event_attendance always holds the *marked* members; the mode decides whether
// being marked means present or absent.
//
// The rules themselves live in lib/attendance.js, shared with the member
// app's staff routes (routes/meAttendance.routes.js).
const router = express.Router();
router.use(authMiddleware);

const { MODES } = attendance;

// The office is whoever is signed in; impersonated support sessions carry
// id 0, which is stored as "no office user" rather than a dangling id.
const actor = (req) => ({ userId: req.user.id || null });

// GET /api/v1/events — newest first. attendee_count always means "present",
// so the list reads the same whichever way the event was recorded.
router.get('/', async (_req, res, next) => {
  try {
    res.json(await attendance.listEvents(getPool()));
  } catch (err) { next(err); }
});

// POST /api/v1/events — { type, title, event_date, attendance_mode? }
router.post('/', async (req, res, next) => {
  try {
    const id = await attendance.createEvent(getPool(), req.body || {}, actor(req));
    res.status(201).json({ success: true, id });
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
// which side is editable. Marked rows also say who marked them and whether
// it came from the office or the member app.
router.get('/:id/attendance', async (req, res, next) => {
  try {
    res.json(await attendance.getRoster(getPool(), parseInt(req.params.id)));
  } catch (err) { next(err); }
});

// POST /api/v1/events/:id/attendance — mark a member. { society_id } comes
// from a card scan; { member_id } from picking a name off the list (an
// absentee is not there to scan their own card).
router.post('/:id/attendance', async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.id);
    const pool = getPool();
    await attendance.getEvent(pool, eventId);
    const result = await attendance.markMember(pool, {
      eventId,
      societyId: req.body.society_id,
      memberId: req.body.member_id ? parseInt(req.body.member_id) : null,
      by: actor(req)
    });
    res.json({ success: true, member: result.member, already: result.already,
      marked_at: result.marked_at, marked_by_name: result.marked_by_name, source: result.source });
  } catch (err) { next(err); }
});

// DELETE /api/v1/events/:id/attendance/:memberId — undo a mistaken scan
router.delete('/:id/attendance/:memberId', async (req, res, next) => {
  try {
    await attendance.unmarkMember(getPool(), parseInt(req.params.id), parseInt(req.params.memberId));
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
