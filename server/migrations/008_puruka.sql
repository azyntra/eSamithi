-- 008 — Puruka (පුරුක) community exchange platform (documentation only;
-- applied idempotently by ensureSchema() in db.js at server startup).
--
-- Member-to-member community exchange: goods, food, farming items, services,
-- rentals. Posts carry the member's real identity; buyers call/WhatsApp and
-- settle face-to-face. No pre-approval; post-moderation via reports.
-- Statuses: Active | Sold | Inactive (expired/deactivated) | Removed (admin)
-- | Deleted (owner soft-delete). Nothing is hard-deleted.
-- Categories live in their own table so admins can manage them without
-- touching past posts. Default lifetime comes from settings.puruka_expiry_days.

CREATE TABLE IF NOT EXISTS puruka_categories (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  code       VARCHAR(30)  NOT NULL,
  label_en   VARCHAR(80)  NOT NULL,
  label_si   VARCHAR(120) NOT NULL,
  is_active  TINYINT      DEFAULT 1,
  sort_order INT          DEFAULT 0,
  UNIQUE KEY uq_puruka_cat_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seeded: household, tools, furniture, farming, food, produce, services, rent, other

CREATE TABLE IF NOT EXISTS puruka_posts (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  member_id       INT          NOT NULL,
  category_id     INT          NOT NULL,
  title           VARCHAR(120) NOT NULL,
  description     TEXT,
  price           BIGINT       DEFAULT NULL,      -- cents; NULL + negotiable=1 = "ask"
  negotiable      TINYINT      DEFAULT 0,
  phone           VARCHAR(20)  DEFAULT NULL,
  location        VARCHAR(120) DEFAULT NULL,
  status          VARCHAR(20)  DEFAULT 'Active',
  report_count    INT          DEFAULT 0,
  expiry_notified TINYINT      DEFAULT 0,         -- pre-expiry push sent
  sold_at         TIMESTAMP    NULL DEFAULT NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  expires_at      DATE         NOT NULL,
  KEY idx_puruka_status (status, created_at),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (category_id) REFERENCES puruka_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS puruka_photos (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  post_id    INT         NOT NULL,
  filename   VARCHAR(80) NOT NULL,
  sort_order TINYINT     DEFAULT 0,
  FOREIGN KEY (post_id) REFERENCES puruka_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS puruka_reports (
  id         INT          PRIMARY KEY AUTO_INCREMENT,
  post_id    INT          NOT NULL,
  member_id  INT          NOT NULL,
  reason     VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_puruka_report (post_id, member_id),
  FOREIGN KEY (post_id) REFERENCES puruka_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO settings (`key`, `value`) VALUES ('puruka_expiry_days', '30');
