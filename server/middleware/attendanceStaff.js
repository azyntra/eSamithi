const { getPool } = require('../db');
const { isAppAttendanceEnabled } = require('../lib/attendance');

// Gate for the member app's attendance-staff routes. Runs after
// memberAuthMiddleware. The permission is read from the database on every
// call and deliberately never put in the member's token: when the office
// removes it, the very next request is refused instead of waiting for a
// 15-minute token to lapse (requirements D2).
async function attendancePermission(memberId) {
  const pool = getPool();
  const [[member]] = await pool.query(
    'SELECT app_staff_attendance, is_active, app_enabled FROM members WHERE id = ?',
    [memberId]
  );
  if (!member) return { allowed: false, code: 'NOT_STAFF' };
  const active = member.is_active === null || Number(member.is_active) === 1;
  const enabled = member.app_enabled === null || Number(member.app_enabled) === 1;
  if (!active || !enabled || Number(member.app_staff_attendance) !== 1) {
    return { allowed: false, code: 'NOT_STAFF' };
  }
  if (!(await isAppAttendanceEnabled(pool))) return { allowed: false, code: 'FEATURE_OFF' };
  return { allowed: true };
}

async function requireAttendanceStaff(req, res, next) {
  try {
    const verdict = await attendancePermission(req.member.id);
    if (verdict.allowed) return next();
    return res.status(403).json({
      error: verdict.code === 'FEATURE_OFF'
        ? 'Attendance marking from the mobile app is switched off for this society'
        : 'You do not have permission to mark attendance',
      code: verdict.code
    });
  } catch (err) { next(err); }
}

module.exports = { requireAttendanceStaff, attendancePermission };
