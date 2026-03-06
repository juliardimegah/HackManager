const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const IS_VERCEL = process.env.VERCEL === '1';
const DB_PATH = IS_VERCEL
  ? path.join('/tmp', 'hackathon.db')
  : path.join(__dirname, 'hackathon.db');

let db = null;

async function getDb() {
  if (db) return db;

  const sqlOptions = IS_VERCEL
    ? { locateFile: () => 'https://sql.js.org/dist/sql-wasm.wasm' }
    : {};
  const SQL = await initSqlJs(sqlOptions);

  // Load existing database file or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS hackathon_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT DEFAULT 'Hackathon 2026',
      end_time TEXT NOT NULL,
      CHECK (id = 1)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name TEXT NOT NULL,
      members TEXT NOT NULL,
      project_title TEXT NOT NULL,
      description TEXT,
      demo_link TEXT,
      file_path TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'presented')),
      submitted_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS randomizer_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      picked_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id INTEGER PRIMARY KEY DEFAULT 1,
      username TEXT NOT NULL DEFAULT 'admin',
      password TEXT NOT NULL DEFAULT 'admin123',
      CHECK (id = 1)
    )
  `);

  // Seed default hackathon settings if not exists
  const result = db.exec('SELECT COUNT(*) as count FROM hackathon_settings');
  const count = result.length > 0 ? result[0].values[0][0] : 0;
  if (count === 0) {
    const endTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    db.run('INSERT INTO hackathon_settings (id, name, end_time) VALUES (1, ?, ?)', ['Hackathon 2026', endTime]);
    saveDb();
  }

  // Seed default admin credentials if not exists
  const adminResult = db.exec('SELECT COUNT(*) as count FROM admin_credentials');
  const adminCount = adminResult.length > 0 ? adminResult[0].values[0][0] : 0;
  if (adminCount === 0) {
    db.run('INSERT INTO admin_credentials (id, username, password) VALUES (1, ?, ?)', ['admin', 'admin123']);
    saveDb();
  }

  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Helper: run SELECT and return array of objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run SELECT and return single object
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run INSERT/UPDATE/DELETE
function execute(sql, params = []) {
  db.run(sql, params);
  saveDb();
  return { lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0].values[0][0], changes: db.getRowsModified() };
}

module.exports = { getDb, saveDb, queryAll, queryOne, execute };
