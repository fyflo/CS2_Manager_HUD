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

// Fix avatar paths in players table
db.all('SELECT id, nickname, avatar FROM players', [], (err, players) => {
    if (err) {
        console.error('Error querying players:', err);
        return;
    }
    
    console.log(`Найдено ${players.length} игроков для проверки`);
    let fixedCount = 0;
    let missingCount = 0;
    
    players.forEach(player => {
        // Пропускаем игроков без аватарок
        if (!player.avatar) {
            console.log(`Игрок ${player.id} (${player.nickname}) не имеет аватарки`);
            return;
        }
        
        // Нормализуем путь к аватарке
        let normalizedAvatar = player.avatar;
        if (normalizedAvatar.startsWith('/uploads/')) {
            normalizedAvatar = normalizedAvatar.replace('/uploads/', '');
        }
        
        // Проверяем существование файла аватарки
        if (uploadedFiles.includes(normalizedAvatar)) {
            console.log(`Аватарка для игрока ${player.id} (${player.nickname}) найдена: ${normalizedAvatar}`);
            
            // Если путь в базе данных отличается от нормализованного, исправляем его
            if (player.avatar !== normalizedAvatar) {
                db.run('UPDATE players SET avatar = ? WHERE id = ?', [normalizedAvatar, player.id], (err) => {
                    if (err) {
                        console.error(`Ошибка при обновлении пути к аватарке для игрока ${player.id}:`, err);
                    } else {
                        console.log(`Исправлен путь к аватарке для игрока ${player.id}: ${player.avatar} -> ${normalizedAvatar}`);
                        fixedCount++;
                    }
                });
            }
        } else {
            console.error(`Аватарка для игрока ${player.id} (${player.nickname}) не найдена: ${normalizedAvatar}`);
            missingCount++;
            
            // Ищем подходящий файл в директории uploads
            const possibleMatches = uploadedFiles.filter(file => 
                file.startsWith('avatar-') && file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
            );
            
            if (possibleMatches.length > 0) {
                console.log(`Найдены возможные аватарки: ${possibleMatches.length} файлов`);
                // Используем первый найденный файл как аватарку
                const newAvatar = possibleMatches[0];
                db.run('UPDATE players SET avatar = ? WHERE id = ?', [newAvatar, player.id], (err) => {
                    if (err) {
                        console.error(`Ошибка при назначении новой аватарки для игрока ${player.id}:`, err);
                    } else {
                        console.log(`Назначена новая аватарка для игрока ${player.id}: ${player.avatar} -> ${newAvatar}`);
                        fixedCount++;
                    }
                });
            }
        }
    });
    
    setTimeout(() => {
        console.log(`Итоги проверки:`);
        console.log(`- Всего игроков: ${players.length}`);
        console.log(`- Исправлено путей: ${fixedCount}`);
        console.log(`- Не найдено аватарок: ${missingCount}`);
        
        // Закрываем соединение с базой данных
        db.close();
        console.log('Готово');
    }, 1000);
}); 