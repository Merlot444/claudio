const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'claudio.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    artist TEXT,
    played_at INTEGER,
    source_url TEXT
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT,
    content TEXT,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER
  );
`);

function addPlay({ title, artist, source_url }) {
  db.prepare(
    'INSERT INTO plays (title, artist, played_at, source_url) VALUES (?, ?, ?, ?)'
  ).run(title, artist, Date.now(), source_url || '');
}

function recentPlays(limit = 20) {
  return db.prepare(
    'SELECT title, artist, played_at, source_url FROM plays ORDER BY played_at DESC LIMIT ?'
  ).all(limit);
}

function addMessage(role, content) {
  db.prepare(
    'INSERT INTO messages (role, content, created_at) VALUES (?, ?, ?)'
  ).run(role, content, Date.now());
}

function recentMessages(limit = 20) {
  return db.prepare(
    'SELECT role, content, created_at FROM messages ORDER BY created_at DESC LIMIT ?'
  ).all(limit).reverse();
}

function setPref(key, value) {
  db.prepare(
    'INSERT OR REPLACE INTO prefs (key, value, updated_at) VALUES (?, ?, ?)'
  ).run(key, typeof value === 'string' ? value : JSON.stringify(value), Date.now());
}

function getPref(key) {
  const row = db.prepare('SELECT value FROM prefs WHERE key = ?').get(key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

module.exports = { addPlay, recentPlays, addMessage, recentMessages, setPref, getPref };
