const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Tenant binding: a token minted for one samithi can never touch another.
    // Tokens from before the multi-samithi update have no `sam` claim and are
    // treated as DEFAULT_TENANT (staff tokens expire within 24 h anyway).
    const sam = decoded.sam || process.env.DEFAULT_TENANT;
    if (req.tenant && sam !== req.tenant) {
      return res.status(403).json({ error: 'Token does not belong to this samithi' });
    }
    req.user = decoded;
    // Viewer accounts are read-only everywhere; hiding buttons client-side
    // is not enforcement
    if (decoded.role === 'viewer' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({ error: 'Your account is view-only and cannot make changes' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Gate a route to administrators only (client hiding is not enough)
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  next();
}

function generateToken(user, tenant) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, sam: tenant },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

module.exports = { authMiddleware, requireAdmin, generateToken };
