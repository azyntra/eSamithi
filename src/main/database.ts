import Database from 'better-sqlite3'
import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) return db

  const dbPath = path.join(app.getPath('userData'), 'esamithi.db')
  db = new Database(dbPath)

  // Performance and safety pragmas
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initializeTables(db)

  return db
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export { hashPassword }

function initializeTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      username  TEXT    UNIQUE NOT NULL,
      password  TEXT    NOT NULL,
      full_name TEXT    NOT NULL,
      role      TEXT    NOT NULL DEFAULT 'admin'
    );

    CREATE TABLE IF NOT EXISTS members (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      society_id      TEXT    UNIQUE NOT NULL,
      nic             TEXT    UNIQUE NOT NULL,
      full_name       TEXT    NOT NULL,
      date_of_birth   TEXT    NOT NULL,
      gender          TEXT    NOT NULL,
      marital_status  TEXT    NOT NULL,
      occupation      TEXT,
      address         TEXT,
      phone           TEXT    NOT NULL,
      date_of_joining TEXT    NOT NULL,
      is_active       INTEGER DEFAULT 1,
      created_at      TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dependents (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      name         TEXT    NOT NULL,
      relationship TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      wallet_type  TEXT NOT NULL,
      balance      INTEGER DEFAULT 0,
      is_active    INTEGER DEFAULT 1,
      created_at   TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fixed_deposits (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      fd_number      TEXT NOT NULL,
      bank_name      TEXT NOT NULL,
      principal      INTEGER NOT NULL,
      interest_rate  REAL NOT NULL,
      term_months    INTEGER NOT NULL,
      start_date     TEXT NOT NULL,
      maturity_date  TEXT NOT NULL,
      status         TEXT DEFAULT 'Active',
      notes          TEXT,
      linked_wallet_id INTEGER REFERENCES wallets(id)
    );

    CREATE TABLE IF NOT EXISTS physical_assets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      quantity    INTEGER DEFAULT 0,
      description TEXT,
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS income_types (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      standard_amount INTEGER DEFAULT 0,
      category_group  TEXT NOT NULL,
      is_active       INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS loans (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id         INTEGER NOT NULL REFERENCES members(id),
      principal_amount  INTEGER NOT NULL,
      principal_owed    INTEGER NOT NULL,
      interest_owed     INTEGER DEFAULT 0,
      fines_owed        INTEGER DEFAULT 0,
      purpose           TEXT,
      date_issued       TEXT NOT NULL,
      status            TEXT DEFAULT 'Active',
      disbursement_wallet_id INTEGER REFERENCES wallets(id),
      created_at        TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS income_ledger (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      date            TEXT NOT NULL,
      payer_type      TEXT NOT NULL,
      member_id       INTEGER REFERENCES members(id),
      guest_name      TEXT,
      income_type_id  INTEGER NOT NULL REFERENCES income_types(id),
      amount          INTEGER NOT NULL,
      principal_part  INTEGER DEFAULT 0,
      interest_part   INTEGER DEFAULT 0,
      months_covered  TEXT,
      fine_reason     TEXT,
      payment_method  TEXT NOT NULL,
      wallet_id       INTEGER NOT NULL REFERENCES wallets(id),
      asset_id        INTEGER REFERENCES physical_assets(id),
      loan_id         INTEGER REFERENCES loans(id),
      notes           TEXT,
      status          TEXT DEFAULT 'Active',
      void_reason     TEXT,
      created_at      TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expense_types (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      standard_payout INTEGER DEFAULT 0,
      is_active       INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS expense_ledger (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      date             TEXT NOT NULL,
      recipient_type   TEXT NOT NULL,
      member_id        INTEGER REFERENCES members(id),
      vendor_name      TEXT,
      expense_type_id  INTEGER NOT NULL REFERENCES expense_types(id),
      amount           INTEGER NOT NULL,
      quantity         INTEGER DEFAULT 1,
      unit_price       INTEGER DEFAULT 0,
      death_reference  TEXT,
      payment_method   TEXT NOT NULL,
      wallet_id        INTEGER NOT NULL REFERENCES wallets(id),
      voucher_no       TEXT,
      notes            TEXT,
      status           TEXT DEFAULT 'Active',
      void_reason      TEXT,
      created_at       TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loan_guarantors (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id   INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS loan_payments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id        INTEGER NOT NULL REFERENCES loans(id),
      date           TEXT NOT NULL,
      principal_paid INTEGER DEFAULT 0,
      interest_paid  INTEGER DEFAULT 0,
      fines_paid     INTEGER DEFAULT 0,
      income_ledger_id INTEGER REFERENCES income_ledger(id),
      created_at     TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings VALUES ('required_guarantors', '2');
    INSERT OR IGNORE INTO settings VALUES ('monthly_interest_rate', '1.0');
    INSERT OR IGNORE INTO settings VALUES ('late_fine_rate', '10.0');
    INSERT OR IGNORE INTO settings VALUES ('max_loan_limit', '100000');
    INSERT OR IGNORE INTO settings VALUES ('grace_period_days', '7');
    INSERT OR IGNORE INTO settings VALUES ('society_name', 'Maranadhara Samithi');
    INSERT OR IGNORE INTO settings VALUES ('low_wallet_threshold', '500000');
    INSERT OR IGNORE INTO settings VALUES ('dashboard_date_range', 'current_month');
  `)

  // ── Database Migrations ────────────────────────────────────────
  
  // Ensure 'is_active' exists in members table (for older DB versions)
  try {
    const tableInfo = database.prepare("PRAGMA table_info(members)").all() as any[]
    const hasIsActive = tableInfo.some(col => col.name === 'is_active')
    if (!hasIsActive) {
      database.exec("ALTER TABLE members ADD COLUMN is_active INTEGER DEFAULT 1")
      console.log('Migration: Added is_active column to members table')
    }
  } catch (err) {
    console.error('Migration Error (is_active):', err)
  }

  // Seed default admin user if no users exist
  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  if (userCount.count === 0) {
    const defaultPassword = hashPassword('admin123')
    database.prepare(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)'
    ).run('admin', defaultPassword, 'Administrator', 'admin')
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
