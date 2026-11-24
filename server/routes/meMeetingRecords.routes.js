const express = require('express');
const { getPool } = require('../db');
const { memberAuthMiddleware } = require('../middleware/memberAuth');
const { secretaryPermission } = require('../lib/officers');
const { buildRoutes } = require('./meetingRecords.shared');

// /api/v1/me/meeting-records — the member app. Every signed-in member reads,
// listens and comments; the society's current Secretary (checked against the
// database on every request, never from the token) also prepares and
// publishes (docs/MEETING-MINUTES-REQUIREMENTS.md §2.1).
async function resolveMember(req) {
  const [[m]] = await getPool().query('SELECT id, full_name, society_id FROM members WHERE id = ?', [req.member.id]);
  if (!m) throw Object.assign(new Error('Member not found'), { statusCode: 404, code: 'NOT_FOUND' });
  const secretary = await secretaryPermission(m.id).catch(() => ({ allowed: false }));
  return {
    kind: 'member',
    memberId: m.id,
    name: m.full_name || m.society_id,
    ref: m.society_id,
    position: 'secretary',
    canPublish: secretary.allowed,
    canModerate: secretary.allowed,
    canWithdraw: false
  };
}

const router = express.Router();
router.use(memberAuthMiddleware);
router.use(buildRoutes(resolveMember, { kind: 'member' }));

module.exports = router;
