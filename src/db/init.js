const bcrypt = require('bcryptjs');
const { run, get } = require('./queries');

// Skema tabel — dipertahankan persis seperti versi monolith (database.js)
// supaya DB lama yang sudah dipakai user tetap kompatibel.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    short_code TEXT UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    click_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`,
  `CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    original_url TEXT NOT NULL,
    folder_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content_html TEXT,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`,
  `CREATE TABLE IF NOT EXISTS markdown_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content_md TEXT NOT NULL DEFAULT '',
    content_html TEXT DEFAULT '',
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`,
];

const DEFAULT_ADMIN = { username: 'admin', password: 'admin123' };

async function initializeDatabase() {
  for (const sql of SCHEMA) {
    await run(sql);
  }

  // Seed user admin default kalau belum ada
  const existing = await get('SELECT id FROM users WHERE username = ?', [DEFAULT_ADMIN.username]);
  if (!existing) {
    const hashed = bcrypt.hashSync(DEFAULT_ADMIN.password, 10);
    await run('INSERT INTO users (username, password) VALUES (?, ?)', [DEFAULT_ADMIN.username, hashed]);
    console.log(`Default admin user created (username: ${DEFAULT_ADMIN.username})`);
  }
}

module.exports = { initializeDatabase };