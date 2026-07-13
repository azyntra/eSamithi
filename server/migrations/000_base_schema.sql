-- Base schema (multi-samithi migration 000) — dumped from the live tenant
-- template on 2026-07-13. Applied only to EMPTY tenant databases; existing
-- tenants already have these tables and the runner records 000 as applied.
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `announcements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(20) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text,
  `deceased_name` varchar(255) DEFAULT NULL,
  `deceased_member_id` int DEFAULT NULL,
  `funeral_date` date DEFAULT NULL,
  `funeral_location` varchar(255) DEFAULT NULL,
  `event_date` date DEFAULT NULL,
  `is_active` tinyint DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `deceased_member_id` (`deceased_member_id`),
  CONSTRAINT `announcements_ibfk_1` FOREIGN KEY (`deceased_member_id`) REFERENCES `members` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `dependents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `relationship` varchar(100) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `nic` varchar(50) DEFAULT NULL,
  `age` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `member_id` (`member_id`),
  CONSTRAINT `dependents_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `event_attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `member_id` int NOT NULL,
  `marked_by` int DEFAULT NULL,
  `marked_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_member` (`event_id`,`member_id`),
  KEY `member_id` (`member_id`),
  CONSTRAINT `event_attendance_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `society_events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `event_attendance_ibfk_2` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `expense_ledger` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `recipient_type` varchar(50) NOT NULL,
  `member_id` int DEFAULT NULL,
  `vendor_name` varchar(255) DEFAULT NULL,
  `expense_type_id` int NOT NULL,
  `amount` bigint NOT NULL,
  `quantity` int DEFAULT '1',
  `unit_price` bigint DEFAULT '0',
  `death_reference` text,
  `payment_method` varchar(50) NOT NULL,
  `wallet_id` int NOT NULL,
  `voucher_no` varchar(100) DEFAULT NULL,
  `notes` text,
  `status` varchar(50) DEFAULT 'Active',
  `void_reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `member_id` (`member_id`),
  KEY `expense_type_id` (`expense_type_id`),
  KEY `wallet_id` (`wallet_id`),
  CONSTRAINT `expense_ledger_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`),
  CONSTRAINT `expense_ledger_ibfk_2` FOREIGN KEY (`expense_type_id`) REFERENCES `expense_types` (`id`),
  CONSTRAINT `expense_ledger_ibfk_3` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `expense_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `standard_payout` bigint DEFAULT '0',
  `is_active` tinyint DEFAULT '1',
  `code` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expense_types_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `fixed_deposits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fd_number` varchar(100) NOT NULL,
  `bank_name` varchar(255) NOT NULL,
  `principal` bigint NOT NULL,
  `interest_rate` decimal(5,2) NOT NULL,
  `term_months` int NOT NULL,
  `start_date` date NOT NULL,
  `maturity_date` date NOT NULL,
  `status` varchar(50) DEFAULT 'Active',
  `notes` text,
  `linked_wallet_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `linked_wallet_id` (`linked_wallet_id`),
  CONSTRAINT `fixed_deposits_ibfk_1` FOREIGN KEY (`linked_wallet_id`) REFERENCES `wallets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `income_ledger` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `payer_type` varchar(50) NOT NULL,
  `member_id` int DEFAULT NULL,
  `guest_name` varchar(255) DEFAULT NULL,
  `income_type_id` int NOT NULL,
  `amount` bigint NOT NULL,
  `principal_part` bigint DEFAULT '0',
  `interest_part` bigint DEFAULT '0',
  `months_covered` varchar(255) DEFAULT NULL,
  `fine_reason` text,
  `payment_method` varchar(50) NOT NULL,
  `wallet_id` int NOT NULL,
  `asset_id` int DEFAULT NULL,
  `loan_id` int DEFAULT NULL,
  `notes` text,
  `status` varchar(50) DEFAULT 'Active',
  `void_reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `member_id` (`member_id`),
  KEY `income_type_id` (`income_type_id`),
  KEY `wallet_id` (`wallet_id`),
  KEY `asset_id` (`asset_id`),
  KEY `loan_id` (`loan_id`),
  CONSTRAINT `income_ledger_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`),
  CONSTRAINT `income_ledger_ibfk_2` FOREIGN KEY (`income_type_id`) REFERENCES `income_types` (`id`),
  CONSTRAINT `income_ledger_ibfk_3` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`),
  CONSTRAINT `income_ledger_ibfk_4` FOREIGN KEY (`asset_id`) REFERENCES `physical_assets` (`id`),
  CONSTRAINT `income_ledger_ibfk_5` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `income_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `standard_amount` bigint DEFAULT '0',
  `category_group` varchar(100) NOT NULL,
  `is_active` tinyint DEFAULT '1',
  `code` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_income_types_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `loan_guarantors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `loan_id` int NOT NULL,
  `member_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `loan_id` (`loan_id`),
  KEY `member_id` (`member_id`),
  CONSTRAINT `loan_guarantors_ibfk_1` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `loan_guarantors_ibfk_2` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `loan_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `loan_id` int NOT NULL,
  `date` date NOT NULL,
  `principal_paid` bigint DEFAULT '0',
  `interest_paid` bigint DEFAULT '0',
  `fines_paid` bigint DEFAULT '0',
  `wallet_id` int DEFAULT NULL,
  `income_ledger_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `loan_id` (`loan_id`),
  KEY `income_ledger_id` (`income_ledger_id`),
  KEY `fk_loan_payments_wallet` (`wallet_id`),
  CONSTRAINT `fk_loan_payments_wallet` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`),
  CONSTRAINT `loan_payments_ibfk_1` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`),
  CONSTRAINT `loan_payments_ibfk_2` FOREIGN KEY (`income_ledger_id`) REFERENCES `income_ledger` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `loans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `principal_amount` bigint NOT NULL,
  `principal_owed` bigint NOT NULL,
  `interest_owed` bigint DEFAULT '0',
  `fines_owed` bigint DEFAULT '0',
  `purpose` text,
  `date_issued` date NOT NULL,
  `status` varchar(50) DEFAULT 'Active',
  `is_migrated` tinyint DEFAULT '0',
  `last_accrual_date` date DEFAULT NULL,
  `disbursement_wallet_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `member_id` (`member_id`),
  KEY `disbursement_wallet_id` (`disbursement_wallet_id`),
  CONSTRAINT `loans_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`),
  CONSTRAINT `loans_ibfk_2` FOREIGN KEY (`disbursement_wallet_id`) REFERENCES `wallets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `member_push_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `platform` varchar(10) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_push_token` (`token`),
  KEY `member_id` (`member_id`),
  CONSTRAINT `member_push_tokens_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `member_refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mrt_token_hash` (`token_hash`),
  KEY `member_id` (`member_id`),
  CONSTRAINT `member_refresh_tokens_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `member_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `type` varchar(30) NOT NULL,
  `amount` bigint DEFAULT NULL,
  `purpose` text,
  `message` text,
  `status` varchar(20) DEFAULT 'Pending',
  `staff_note` text,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `member_id` (`member_id`),
  CONSTRAINT `member_requests_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `society_id` varchar(50) NOT NULL,
  `nic` varchar(50) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `marital_status` varchar(50) DEFAULT NULL,
  `occupation` varchar(255) DEFAULT NULL,
  `address` text,
  `phone` varchar(50) DEFAULT NULL,
  `date_of_joining` date DEFAULT NULL,
  `father_name` varchar(255) DEFAULT NULL,
  `mother_name` varchar(255) DEFAULT NULL,
  `father_in_law_name` varchar(255) DEFAULT NULL,
  `mother_in_law_name` varchar(255) DEFAULT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `bank_account_holder_name` varchar(255) DEFAULT NULL,
  `bank_account_number` varchar(100) DEFAULT NULL,
  `is_active` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `pin_hash` varchar(255) DEFAULT NULL,
  `pin_set_at` timestamp NULL DEFAULT NULL,
  `failed_pin_attempts` int DEFAULT '0',
  `pin_locked_until` timestamp NULL DEFAULT NULL,
  `app_enabled` tinyint DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `society_id` (`society_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `physical_assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `quantity` int DEFAULT '0',
  `description` text,
  `is_active` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `puruka_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(30) NOT NULL,
  `label_en` varchar(80) NOT NULL,
  `label_si` varchar(120) NOT NULL,
  `is_active` tinyint DEFAULT '1',
  `sort_order` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_puruka_cat_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `puruka_photos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `filename` varchar(80) NOT NULL,
  `sort_order` tinyint DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `post_id` (`post_id`),
  CONSTRAINT `puruka_photos_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `puruka_posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `puruka_posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `category_id` int NOT NULL,
  `title` varchar(120) NOT NULL,
  `description` text,
  `price` bigint DEFAULT NULL,
  `negotiable` tinyint DEFAULT '0',
  `phone` varchar(20) DEFAULT NULL,
  `location` varchar(120) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Active',
  `report_count` int DEFAULT '0',
  `expiry_notified` tinyint DEFAULT '0',
  `sold_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_puruka_status` (`status`,`created_at`),
  KEY `member_id` (`member_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `puruka_posts_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`),
  CONSTRAINT `puruka_posts_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `puruka_categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `puruka_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `member_id` int NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_puruka_report` (`post_id`,`member_id`),
  KEY `member_id` (`member_id`),
  CONSTRAINT `puruka_reports_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `puruka_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `puruka_reports_ibfk_2` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `settings` (
  `key` varchar(100) NOT NULL,
  `value` text NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `society_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(20) NOT NULL,
  `title` varchar(255) NOT NULL,
  `event_date` date NOT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'admin',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `wallets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `wallet_type` varchar(50) NOT NULL,
  `balance` bigint DEFAULT '0',
  `is_active` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS=1;
