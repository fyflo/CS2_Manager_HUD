const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

db.serialize(() => {
  // Создаем таблицу команд
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    region TEXT,
    logo TEXT,
    short_name TEXT
  )`);

  // Создаем таблицу игроков
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    real_name TEXT,
    steam64 TEXT UNIQUE,
    team_id INTEGER,
    avatar TEXT,
    cameraLink TEXT,
    FOREIGN KEY(team_id) REFERENCES teams(id)
  )`);
});

module.exports = db;