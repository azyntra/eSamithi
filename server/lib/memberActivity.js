const { getPool } = require('../db');

// Last-seen bookkeeping for the member mobile app, behind the staff "App
// usage" report. Called on every authenticated member request, so it must
// cost nothing: one write per member per WRITE_INTERVAL_MS, never awaited,
// and never able to fail the request it rides on.
const WRITE_INTERVAL_MS = 5 * 60 * 1000;
const lastWrite = new Map(); // "<tenant>:<memberId>" → epoch ms of last write

const clean = (v, max) => {
  const s = String(v || '').trim();
  return s ? s.slice(0, max) : null;
};

function touchMember(req) {
  try {
    const memberId = req.member && req.member.id;
    if (!memberId) return;
    const key = `${req.tenant || ''}:${memberId}`;
    const now = Date.now();
    if (now - (lastWrite.get(key) || 0) < WRITE_INTERVAL_MS) return;
    lastWrite.set(key, now);

    // Sent by app builds that know about the report; older builds leave both
    // NULL and COALESCE keeps whatever a newer build recorded earlier.
    const platform = clean(req.headers['x-app-platform'], 20);
    const version = clean(req.headers['x-app-version'], 40);

    getPool().query(
      `INSERT INTO member_app_activity (member_id, first_seen_at, last_seen_at, platform, app_version)
       VALUES (?, NOW(), NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE
         last_seen_at  = NOW(),
         first_seen_at = COALESCE(first_seen_at, NOW()),
         platform      = COALESCE(VALUES(platform), platform),
         app_version   = COALESCE(VALUES(app_version), app_version)`,
      [memberId, platform, version]
    ).catch(() => { lastWrite.delete(key); });
  } catch (_err) { /* bookkeeping only */ }
}

// Buckets for the report. `online` is bounded below by the write interval:
// a member is stamped at most every 5 minutes, so "seen within 10" is the
// tightest window that never flickers for someone who is using the app.
const ONLINE_SECONDS = 10 * 60;
const ACTIVE_DAYS = 7;
const OCCASIONAL_DAYS = 30;

function usageStatus({ enrolled, appEnabled, secondsAgo }) {
  if (!appEnabled) return 'blocked';
  if (!enrolled) return 'not_enrolled';
  if (secondsAgo === null || secondsAgo === undefined) return 'dormant';
  if (secondsAgo <= ONLINE_SECONDS) return 'online';
  if (secondsAgo <= ACTIVE_DAYS * 86400) return 'active';
  if (secondsAgo <= OCCASIONAL_DAYS * 86400) return 'occasional';
  return 'dormant';
}

module.exports = { touchMember, usageStatus, ONLINE_SECONDS, ACTIVE_DAYS, OCCASIONAL_DAYS, WRITE_INTERVAL_MS };
