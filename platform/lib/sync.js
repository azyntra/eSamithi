const fs = require('fs');
const { getPool } = require('../db');

const TENANTS_FILE = process.env.TENANTS_FILE || '/etc/esamithi/tenants.json';

// The samithis table is the source of truth; tenants.json is a generated
// artifact the tenant API consumes (multi-samithi plan §5 — no more editing
// it by hand). The tenant API re-reads it within 30 s.
async function syncTenantsFile() {
  const [rows] = await getPool().query(
    'SELECT slug, name_en, db_name, db_user, db_password_env, status FROM samithis WHERE status != "archived"'
  );
  const out = {};
  for (const r of rows) {
    out[r.slug] = {
      name: r.name_en,
      db: r.db_name,
      status: r.status,
      ...(r.db_user ? { db_user: r.db_user } : {}),
      ...(r.db_password_env ? { db_password_env: r.db_password_env } : {})
    };
  }
  // In-place write on purpose: the file is bind-mounted into the API
  // container, so the inode must survive (tmp+rename would detach the mount)
  fs.writeFileSync(TENANTS_FILE, JSON.stringify(out, null, 2) + '\n');
}

module.exports = { syncTenantsFile };
