const jwt = require('jsonwebtoken');

// Auth for the member mobile app. Member tokens carry { member_id, typ:"member" }
// and are deliberately NOT interchangeable with staff tokens: staff tokens have
// no `typ` claim (rejected here), and member tokens have no `role` claim (so
// they fail the staff authMiddleware's role checks and never reach staff data).
// The `sam` claim binds a token to its samithi; pre-multi-samithi tokens lack
// it and are treated as DEFAULT_TENANT.
function samMatches(decoded, req) {
  const sam = decoded.sam || process.env.DEFAULT_TENANT;
  return !req.tenant || sam === req.tenant;
}

function memberAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.typ !== 'member' || !decoded.member_id) {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    if (!samMatches(decoded, req)) {
      return res.status(403).json({ error: 'Token does not belong to this samithi' });
    }
    req.member = { id: decoded.member_id };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Same shape, but for the short-lived enrollment token issued by
// /member-auth/verify-identity — only good for setting a PIN.
function enrollAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Verification required' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.typ !== 'enroll' || !decoded.member_id) {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    if (!samMatches(decoded, req)) {
      return res.status(403).json({ error: 'Token does not belong to this samithi' });
    }
    req.member = { id: decoded.member_id };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Verification expired — please verify your identity again' });
  }
}

module.exports = { memberAuthMiddleware, enrollAuthMiddleware };
