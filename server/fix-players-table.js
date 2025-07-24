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
    
    // Если колонки created_at нет, создаем новую таблицу
    if (!hasCreatedAtColumn) {
        console.log("Создаем новую таблицу players с колонкой created_at...");
        
        // 1. Создаем временную таблицу
        db.run(`
            CREATE TABLE players_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT NOT NULL,
                realName TEXT,
                steam64 TEXT,
                teamId INTEGER,
                avatar TEXT,
                cameraLink TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(teamId) REFERENCES teams(id)
            )
        `, (err) => {
            if (err) {
                console.error("Ошибка при создании новой таблицы players_new:", err);
                db.close();
                return;
            }
            
            // 2. Копируем данные из старой таблицы
            db.run(`
                INSERT INTO players_new (id, nickname, realName, steam64, teamId, avatar, cameraLink)
                SELECT id, nickname, realName, steam64, teamId, avatar, cameraLink FROM players
            `, (err) => {
                if (err) {
                    console.error("Ошибка при копировании данных в новую таблицу:", err);
                    db.close();
                    return;
                }
                
                // 3. Удаляем старую таблицу
                db.run("DROP TABLE players", (err) => {
                    if (err) {
                        console.error("Ошибка при удалении старой таблицы:", err);
                        db.close();
                        return;
                    }
                    
                    // 4. Переименовываем новую таблицу
                    db.run("ALTER TABLE players_new RENAME TO players", (err) => {
                        if (err) {
                            console.error("Ошибка при переименовании таблицы:", err);
                            db.close();
                            return;
                        }
                        
                        console.log("Таблица players успешно обновлена с колонкой created_at");
                        db.close();
                    });
                });
            });
        });
    } else {
        db.close();
    }
}); 