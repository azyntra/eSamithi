const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { buildRoutes } = require('./meetingRecords.shared');

// /api/v1/meeting-records — the office web (and the desktop shell that loads
// it). Every staff role reads; Administrators and the Secretary's own system
// user publish (OD1); Administrators and Staff moderate comments (OD2); only
// Administrators withdraw a version (docs/MEETING-MINUTES-REQUIREMENTS.md §2.2).
// View-only users are already refused every write by authMiddleware.
async function resolveStaff(req) {
  const [[u]] = await getPool().query('SELECT id, username, full_name, role, is_active, society_position FROM users WHERE id = ?', [req.user.id]);
  if (!u || u.is_active === 0) throw Object.assign(new Error('Your account is disabled'), { statusCode: 403, code: 'ACCOUNT_DISABLED' });
  const secretary = u.society_position === 'secretary';
  const admin = u.role === 'admin';
  return {
    kind: 'staff',
    userId: u.id,
    name: u.full_name || u.username,
    ref: u.username,
    position: secretary ? 'secretary' : 'office',
    canPublish: admin || (u.role === 'user' && secretary),
    canModerate: admin || u.role === 'user',
    canWithdraw: admin
  };
}

const router = express.Router();
router.use(authMiddleware);
router.use(buildRoutes(resolveStaff, { kind: 'staff' }));

module.exports = router;
