const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const os = require('os');

// In Electron, app.getPath('userData') on Mac is usually ~/Library/Application Support/<AppName>
// Let's try to locate it. The app name is likely eSamithi or esamithi.
const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'esamithi', 'esamithi.db');

try {
  const db = new Database(dbPath, { fileMustExist: true });
  const users = db.prepare('SELECT id, username, password, full_name, role FROM users').all();
  console.log(JSON.stringify(users, null, 2));
} catch (e) {
  console.error(e.message);
}
