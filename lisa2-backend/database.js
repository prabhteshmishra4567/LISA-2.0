const sqlite3 = require("sqlite3").verbose();

// Connect to SQLite database (Creates if it doesn't exist)
const db = new sqlite3.Database("./lisa_ai.db", (err) => {
  if (err) {
    console.error("Error connecting to database:", err);
  } else {
    console.log("Connected to SQLite Database ✅");
  }
});

// Create a table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
