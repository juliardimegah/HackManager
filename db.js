const { createClient } = require('@libsql/client');
const path = require('path');

const IS_VERCEL = process.env.VERCEL === '1';

let client = null;

async function getDb() {
  if (client) return client;

  if (process.env.TURSO_DATABASE_URL) {
    // Production: use Turso cloud database
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
  } else {
    // Local dev: use SQLite file
    const dbPath = path.join(__dirname, 'hackathon.db');
    client = createClient({
      url: `file:${dbPath}`
    });
  }

  // Create tables
  await client.execute(`
    CREATE TABLE IF NOT EXISTS hackathon_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT DEFAULT 'Hackathon 2026',
      end_time TEXT NOT NULL,
      CHECK (id = 1)
    )
  `);

  await client.execute(`
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

  await client.execute(`
    CREATE TABLE IF NOT EXISTS randomizer_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      picked_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id INTEGER PRIMARY KEY DEFAULT 1,
      username TEXT NOT NULL DEFAULT 'admin',
      password TEXT NOT NULL DEFAULT 'admin123',
      CHECK (id = 1)
    )
  `);

  // Seed default hackathon settings if not exists
  const settingsResult = await client.execute('SELECT COUNT(*) as count FROM hackathon_settings');
  if (settingsResult.rows[0].count === 0) {
    const endTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    await client.execute({
      sql: 'INSERT INTO hackathon_settings (id, name, end_time) VALUES (1, ?, ?)',
      args: ['Hackathon 2026', endTime]
    });
  }

  // Seed default admin credentials if not exists
  const adminResult = await client.execute('SELECT COUNT(*) as count FROM admin_credentials');
  if (adminResult.rows[0].count === 0) {
    await client.execute({
      sql: 'INSERT INTO admin_credentials (id, username, password) VALUES (1, ?, ?)',
      args: ['admin', 'admin123']
    });
  }

  return client;
}

// Helper: run SELECT and return array of objects
async function queryAll(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows;
}

// Helper: run SELECT and return single object
async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run INSERT/UPDATE/DELETE
async function execute(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.rowsAffected };
}

module.exports = { getDb, queryAll, queryOne, execute };
