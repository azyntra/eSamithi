// Control-plane database (esamithi_platform). Lives beside the tenant DBs on
// the same MySQL; the platform app user has rights on this schema only —
// cross-tenant reads happen through the tenant API, never direct SQL (NFR-2).
const fs = require('fs');
const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (!pool) throw new Error('Platform DB not initialized');
  return pool;
}

async function initDb() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.PLATFORM_DB_USER || 'platform_app',
    password: process.env.PLATFORM_DB_PASSWORD || '',
    database: process.env.PLATFORM_DB_NAME || 'esamithi_platform',
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4'
  });
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  await ensureSchema();
  await seedFromTenantsFile();
}

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS super_admins (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    email         VARCHAR(255) NOT NULL,
    name          VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    totp_secret   VARCHAR(64)  NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'superadmin',
    is_active     TINYINT      NOT NULL DEFAULT 1,
    last_login_at TIMESTAMP    NULL DEFAULT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sa_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS sa_recovery_codes (
    id        INT PRIMARY KEY AUTO_INCREMENT,
    admin_id  INT          NOT NULL,
    code_hash VARCHAR(64)  NOT NULL,
    used_at   TIMESTAMP    NULL DEFAULT NULL,
    FOREIGN KEY (admin_id) REFERENCES super_admins(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS sa_refresh_tokens (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    admin_id   INT          NOT NULL,
    token_hash VARCHAR(64)  NOT NULL,
    expires_at TIMESTAMP    NOT NULL,
    revoked_at TIMESTAMP    NULL DEFAULT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    KEY idx_sart_hash (token_hash),
    FOREIGN KEY (admin_id) REFERENCES super_admins(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS servers (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    code       VARCHAR(30)  NOT NULL,
    api_url    VARCHAR(255) NOT NULL,
    role       VARCHAR(20)  NOT NULL DEFAULT 'active',
    health_url VARCHAR(255) DEFAULT NULL,
    UNIQUE KEY uq_server_code (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS samithis (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    slug            VARCHAR(30)  NOT NULL,
    join_code       VARCHAR(20)  NOT NULL,
    name_en         VARCHAR(160) NOT NULL,
    name_si         VARCHAR(200) DEFAULT NULL,
    server_id       INT          NOT NULL,
    db_name         VARCHAR(64)  NOT NULL,
    db_user         VARCHAR(64)  DEFAULT NULL,
    db_password_env VARCHAR(64)  DEFAULT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'active',
    contact_json    JSON         DEFAULT NULL,
    min_app_version VARCHAR(20)  DEFAULT NULL,
    onboarded_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    suspended_at    TIMESTAMP    NULL DEFAULT NULL,
    UNIQUE KEY uq_samithi_slug (slug),
    UNIQUE KEY uq_samithi_code (join_code),
    FOREIGN KEY (server_id) REFERENCES servers(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Onboarded tenants store their MySQL password inline (the wizard creates a
  // per-tenant DB user); syncTenantsFile writes it into tenants.json so the
  // tenant API connects without a restart. Idempotent add for existing DBs.
  const [pwCol] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'samithis' AND COLUMN_NAME = 'db_password'`
  );
  if (pwCol.length === 0) {
    await pool.query('ALTER TABLE samithis ADD COLUMN db_password VARCHAR(120) DEFAULT NULL AFTER db_password_env');
  }

  // Append-only: the platform DB user must have no UPDATE/DELETE grant on
  // this table (enforced at provisioning; FR-9.2)
  await pool.query(`CREATE TABLE IF NOT EXISTS audit_log (
    id             BIGINT PRIMARY KEY AUTO_INCREMENT,
    admin_id       INT          DEFAULT NULL,
    role           VARCHAR(20)  DEFAULT NULL,
    action         VARCHAR(120) NOT NULL,
    samithi_slug   VARCHAR(30)  DEFAULT NULL,
    sid            VARCHAR(40)  DEFAULT NULL,
    payload_before JSON         DEFAULT NULL,
    payload_after  JSON         DEFAULT NULL,
    ip             VARCHAR(45)  DEFAULT NULL,
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_admin (admin_id, created_at),
    KEY idx_audit_samithi (samithi_slug, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS platform_settings (
    \`key\` VARCHAR(60) PRIMARY KEY,
    \`value\` TEXT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Broadcast history (FR-7.1): what was sent, to whom, by whom, and the
  // per-samithi delivery result.
  await pool.query(`CREATE TABLE IF NOT EXISTS broadcasts (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    admin_id     INT          DEFAULT NULL,
    title        VARCHAR(255) NOT NULL,
    body         TEXT,
    push         TINYINT      DEFAULT 0,
    targets      JSON         DEFAULT NULL,
    results      JSON         DEFAULT NULL,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    KEY idx_broadcasts_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Latest counters per samithi (collector upserts; dashboard reads)
  await pool.query(`CREATE TABLE IF NOT EXISTS tenant_stats_current (
    samithi_slug            VARCHAR(30) PRIMARY KEY,
    captured_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    reachable               TINYINT DEFAULT 1,
    members_total           INT DEFAULT 0,
    members_active          INT DEFAULT 0,
    members_enrolled        INT DEFAULT 0,
    staff_users             INT DEFAULT 0,
    wallets_total_cents     BIGINT DEFAULT 0,
    loans_active            INT DEFAULT 0,
    loans_outstanding_cents BIGINT DEFAULT 0,
    fds_count               INT DEFAULT 0,
    fds_value_cents         BIGINT DEFAULT 0,
    pending_requests        INT DEFAULT 0,
    last_txn_at             DATE DEFAULT NULL,
    migration_version       VARCHAR(80) DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Impersonation sessions (kill-switch + audit linkage via sid)
  await pool.query(`CREATE TABLE IF NOT EXISTS impersonation_sessions (
    sid          VARCHAR(40) PRIMARY KEY,
    admin_id     INT NOT NULL,
    samithi_slug VARCHAR(30) NOT NULL,
    expires_at   TIMESTAMP NOT NULL,
    revoked_at   TIMESTAMP NULL DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES super_admins(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

// First boot on a machine that already runs tenants: import the existing
// registry so the panel starts with reality. Join codes come from the
// directory file when present, else generated.
async function seedFromTenantsFile() {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM samithis');
  if (n > 0) return;

  const apiUrl = process.env.PUBLIC_API_URL || 'http://212.227.103.150/api/v1';
  const [server] = await pool.query(
    'INSERT INTO servers (code, api_url, role, health_url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE api_url = VALUES(api_url), id = LAST_INSERT_ID(id)',
    ['server1', apiUrl, 'active', `${apiUrl}/health?deep=1`]
  );
  const serverId = server.insertId;

  let tenants = {};
  let directory = {};
  try { tenants = JSON.parse(fs.readFileSync(process.env.TENANTS_FILE || '/etc/esamithi/tenants.json', 'utf-8')); } catch {}
  try { directory = JSON.parse(fs.readFileSync(process.env.DIRECTORY_FILE || '/etc/esamithi/directory.json', 'utf-8')); } catch {}

  const codeBySlug = {};
  for (const [code, rec] of Object.entries(directory)) codeBySlug[rec.slug] = code;

  for (const [slug, t] of Object.entries(tenants)) {
    const joinCode = codeBySlug[slug] || `${slug.slice(0, 3).toUpperCase()}-${1000 + Math.floor(Math.random() * 9000)}`;
    await pool.query(
      `INSERT IGNORE INTO samithis (slug, join_code, name_en, server_id, db_name, db_user, db_password_env, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, joinCode, t.name || slug, serverId, t.db, t.db_user || null, t.db_password_env || null, t.status || 'active']
    );
    console.log(`✓ registry seeded: ${slug} (${joinCode})`);
  }
}

module.exports = { initDb, getPool };
