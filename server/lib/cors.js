// CORS policy. Unset CORS_ALLOWED_ORIGINS keeps today's behaviour exactly
// (`cors()`: Access-Control-Allow-Origin: * for everyone). Once the web app is
// live it is set to the allow-list; requests WITHOUT an Origin header (the
// Electron main process, React Native, curl, health checks) are always
// allowed because native clients never send one. Credentials stay off — the
// web app is same-origin and needs no CORS at all.
const cors = require('cors');

function allowedOrigins() {
  return String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsMiddleware() {
  const list = allowedOrigins();
  if (list.length === 0) return cors();
  return cors({
    origin(origin, cb) {
      if (!origin || list.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: false
  });
}

module.exports = { corsMiddleware, allowedOrigins };
