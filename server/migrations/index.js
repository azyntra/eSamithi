// Ordered migrations, applied per tenant and recorded in schema_migrations.
// Every up() is idempotent (safe to run on tenants that predate the runner:
// the first pass no-ops and records). New migrations append to the end —
// never edit an applied one; expand/contract for breaking changes.
const fs = require('fs');
const path = require('path');

// 000 — full base schema for EMPTY tenant databases (CREATE TABLE IF NOT
// EXISTS throughout, so it also no-ops on existing tenants).
async function baseSchema(pool) {
  const sql = fs.readFileSync(path.join(__dirname, '000_base_schema.sql'), 'utf-8');
  const statements = sql
    .split('\n')
    .filter((line) => !line.startsWith('--'))
    .join('\n')
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Single connection: FOREIGN_KEY_CHECKS toggling is session-scoped and the
  // dump's table order doesn't respect FK dependencies
  const conn = await pool.getConnection();
  try {
    for (const stmt of statements) await conn.query(stmt);
  } finally {
    conn.release();
  }
}

// 004 — loan repayments record their receiving wallet
async function loanPaymentWallet(pool) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loan_payments' AND COLUMN_NAME = 'wallet_id'`
  );
  if (cols.length === 0) {
    await pool.query('ALTER TABLE loan_payments ADD COLUMN wallet_id INT NULL AFTER fines_paid');
    await pool.query('ALTER TABLE loan_payments ADD CONSTRAINT fk_loan_payments_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id)');
  }
}

// 005 — member mobile app auth (PIN credentials + refresh tokens)
async function memberAppAuth(pool) {
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
}

// 006 — announcements (death/meeting/general), member requests, push tokens
async function announcementsRequestsPush(pool) {
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
}

// 007 — attendance register (QR card scanning at meetings/funerals)
async function attendance(pool) {
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
}

// 008 — Puruka (community exchange platform)
async function puruka(pool) {
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
    ['household',  'Household Items',       'ගෘහස්ථ භාණ්ඩ',           1],
    ['tools',      'Tools',                 'උපකරණ',                  2],
    ['furniture',  'Furniture',             'ගෘහ භාණ්ඩ',              3],
    ['farming',    'Farming Items',         'ගොවිතැන් උපකරණ',         4],
    ['food',       'Food',                  'ආහාර',                   5],
    ['produce',    'Agriculture / Produce', 'කෘෂිකාර්මික / අස්වැන්න', 6],
    ['services',   'Services',              'සේවාවන්',                7],
    ['rent',       'Rent / Borrow',         'කුලියට / තාවකාලිකව',     8],
    ['other',      'Other',                 'වෙනත්',                  9]
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

  // Default post lifetime (server-side default; no admin UI by design)
  await pool.query(
    "INSERT IGNORE INTO settings (`key`, `value`) VALUES ('puruka_expiry_days', '30')"
  );
}

module.exports = [
  { id: '000_base_schema', up: baseSchema },
  { id: '004_loan_payment_wallet', up: loanPaymentWallet },
  { id: '005_member_app_auth', up: memberAppAuth },
  { id: '006_announcements_requests_push', up: announcementsRequestsPush },
  { id: '007_attendance', up: attendance },
  { id: '008_puruka', up: puruka }
];
