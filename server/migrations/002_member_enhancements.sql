-- ═══════════════════════════════════════════════════════════════
-- eSamithi — Migration 002: Enhanced Member & Dependent fields
-- Run: mysql -u esamithi_user -p esamithi < 002_member_enhancements.sql
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── Members: Add family info & bank account columns ──────────
ALTER TABLE members
  ADD COLUMN father_name        VARCHAR(255) DEFAULT NULL AFTER date_of_joining,
  ADD COLUMN mother_name        VARCHAR(255) DEFAULT NULL AFTER father_name,
  ADD COLUMN father_in_law_name VARCHAR(255) DEFAULT NULL AFTER mother_name,
  ADD COLUMN mother_in_law_name VARCHAR(255) DEFAULT NULL AFTER father_in_law_name,
  ADD COLUMN nsb_account_number VARCHAR(100) DEFAULT NULL AFTER mother_in_law_name;

-- ── Members: Make fields nullable for flexible registration ──
ALTER TABLE members
  MODIFY nic             VARCHAR(50)  DEFAULT NULL,
  MODIFY full_name       VARCHAR(255) DEFAULT NULL,
  MODIFY date_of_birth   DATE         DEFAULT NULL,
  MODIFY gender          VARCHAR(20)  DEFAULT NULL,
  MODIFY marital_status  VARCHAR(50)  DEFAULT NULL,
  MODIFY phone           VARCHAR(50)  DEFAULT NULL,
  MODIFY date_of_joining DATE         DEFAULT NULL;

-- ── Members: Drop UNIQUE on NIC (can be empty during migration) ──
-- Check if the index exists before dropping (safe for re-runs)
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'members' AND INDEX_NAME = 'nic');
SET @drop_sql = IF(@idx_exists > 0, 'ALTER TABLE members DROP INDEX nic', 'SELECT 1');
PREPARE stmt FROM @drop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── Dependents: Add DOB, NIC, Age columns ────────────────────
ALTER TABLE dependents
  ADD COLUMN date_of_birth DATE         DEFAULT NULL AFTER relationship,
  ADD COLUMN nic           VARCHAR(50)  DEFAULT NULL AFTER date_of_birth,
  ADD COLUMN age           INT          DEFAULT NULL AFTER nic;

-- ── Dependents: Make name/relationship nullable ──────────────
ALTER TABLE dependents
  MODIFY name         VARCHAR(255) DEFAULT NULL,
  MODIFY relationship VARCHAR(100) DEFAULT NULL;
