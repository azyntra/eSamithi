/**
 * eSamithi Data Migration Script
 * SQLite (Local) -> MySQL (Cloud)
 * 
 * Usage:
 * 1. Ensure .env is configured with MySQL details
 * 2. Run: node migrate-data.js
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');
const path = require('path');
const os = require('os');

// Path to your local SQLite database
const sqlitePath = path.join(os.homedir(), 'Library', 'Application Support', 'esamithi', 'esamithi.db');

async function migrate() {
  console.log('🚀 Starting migration...');
  console.log('📂 SQLite path:', sqlitePath);

  let sqlite;
  try {
    sqlite = new Database(sqlitePath, { readonly: true });
  } catch (err) {
    console.error('❌ Could not open SQLite database:', err.message);
    process.exit(1);
  }

  const mysqlConn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // 1. Migrate Settings
    console.log('⚙️ Migrating settings...');
    const settings = sqlite.prepare('SELECT * FROM settings').all();
    for (const s of settings) {
      await mysqlConn.execute('INSERT IGNORE INTO settings (`key`, value) VALUES (?, ?)', [s.key, s.value]);
    }

    // 2. Migrate Users
    console.log('👤 Migrating users...');
    const users = sqlite.prepare('SELECT * FROM users').all();
    for (const u of users) {
      await mysqlConn.execute('INSERT IGNORE INTO users (id, username, password, full_name, role) VALUES (?, ?, ?, ?, ?)', 
        [u.id, u.username, u.password, u.full_name, u.role]);
    }

    // 3. Migrate Members
    console.log('👨‍👩‍👧‍👦 Migrating members...');
    const members = sqlite.prepare('SELECT * FROM members').all();
    for (const m of members) {
      await mysqlConn.execute('INSERT IGNORE INTO members (id, society_id, nic, full_name, date_of_birth, gender, marital_status, occupation, address, phone, date_of_joining, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [m.id, m.society_id, m.nic, m.full_name, m.date_of_birth, m.gender, m.marital_status, m.occupation, m.address, m.phone, m.date_of_joining, m.is_active, m.created_at]);
    }

    // 4. Migrate Dependents
    console.log('👶 Migrating dependents...');
    const dependents = sqlite.prepare('SELECT * FROM dependents').all();
    for (const d of dependents) {
      await mysqlConn.execute('INSERT IGNORE INTO dependents (id, member_id, name, relationship) VALUES (?, ?, ?, ?)', 
        [d.id, d.member_id, d.name, d.relationship]);
    }

    // 5. Migrate Wallets
    console.log('💳 Migrating wallets...');
    const wallets = sqlite.prepare('SELECT * FROM wallets').all();
    for (const w of wallets) {
      await mysqlConn.execute('INSERT IGNORE INTO wallets (id, name, wallet_type, balance, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
        [w.id, w.name, w.wallet_type, w.balance, w.is_active, w.created_at]);
    }

    // 6. Migrate Fixed Deposits
    console.log('🏦 Migrating fixed deposits...');
    const fds = sqlite.prepare('SELECT * FROM fixed_deposits').all();
    for (const f of fds) {
      await mysqlConn.execute('INSERT IGNORE INTO fixed_deposits (id, fd_number, bank_name, principal, interest_rate, term_months, start_date, maturity_date, status, notes, linked_wallet_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [f.id, f.fd_number, f.bank_name, f.principal, f.interest_rate, f.term_months, f.start_date, f.maturity_date, f.status, f.notes, f.linked_wallet_id]);
    }

    // 7. Migrate Physical Assets
    console.log('📦 Migrating assets...');
    const assets = sqlite.prepare('SELECT * FROM physical_assets').all();
    for (const a of assets) {
      await mysqlConn.execute('INSERT IGNORE INTO physical_assets (id, name, quantity, description, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
        [a.id, a.name, a.quantity, a.description, a.is_active, a.created_at]);
    }

    // 8. Migrate Income Types
    console.log('📈 Migrating income types...');
    const iTypes = sqlite.prepare('SELECT * FROM income_types').all();
    for (const t of iTypes) {
      await mysqlConn.execute('INSERT IGNORE INTO income_types (id, name, standard_amount, category_group, is_active) VALUES (?, ?, ?, ?, ?)', 
        [t.id, t.name, t.standard_amount, t.category_group, t.is_active]);
    }

    // 9. Migrate Expense Types
    console.log('📉 Migrating expense types...');
    const eTypes = sqlite.prepare('SELECT * FROM expense_types').all();
    for (const t of eTypes) {
      await mysqlConn.execute('INSERT IGNORE INTO expense_types (id, name, standard_payout, is_active) VALUES (?, ?, ?, ?)', 
        [t.id, t.name, t.standard_payout, t.is_active]);
    }

    // 10. Migrate Loans
    console.log('💰 Migrating loans...');
    const loans = sqlite.prepare('SELECT * FROM loans').all();
    for (const l of loans) {
      await mysqlConn.execute('INSERT IGNORE INTO loans (id, member_id, principal_amount, principal_owed, interest_owed, fines_owed, purpose, date_issued, status, disbursement_wallet_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [l.id, l.member_id, l.principal_amount, l.principal_owed, l.interest_owed, l.fines_owed, l.purpose, l.date_issued, l.status, l.disbursement_wallet_id, l.created_at]);
    }

    // 11. Migrate Income Ledger
    console.log('📑 Migrating income ledger...');
    const income = sqlite.prepare('SELECT * FROM income_ledger').all();
    for (const i of income) {
      await mysqlConn.execute('INSERT IGNORE INTO income_ledger (id, date, payer_type, member_id, guest_name, income_type_id, amount, principal_part, interest_part, months_covered, fine_reason, payment_method, wallet_id, asset_id, loan_id, notes, status, void_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [i.id, i.date, i.payer_type, i.member_id, i.guest_name, i.income_type_id, i.amount, i.principal_part, i.interest_part, i.months_covered, i.fine_reason, i.payment_method, i.wallet_id, i.asset_id, i.loan_id, i.notes, i.status, i.void_reason, i.created_at]);
    }

    // 12. Migrate Expense Ledger
    console.log('🧾 Migrating expense ledger...');
    const expenses = sqlite.prepare('SELECT * FROM expense_ledger').all();
    for (const e of expenses) {
      await mysqlConn.execute('INSERT IGNORE INTO expense_ledger (id, date, recipient_type, member_id, vendor_name, expense_type_id, amount, quantity, unit_price, death_reference, payment_method, wallet_id, voucher_no, notes, status, void_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [e.id, e.date, e.recipient_type, e.member_id, e.vendor_name, e.expense_type_id, e.amount, e.quantity, e.unit_price, e.death_reference, e.payment_method, e.wallet_id, e.voucher_no, e.notes, e.status, e.void_reason, e.created_at]);
    }

    // 13. Migrate Loan Guarantors
    console.log('🤝 Migrating guarantors...');
    const guarantors = sqlite.prepare('SELECT * FROM loan_guarantors').all();
    for (const g of guarantors) {
      await mysqlConn.execute('INSERT IGNORE INTO loan_guarantors (id, loan_id, member_id) VALUES (?, ?, ?)', 
        [g.id, g.loan_id, g.member_id]);
    }

    console.log('✅ Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    sqlite.close();
    await mysqlConn.end();
  }
}

migrate();
