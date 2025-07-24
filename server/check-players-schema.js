const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Подключаемся к базе данных
const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

// Проверяем структуру таблицы players
db.all("PRAGMA table_info(players)", [], (err, rows) => {
    if (err) {
        console.error("Ошибка при проверке структуры таблицы players:", err);
        db.close();
        return;
    }
    
    console.log("Структура таблицы players:");
    console.log(rows);
    
    // Проверяем наличие колонки created_at
    const hasCreatedAtColumn = rows.some(row => row.name === 'created_at');
    console.log("Колонка created_at существует:", hasCreatedAtColumn);
    
    // Если колонки created_at нет, добавляем её
    if (!hasCreatedAtColumn) {
        console.log("Добавляем колонку created_at в таблицу players...");
        db.run("ALTER TABLE players ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (err) => {
            if (err) {
                console.error("Ошибка при добавлении колонки created_at:", err);
            } else {
                console.log("Колонка created_at успешно добавлена в таблицу players");
            }
            db.close();
        });
    } else {
        db.close();
    }
}); 