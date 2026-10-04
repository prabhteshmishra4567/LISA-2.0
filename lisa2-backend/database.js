const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

function createStore(filename = path.join(__dirname, 'lisa_ai.db')) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'New conversation',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_owner ON sessions(owner_id, updated_at);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL, sources_json TEXT NOT NULL DEFAULT '[]',
      suggestions_html TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_session ON messages(conversation_id);
  `);
  const get = (id, owner) => db.prepare('SELECT * FROM sessions WHERE id = ? AND owner_id = ?').get(id, owner);
  const messages = (id) => db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY rowid').all(id)
    .map(({ sources_json, suggestions_html, ...message }) => ({ ...message, sources: JSON.parse(sources_json), searchSuggestions: suggestions_html }));
  return {
    list(owner) {
      return db.prepare('SELECT id, title, created_at, updated_at FROM sessions WHERE owner_id = ? ORDER BY updated_at DESC').all(owner);
    },
    get, messages,
    create(owner, title = 'New conversation') {
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO sessions (id, owner_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, owner, title, now, now);
      return get(id, owner);
    },
    rename(id, owner, title) {
      db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ? AND owner_id = ?').run(title, new Date().toISOString(), id, owner);
      return get(id, owner);
    },
    remove(id, owner) {
      return db.prepare('DELETE FROM sessions WHERE id = ? AND owner_id = ?').run(id, owner).changes > 0;
    },
    saveTurn(id, question, answer, sources = [], suggestions = '') {
      const now = new Date().toISOString();
      const insert = db.prepare('INSERT INTO messages (id, conversation_id, role, content, sources_json, suggestions_html, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      db.exec('BEGIN IMMEDIATE');
      try {
        insert.run(randomUUID(), id, 'user', question, '[]', '', now);
        insert.run(randomUUID(), id, 'assistant', answer, JSON.stringify(sources), suggestions, now);
        db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return messages(id).slice(-2);
    },
    close: () => db.close(),
  };
}
module.exports = { createStore };
