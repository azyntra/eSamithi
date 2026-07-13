-- 004: Record which wallet received each loan repayment so deleting a loan
-- can reverse the cash movement exactly. Applied automatically at server
-- startup (see ensureSchema in db.js); kept here for reference/manual runs.

ALTER TABLE loan_payments ADD COLUMN wallet_id INT NULL AFTER fines_paid;
ALTER TABLE loan_payments ADD CONSTRAINT fk_loan_payments_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id);
