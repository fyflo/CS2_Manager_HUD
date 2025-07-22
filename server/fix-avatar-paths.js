const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Connect to the database
const dbPath = path.join(__dirname, '../database.db');
console.log('Using database:', dbPath);
const db = new sqlite3.Database(dbPath);

// Fix avatar paths in players table
db.all('SELECT id, avatar FROM players', [], (err, players) => {
    if (err) {
        console.error('Error querying players:', err);
        return;
    }
    
    console.log(`Found ${players.length} players to check`);
    let fixedCount = 0;
    
    players.forEach(player => {
        // Пропускаем игроков без аватарок
        if (!player.avatar) {
            console.log(`Player ${player.id} has no avatar`);
            return;
        }
        
        // Проверяем, существует ли файл аватарки в uploads
        const uploadsPath = path.join(__dirname, '../public/uploads');
        const avatarPath = path.join(uploadsPath, player.avatar);
        
        if (fs.existsSync(avatarPath)) {
            console.log(`Avatar exists for player ${player.id}: ${player.avatar}`);
        } else {
            console.log(`Avatar file not found for player ${player.id}: ${player.avatar}`);
            
            // Проверяем, есть ли файл с префиксом /uploads/
            if (player.avatar.startsWith('/uploads/')) {
                const fixedAvatar = player.avatar.replace('/uploads/', '');
                const fixedPath = path.join(uploadsPath, fixedAvatar);
                
                if (fs.existsSync(fixedPath)) {
                    db.run('UPDATE players SET avatar = ? WHERE id = ?', [fixedAvatar, player.id], (err) => {
                        if (err) {
                            console.error(`Error fixing avatar path for player ${player.id}:`, err);
                        } else {
                            console.log(`Fixed avatar path for player ${player.id}: ${player.avatar} -> ${fixedAvatar}`);
                            fixedCount++;
                        }
                    });
                }
            } else {
                // Проверяем, существует ли файл с добавленным префиксом /uploads/
                const alternativePath = path.join(uploadsPath, `/uploads/${player.avatar}`);
                if (fs.existsSync(alternativePath)) {
                    console.log(`Found avatar at alternative path: /uploads/${player.avatar}`);
                }
            }
        }
    });
    
    console.log(`Fixed ${fixedCount} avatar paths`);
});

// Close the database connection after a delay to ensure all updates complete
setTimeout(() => {
    console.log('Closing database connection');
    db.close();
    console.log('Done');
}, 1000); 