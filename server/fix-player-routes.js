const fs = require('fs');
const path = require('path');

// Путь к файлу server.js
const serverJsPath = path.join(__dirname, 'server.js');

// Читаем содержимое файла
let content = fs.readFileSync(serverJsPath, 'utf8');

// Находим и удаляем дублирующие маршруты игроков
const startPattern = 'app.post("/api/players", upload.single("avatar"), (req, res) => {';
const endPattern = 'app.get("/api/teams/:teamId/players", (req, res) => {';

// Находим позиции начала и конца блока для удаления
const startPos = content.indexOf(startPattern);
const endPos = content.indexOf(endPattern);

if (startPos !== -1 && endPos !== -1) {
    // Создаем новое содержимое файла
    const newContent = 
        content.substring(0, startPos) + 
        '// Дублирующие маршруты игроков были удалены, так как они уже обрабатываются через app.use("/api/players", playersRoutes)\n\n' +
        endPattern +
        content.substring(endPos + endPattern.length);
    
    // Создаем резервную копию
    fs.writeFileSync(serverJsPath + '.bak2', content);
    
    // Записываем новое содержимое
    fs.writeFileSync(serverJsPath, newContent);
    
    console.log('Дублирующие маршруты игроков успешно удалены!');
} else {
    console.log('Не удалось найти дублирующие маршруты игроков в файле server.js');
} 