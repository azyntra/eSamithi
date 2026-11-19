const { getSetting } = require('./settings');

// The attendance register's rules, shared by the office routes
// (routes/events.routes.js) and the member app's staff routes
// (routes/meAttendance.routes.js) so the two can never drift apart.
//
// event_attendance always holds the *marked* members; an event's
// attendance_mode decides whether a mark means present or absent.

const EVENT_TYPES = ['meeting', 'funeral', 'other'];
const MODES = ['present', 'absent'];

// Phone marking is limited to events dated yesterday, today or tomorrow, so a
// lost phone or a slip cannot rewrite an old register (requirements D4).
const OPEN_WINDOW_DAYS = 1;

// "Today" for the society, not for the server: the API hosts run in UTC and
// Sri Lanka is UTC+5:30, so before 05:30 local the two disagree on the date.
const SOCIETY_UTC_OFFSET_MINUTES = parseInt(process.env.SOCIETY_UTC_OFFSET_MINUTES || '330', 10);

function societyToday(now = new Date()) {
  return new Date(now.getTime() + SOCIETY_UTC_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);
}

// Whole days from `today` to `eventDate` (both YYYY-MM-DD); negative = past
function dayOffset(eventDate, today) {
  const toUtc = (s) => {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(eventDate) - toUtc(today)) / 86400000);
}

function isWithinOpenWindow(eventDate, today = societyToday()) {
  return Math.abs(dayOffset(eventDate, today)) <= OPEN_WINDOW_DAYS;
}

// What a scanner hands us. A membership QR carries the society ID and nothing
// else; anything that looks like a link or is implausibly long is some other
// code (a shop sticker, a payment QR) and never reaches the database.
function parseCardPayload(raw) {
  const value = String(raw == null ? '' : raw).trim();
  if (!value || value.length > 50) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /\s/.test(value)) return null;
  return value;
}

function fail(statusCode, message, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function validateEventInput({ type, title, event_date, attendance_mode }) {
  const mode = attendance_mode || 'present';
  if (!EVENT_TYPES.includes(type)) throw fail(400, 'Invalid event type');
  if (!MODES.includes(mode)) throw fail(400, 'Invalid attendance mode');
  if (!title || !String(title).trim()) throw fail(400, 'Title is required');
  if (String(title).trim().length > 255) throw fail(400, 'Title is too long');
  if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) throw fail(400, 'Valid event date is required');
  return { type, title: String(title).trim(), event_date, mode };
}

