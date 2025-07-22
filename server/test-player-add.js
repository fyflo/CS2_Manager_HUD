const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Определяем путь к базе данных
const dbPath = path.join(__dirname, '..', 'database.db');
console.log('Путь к базе данных:', dbPath);
console.log('База данных существует:', fs.existsSync(dbPath));

const db = new sqlite3.Database(dbPath);

// Тестируем добавление игрока
console.log('Тестирование добавления игрока...');

// Создаем тестового игрока
const testPlayer = {
    nickname: 'TestPlayer_' + Date.now(),
    realName: 'Test Player',
    steam64: '7656119' + Math.floor(Math.random() * 10000000),
    teamId: null,
    avatar: null,
    cameraLink: null
};

// Добавляем игрока в базу
db.run(
    "INSERT INTO players (nickname, realName, steam64, teamId, avatar, cameraLink) VALUES (?, ?, ?, ?, ?, ?)",
    [testPlayer.nickname, testPlayer.realName, testPlayer.steam64, testPlayer.teamId, testPlayer.avatar, testPlayer.cameraLink],
    function (err) {
        if (err) {
            console.error('Ошибка при добавлении тестового игрока:', err);
        } else {
            const playerId = this.lastID;
            console.log(`Тестовый игрок успешно добавлен с ID: ${playerId}`);
            
            // Проверяем, что игрок действительно добавлен
            db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, player) => {
                if (err) {
                    console.error('Ошибка при получении добавленного игрока:', err);
                } else if (player) {
                    console.log('Данные добавленного игрока:', player);
                } else {
                    console.error('Игрок не найден после добавления!');
                }
                
                // Закрываем соединение с базой данных
                db.close();
            });
        }
    }
); 