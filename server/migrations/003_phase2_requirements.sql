-- ═══════════════════════════════════════════════════════════════
-- eSamithi — Migration 003: Phase 2 Requirements (v2.0)
-- Run: mysql -u esamithi_user -p esamithi < 003_phase2_requirements.sql
--
-- Req 1: Generic banking information (replaces NSB-only account)
-- Req 2: Migration Mode flag
-- Req 3/4: Coded income & expense types for adaptive forms
-- Req 5: Loan accrual tracking + migrated-loan support
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── Req 1: Members — generic bank account fields ──────────────
ALTER TABLE members
  ADD COLUMN bank_name                VARCHAR(255) DEFAULT NULL AFTER mother_in_law_name,
  ADD COLUMN bank_account_holder_name VARCHAR(255) DEFAULT NULL AFTER bank_name,
  ADD COLUMN bank_account_number      VARCHAR(100) DEFAULT NULL AFTER bank_account_holder_name;

-- Carry over existing NSB account numbers, then retire the old column
UPDATE members
SET bank_name = 'National Savings Bank (NSB)',
    bank_account_holder_name = full_name,
    bank_account_number = nsb_account_number
WHERE nsb_account_number IS NOT NULL AND nsb_account_number != '';

ALTER TABLE members DROP COLUMN nsb_account_number;

-- ── Req 2: Migration Mode flag (developer/admin managed only) ──
INSERT IGNORE INTO settings (`key`, value) VALUES ('migration_completed', 'false');

-- ── Req 3/4: Type codes for adaptive forms ─────────────────────
ALTER TABLE income_types
  ADD COLUMN code VARCHAR(50) DEFAULT NULL,
  ADD UNIQUE KEY uq_income_types_code (code);

ALTER TABLE expense_types
  ADD COLUMN code VARCHAR(50) DEFAULT NULL,
  ADD UNIQUE KEY uq_expense_types_code (code);

-- Attach codes to existing rows when names already match
UPDATE income_types SET code = 'membership_fee'          WHERE code IS NULL AND name LIKE '%Membership%';
UPDATE income_types SET code = 'entrance_fee'            WHERE code IS NULL AND name LIKE '%Entrance%';
UPDATE income_types SET code = 'fine'                    WHERE code IS NULL AND name LIKE '%Fine%' AND name NOT LIKE '%Loan%';
UPDATE income_types SET code = 'funeral_food_collection' WHERE code IS NULL AND name LIKE '%Funeral Food%';
UPDATE income_types SET code = 'bank_interest'           WHERE code IS NULL AND name LIKE '%Bank Interest%';
UPDATE income_types SET code = 'building_income'         WHERE code IS NULL AND name LIKE '%Building%';
UPDATE income_types SET code = 'asset_income'            WHERE code IS NULL AND (name LIKE '%Asset%' OR name LIKE '%Rental%');
UPDATE income_types SET code = 'loan_interest'           WHERE code IS NULL AND name LIKE '%Loan Interest%';
UPDATE income_types SET code = 'loan_fine'               WHERE code IS NULL AND name LIKE '%Loan Fine%';
UPDATE income_types SET code = 'other_income'            WHERE code IS NULL AND name LIKE '%Other%';

-- Seed the required income types (INSERT IGNORE keys on unique code)
INSERT IGNORE INTO income_types (name, standard_amount, category_group, code, is_active) VALUES
  ('Membership Fee',          0, 'Fees',     'membership_fee',          1),
  ('Entrance Fee',            0, 'Fees',     'entrance_fee',            1),
  ('Fine',                    0, 'Fines',    'fine',                    1),
  ('Funeral Food Collection', 0, 'Funeral',  'funeral_food_collection', 1),
  ('Bank Interest',           0, 'Interest', 'bank_interest',           1),
  ('Building Income',         0, 'Building', 'building_income',         1),
  ('Asset Income',            0, 'Assets',   'asset_income',            1),
  ('Other Income',            0, 'Other',    'other_income',            1),
  ('Loan Interest',           0, 'Loans',    'loan_interest',           1),
  ('Loan Fine',               0, 'Loans',    'loan_fine',               1);

UPDATE expense_types SET code = 'inlaw_funeral_benefit' WHERE code IS NULL AND (name LIKE '%In-Law%' OR name LIKE '%in law%');
UPDATE expense_types SET code = 'funeral_benefit'       WHERE code IS NULL AND name LIKE '%Funeral%';
UPDATE expense_types SET code = 'hospital_assistance'   WHERE code IS NULL AND name LIKE '%Hospital%';
UPDATE expense_types SET code = 'grade5_scholarship'    WHERE code IS NULL AND (name LIKE '%Scholarship%' OR name LIKE '%Grade 5%');
UPDATE expense_types SET code = 'year_end_bonus'        WHERE code IS NULL AND name LIKE '%Bonus%';
UPDATE expense_types SET code = 'bills_operational'     WHERE code IS NULL AND (name LIKE '%Bill%' OR name LIKE '%Operational%');
UPDATE expense_types SET code = 'other_expense'         WHERE code IS NULL AND name LIKE '%Other%';

INSERT IGNORE INTO expense_types (name, standard_payout, code, is_active) VALUES
  ('Funeral Benefit',                            0, 'funeral_benefit',       1),
  ('Mother-in-Law / Father-in-Law Funeral Benefit', 0, 'inlaw_funeral_benefit', 1),
  ('Hospital Assistance',                        0, 'hospital_assistance',   1),
  ('Grade 5 Scholarship Benefit',                0, 'grade5_scholarship',    1),
  ('Year-End Bonus',                             0, 'year_end_bonus',        1),
  ('Bills & Operational Expenses',               0, 'bills_operational',     1),
  ('Other Expense',                              0, 'other_expense',         1);

-- ── Req 5: Loans — accrual tracking + migration support ────────
ALTER TABLE loans
  ADD COLUMN is_migrated       TINYINT DEFAULT 0    AFTER status,
  ADD COLUMN last_accrual_date DATE    DEFAULT NULL AFTER is_migrated;

-- Existing loans start accruing from their issue date
UPDATE loans SET last_accrual_date = date_issued WHERE last_accrual_date IS NULL;
