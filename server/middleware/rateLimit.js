// Staff sign-in rate limits (requirements §6.5). Keyed by client IP + samithi
// like the member-PIN limiter, which needs `trust proxy` in server.js — behind
// the nginx container every request would otherwise share nginx's own IP.
// Only failed attempts count towards the login limit, so a busy office that
// signs in correctly never notices it.
const rateLimit = require('express-rate-limit');

const { ipKeyGenerator } = rateLimit;
const WINDOW_MS = 15 * 60 * 1000;

function intEnv(name, fallback) {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const tenantIpKey = (req) => `${ipKeyGenerator(req.ip)}|${req.tenant || ''}`;

const staffLoginLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: intEnv('STAFF_LOGIN_LIMIT', 30),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: tenantIpKey,
  message: { error: 'Too many sign-in attempts from this network. Please try again in a few minutes.' }
});

const refreshLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: intEnv('STAFF_REFRESH_LIMIT', 120),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: tenantIpKey,
  message: { error: 'Too many session refreshes. Please try again shortly.' }
});

module.exports = { staffLoginLimiter, refreshLimiter, tenantIpKey };
