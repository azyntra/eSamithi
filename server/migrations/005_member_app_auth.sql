-- ═══════════════════════════════════════════════════════════════
-- eSamithi — Migration 005: Member Mobile App Authentication
-- Run: mysql -u esamithi_user -p esamithi < 005_member_app_auth.sql
--
-- NOTE: this file is documentation. The same changes are applied
-- idempotently by ensureSchema() in server/db.js at startup.
--
-- Members enroll in the mobile app with NIC + date of birth, then set a
-- 4–6 digit PIN (bcrypt-hashed). Sessions use a short-lived member JWT
-- plus a rotating opaque refresh token (only its SHA-256 is stored).
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

ALTER TABLE members
  ADD COLUMN pin_hash            VARCHAR(255) DEFAULT NULL,
  ADD COLUMN pin_set_at          TIMESTAMP    NULL DEFAULT NULL,
  ADD COLUMN failed_pin_attempts INT          DEFAULT 0,
  ADD COLUMN pin_locked_until    TIMESTAMP    NULL DEFAULT NULL,
  ADD COLUMN app_enabled         TINYINT      DEFAULT 1;

CREATE TABLE IF NOT EXISTS member_refresh_tokens (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  member_id  INT          NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  revoked_at TIMESTAMP    NULL DEFAULT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mrt_token_hash (token_hash),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
