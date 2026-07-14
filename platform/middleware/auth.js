const jwt = require('jsonwebtoken');
const { getPool } = require('../db');

const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];
const SECRET_FIELDS = ['password', 'new_password', 'code', 'token', 'refresh_token', 'mfa_token', 'totp_secret'];

function sanitize(body) {
  if (!body || typeof body !== 'object') return null;
  const clean = { ...body };
  for (const f of SECRET_FIELDS) if (f in clean) clean[f] = '[redacted]';
  return Object.keys(clean).length ? clean : null;
}

// Bearer access-token gate. Auditor role is read-only everywhere (FR-1.4) —
// enforced here, not in the UI.
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.PLATFORM_JWT_SECRET);
    if (decoded.typ !== 'pa') return res.status(401).json({ error: 'Invalid token type' });
    req.admin = { id: decoded.id, role: decoded.role, email: decoded.email };
    if (decoded.role === 'auditor' && MUTATING.includes(req.method)) {
      return res.status(403).json({ error: 'Auditor accounts are read-only' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireSuperadmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'superadmin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

// FR-9.1: every mutating platform request gets an audit row — enforced as
// middleware so no route can forget. Handlers may refine via res.locals:
//   res.locals.audit = { action, samithi, before, after }
function auditMiddleware(req, res, next) {
  if (!MUTATING.includes(req.method)) return next();
  res.on('finish', () => {
    const a = res.locals.audit || {};
    const row = {
      admin_id: req.admin?.id ?? null,
      role: req.admin?.role ?? null,
      action: a.action || `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`,
      samithi_slug: a.samithi ?? null,
      sid: a.sid ?? null,
      payload_before: a.before ? JSON.stringify(a.before) : null,
      payload_after: JSON.stringify({ ...(a.after ?? sanitize(req.body) ?? {}), _status: res.statusCode }),
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress
    };
    getPool()
      .query(
        `INSERT INTO audit_log (admin_id, role, action, samithi_slug, sid, payload_before, payload_after, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.admin_id, row.role, row.action, row.samithi_slug, row.sid, row.payload_before, row.payload_after, row.ip]
      )
      .catch((err) => console.error('[audit] insert failed:', err.message));
  });
  next();
}

module.exports = { requireAuth, requireSuperadmin, auditMiddleware, sanitize };
