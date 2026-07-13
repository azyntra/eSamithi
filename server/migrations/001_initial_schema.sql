-- ═══════════════════════════════════════════════════════════════
-- eSamithi — MySQL Schema Migration
-- Run: mysql -u esamithi_user -p esamithi < 001_initial_schema.sql
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS users (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  username  VARCHAR(100) UNIQUE NOT NULL,
  password  VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role      VARCHAR(50)  NOT NULL DEFAULT 'admin'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS members (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  society_id      VARCHAR(50)  UNIQUE NOT NULL,
  nic             VARCHAR(50)  UNIQUE NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  date_of_birth   DATE         NOT NULL,
  gender          VARCHAR(20)  NOT NULL,
  marital_status  VARCHAR(50)  NOT NULL,
  occupation      VARCHAR(255),
  address         TEXT,
  phone           VARCHAR(50)  NOT NULL,
  date_of_joining DATE         NOT NULL,
  is_active       TINYINT      DEFAULT 1,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dependents (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  member_id    INT          NOT NULL,
  name         VARCHAR(255) NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wallets (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(255) NOT NULL,
  wallet_type VARCHAR(50)  NOT NULL,
  balance     BIGINT       DEFAULT 0,
  is_active   TINYINT      DEFAULT 1,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fixed_deposits (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  fd_number        VARCHAR(100) NOT NULL,
  bank_name        VARCHAR(255) NOT NULL,
  principal        BIGINT       NOT NULL,
  interest_rate    DECIMAL(5,2) NOT NULL,
  term_months      INT          NOT NULL,
  start_date       DATE         NOT NULL,
  maturity_date    DATE         NOT NULL,
  status           VARCHAR(50)  DEFAULT 'Active',
  notes            TEXT,
  linked_wallet_id INT,
  FOREIGN KEY (linked_wallet_id) REFERENCES wallets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS physical_assets (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(255) NOT NULL,
  quantity    INT          DEFAULT 0,
  description TEXT,
  is_active   TINYINT      DEFAULT 1,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS income_types (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(255) NOT NULL,
  standard_amount BIGINT       DEFAULT 0,
  category_group  VARCHAR(100) NOT NULL,
  is_active       TINYINT      DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expense_types (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(255) NOT NULL,
  standard_payout BIGINT       DEFAULT 0,
  is_active       TINYINT      DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS loans (
  id                     INT PRIMARY KEY AUTO_INCREMENT,
  member_id              INT    NOT NULL,
  principal_amount       BIGINT NOT NULL,
  principal_owed         BIGINT NOT NULL,
  interest_owed          BIGINT DEFAULT 0,
  fines_owed             BIGINT DEFAULT 0,
  purpose                TEXT,
  date_issued            DATE   NOT NULL,
  status                 VARCHAR(50) DEFAULT 'Active',
  disbursement_wallet_id INT,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (disbursement_wallet_id) REFERENCES wallets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS income_ledger (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  date            DATE         NOT NULL,
  payer_type      VARCHAR(50)  NOT NULL,
  member_id       INT,
  guest_name      VARCHAR(255),
  income_type_id  INT          NOT NULL,
  amount          BIGINT       NOT NULL,
  principal_part  BIGINT       DEFAULT 0,
  interest_part   BIGINT       DEFAULT 0,
  months_covered  VARCHAR(255),
  fine_reason     TEXT,
  payment_method  VARCHAR(50)  NOT NULL,
  wallet_id       INT          NOT NULL,
  asset_id        INT,
  loan_id         INT,
  notes           TEXT,
  status          VARCHAR(50)  DEFAULT 'Active',
  void_reason     TEXT,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (income_type_id) REFERENCES income_types(id),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  FOREIGN KEY (asset_id) REFERENCES physical_assets(id),
  FOREIGN KEY (loan_id) REFERENCES loans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expense_ledger (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  date            DATE         NOT NULL,
  recipient_type  VARCHAR(50)  NOT NULL,
  member_id       INT,
  vendor_name     VARCHAR(255),
  expense_type_id INT          NOT NULL,
  amount          BIGINT       NOT NULL,
  quantity        INT          DEFAULT 1,
  unit_price      BIGINT       DEFAULT 0,
  death_reference TEXT,
  payment_method  VARCHAR(50)  NOT NULL,
  wallet_id       INT          NOT NULL,
  voucher_no      VARCHAR(100),
  notes           TEXT,
  status          VARCHAR(50)  DEFAULT 'Active',
  void_reason     TEXT,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (expense_type_id) REFERENCES expense_types(id),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS loan_guarantors (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  loan_id   INT NOT NULL,
  member_id INT NOT NULL,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS loan_payments (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  loan_id          INT    NOT NULL,
  date             DATE   NOT NULL,
  principal_paid   BIGINT DEFAULT 0,
  interest_paid    BIGINT DEFAULT 0,
  fines_paid       BIGINT DEFAULT 0,
  income_ledger_id INT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  FOREIGN KEY (income_ledger_id) REFERENCES income_ledger(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  `key`   VARCHAR(100) PRIMARY KEY,
  value   TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO settings (`key`, value) VALUES
  ('required_guarantors', '2'),
  ('monthly_interest_rate', '1.0'),
  ('late_fine_rate', '10.0'),
  ('max_loan_limit', '100000'),
  ('grace_period_days', '7'),
  ('society_name', 'Maranadhara Samithi'),
  ('low_wallet_threshold', '500000'),
  ('dashboard_date_range', 'current_month');

INSERT IGNORE INTO users (username, password, full_name, role) VALUES
  ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Administrator', 'admin');
