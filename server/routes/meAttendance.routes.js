const express = require('express');
const rateLimit = require('express-rate-limit');
const { getPool } = require('../db');
const { memberAuthMiddleware } = require('../middleware/memberAuth');
const { requireAttendanceStaff } = require('../middleware/attendanceStaff');
const attendance = require('../lib/attendance');

// Attendance marking from the member app, for members the office has
// nominated as attendance staff (docs/MOBILE-STAFF-ATTENDANCE-REQUIREMENTS.md).
// Mounted at /api/v1/me/attendance. Every route needs a member token AND the
// staff permission, checked against the database per request.
//
// Compared with the office routes, staff here can create events and mark,
// but only inside the open window (yesterday / today / tomorrow), can undo
// only their own marks, cannot delete events or change the marking method,
// and only ever receive names and society IDs — no NIC, no phone numbers.
const router = express.Router();
router.use(memberAuthMiddleware, requireAttendanceStaff);

const memberKey = (req) => `${req.tenant || ''}|m${req.member.id}`;

// A practised operator manages ~20 scans a minute; 120 leaves room for a
// burst and a retry storm without letting a broken client flood the table.
const markLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false,
  keyGenerator: memberKey,
  message: { error: 'Too many scans in a short time. Please wait a moment.', code: 'RATE_LIMITED' }
});
const createLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  keyGenerator: memberKey,
  message: { error: 'Too many events created today.', code: 'RATE_LIMITED' }
});

// The app's view of an event: plain date string, nothing internal
function eventView(e) {
  return {
    id: e.id, type: e.type, title: e.title, event_date: e.event_day,
    attendance_mode: e.attendance_mode, created_by_name: e.created_by_name || null,
    ...(e.attendee_count !== undefined ? { attendee_count: e.attendee_count } : {})
  };
}

// Load an event and insist it is inside the phone-marking window
async function openEvent(pool, eventId) {
  if (!Number.isInteger(eventId)) throw attendance.fail(404, 'Event not found', 'EVENT_NOT_FOUND');
  const event = await attendance.getEvent(pool, eventId);
  if (!attendance.isWithinOpenWindow(event.event_day)) {
    throw attendance.fail(409, 'This event is closed for marking from the mobile app', 'EVENT_CLOSED');
  }
  return event;
}

const rosterRow = (me) => (r) => ({
  member_id: r.member_id, society_id: r.society_id, full_name: r.full_name,
  marked_at: r.marked_at, marked_by_name: r.marked_by_name || null,
  source: r.source || null,
  mine: r.marked_by_member_id !== null && Number(r.marked_by_member_id) === Number(me)
});

// GET /me/attendance/events — events open for marking, newest first
router.get('/events', async (_req, res, next) => {
  try {
    const today = attendance.societyToday();
    const events = await attendance.listEvents(getPool(), { openFor: today });
    res.json({ today, events: events.map(eventView) });
  } catch (err) { next(err); }
});

// POST /me/attendance/events — { type, title, event_date, attendance_mode? }
router.post('/events', createLimiter, async (req, res, next) => {
  try {
    const input = attendance.validateEventInput(req.body || {});
    if (!attendance.isWithinOpenWindow(input.event_date)) {
      throw attendance.fail(400, 'The event date must be yesterday, today or tomorrow', 'DATE_OUT_OF_WINDOW');
    }
    const id = await attendance.createEvent(getPool(), req.body, { memberId: req.member.id });
    res.status(201).json({ success: true, id });
  } catch (err) { next(err); }
});

// GET /me/attendance/events/:id — event + present + absent (names and IDs only)
router.get('/events/:id(\\d+)', async (req, res, next) => {
  try {
    const pool = getPool();
    const eventId = parseInt(req.params.id);
    await openEvent(pool, eventId);
    const roster = await attendance.getRoster(pool, eventId, { minimal: true });
    const row = rosterRow(req.member.id);
    res.json({ event: eventView(roster.event), present: roster.present.map(row), absent: roster.absent.map(row) });
  } catch (err) { next(err); }
});

// GET /me/attendance/members?q= — manual lookup for members with no card to
// scan. Active members only, by name or society ID, at most 20.
router.get('/members', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const [rows] = await getPool().query(
      `SELECT id AS member_id, society_id, full_name FROM members
       WHERE (is_active = 1 OR is_active IS NULL) AND (full_name LIKE ? OR society_id LIKE ?)
       ORDER BY (LOWER(society_id) = LOWER(?)) DESC, full_name ASC LIMIT 20`,
      [like, like, q]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /me/attendance/events/:id/marks — { society_id | member_id, client_ref? }
// society_id is what a card scan yields; member_id comes from manual lookup.
router.post('/events/:id(\\d+)/marks', markLimiter, async (req, res, next) => {
  try {
    const pool = getPool();
    const eventId = parseInt(req.params.id);
    const event = await openEvent(pool, eventId);
    const body = req.body || {};
    const clientRef = typeof body.client_ref === 'string' && /^[0-9a-fA-F-]{36}$/.test(body.client_ref) ? body.client_ref : null;
    const result = await attendance.markMember(pool, {
      eventId,
      societyId: body.society_id,
      memberId: body.member_id ? parseInt(body.member_id) : null,
      by: { memberId: req.member.id },
      clientRef
    });
    res.json({
      success: true,
      member: result.member,
      already: result.already,
      marked_at: result.marked_at,
      marked_by_name: result.marked_by_name,
      mine: Number(result.marked_by_member_id) === Number(req.member.id),
      // What this mark means for the event's method, so the app can say
      // "marked absent" without having to remember the mode itself
      meaning: event.attendance_mode === 'absent' ? 'absent' : 'present'
    });
  } catch (err) { next(err); }
});

// DELETE /me/attendance/events/:id/marks/:memberId — undo, own marks only
router.delete('/events/:id(\\d+)/marks/:memberId(\\d+)', async (req, res, next) => {
  try {
    const pool = getPool();
    const eventId = parseInt(req.params.id);
    await openEvent(pool, eventId);
    await attendance.unmarkMember(pool, eventId, parseInt(req.params.memberId), { onlyByMemberId: req.member.id });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
