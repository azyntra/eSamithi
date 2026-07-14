const { getTenants, reloadTenants, tenantContext } = require('../db');

// Resolves which samithi (tenant) a request belongs to:
//   1. X-Samithi header — set by clients after the multi-samithi update
//   2. DEFAULT_TENANT env — keeps already-deployed clients (no header) working
// The auth middlewares additionally check the JWT `sam` claim against
// req.tenant, so a token minted for one samithi can never touch another.
function tenantMiddleware(req, res, next) {
  const slug = String(req.headers['x-samithi'] || process.env.DEFAULT_TENANT || '').trim();
  if (!slug) {
    return res.status(400).json({ error: 'Samithi not specified' });
  }
  // Miss → force one re-read: catches a just-onboarded samithi before the TTL
  let tenant = getTenants()[slug];
  if (!tenant) tenant = reloadTenants()[slug];
  if (!tenant) {
    return res.status(403).json({ error: 'Unknown samithi' });
  }
  if (tenant.status !== 'active') {
    return res.status(403).json({ error: 'This samithi is suspended. Please contact eSamithi support.' });
  }
  req.tenant = slug;
  tenantContext.run({ slug }, next);
}

module.exports = { tenantMiddleware };
