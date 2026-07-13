-- ═══════════════════════════════════════════════════════════════
-- eSamithi — Migration 006: Announcements, Member Requests, Push
-- Run: mysql -u esamithi_user -p esamithi < 006_notices_requests.sql
--
-- NOTE: this file is documentation. The same changes are applied
-- idempotently by ensureSchema() in server/db.js at startup.
--
-- v2 of the member mobile app: death/meeting/general notices authored
-- by staff (desktop Message Portal), member-submitted loan/correction
-- requests with a staff review queue, and Expo push tokens.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS announcements (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  type                VARCHAR(20)  NOT NULL,           -- 'death' | 'meeting' | 'general'
  title               VARCHAR(255) NOT NULL,
  body                TEXT,
  deceased_name       VARCHAR(255) DEFAULT NULL,       -- death only
  deceased_member_id  INT          DEFAULT NULL,
  funeral_date        DATE         DEFAULT NULL,
  funeral_location    VARCHAR(255) DEFAULT NULL,
  event_date          DATE         DEFAULT NULL,       -- meeting only
  is_active           TINYINT      DEFAULT 1,
  created_by          INT          DEFAULT NULL,       -- users.id
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deceased_member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS member_requests (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  member_id   INT          NOT NULL,
  type        VARCHAR(30)  NOT NULL,                   -- 'loan' | 'correction'
  amount      BIGINT       DEFAULT NULL,               -- loan: requested cents
  purpose     TEXT,                                    -- loan purpose
  message     TEXT,                                    -- correction text / notes
  status      VARCHAR(20)  DEFAULT 'Pending',          -- Pending | Approved | Rejected | Done
  staff_note  TEXT,
  reviewed_by INT          DEFAULT NULL,               -- users.id
  reviewed_at TIMESTAMP    NULL DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS member_push_tokens (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  member_id  INT          NOT NULL,
  token      VARCHAR(255) NOT NULL,
  platform   VARCHAR(10)  DEFAULT NULL,
  updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_token (token),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
