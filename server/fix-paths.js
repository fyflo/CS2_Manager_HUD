const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Определяем путь к базе данных
const dbPath = path.join(__dirname, '../database.db');
console.log('Используется база данных:', dbPath);

// Подключаемся к базе данных
const db = new sqlite3.Database(dbPath);

// Функция для исправления путей к логотипам команд
function fixTeamLogos() {
    return new Promise((resolve, reject) => {
        db.all('SELECT id, logo FROM teams', [], (err, teams) => {
            if (err) {
                console.error('Ошибка при получении данных о командах:', err);
                reject(err);
                return;
            }

            const promises = teams.map(team => {
                return new Promise((resolveTeam, rejectTeam) => {
                    if (team.logo && team.logo.startsWith('/uploads/')) {
                        const fixedLogo = team.logo.replace('/uploads/', '');
                        db.run('UPDATE teams SET logo = ? WHERE id = ?', [fixedLogo, team.id], (err) => {
                            if (err) {
                                console.error(`Ошибка при обновлении логотипа команды ${team.id}:`, err);
                                rejectTeam(err);
                                return;
                            }
                            console.log(`Исправлен путь к логотипу команды ${team.id}: ${team.logo} -> ${fixedLogo}`);
                            resolveTeam();
                        });
                    } else {
                        resolveTeam();
                    }
                });
            });

            Promise.all(promises)
                .then(() => {
                    console.log('Все пути к логотипам команд исправлены');
                    resolve();
                })
                .catch(error => {
                    console.error('Ошибка при исправлении путей к логотипам команд:', error);
                    reject(error);
                });
        });
    });
}

// Функция для исправления путей к аватарам игроков
function fixPlayerAvatars() {
    return new Promise((resolve, reject) => {
        db.all('SELECT id, avatar FROM players', [], (err, players) => {
            if (err) {
                console.error('Ошибка при получении данных об игроках:', err);
                reject(err);
                return;
            }

            const promises = players.map(player => {
                return new Promise((resolvePlayer, rejectPlayer) => {
                    if (player.avatar && player.avatar.startsWith('/uploads/')) {
                        const fixedAvatar = player.avatar.replace('/uploads/', '');
                        db.run('UPDATE players SET avatar = ? WHERE id = ?', [fixedAvatar, player.id], (err) => {
                            if (err) {
                                console.error(`Ошибка при обновлении аватара игрока ${player.id}:`, err);
                                rejectPlayer(err);
                                return;
                            }
                            console.log(`Исправлен путь к аватару игрока ${player.id}: ${player.avatar} -> ${fixedAvatar}`);
                            resolvePlayer();
                        });
                    } else {
                        resolvePlayer();
                    }
                });
            });

            Promise.all(promises)
                .then(() => {
                    console.log('Все пути к аватарам игроков исправлены');
                    resolve();
                })
                .catch(error => {
                    console.error('Ошибка при исправлении путей к аватарам игроков:', error);
                    reject(error);
                });
        });
    });
}

// Проверка наличия колонки cameraLink в таблице players
function checkCameraLinkColumn() {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(players)`, (err, rows) => {
            if (err) {
                console.error('Ошибка при проверке схемы таблицы players:', err);
                reject(err);
                return;
            }
            
            // Проверяем существование колонки cameraLink
            const hasCameraLink = rows && rows.some(row => row.name === 'cameraLink');
            
            if (!hasCameraLink) {
                db.run(`ALTER TABLE players ADD COLUMN cameraLink TEXT`, (err) => {
                    if (err) {
                        console.error('Ошибка при добавлении колонки cameraLink:', err);
                        reject(err);
                        return;
                    }
                    console.log('Колонка cameraLink успешно добавлена в таблицу players');
                    resolve();
                });
            } else {
                console.log('Колонка cameraLink уже существует в таблице players');
                resolve();
            }
        });
    });
}

// Запускаем все функции исправления
async function fixAll() {
    try {
        await checkCameraLinkColumn();
        await fixTeamLogos();
        await fixPlayerAvatars();
        console.log('Все исправления успешно применены');
    } catch (error) {
        console.error('Произошла ошибка при исправлении данных:', error);
    } finally {
        db.close();
    }
}

// Запускаем исправления
fixAll(); 