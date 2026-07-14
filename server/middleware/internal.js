const jwt = require('jsonwebtoken');

// Platform-to-tenant calls (the stats collector). Signed with a secret shared
// only between platform-api and the tenant API — never reachable by clients.
function internalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Internal auth required' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.INTERNAL_SECRET || '');
    if (decoded.typ !== 'internal') return res.status(401).json({ error: 'Invalid token type' });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid internal token' });
  }
}

module.exports = { internalAuth };
