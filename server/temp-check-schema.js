const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Определяем путь к базе данных
const dbPath = path.join(__dirname, '..', 'database.db');
console.log('Путь к базе данных:', dbPath);
console.log('База данных существует:', fs.existsSync(dbPath));

const db = new sqlite3.Database(dbPath);

// Проверяем схему таблицы players
console.log('Проверка схемы таблицы players...');
db.all(`PRAGMA table_info(players)`, (err, rows) => {
    if (err) {
        console.error('Ошибка при проверке схемы таблицы players:', err);
        return;
    }
    
    console.log('Схема таблицы players:');
    rows.forEach(row => {
        console.log(`${row.cid}: ${row.name} (${row.type})${row.notnull ? ' NOT NULL' : ''}${row.pk ? ' PRIMARY KEY' : ''}`);
    });
    
    // Проверяем наличие колонки created_at
    const hasCreatedAt = rows.some(row => row.name === 'created_at');
    console.log('Есть ли колонка created_at:', hasCreatedAt);
    
    // Пробуем добавить тестового игрока
    console.log('Попытка добавления тестового игрока...');
    db.run(
        "INSERT INTO players (nickname, realName, steam64, teamId, avatar, cameraLink) VALUES (?, ?, ?, ?, ?, ?)",
        ["TestPlayer", "Test Name", "123456789", null, null, null],
        function (err) {
            if (err) {
                console.error('Ошибка при добавлении тестового игрока:', err);
                
                // Если ошибка связана с отсутствием колонки created_at, попробуем её добавить
                if (err.message.includes('created_at') && !hasCreatedAt) {
                    console.log('Попытка добавления колонки created_at...');
                    db.run("ALTER TABLE players ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP", function(alterErr) {
                        if (alterErr) {
                            console.error('Ошибка при добавлении колонки created_at:', alterErr);
                        } else {
                            console.log('Колонка created_at успешно добавлена');
                            
                            // Пробуем снова добавить игрока
                            db.run(
                                "INSERT INTO players (nickname, realName, steam64, teamId, avatar, cameraLink, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
                                ["TestPlayer", "Test Name", "123456789", null, null, null],
                                function (insertErr) {
                                    if (insertErr) {
                                        console.error('Ошибка при повторном добавлении игрока:', insertErr);
                                    } else {
                                        console.log('Тестовый игрок успешно добавлен после изменения схемы');
                                    }
                                    db.close();
                                }
                            );
                        }
                    });
                } else {
                    db.close();
                }
            } else {
                console.log('Тестовый игрок успешно добавлен');
                db.close();
            }
        }
    );
}); 