// by: { userId } for the office, { memberId } for the member app
async function createEvent(pool, input, by) {
  const { type, title, event_date, mode } = validateEventInput(input);
  const [result] = await pool.query(
    `INSERT INTO society_events (type, title, event_date, attendance_mode, created_by, created_by_member_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [type, title, event_date, mode, by.userId ?? null, by.memberId ?? null]
  );
  return result.insertId;
}

// Newest first. attendee_count always means "present", so a list reads the
// same whichever way the event was recorded. Rows keep every society_events
// column exactly as the office clients have always received them (event_date
// included); event_day is the same date as a plain YYYY-MM-DD string, which
// is what the member app and the open-window check use. `openFor` (a YYYY-MM-DD "today")
// narrows to the phone-marking window.
async function listEvents(pool, { openFor = null } = {}) {
  const where = openFor ? 'WHERE ABS(DATEDIFF(e.event_date, ?)) <= ?' : '';
  const params = openFor ? [openFor, OPEN_WINDOW_DAYS] : [];
  const [rows] = await pool.query(`
    SELECT e.*, DATE_FORMAT(e.event_date, '%Y-%m-%d') AS event_day,
           COALESCE(cu.full_name, cm.full_name) AS created_by_name,
           CASE WHEN e.attendance_mode = 'absent'
                THEN (SELECT COUNT(*) FROM members WHERE is_active = 1)
                     - COALESCE(SUM(CASE WHEN m.is_active = 1 THEN 1 ELSE 0 END), 0)
                ELSE COUNT(a.id)
           END AS attendee_count
    FROM society_events e
    LEFT JOIN event_attendance a ON a.event_id = e.id
    LEFT JOIN members m ON m.id = a.member_id
    LEFT JOIN users cu ON cu.id = e.created_by
    LEFT JOIN members cm ON cm.id = e.created_by_member_id
    ${where}
    GROUP BY e.id
    ORDER BY e.event_date DESC, e.id DESC
  `, params);
  return rows.map((r) => ({ ...r, attendee_count: Math.max(0, Number(r.attendee_count)) }));
}

async function getEvent(pool, eventId) {
  const [[event]] = await pool.query(
    `SELECT e.*, DATE_FORMAT(e.event_date, '%Y-%m-%d') AS event_day,
            COALESCE(cu.full_name, cm.full_name) AS created_by_name
     FROM society_events e
     LEFT JOIN users cu ON cu.id = e.created_by
     LEFT JOIN members cm ON cm.id = e.created_by_member_id
     WHERE e.id = ?`,
    [eventId]
  );
  if (!event) throw fail(404, 'Event not found', 'EVENT_NOT_FOUND');
  return event;
}

// Event + present list + absentee list. Both lists carry the same columns;
// marked_at is null for the members the mode derives (never individually
// marked), which is also how a client knows which side is editable.
// `minimal` is the member app's view: names and society IDs only — a phone
// roster never carries NIC or phone numbers (requirements NFR-4).
async function getRoster(pool, eventId, { minimal = false } = {}) {
  const event = await getEvent(pool, eventId);
  const contact = minimal ? '' : ', m.nic, m.phone';

  const [marked] = await pool.query(`
    SELECT a.member_id, a.marked_at, m.society_id, m.full_name${contact},
           a.source, a.marked_by_member_id,
           COALESCE(u.full_name, sm.full_name) AS marked_by_name
    FROM event_attendance a
    JOIN members m ON m.id = a.member_id
    LEFT JOIN users u ON u.id = a.marked_by
    LEFT JOIN members sm ON sm.id = a.marked_by_member_id
    WHERE a.event_id = ?
    ORDER BY a.marked_at DESC, a.id DESC
  `, [eventId]);

  const [unmarked] = await pool.query(`
    SELECT m.id AS member_id, NULL AS marked_at, m.society_id, m.full_name${contact},
           NULL AS source, NULL AS marked_by_member_id, NULL AS marked_by_name
    FROM members m
    WHERE m.is_active = 1
      AND m.id NOT IN (SELECT member_id FROM event_attendance WHERE event_id = ?)
    ORDER BY m.society_id ASC
  `, [eventId]);

  const byAbsence = event.attendance_mode === 'absent';
  return { event, present: byAbsence ? unmarked : marked, absent: byAbsence ? marked : unmarked };
}

async function findMember(pool, { societyId, memberId }) {
  const [[member]] = memberId
    ? await pool.query('SELECT id, society_id, full_name, is_active FROM members WHERE id = ?', [memberId])
    : await pool.query(
        'SELECT id, society_id, full_name, is_active FROM members WHERE LOWER(society_id) = LOWER(?)',
        [societyId]
      );
  if (!member) throw fail(404, 'Member not found', 'MEMBER_NOT_FOUND');
  return { ...member, is_active: member.is_active === null ? 1 : Number(member.is_active) };
}

// Mark one member against an event. Idempotent: UNIQUE(event_id, member_id)
// means two phones and the office scanner can all scan the same card and the
// register still holds one row — the losers are told `already`, with who got
// there first and when.
async function markMember(pool, { eventId, societyId, memberId, by, clientRef = null }) {
  const cleanId = societyId ? parseCardPayload(societyId) : null;
  if (!cleanId && !memberId) throw fail(400, 'society_id or member_id is required');

  const member = await findMember(pool, { societyId: cleanId, memberId });
  const [result] = await pool.query(
    `INSERT IGNORE INTO event_attendance (event_id, member_id, marked_by, marked_by_member_id, source, client_ref)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [eventId, member.id, by.userId ?? null, by.memberId ?? null, by.memberId ? 'app' : 'office', clientRef]
  );

  const [[row]] = await pool.query(
    `SELECT a.marked_at, a.source, a.marked_by_member_id,
            COALESCE(u.full_name, sm.full_name) AS marked_by_name
     FROM event_attendance a
     LEFT JOIN users u ON u.id = a.marked_by
     LEFT JOIN members sm ON sm.id = a.marked_by_member_id
     WHERE a.event_id = ? AND a.member_id = ?`,
    [eventId, member.id]
  );

  return {
    member,
    already: result.affectedRows === 0,
    marked_at: row ? row.marked_at : null,
    marked_by_name: row ? row.marked_by_name : null,
    marked_by_member_id: row ? row.marked_by_member_id : null,
    source: row ? row.source : null
  };
}

// Undo a mark. The office may remove any; the member app passes
// `onlyByMemberId` so staff can only take back what they marked themselves.
async function unmarkMember(pool, eventId, memberId, { onlyByMemberId = null } = {}) {
  const [[row]] = await pool.query(
    'SELECT id, marked_by_member_id FROM event_attendance WHERE event_id = ? AND member_id = ?',
    [eventId, memberId]
  );
  if (!row) throw fail(404, 'Attendance row not found', 'MARK_NOT_FOUND');
  if (onlyByMemberId !== null && Number(row.marked_by_member_id) !== Number(onlyByMemberId)) {
    throw fail(403, 'You can only remove marks you made yourself', 'NOT_YOUR_MARK');
  }
  await pool.query('DELETE FROM event_attendance WHERE id = ?', [row.id]);
}

// The society-wide switch for phone marking (FR-1.9); on unless set to '0'
async function isAppAttendanceEnabled(runner = null) {
  return (await getSetting('app_attendance_enabled', runner)) !== '0';
}

module.exports = {
  EVENT_TYPES, MODES, OPEN_WINDOW_DAYS,
  societyToday, dayOffset, isWithinOpenWindow, parseCardPayload,
  validateEventInput, createEvent, listEvents, getEvent, getRoster,
  findMember, markMember, unmarkMember, isAppAttendanceEnabled, fail
};
