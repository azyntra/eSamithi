CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  username  TEXT    UNIQUE NOT NULL,
  password  TEXT    NOT NULL,
  full_name TEXT    NOT NULL,
  role      TEXT    NOT NULL DEFAULT 'admin'
);
