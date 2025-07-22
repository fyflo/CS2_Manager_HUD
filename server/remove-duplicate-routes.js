const fs = require('fs');
const path = require('path');

// Путь к файлу server.js
const serverFilePath = path.join(__dirname, 'server.js');

// Читаем содержимое файла
fs.readFile(serverFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Ошибка при чтении файла:', err);
        return;
    }

    // Массив регулярных выражений для поиска маршрутов, которые нужно удалить
    const routesToRemove = [
        // Маршруты для команд
        /app\.get\('\/api\/teams\/search'[\s\S]*?}\);/g,
        /app\.get\('\/api\/teams'[\s\S]*?}\);/g,
        /app\.get\('\/api\/teams\/:id'[\s\S]*?}\);/g,
        /app\.post\('\/api\/teams'[\s\S]*?}\);/g,
        /app\.put\('\/api\/teams\/:id'[\s\S]*?}\);/g,
        /app\.delete\('\/api\/teams\/:id'[\s\S]*?}\);/g,
        /app\.get\('\/api\/teams\/:teamId\/players'[\s\S]*?}\);/g,
        
        // Маршруты для игроков
        /app\.get\('\/api\/players'[\s\S]*?}\);/g,
        /app\.get\('\/api\/players\/:id'[\s\S]*?}\);/g,
        /app\.post\('\/api\/players'[\s\S]*?}\);/g,
        /app\.put\('\/api\/players\/:id'[\s\S]*?}\);/g,
        /app\.delete\('\/api\/players\/:id'[\s\S]*?}\);/g
    ];

    // Удаляем маршруты
    let newData = data;
    for (const regex of routesToRemove) {
        newData = newData.replace(regex, '// Маршрут перемещен в отдельный файл');
    }

    // Записываем изменения в файл
    fs.writeFile(serverFilePath, newData, 'utf8', (err) => {
        if (err) {
            console.error('Ошибка при записи файла:', err);
            return;
        }
        console.log('Дублирующие маршруты успешно удалены из server.js');
    });
}); 