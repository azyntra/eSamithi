const mysql = require('mysql2/promise');

let pool = null;

async function initPool() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'esamithi_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'esamithi',
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    charset: 'utf8mb4'
  });

  // Test the connection
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();

  await ensureSchema();
}

// Small idempotent schema upgrades (there is no migration runner; the SQL
// files in migrations/ document these same changes for manual runs)
async function ensureSchema() {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loan_payments' AND COLUMN_NAME = 'wallet_id'`
  );
  if (cols.length === 0) {
    await pool.query('ALTER TABLE loan_payments ADD COLUMN wallet_id INT NULL AFTER fines_paid');
    await pool.query('ALTER TABLE loan_payments ADD CONSTRAINT fk_loan_payments_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id)');
    console.log('✓ Schema: added loan_payments.wallet_id (004)');
  }

  // 005 — member mobile app auth (PIN credentials + refresh tokens)
  const [pinCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'members' AND COLUMN_NAME = 'pin_hash'`
  );
  if (pinCols.length === 0) {
    await pool.query(`ALTER TABLE members
      ADD COLUMN pin_hash            VARCHAR(255) DEFAULT NULL,
      ADD COLUMN pin_set_at          TIMESTAMP    NULL DEFAULT NULL,
      ADD COLUMN failed_pin_attempts INT          DEFAULT 0,
      ADD COLUMN pin_locked_until    TIMESTAMP    NULL DEFAULT NULL,
      ADD COLUMN app_enabled         TINYINT      DEFAULT 1`);
    console.log('✓ Schema: added member app auth columns (005)');
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS member_refresh_tokens (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    member_id  INT          NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP    NOT NULL,
    revoked_at TIMESTAMP    NULL DEFAULT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    KEY idx_mrt_token_hash (token_hash),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // 006 — announcements (death/meeting/general), member requests, push tokens
  await pool.query(`CREATE TABLE IF NOT EXISTS announcements (
    id                  INT PRIMARY KEY AUTO_INCREMENT,
    type                VARCHAR(20)  NOT NULL,
    title               VARCHAR(255) NOT NULL,
    body                TEXT,
    deceased_name       VARCHAR(255) DEFAULT NULL,
    deceased_member_id  INT          DEFAULT NULL,
    funeral_date        DATE         DEFAULT NULL,
    funeral_location    VARCHAR(255) DEFAULT NULL,
    event_date          DATE         DEFAULT NULL,
    is_active           TINYINT      DEFAULT 1,
    created_by          INT          DEFAULT NULL,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deceased_member_id) REFERENCES members(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS member_requests (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    member_id   INT          NOT NULL,
    type        VARCHAR(30)  NOT NULL,
    amount      BIGINT       DEFAULT NULL,
    purpose     TEXT,
    message     TEXT,
    status      VARCHAR(20)  DEFAULT 'Pending',
    staff_note  TEXT,
    reviewed_by INT          DEFAULT NULL,
    reviewed_at TIMESTAMP    NULL DEFAULT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS member_push_tokens (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    member_id  INT          NOT NULL,
    token      VARCHAR(255) NOT NULL,
    platform   VARCHAR(10)  DEFAULT NULL,
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_push_token (token),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // 007 — attendance register (QR card scanning at meetings/funerals)
  await pool.query(`CREATE TABLE IF NOT EXISTS society_events (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    type       VARCHAR(20)  NOT NULL,
    title      VARCHAR(255) NOT NULL,
    event_date DATE         NOT NULL,
    created_by INT          DEFAULT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS event_attendance (
    id        INT PRIMARY KEY AUTO_INCREMENT,
    event_id  INT       NOT NULL,
    member_id INT       NOT NULL,
    marked_by INT       DEFAULT NULL,
    marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_event_member (event_id, member_id),
    FOREIGN KEY (event_id) REFERENCES society_events(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // 008 — Puruka (community exchange platform)
  await pool.query(`CREATE TABLE IF NOT EXISTS puruka_categories (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    code       VARCHAR(30)  NOT NULL,
    label_en   VARCHAR(80)  NOT NULL,
    label_si   VARCHAR(120) NOT NULL,
    is_active  TINYINT      DEFAULT 1,
    sort_order INT          DEFAULT 0,
    UNIQUE KEY uq_puruka_cat_code (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const purukaCats = [
    ['household',  'Household Items',     'ගෘහස්ථ භාණ්ඩ',        1],
    ['tools',      'Tools',               'උපකරණ',               2],
    ['furniture',  'Furniture',           'ගෘහ භාණ්ඩ',           3],
    ['farming',    'Farming Items',       'ගොවිතැන් උපකරණ',      4],
    ['food',       'Food',                'ආහාර',                5],
    ['produce',    'Agriculture / Produce', 'කෘෂිකාර්මික / අස්වැන්න', 6],
    ['services',   'Services',            'සේවාවන්',             7],
    ['rent',       'Rent / Borrow',       'කුලියට / තාවකාලිකව',  8],
    ['other',      'Other',               'වෙනත්',               9]
  ];
  for (const [code, en, si, order] of purukaCats) {
    await pool.query(
      'INSERT IGNORE INTO puruka_categories (code, label_en, label_si, sort_order) VALUES (?, ?, ?, ?)',
      [code, en, si, order]
    );
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS puruka_posts (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    member_id       INT          NOT NULL,
    category_id     INT          NOT NULL,
    title           VARCHAR(120) NOT NULL,
    description     TEXT,
    price           BIGINT       DEFAULT NULL,
    negotiable      TINYINT      DEFAULT 0,
    phone           VARCHAR(20)  DEFAULT NULL,
    location        VARCHAR(120) DEFAULT NULL,
    status          VARCHAR(20)  DEFAULT 'Active',
    report_count    INT          DEFAULT 0,
    expiry_notified TINYINT      DEFAULT 0,
    sold_at         TIMESTAMP    NULL DEFAULT NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATE         NOT NULL,
    KEY idx_puruka_status (status, created_at),
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (category_id) REFERENCES puruka_categories(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS puruka_photos (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    post_id    INT         NOT NULL,
    filename   VARCHAR(80) NOT NULL,
    sort_order TINYINT     DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES puruka_posts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS puruka_reports (
    id         INT          PRIMARY KEY AUTO_INCREMENT,
    post_id    INT          NOT NULL,
    member_id  INT          NOT NULL,
    reason     VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_puruka_report (post_id, member_id),
    FOREIGN KEY (post_id) REFERENCES puruka_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Default post lifetime, editable from the desktop Puruka admin tab
  await pool.query(
    "INSERT IGNORE INTO settings (`key`, `value`) VALUES ('puruka_expiry_days', '30')"
  );
}

function getPool() {
  if (!pool) throw new Error('Database pool not initialized');
  return pool;
}

module.exports = { initPool, getPool };
