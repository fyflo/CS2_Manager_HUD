const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Connect to the database
const dbPath = path.join(__dirname, '../database.db');
console.log('Using database:', dbPath);
const db = new sqlite3.Database(dbPath);

// Путь к директории с загруженными аватарками
const uploadsPath = path.join(__dirname, '../public/uploads');

// Проверяем существование директории
if (!fs.existsSync(uploadsPath)) {
    console.error(`Директория ${uploadsPath} не существует!`);
    process.exit(1);
}

// Получаем список всех файлов в директории uploads
const uploadedFiles = fs.readdirSync(uploadsPath);
console.log(`Найдено ${uploadedFiles.length} файлов в директории uploads`);

// Фильтруем только файлы аватарок
const avatarFiles = uploadedFiles.filter(file => 
    file.startsWith('avatar-') && (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
);
console.log(`Найдено ${avatarFiles.length} файлов аватарок`);

// Исправляем пути к аватаркам в таблице players
console.log('Исправление путей к аватаркам в базе данных...');

// 1. Сначала удаляем префикс /uploads/ у всех аватарок
db.run(`
    UPDATE players 
    SET avatar = REPLACE(avatar, '/uploads/', '') 
    WHERE avatar LIKE '/uploads/%'
`, function(err) {
    if (err) {
        console.error('Ошибка при удалении префикса /uploads/:', err);
    } else {
        console.log(`Удален префикс /uploads/ у ${this.changes} записей`);
    }

    // 2. Проверяем каждого игрока и исправляем пути к аватаркам
    db.all('SELECT id, nickname, avatar FROM players', [], (err, players) => {
        if (err) {
            console.error('Ошибка при запросе игроков:', err);
            return;
        }
        
        console.log(`Найдено ${players.length} игроков для проверки`);
        let fixedCount = 0;
        let missingCount = 0;
        let assignedCount = 0;
        
        const updatePromises = players.map(player => {
            return new Promise((resolve) => {
                // Пропускаем игроков без аватарок
                if (!player.avatar) {
                    console.log(`Игрок ${player.id} (${player.nickname}) не имеет аватарки`);
                    resolve();
                    return;
                }
                
                // Проверяем существование файла аватарки
                if (fs.existsSync(path.join(uploadsPath, player.avatar))) {
                    console.log(`Аватарка для игрока ${player.id} (${player.nickname}) найдена: ${player.avatar}`);
                    resolve();
                } else {
                    console.error(`Аватарка для игрока ${player.id} (${player.nickname}) не найдена: ${player.avatar}`);
                    missingCount++;
                    
                    // Назначаем новую аватарку из доступных
                    if (avatarFiles.length > 0) {
                        // Используем случайную аватарку из доступных
                        const randomIndex = Math.floor(Math.random() * avatarFiles.length);
                        const newAvatar = avatarFiles[randomIndex];
                        
                        db.run('UPDATE players SET avatar = ? WHERE id = ?', [newAvatar, player.id], (err) => {
                            if (err) {
                                console.error(`Ошибка при назначении новой аватарки для игрока ${player.id}:`, err);
                                resolve();
                            } else {
                                console.log(`Назначена новая аватарка для игрока ${player.id}: ${player.avatar} -> ${newAvatar}`);
                                assignedCount++;
                                resolve();
                            }
                        });
                    } else {
                        resolve();
                    }
                }
            });
        });
        
        Promise.all(updatePromises).then(() => {
            console.log(`Итоги проверки:`);
            console.log(`- Всего игроков: ${players.length}`);
            console.log(`- Исправлено путей: ${fixedCount}`);
            console.log(`- Не найдено аватарок: ${missingCount}`);
            console.log(`- Назначено новых аватарок: ${assignedCount}`);
            
            // Закрываем соединение с базой данных
            db.close();
            console.log('Готово');
        });
    });
}); 