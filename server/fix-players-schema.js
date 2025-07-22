const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Определяем путь к базе данных
const dbPath = path.join(__dirname, '..', 'database.db');
console.log('Путь к базе данных:', dbPath);
console.log('База данных существует:', fs.existsSync(dbPath));

const db = new sqlite3.Database(dbPath);

// Начинаем транзакцию
db.serialize(() => {
    console.log('Начинаем исправление схемы таблицы players...');
    
    // Проверяем текущую схему
    db.all(`PRAGMA table_info(players)`, (err, rows) => {
        if (err) {
            console.error('Ошибка при проверке схемы таблицы players:', err);
            return;
        }
        
        console.log('Текущая схема таблицы players:');
        rows.forEach(row => {
            console.log(`${row.cid}: ${row.name} (${row.type})${row.notnull ? ' NOT NULL' : ''}${row.pk ? ' PRIMARY KEY' : ''}`);
        });
        
        // Проверяем наличие колонки created_at
        const hasCreatedAt = rows.some(row => row.name === 'created_at');
        console.log('Есть ли колонка created_at:', hasCreatedAt);
        
        if (!hasCreatedAt) {
            console.log('Исправляем схему таблицы players...');
            
            // 1. Создаем временную таблицу с правильной схемой
            db.run(`
                CREATE TABLE players_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nickname TEXT NOT NULL,
                    realName TEXT,
                    steam64 TEXT,
                    teamId INTEGER,
                    avatar TEXT,
                    cameraLink TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(teamId) REFERENCES teams(id)
                )
            `, function(err) {
                if (err) {
                    console.error('Ошибка при создании новой таблицы players_new:', err);
                    return;
                }
                
                console.log('Временная таблица players_new создана');
                
                // 2. Копируем данные из старой таблицы в новую
                db.run(`
                    INSERT INTO players_new (id, nickname, realName, steam64, teamId, avatar, cameraLink)
                    SELECT id, nickname, realName, steam64, teamId, avatar, cameraLink FROM players
                `, function(err) {
                    if (err) {
                        console.error('Ошибка при копировании данных в новую таблицу:', err);
                        return;
                    }
                    
                    console.log('Данные успешно скопированы в новую таблицу');
                    
                    // 3. Удаляем старую таблицу
                    db.run(`DROP TABLE players`, function(err) {
                        if (err) {
                            console.error('Ошибка при удалении старой таблицы:', err);
                            return;
                        }
                        
                        console.log('Старая таблица players удалена');
                        
                        // 4. Переименовываем новую таблицу
                        db.run(`ALTER TABLE players_new RENAME TO players`, function(err) {
                            if (err) {
                                console.error('Ошибка при переименовании новой таблицы:', err);
                                return;
                            }
                            
                            console.log('Таблица players_new переименована в players');
                            
                            // 5. Проверяем обновленную схему
                            db.all(`PRAGMA table_info(players)`, (err, updatedRows) => {
                                if (err) {
                                    console.error('Ошибка при проверке обновленной схемы:', err);
                                } else {
                                    console.log('Обновленная схема таблицы players:');
                                    updatedRows.forEach(row => {
                                        console.log(`${row.cid}: ${row.name} (${row.type})${row.notnull ? ' NOT NULL' : ''}${row.pk ? ' PRIMARY KEY' : ''}`);
                                    });
                                    console.log('Исправление схемы таблицы players завершено успешно');
                                }
                            });
                        });
                    });
                });
            });
        } else {
            console.log('Колонка created_at уже существует, исправление не требуется');
        }
    });
});

// Закрываем соединение с базой данных после выполнения всех операций
process.on('exit', () => {
    db.close();
    console.log('Соединение с базой данных закрыто');
}); 