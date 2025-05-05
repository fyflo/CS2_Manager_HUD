const express = require('express');
const ip = require('ip');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');

const io = new Server(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Получаем IP адрес сервера
const serverIP = ip.address();


// Настройка статических файлов
app.use(express.static('public'));

// Socket.IO подключения
io.on('connection', (socket) => {
    //console.log('Клиент подключился');

    socket.on('disconnect', () => {
        //console.log('Клиент отключился');
    });
});

// Маршрут для получения информации о сервере
app.get('/api/server-info', (req, res) => {
    res.json({
        ip: serverIP,
        port: PORT
    });
});


const multer = require('multer');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Загрузка локализаций
const locales = {
    ru: require('../public/locales/ru.js'),
    en: require('../public/locales/en.js'),
    zh: require('../public/locales/zh.js')
  };

// Создаем отдельный сервер для GSI данных
const gsiApp = express();
const gsiServer = require('http').createServer(gsiApp);

// Добавляем парсеры для JSON и URL-encoded данных
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
gsiApp.use(express.json({ limit: '50mb' }));
gsiApp.use(express.urlencoded({ extended: true }));

// Настройка статических файлов
app.use(express.static(path.join(__dirname, '../public')));
app.use('/huds', express.static(path.join(__dirname, '../public/huds')));

// Настройка хранения файлов
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Создаем папку для загрузок, если её нет
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware для определения языка (исправленный с проверкой на undefined)
app.use((req, res, next) => {
    // Проверяем, что cookies определены
    const cookies = req.cookies || {};
    
    // Получаем предпочтительный язык из куки или параметра запроса
    let lang = cookies.lang || req.query.lang || 'ru'; // По умолчанию русский
    
    // Проверяем, поддерживается ли выбранный язык
    if (!locales[lang]) {
      lang = 'ru';
    }
    
    // Сохраняем выбранный язык в куки на 1 год, если он был передан в запросе
    if (req.query.lang && req.query.lang !== cookies.lang) {
      res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000 });
    }
    
    // Добавляем переменные локализации к res.locals для использования в шаблонах
    res.locals.lang = lang;
    res.locals.t = locales[lang];
    
    next();
  });
  
  // API для изменения языка
  app.get('/api/change-language', (req, res) => {
    const lang = req.query.lang || 'ru';
    
    if (locales[lang]) {
      // Просто возвращаем выбранный язык без сохранения в cookies
      res.json({ success: true, language: lang });
    } else {
      res.status(400).json({ success: false, message: 'Unsupported language' });
    }
  });
  
  // API для получения текущего языка и всех доступных переводов
  app.get('/api/get-translations', (req, res) => {
    const lang = req.query.lang || 'ru';
    const translationsToSend = locales[lang] || locales['ru']; // Если выбранного языка нет, используем русский
    
    res.json({ 
      language: lang, 
      translations: translationsToSend 
    });
  });

// Настройка базы данных
const db = new sqlite3.Database('database.db');

// В начале файла после создания базы данных
db.serialize(() => {
    // Создание основной структуры таблицы matches
    db.run(`CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_name TEXT,
        team1_id INTEGER,
        team2_id INTEGER,
        status TEXT DEFAULT 'pending',
        map TEXT,
        format TEXT DEFAULT 'bo1',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(team1_id) REFERENCES teams(id),
        FOREIGN KEY(team2_id) REFERENCES teams(id)
    )`);

    // Добавляем колонки для счета, если их нет
    db.run(`
        SELECT score_team1 FROM matches LIMIT 1
    `, [], (err) => {
        if (err) {
            // Колонка не существует, добавляем её
            db.run(`ALTER TABLE matches ADD COLUMN score_team1 INTEGER DEFAULT 0`);
        }
    });

    db.run(`
        SELECT score_team2 FROM matches LIMIT 1
    `, [], (err) => {
        if (err) {
            // Колонка не существует, добавляем её
            db.run(`ALTER TABLE matches ADD COLUMN score_team2 INTEGER DEFAULT 0`);
        }
    });
});

// Настройка шаблонизатора
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, '../public'));


// В начале файла, где создаются таблицы

db.serialize(() => {
    // Сначала удалим существующую таблицу matches
    db.run(`DROP TABLE IF EXISTS matches`);

    // Создаем таблицу заново с правильной структурой
    db.run(`CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team1_id INTEGER,
        team2_id INTEGER,
        match_name TEXT,
        map TEXT,
        status TEXT DEFAULT 'pending',
        score_team1 INTEGER DEFAULT 0,
        score_team2 INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(team1_id) REFERENCES teams(id),
        FOREIGN KEY(team2_id) REFERENCES teams(id)
    )`);
});


// Стандартные пути установки Steam
const defaultSteamPaths = [
  "C:\\Program Files (x86)\\Steam",
  "C:\\Program Files\\Steam",
  "D:\\Program Files (x86)\\Steam",
  "D:\\Program Files\\Steam",
  "E:\\Program Files (x86)\\Steam",
  "E:\\Program Files\\Steam",
  "F:\\Program Files (x86)\\Steam",
  "F:\\Program Files\\Steam",
  "G:\\Program Files (x86)\\Steam",
  "G:\\Program Files\\Steam",
  "H:\\Program Files (x86)\\Steam",
  "H:\\Program Files\\Steam",
  "I:\\Program Files (x86)\\Steam",
  "I:\\Program Files\\Steam",
  "J:\\Program Files (x86)\\Steam",
  "J:\\Program Files\\Steam",
  "K:\\Program Files (x86)\\Steam",
  "K:\\Program Files\\Steam",
  "L:\\Program Files (x86)\\Steam",
  "L:\\Program Files\\Steam",
  "M:\\Program Files (x86)\\Steam",
  "M:\\Program Files\\Steam",
  "C:\\Steam",
  "D:\\Steam",
  "E:\\Steam",
  "F:\\Steam",
  "G:\\Steam",
  "H:\\Steam",
  "I:\\Steam",
  "J:\\Steam",
  "K:\\Steam",
  "L:\\Steam",
  "M:\\Steam"
];

// Функция для поиска CS2 в стандартных местах
function findCS2Path() {
  // Стандартные пути для библиотек Steam
  const libraryFolders = [];
  
  // Проверяем стандартные пути установки Steam
  for (const steamPath of defaultSteamPaths) {
    if (fs.existsSync(steamPath)) {
      // Добавляем стандартную библиотеку Steam
      libraryFolders.push(path.join(steamPath, "steamapps"));
      
      // Проверяем libraryfolders.vdf для дополнительных библиотек
      const libraryVdf = path.join(steamPath, "steamapps", "libraryfolders.vdf");
      if (fs.existsSync(libraryVdf)) {
        try {
          const content = fs.readFileSync(libraryVdf, 'utf8');
          // Простой парсинг путей в VDF (не идеальный, но работает для большинства случаев)
          const pathMatches = content.match(/"path"\s+"([^"]+)"/g);
          if (pathMatches) {
            for (const match of pathMatches) {
              const libPath = match.match(/"path"\s+"([^"]+)"/)[1].replace(/\\\\/g, '\\');
              libraryFolders.push(path.join(libPath, "steamapps"));
            }
          }
        } catch (err) {
          console.error("Ошибка при чтении libraryfolders.vdf:", err);
        }
      }
    }
  }
  
  // Проверяем каждую библиотеку на наличие CS2
  for (const libraryPath of libraryFolders) {
    // CS2 может быть по двум путям (старый CS:GO и новый CS2)
    const cs2Paths = [
      path.join(libraryPath, "common", "Counter-Strike Global Offensive"),
      path.join(libraryPath, "common", "Counter-Strike 2")
    ];
    
    for (const cs2Path of cs2Paths) {
      if (fs.existsSync(cs2Path)) {
        return cs2Path;
      }
    }
  }
  
  return null;
}

// Проверка и установка конфигов CS2
app.get('/api/check-cs2-configs', (req, res) => {
    try {
      const customPath = req.query.path; // Позволяем пользователю указать свой путь
      let cs2Path = customPath;
      
      if (!cs2Path) {
        cs2Path = findCS2Path();
      }
      
      if (!cs2Path || !fs.existsSync(cs2Path)) {
        return res.json({ 
          success: false, 
          message: 'CS2 не найден по стандартным путям. Укажите путь вручную.' 
        });
      }
      
      //console.info("Найдена установка CS2 в", cs2Path);
      // Обновленный правильный путь к конфигам
      const configDir = path.join(cs2Path, "game", "csgo", "cfg");
      
      // Проверяем существование обоих конфигов
        const gsiConfigPath = path.join(configDir, "gamestate_integration_fhud.cfg");
        const observerConfigPath = path.join(configDir, "observer.cfg");
        const observer_offConfigPath = path.join(configDir, "observer_off.cfg");
        const observer2ConfigPath = path.join(configDir, "observer2.cfg"); // Add this line

        const gsiInstalled = fs.existsSync(gsiConfigPath);
        const observerInstalled = fs.existsSync(observerConfigPath);
        const observer_offInstalled = fs.existsSync(observer_offConfigPath);
        const observer2Installed = fs.existsSync(observer2ConfigPath); // Add this line

        return res.json({ 
            success: true, 
            gsiInstalled: gsiInstalled,
            observerInstalled: observerInstalled,
            observer_offInstalled: observer_offInstalled,
            observer2Installed: observer2Installed, // Add this line
            path: cs2Path,
            configPath: configDir
        });
    } catch (error) {
      console.error("Ошибка при проверке конфигов:", error);
      return res.status(500).json({ success: false, message: 'Ошибка при проверке конфигов' });
    }
  });
  
  // Установка конфигов CS2
  app.get('/api/install-cs2-configs', (req, res) => {
    try {
      const customPath = req.query.path;
      let cs2Path = customPath;
      
      if (!cs2Path) {
        cs2Path = findCS2Path();
      }
      
      if (!cs2Path || !fs.existsSync(cs2Path)) {
        return res.json({ 
          success: false, 
          message: 'CS2 не найден по стандартным путям. Укажите путь вручную.' 
        });
      }
      
      // Обновленный правильный путь к конфигам
      const configDir = path.join(cs2Path, "game", "csgo", "cfg");
      
      // Создаем директорию конфига, если её нет
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Пути к исходным файлам конфигов из нашего проекта
      // In the install-cs2-configs endpoint:
        const sourceGsiPath = path.join(process.cwd(), "cfg", "gamestate_integration_fhud.cfg");
        const sourceObserverPath = path.join(process.cwd(), "cfg", "observer.cfg");
        const sourceObserver_offPath = path.join(process.cwd(), "cfg", "observer_off.cfg");
        const sourceObserver2Path = path.join(process.cwd(), "cfg", "observer2.cfg"); // Add this line

        // Destination paths
        const destGsiPath = path.join(configDir, "gamestate_integration_fhud.cfg");
        const destObserverPath = path.join(configDir, "observer.cfg");
        const destObserver_offPath = path.join(configDir, "observer_off.cfg");
        const destObserver2Path = path.join(configDir, "observer2.cfg"); // Add this line

        let installed = { gsi: false, observer: false, observer_off: false, observer2: false }; // Update this line
      let errors = [];
      
      // Копируем GSI конфиг
      if (fs.existsSync(sourceGsiPath)) {
        fs.copyFileSync(sourceGsiPath, destGsiPath);
        installed.gsi = true;
        //console.info("Установлен GSI конфиг в", destGsiPath);
      } else {
        errors.push('Не найден исходный файл GSI конфига');
      }
      
      // Копируем Observer конфиг
      if (fs.existsSync(sourceObserverPath)) {
        fs.copyFileSync(sourceObserverPath, destObserverPath);
        installed.observer = true;
        //console.info("Установлен Observer конфиг в", destObserverPath);
      } else {
        errors.push('Не найден исходный файл Observer конфига');
      }

      // Копируем Observer конфиг
      if (fs.existsSync(sourceObserver2Path)) {
        fs.copyFileSync(sourceObserver2Path, destObserver2Path);
        installed.observer2 = true;
        //console.info("Установлен Observer конфиг в", destObserverPath);
      } else {
        errors.push('Не найден исходный файл Observer2 конфига');
      }

      // Копируем Observer_off конфиг
      if (fs.existsSync(sourceObserver_offPath)) {
        fs.copyFileSync(sourceObserver_offPath, destObserver_offPath);
        installed.observer_off = true;
        //console.info("Установлен Observer_off конфиг в", destObserver_offPath);
      } else {
        errors.push('Не найден исходный файл Observer_off конфига');
      }
      if (errors.length > 0) {
        return res.json({ 
          success: false, 
          message: errors.join('. '),
          installed: installed
        });
      }
      
      return res.json({ 
        success: true, 
        message: 'Конфиги успешно установлены', 
        installed: installed,
        configPath: configDir
      });
    } catch (error) {
      //console.error("Ошибка при установке конфигов:", error);
      return res.status(500).json({ success: false, message: 'Ошибка при установке конфигов' });
    }
  });

// Создание нового матча
app.post('/api/matches', (req, res) => {
    const { team1_id, team2_id } = req.body;

    db.run(`
        INSERT INTO matches (team1_id, team2_id, format, status) 
        VALUES (?, ?, 'bo1', 'pending')
    `, [team1_id, team2_id], function(err) {
        if (err) {
            //console.error('Ошибка при создании матча:', err);
            return res.status(500).json({ error: 'Ошибка при создании матча' });
        }
        
        // Возвращаем ID созданного матча
        res.json({ 
            success: true, 
            matchId: this.lastID,
            message: 'Матч успешно создан' 
        });
    });
});

// Получение списка матчей
app.get('/api/matches', (req, res) => {
    db.all(`
        SELECT 
            m.*,
            t1.name as team1_name,
            t2.name as team2_name,
            mm.id as map_id,
            mm.map_name,
            mm.pick_team,
            mm.side_pick_team,
            mm.order_number,
            mm.score_team1 as map_score_team1,
            mm.score_team2 as map_score_team2,
            mm.status as map_status,
            mm.winner_team,
            mm.winner_logo,
            tp.name as pick_team_name,
            tp.logo as pick_team_logo
        FROM matches m
        LEFT JOIN teams t1 ON m.team1_id = t1.id
        LEFT JOIN teams t2 ON m.team2_id = t2.id
        LEFT JOIN match_maps mm ON m.id = mm.match_id
        LEFT JOIN teams tp ON mm.pick_team = tp.id
        WHERE m.status IN ('pending', 'active')
        ORDER BY m.created_at DESC, mm.order_number ASC
    `, [], (err, rows) => {
        if (err) {
            //console.error('Ошибка при получении списка матчей:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // Преобразуем результаты в структуру матчей с картами
        const matches = [];
        let currentMatch = null;
        
        rows.forEach(row => {
            // Если это новый матч или первая запись
            if (!currentMatch || currentMatch.id !== row.id) {
                currentMatch = {
                    id: row.id,
                    team1_id: row.team1_id,
                    team2_id: row.team2_id,
                    team1_name: row.team1_name,
                    team2_name: row.team2_name,
                    format: row.format,
                    status: row.status,
                    score_team1: row.score_team1,
                    score_team2: row.score_team2,
                    created_at: row.created_at,
                    maps: []
                };
                matches.push(currentMatch);
            }
            
            // Добавляем карту, если она есть
            if (row.map_id) {
                currentMatch.maps.push({
                    id: row.map_id,
                    map_name: row.map_name,
                    pick_team: row.pick_team,
                    side_pick_team: row.side_pick_team,
                    status: row.map_status,
                    score_team1: row.map_score_team1,
                    score_team2: row.map_score_team2,
                    order_number: row.order_number,
                    name_team_pick: row.pick_team_name,
                    logo_team_pick: row.pick_team_logo,
                    winner_team: row.winner_team,
                    winner_logo: row.winner_logo
                });
            }
        });
        
        res.json(matches);
    });
});

// Обработчик обновления счета матча
app.post('/api/matches/:id/score', async (req, res) => {
    const matchId = req.params.id;
    const { team, change, swap } = req.body; // Добавляем параметр swap

    //console.log('Получен запрос на обновление счета:', { matchId, team, change, swap });

    try {
        // Проверяем существование матча
        const match = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM matches WHERE id = ?', [matchId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!match) {
            //console.log('Матч не найден:', matchId);
            return res.status(404).json({ error: 'Матч не найден' });
        }

        // Определяем поле для обновления
        let scoreField = team === 1 ? 'score_team1' : 'score_team2';
        let currentScore = match[scoreField] || 0;
        let newScore = Math.max(0, currentScore + change);

        // Если swap равен true, меняем местами счет команд
        if (swap) {
            const tempScore = match.score_team1;
            match.score_team1 = match.score_team2;
            match.score_team2 = tempScore;
            //console.log('Счет команд поменян местами:', {
            //    score_team1: match.score_team1,
            //    score_team2: match.score_team2
            //});
        }

        //console.log('Обновление счета:', {
        //    matchId,
        //    scoreField,
        //    currentScore,
        //    newScore
        //});

        // Обновляем счет в базе данных
        await new Promise((resolve, reject) => {
            const query = `UPDATE matches SET ${scoreField} = ? WHERE id = ?`;
            //console.log('SQL запрос:', query, [newScore, matchId]);
            
            db.run(query, [newScore, matchId], function(err) {
                if (err) {
                    //console.error('Ошибка SQL:', err);
                    reject(err);
                } else {
                    //console.log('Счет обновлен успешно');
                    resolve(this.changes);
                }
            });
        });

        // Получаем обновленные данные матча
        const updatedMatch = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM matches WHERE id = ?', [matchId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json({
            success: true,
            match: updatedMatch
        });

    } catch (error) {
        //console.error('Ошибка при обновлении счета:', error);
        res.status(500).json({ 
            error: 'Ошибка при обновлении счета',
            details: error.message 
        });
    }
});

// Удаление матча
app.delete('/api/matches/:id', (req, res) => {
    db.run('DELETE FROM matches WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Матч успешно удален' });
    });
});

// Запуск матча
app.post('/api/matches/:id/start', (req, res) => {
    db.run('UPDATE matches SET status = "active" WHERE id = ?', 
        [req.params.id], 
        (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Матч запущен' });
        }
    );
});

// Смена сторон в матче
// Добавляем новые поля в таблицу match_maps для хранения оригинальных данных
app.post('/api/matches/:id/swap', (req, res) => {
    const matchId = req.params.id;
    
    // Сначала получаем текущие данные о матче и картах
    db.get(`
        SELECT 
            m.*,
            t1.id as team1_id,
            t1.name as team1_name,
            t1.logo as team1_logo,
            t2.id as team2_id,
            t2.name as team2_name,
            t2.logo as team2_logo
        FROM matches m
        LEFT JOIN teams t1 ON m.team1_id = t1.id
        LEFT JOIN teams t2 ON m.team2_id = t2.id
        WHERE m.id = ?
    `, [matchId], (err, match) => {
        if (err) {
            //console.error('Ошибка при получении данных матча:', err);
            return res.status(500).json({ error: 'Ошибка при получении данных матча' });
        }
        
        if (!match) {
            return res.status(404).json({ error: 'Матч не найден' });
        }
        
        // Получаем данные о картах
        db.all(`
            SELECT 
                mm.*,
                COALESCE(mm.original_pick_team_name, 
                    CASE 
                        WHEN mm.pick_team = 'team1' THEN ? 
                        WHEN mm.pick_team = 'team2' THEN ? 
                        ELSE NULL 
                    END
                ) as original_pick_team_name,
                COALESCE(mm.original_pick_team_logo, 
                    CASE 
                        WHEN mm.pick_team = 'team1' THEN ? 
                        WHEN mm.pick_team = 'team2' THEN ? 
                        ELSE NULL 
                    END
                ) as original_pick_team_logo
            FROM match_maps mm
            WHERE mm.match_id = ?
            ORDER BY mm.order_number
        `, [match.team1_name, match.team2_name, match.team1_logo, match.team2_logo, matchId], (err, maps) => {
            if (err) {
                //console.error('Ошибка при получении данных карт:', err);
                return res.status(500).json({ error: 'Ошибка при получении данных карт' });
            }
            
            // Сохраняем оригинальные данные о командах, выбравших карты
            const updatePromises = maps.map(map => {
                return new Promise((resolve, reject) => {
                    // Если оригинальные данные еще не сохранены, сохраняем их
                    if (!map.original_pick_team_name || !map.original_pick_team_logo) {
                        db.run(`
                            UPDATE match_maps 
                            SET 
                                original_pick_team_name = ?,
                                original_pick_team_logo = ?
                            WHERE id = ?
                        `, [
                            map.original_pick_team_name,
                            map.original_pick_team_logo,
                            map.id
                        ], function(err) {
                            if (err) reject(err);
                            else resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            });
            
            // Ждем завершения всех обновлений
            Promise.all(updatePromises)
                .then(() => {
                    // Выполняем свап команд
                    db.run(`
                        UPDATE matches 
                        SET 
                            team1_id = team2_id,
                            team2_id = team1_id,
                            score_team1 = score_team2,
                            score_team2 = score_team1
                        WHERE id = ?
                    `, [matchId], function(err) {
                        if (err) {
                            //console.error('Ошибка при смене сторон:', err);
                            return res.status(500).json({ error: 'Ошибка при смене сторон' });
                        }
                        
                        // Получаем обновленные данные матча
                        db.get(`
                            SELECT 
                                m.*,
                                t1.name as team1_name,
                                t1.logo as team1_logo,
                                t2.name as team2_name,
                                t2.logo as team2_logo
                            FROM matches m
                            LEFT JOIN teams t1 ON m.team1_id = t1.id
                            LEFT JOIN teams t2 ON m.team2_id = t2.id
                            WHERE m.id = ?
                        `, [matchId], (err, updatedMatch) => {
                            if (err) {
                                //console.error('Ошибка при получении обновленных данных матча:', err);
                                return res.status(500).json({ error: 'Ошибка при получении обновленных данных матча' });
                            }
                            
                            // Получаем обновленные данные о картах с оригинальными данными о выборе команд
                            db.all(`
                                SELECT 
                                    mm.*,
                                    COALESCE(mm.original_pick_team_name, 
                                        CASE 
                                            WHEN mm.pick_team = 'team1' THEN ? 
                                            WHEN mm.pick_team = 'team2' THEN ? 
                                            ELSE NULL 
                                        END
                                    ) as name_team_pick,
                                    COALESCE(mm.original_pick_team_logo, 
                                        CASE 
                                            WHEN mm.pick_team = 'team1' THEN ? 
                                            WHEN mm.pick_team = 'team2' THEN ? 
                                            ELSE NULL 
                                        END
                                    ) as logo_team_pick
                                FROM match_maps mm
                                WHERE mm.match_id = ?
                                ORDER BY mm.order_number
                            `, [updatedMatch.team1_name, updatedMatch.team2_name, updatedMatch.team1_logo, updatedMatch.team2_logo, matchId], (err, updatedMaps) => {
                                if (err) {
                                    //console.error('Ошибка при получении обновленных данных карт:', err);
                                    return res.status(500).json({ error: 'Ошибка при получении обновленных данных карт' });
                                }
                                
                                // Обновляем названия команд и логотипы в gameState.map
                                if (gameState.map) {
                                    const tempName = gameState.map.team_ct.name;
                                    const tempLogo = gameState.map.team_ct.logo;
                                    
                                    gameState.map.team_ct.name = gameState.map.team_t.name;
                                    gameState.map.team_ct.logo = gameState.map.team_t.logo;
                                    
                                    gameState.map.team_t.name = tempName;
                                    gameState.map.team_t.logo = tempLogo;
                                }
                                
                                // Отправляем ответ с обновленными данными
                                res.json({
                                    success: true,
                                    match: updatedMatch,
                                    maps: updatedMaps,
                                    gameState: gameState.map
                                });
                            });
                        });
                    });
                })
                .catch(error => {
                    //console.error('Ошибка при сохранении оригинальных данных:', error);
                    res.status(500).json({ error: 'Ошибка при сохранении оригинальных данных' });
                });
        });
    });
});


// Получение данных матча для редактирования
app.get('/api/matches/:id', (req, res) => {
    const matchId = req.params.id;
    
    db.get(`
        SELECT 
            m.*,
            t1.name as team1_name,
            t2.name as team2_name
        FROM matches m
        LEFT JOIN teams t1 ON m.team1_id = t1.id
        LEFT JOIN teams t2 ON m.team2_id = t2.id
        WHERE m.id = ?
    `, [matchId], (err, match) => {
        if (err) {
            //console.error('Ошибка при получении данных матча:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!match) {
            return res.status(404).json({ error: 'Матч не найден' });
        }
        
        // Получаем данные о картах матча
        db.all(`
            SELECT 
                mm.*,
                t.name as pick_team_name,
                t.logo as pick_team_logo
            FROM match_maps mm
            LEFT JOIN teams t ON mm.pick_team = t.id
            WHERE mm.match_id = ?
            ORDER BY mm.order_number
        `, [matchId], (err, maps) => {
            if (err) {
                //console.error('Ошибка при получении данных о картах:', err);
                return res.status(500).json({ error: err.message });
            }
            
            match.maps = maps || [];
            res.json(match);
        });
    });
});

// Обновление данных матча
app.post('/api/matches/:id/update', async (req, res) => {
    const matchId = req.params.id;
    const { format, maps } = req.body;

    try {
        // Получаем информацию о командах матча
        const match = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    m.*,
                    t1.name as team1_name,
                    t1.logo as team1_logo,
                    t2.name as team2_name,
                    t2.logo as team2_logo
                FROM matches m
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE m.id = ?
            `, [matchId], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        // Начинаем транзакцию
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Обновляем основные данные матча
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE matches 
                SET format = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [format, matchId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Удаляем существующие карты матча
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM match_maps WHERE match_id = ?', [matchId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Добавляем новые карты
        if (maps && maps.length > 0) {
            const stmt = db.prepare(`
                INSERT INTO match_maps (
                    match_id, 
                    map_name, 
                    pick_team, 
                    side_pick_team, 
                    order_number,
                    score_team1,
                    score_team2,
                    original_pick_team_name,
                    original_pick_team_logo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const [index, map] of maps.entries()) {
                let pickTeamName = null;
                let pickTeamLogo = null;

                // Определяем имя и лого команды, выбравшей карту
                if (map.pickTeam === 'team1') {
                    pickTeamName = match.team1_name;
                    pickTeamLogo = match.team1_logo;
                } else if (map.pickTeam === 'team2') {
                    pickTeamName = match.team2_name;
                    pickTeamLogo = match.team2_logo;
                }

                await new Promise((resolve, reject) => {
                    stmt.run([
                        matchId,
                        map.mapId,
                        map.pickTeam || null,
                        map.startingSide?.team || null,
                        index + 1,
                        map.score?.team1 || 0,
                        map.score?.team2 || 0,
                        pickTeamName,
                        pickTeamLogo
                    ], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            stmt.finalize();
        }

        // Завершаем транзакцию
        await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ 
            success: true, 
            message: 'Матч успешно обновлен' 
        });

    } catch (error) {
        // В случае ошибки откатываем транзакцию
        await new Promise((resolve) => {
            db.run('ROLLBACK', () => resolve());
        });

        //console.error('Ошибка при обновлении матча:', error);
        res.status(500).json({ 
            error: 'Ошибка при обновлении матча',
            details: error.message 
        });
    }
});

// В начале файла, где происходит инициализация базы данных //база матча
// ... existing code ...
db.serialize(() => {
    // Удаляем старую таблицу matches, если она существует
    db.run(`DROP TABLE IF EXISTS match_maps`);
    db.run(`DROP TABLE IF EXISTS matches`);

    // Создаем таблицу matches заново с правильной структурой
    db.run(`
        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team1_id INTEGER,
            team2_id INTEGER,
            format TEXT DEFAULT 'bo1',
            status TEXT DEFAULT 'pending',
            score_team1 INTEGER DEFAULT 0,
            score_team2 INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(team1_id) REFERENCES teams(id),
            FOREIGN KEY(team2_id) REFERENCES teams(id)
        )
    `, (err) => {
        if (err) {
            console.error('Ошибка при создании таблицы matches:', err);
        } else {
            console.log('Таблица matches успешно создана');
        }
    });

    // Создаем таблицу match_maps
    db.run(`
        CREATE TABLE IF NOT EXISTS match_maps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            map_name TEXT,
            pick_team INTEGER,
            side_pick_team INTEGER,
            order_number INTEGER,
            score_team1 INTEGER DEFAULT 0,
            score_team2 INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            winner_team TEXT,
            winner_logo TEXT,
            winner_team1 TEXT,
            winner_logo1 TEXT,
            winner_team2 TEXT,
            winner_logo2 TEXT,
            winner_team3 TEXT,
            winner_logo3 TEXT,
            winner_team4 TEXT,
            winner_logo4 TEXT,
            winner_team5 TEXT,
            winner_logo5 TEXT,
            original_pick_team_name TEXT,
            original_pick_team_logo TEXT,
            FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Ошибка при создании таблицы match_maps:', err);
        } else {
            console.log('Таблица match_maps успешно создана');
        }
    });
    
    // Создаем таблицу teams
    db.run(`
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            region TEXT,
            logo TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Ошибка при создании таблицы teams:', err);
        } else {
            console.log('Таблица teams успешно создана');
        }
    });
    
    // Создаем таблицу players
    db.run(`
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT NOT NULL,
            realName TEXT,
            steam64 TEXT,
            teamId INTEGER,
            avatar TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teamId) REFERENCES teams(id)
        )
    `, (err) => {
        if (err) {
            console.error('Ошибка при создании таблицы players:', err);
        } else {
            console.log('Таблица players успешно создана');
        }
    });
});
/*// Добавляем новые поля в существующую таблицу
db.run(`ALTER TABLE match_maps ADD COLUMN original_pick_team_name TEXT;`, (err) => {
    if (err) {
        console.error('Ошибка при добавлении поля original_pick_team_name:', err);
    } else {
        console.log('Поле original_pick_team_name успешно добавлено');
    }
});

db.run(`ALTER TABLE match_maps ADD COLUMN original_pick_team_logo TEXT;`, (err) => {
    if (err) {
        console.error('Ошибка при добавлении поля original_pick_team_logo:', err);
    } else {
        console.log('Поле original_pick_team_logo успешно добавлено');
    }
});*/

// Обновляем endpoint для обновления матча
app.post('/api/matches/:id/update', (req, res) => {
    const matchId = req.params.id;
    const { format, maps } = req.body;

    //console.log('Получены данные для обновления:', { matchId, format, maps });

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Проверяем существование матча
        db.get('SELECT id FROM matches WHERE id = ?', [matchId], (err, match) => {
            if (err) {
                console.error('Ошибка при проверке матча:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Ошибка при проверке матча' });
            }

            if (!match) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: 'Матч не найден' });
            }

            // Обновляем формат матча
            db.run('UPDATE matches SET format = ? WHERE id = ?', 
                [format, matchId], 
                (err) => {
                    if (err) {
                        //console.error('Ошибка при обновлении формата:', err);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Ошибка при обновлении формата' });
                    }

                    // Удаляем существующие карты
                    db.run('DELETE FROM match_maps WHERE match_id = ?', [matchId], (err) => {
                        if (err) {
                            //console.error('Ошибка при удалении карт:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Ошибка при удалении карт' });
                        }

                        // Если есть новые карты, добавляем их
                        if (maps && maps.length > 0) {
                            const stmt = db.prepare(`
                                INSERT INTO match_maps (
                                    match_id, 
                                    map_name, 
                                    pick_team, 
                                    side_pick_team, 
                                    order_number,
                                    score_team1,
                                    score_team2
                                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                            `);

                            let hasError = false;
                            maps.forEach((map, index) => {
                                //console.log('Добавление карты:', map);
                                stmt.run(
                                    matchId,
                                    map.mapId,
                                    map.pickTeam || null,
                                    map.startingSide?.team || null,
                                    index + 1,
                                    map.score?.team1 || 0,
                                    map.score?.team2 || 0,
                                    (err) => {
                                        if (err) {
                                            //console.error('Ошибка при добавлении карты:', err);
                                            hasError = true;
                                        }
                                    }
                                );
                            });

                            stmt.finalize((err) => {
                                if (err || hasError) {
                                    //console.error('Ошибка при финализации:', err);
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Ошибка при добавлении карт' });
                                }

                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        //console.error('Ошибка при коммите:', err);
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'Ошибка при сохранении изменений' });
                                    }

                                    res.json({ success: true });
                                });
                            });
                        } else {
                            // Если нет новых карт, просто завершаем транзакцию
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    //console.error('Ошибка при коммите:', err);
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Ошибка при сохранении изменений' });
                                }

                                res.json({ success: true });
                            });
                        }
                    });
                }
            );
        });
    });
});

// Обработчик обновления счета карты
app.post('/api/matches/:matchId/map-score', async (req, res) => {
    const matchId = req.params.matchId;
    const { mapIndex, team1Score, team2Score, winner, team1Name, team2Name } = req.body;

    //console.log('Получен запрос на обновление счета карты:', { matchId, mapIndex, team1Score, team2Score, winner });

    try {
        // Проверяем существование матча
        const match = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    m.*,
                    t1.name as team1_name, t1.logo as team1_logo,
                    t2.name as team2_name, t2.logo as team2_logo
                FROM matches m
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE m.id = ?
            `, [matchId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!match) {
            //console.log('Матч не найден:', matchId);
            return res.status(404).json({ error: 'Матч не найден' });
        }

        // Получаем карты матча, отсортированные по order_number
        const maps = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM match_maps 
                WHERE match_id = ? 
                ORDER BY order_number ASC
            `, [matchId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Проверяем, существует ли карта с указанным индексом
        if (!maps || maps.length <= mapIndex) {
            //console.log('Карта не найдена:', { matchId, mapIndex });
            return res.status(404).json({ error: 'Карта не найдена' });
        }

        const mapToUpdate = maps[mapIndex];
        
        // Определяем статус карты на основе выбора победителя
        let status = mapToUpdate.status; // Сохраняем текущий статус по умолчанию
        
        // Определяем победителя на основе выбора или счета
        let winnerTeam = null;
        let winnerLogo = null;
        
        if (winner === 'team1') {
            winnerTeam = match.team1_name;
            winnerLogo = match.team1_logo;
            status = 'completed';
        } else if (winner === 'team2') {
            winnerTeam = match.team2_name;
            winnerLogo = match.team2_logo;
            status = 'completed';
        } else if (team1Score > team2Score) {
            winnerTeam = match.team1_name;
            winnerLogo = match.team1_logo;
            status = 'completed';
        } else if (team2Score > team1Score) {
            winnerTeam = match.team2_name;
            winnerLogo = match.team2_logo;
            status = 'completed';
        }
        
        //console.log('Обновление карты:', {
        //    mapId: mapToUpdate.id,
        //    team1Score,
        //    team2Score,
        //    status,
        //    winnerTeam,
        //    winnerLogo
        //});
        
        // Обновляем счет карты, статус и информацию о победителе
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE match_maps 
                SET score_team1 = ?, score_team2 = ?, status = ?, winner_team = ?, winner_logo = ? 
                WHERE id = ?
            `, [team1Score, team2Score, status, winnerTeam, winnerLogo, mapToUpdate.id], function(err) {
                if (err) {
                    //console.error('Ошибка SQL при обновлении счета карты:', err);
                    reject(err);
                } else {
                    //console.log('Счет карты обновлен успешно');
                    resolve(this.changes);
                }
            });
        });

        // Обновляем GSI данные, если они существуют
        if (global.gsiState && global.gsiState.map) {
            // Если карта в GSI соответствует обновляемой карте
            if (global.gsiState.map.name === mapToUpdate.map_name) {
                // Обновляем счет в GSI данных
                global.gsiState.map.team_ct.score = team1Score;
                global.gsiState.map.team_t.score = team2Score;
                
                // Отправляем обновление через WebSocket, если доступно
                if (io) {
                    io.emit('gsi_update', {
                        type: 'map_score_update',
                        data: {
                            matchId: parseInt(matchId),
                            mapId: mapToUpdate.id,
                            team1Score: team1Score,
                            team2Score: team2Score,
                            status: status,
                            winnerTeam: winnerTeam,
                            winnerLogo: winnerLogo
                        }
                    });
                    //console.log('Отправлено обновление счета карты через WebSocket');
                }
            }
        }

        // Получаем обновленные данные матча
        const updatedMatch = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    m.*,
                    t1.name as team1_name,
                    t2.name as team2_name
                FROM matches m
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE m.id = ?
            `, [matchId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Получаем обновленные данные о картах
        const updatedMaps = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM match_maps 
                WHERE match_id = ? 
                ORDER BY order_number ASC
            `, [matchId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            success: true,
            message: 'Счет карты успешно обновлен',
            match: updatedMatch,
            maps: updatedMaps
        });

    } catch (error) {
        //console.error('Ошибка при обновлении счета карты:', error);
        res.status(500).json({ 
            error: 'Ошибка при обновлении счета карты',
            details: error.message 
        });
    }
});

// Получение списка доступных карт
app.get('/api/maps', (req, res) => {
    const maps = [
        { id: 'de_dust2', name: 'Dust II' },
        { id: 'de_mirage', name: 'Mirage' },
        { id: 'de_inferno', name: 'Inferno' },
        { id: 'de_nuke', name: 'Nuke' },
        { id: 'de_overpass', name: 'Overpass' },
        { id: 'de_ancient', name: 'Ancient' },
        { id: 'de_anubis', name: 'Anubis' },
        { id: 'de_vertigo', name: 'Vertigo' },
        { id: 'de_cache', name: 'Cache' },
        { id: 'de_train', name: 'Train' }

    ];
    res.json(maps);
});

// Запуск матча
app.post('/api/matches/:id/start', (req, res) => {
    const matchId = req.params.id;
    db.run('UPDATE matches SET status = "active" WHERE id = ?', 
        [matchId], 
        function(err) {
            if (err) {
                //console.error('Ошибка при запуске матча:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                success: true,
                message: 'Матч запущен'
            });
        }
    );
});

// Остановка матча
app.post('/api/matches/:id/stop', (req, res) => {
    const matchId = req.params.id;
    db.run('UPDATE matches SET status = "pending" WHERE id = ?', 
        [matchId], 
        function(err) {
            if (err) {
                //console.error('Ошибка при остановке матча:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                success: true,
                message: 'Матч остановлен'
            });
        }
    );
});

// Обновляем маршрут получения списка матчей, чтобы включить только активные матчи
app.get('/api/matches', (req, res) => {
    db.all(`
        SELECT 
            m.*,
            t1.name as team1_name,
            t2.name as team2_name
        FROM matches m
        LEFT JOIN teams t1 ON m.team1_id = t1.id
        LEFT JOIN teams t2 ON m.team2_id = t2.id
        WHERE m.status IN ('pending', 'active')
        ORDER BY m.created_at DESC
    `, [], (err, matches) => {
        if (err) {
            //console.error('Ошибка при получении списка матчей:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(matches);
    });
});

// Обновление счета и статуса карты
app.put('/api/matches/:matchId/maps/:mapId', (req, res) => {
    const { matchId, mapId } = req.params;
    const { team1_score, team2_score, status, team1_side } = req.body;

    db.run(
        `UPDATE match_maps 
        SET team1_score = ?, team2_score = ?, status = ?, team1_side = ?
        WHERE id = ? AND match_id = ?`,
        [team1_score, team2_score, status, team1_side, mapId, matchId],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Обновлено успешно' });
        }
    );
});

app.post('/api/matches/:matchId/score', async (req, res) => {
    try {
        const matchId = req.params.matchId;
        const { team, change } = req.body;
        
        //console.log('Получен запрос на обновление счета:', { matchId, team, change });

        // Проверяем структуру таблицы
        const tableInfo = await db.all("PRAGMA table_info(matches)");
        //console.log('Структура таблицы matches:', tableInfo.map(col => col.name));

        // Получаем текущий матч из базы данных
        const match = await db.get('SELECT * FROM matches WHERE id = ?', [matchId]);
        
        if (!match) {
            return res.status(404).json({ error: 'Матч не найден' });
        }

        //console.log('Текущие данные матча:', match);

        // Определяем имена столбцов на основе структуры таблицы
        let team1ScoreField, team2ScoreField;
        
        // Проверяем возможные варианты имен столбцов
        if (match.hasOwnProperty('team1Score')) {
            team1ScoreField = 'team1Score';
            team2ScoreField = 'team2Score';
        } else if (match.hasOwnProperty('score_team1')) {
            team1ScoreField = 'score_team1';
            team2ScoreField = 'score_team2';
        } else if (match.hasOwnProperty('team1_score')) {
            team1ScoreField = 'team1_score';
            team2ScoreField = 'team2_score';
        } else {
            // Если не нашли подходящих столбцов, выводим все доступные поля
            //console.log('Доступные поля матча:', Object.keys(match));
            return res.status(500).json({ error: 'Не удалось определить столбцы для счета' });
        }

        // Выбираем нужное поле в зависимости от команды
        const scoreField = team === 1 ? team1ScoreField : team2ScoreField;
        const currentScore = match[scoreField] || 0;
        const newScore = Math.max(0, currentScore + change);
        
        //console.log('Обновление счета:', {
        //    matchId,
        //    scoreField,
        //    currentScore,
        //    newScore
        //});

        // Формируем SQL запрос с правильными именами столбцов
        const sql = `UPDATE matches SET ${scoreField} = ? WHERE id = ?`;
        //console.log('SQL запрос:', sql, [newScore, matchId]);
        
        // Выполняем запрос
        await db.run(sql, [newScore, matchId]);
        
        // Получаем обновленные данные
        const updatedMatch = await db.get('SELECT * FROM matches WHERE id = ?', [matchId]);
        
        //console.log('Счет обновлен успешно');
        
        // Обновляем GSI данные
        if (global.gsiState) {
            // Если GSI данные еще не инициализированы, создаем структуру
            if (!global.gsiState.matches) {
                global.gsiState.matches = [];
            }
            
            // Ищем матч в GSI данных
            let gsiMatch = global.gsiState.matches.find(m => m.id === parseInt(matchId));
            
            // Если матч не найден, добавляем его
            if (!gsiMatch) {
                gsiMatch = {
                    id: parseInt(matchId),
                    team1Score: 0,
                    team2Score: 0
                };
                global.gsiState.matches.push(gsiMatch);
            }
            
            // Обновляем счет в GSI данных
            gsiMatch.team1Score = updatedMatch[team1ScoreField] || 0;
            gsiMatch.team2Score = updatedMatch[team2ScoreField] || 0;
            
            //console.log('GSI данные обновлены:', gsiMatch);
            
            // Отправляем обновление всем подключенным клиентам через WebSocket
            if (io) {
                io.emit('gsi_update', {
                    type: 'score_update',
                    data: {
                        matchId: parseInt(matchId),
                        team1Score: gsiMatch.team1Score,
                        team2Score: gsiMatch.team2Score
                    }
                });
                //console.log('Отправлено обновление через WebSocket');
            }
        }

        res.json({ 
            success: true, 
            team1Score: updatedMatch[team1ScoreField] || 0,
            team2Score: updatedMatch[team2ScoreField] || 0
        });

    } catch (error) {
        //console.error('Ошибка при обновлении счета:', error);
        res.status(500).json({ error: 'Ошибка при обновлении счета', details: error.message });
    }
});

// Поиск команд
app.get('/api/teams/search', (req, res) => {
    const { query } = req.query;
    
    db.all(
        'SELECT * FROM teams WHERE name LIKE ? LIMIT 10',
        [`%${query}%`],
        (err, teams) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(teams);
        }
    );
});

// Получение списка всех команд
// Добавьте этот роут для получения списка команд
app.get('/api/teams', (req, res) => {
    const query = `
        SELECT id, name, logo 
        FROM teams 
        ORDER BY name ASC
    `;
    
    db.all(query, [], (err, teams) => {
        if (err) {
            //console.error('Ошибка при получении списка команд:', err);
            return res.status(500).json({ 
                error: 'Ошибка при получении списка команд',
                details: err.message 
            });
        }
        
        res.json(teams);
    });
});

app.post('/api/teams', upload.single('logo'), (req, res) => {
    const { name, region } = req.body;
    // Сохраняем только имя файла, без /uploads/
    const logo = req.file ? req.file.filename : null;

    db.run('INSERT INTO teams (name, region, logo) VALUES (?, ?, ?)',
        [name, region, logo],
        function(err) {
            if (err) {
                //console.error('Ошибка при создании команды:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

// Добавьте этот код временно для исправления путей в базе данных
app.get('/api/fix-logo-paths', (req, res) => {
    db.all('SELECT id, logo FROM teams', [], (err, teams) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        teams.forEach(team => {
            if (team.logo && team.logo.startsWith('/uploads/')) {
                const fixedLogo = team.logo.replace('/uploads/', '');
                db.run('UPDATE teams SET logo = ? WHERE id = ?', [fixedLogo, team.id]);
            }
        });

        res.json({ message: 'Пути к логотипам исправлены' });
    });
});

app.delete('/api/teams/:id', async (req, res) => {
    try {
        const teamId = req.params.id;
        
        db.run('DELETE FROM teams WHERE id = ?', [teamId], function(err) {
            if (err) {
                //console.error('Ошибка при удалении:', err);
                return res.status(500).json({ message: 'Ошибка при удалении команды' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ message: `Команда с ID ${teamId} не найдена` });
            }
            
            res.json({ message: 'Команда успешно удалена' });
        });
    } catch (error) {
        //console.error('Ошибка при удалении команды:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

app.get('/api/teams/:id', (req, res) => {
    const teamId = req.params.id;
    
    const query = `
        SELECT * FROM teams WHERE id = ?
    `;
    
    db.get(query, [teamId], (err, team) => {
        if (err) {
            //console.error('Ошибка при получении данных команды:', err);
            return res.status(500).json({ 
                message: 'Ошибка при получении данных команды',
                error: err.message 
            });
        }
        
        if (!team) {
            return res.status(404).json({ 
                message: `Команда с ID ${teamId} не найдена` 
            });
        }
        
        res.json(team);
    });
});

app.put('/api/teams/:id', upload.single('logo'), (req, res) => {
    const teamId = req.params.id;
    const { name, region } = req.body;
    
    db.get('SELECT id FROM teams WHERE id = ?', [teamId], (err, team) => {
        if (err) {
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        
        if (!team) {
            return res.status(404).json({ message: `Команда с ID ${teamId} не найдена` });
        }
        
        // Сохраняем только имя файла, без /uploads/
        const logo = req.file ? req.file.filename : null;
        let updateQuery = 'UPDATE teams SET name = ?, region = ?';
        let params = [name, region];

        if (logo) {
            updateQuery += ', logo = ?';
            params.push(logo); // Теперь сохраняем только имя файла
        }

        updateQuery += ' WHERE id = ?';
        params.push(teamId);

        db.run(updateQuery, params, function(err) {
            if (err) {
                return res.status(500).json({ message: 'Ошибка при обновлении команды' });
            }

            res.json({ 
                message: 'Команда успешно обновлена',
                teamId: teamId
            });
        });
    });
});

// ... existing code ...

app.get('/api/players', (req, res) => {
    db.all('SELECT * FROM players', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/players', upload.single('avatar'), (req, res) => {
    const { nickname, realName, steam64, teamId } = req.body;
    const avatar = req.file ? `/uploads/${req.file.filename}` : null;

    db.run('INSERT INTO players (nickname, realName, steam64, teamId, avatar) VALUES (?, ?, ?, ?, ?)',
        [nickname, realName, steam64, teamId, avatar],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

app.delete('/api/players/:id', async (req, res) => {
    try {
        const playerId = req.params.id;
        
        // Используем правильный метод для sqlite3
        db.run('DELETE FROM players WHERE id = ?', [playerId], function(err) {
            if (err) {
                //console.error('Ошибка при удалении:', err);
                return res.status(500).json({ message: 'Ошибка при удалении игрока' });
            }
            
            // this.changes показывает количество затронутых строк
            if (this.changes === 0) {
                return res.status(404).json({ message: `Игрок с ID ${playerId} не найден` });
            }
            
            res.json({ message: 'Игрок успешно удален' });
        });
    } catch (error) {
        //console.error('Ошибка при удалении игрока:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

// Маршрут для получения данных одного игрока
app.get('/api/players/:id', (req, res) => {
    const playerId = req.params.id;
    
    // Используем более подробный запрос, включая информацию о команде
    const query = `
        SELECT 
            players.*,
            teams.name as teamName
        FROM players 
        LEFT JOIN teams ON players.teamId = teams.id
        WHERE players.id = ?
    `;
    
    db.get(query, [playerId], (err, player) => {
        if (err) {
            //console.error('Ошибка при получении данных игрока:', err);
            return res.status(500).json({ 
                message: 'Ошибка при получении данных игрока',
                error: err.message 
            });
        }
        
        if (!player) {
            return res.status(404).json({ 
                message: `Игрок с ID ${playerId} не найден` 
            });
        }
        
        // Отправляем данные игрока
        res.json(player);
    });
});

// Обновляем маршрут PUT для редактирования игрока
app.put('/api/players/:id', upload.single('avatar'), (req, res) => {
    const playerId = req.params.id;
    const { nickname, realName, steam64, teamId } = req.body;
    
    // Проверяем существование игрока перед обновлением
    db.get('SELECT id FROM players WHERE id = ?', [playerId], (err, player) => {
        if (err) {
            //console.error('Ошибка при проверке игрока:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        
        if (!player) {
            return res.status(404).json({ message: `Игрок с ID ${playerId} не найден` });
        }
        
        // Если игрок найден, обновляем данные
        const avatar = req.file ? `/uploads/${req.file.filename}` : null;
        let updateQuery = 'UPDATE players SET nickname = ?, realName = ?, steam64 = ?, teamId = ?';
        let params = [nickname, realName, steam64, teamId];

        if (avatar) {
            updateQuery += ', avatar = ?';
            params.push(avatar);
        }

        updateQuery += ' WHERE id = ?';
        params.push(playerId);

        db.run(updateQuery, params, function(err) {
            if (err) {
                //console.error('Ошибка при обновлении:', err);
                return res.status(500).json({ message: 'Ошибка при обновлении игрока' });
            }

            res.json({ 
                message: 'Игрок успешно обновлен',
                playerId: playerId
            });
        });
    });
});

// ... existing code ...

// Добавляем новый эндпоинт для получения игроков команды
app.get('/api/teams/:teamId/players', (req, res) => {
    const teamId = req.params.teamId;
    
    db.all(`
        SELECT * FROM players 
        WHERE teamId = ?
        ORDER BY nickname
    `, [teamId], (err, players) => {
        if (err) {
            //console.error('Ошибка при получении игроков команды:', err);
            return res.status(500).json({ error: 'Ошибка при получении игроков' });
        }
        res.json(players || []); // Возвращаем пустой массив, если игроков нет
    });
});

// ... existing code ...

// Endpoint для запуска оверлея
app.post('/api/start-overlay', (req, res) => {
    const { hudId } = req.body;
    
    // Путь к файлу start.bat в папке overlay
    const overlayPath = path.join(__dirname, '../overlay/start.bat');
    
    // Запускаем оверлей с параметром hudId
    exec(`"${overlayPath}" ${hudId}`, (error) => {
        if (error) {
            //console.error('Error starting overlay:', error);
            res.status(500).json({ error: 'Failed to start overlay' });
            return;
        }
        res.json({ success: true });
    });
});

// Функция для сканирования HUD'ов
function scanHUDs() {
    const hudsPath = path.join(__dirname, '../public/huds');
    const huds = [];
    
    fs.readdirSync(hudsPath).forEach(hudDir => {
        if (!fs.statSync(path.join(hudsPath, hudDir)).isDirectory() || hudDir.startsWith('.')) {
            return;
        }

        const hudPath = path.join(hudsPath, hudDir);
        if (fs.existsSync(path.join(hudPath, 'template.pug')) || 
            fs.existsSync(path.join(hudPath, 'index.html'))) {
            
            let config = {
                id: hudDir,
                name: hudDir.charAt(0).toUpperCase() + hudDir.slice(1) + ' HUD',
                description: 'Custom HUD'
            };

            const configPath = path.join(hudPath, 'config.json');
            if (fs.existsSync(configPath)) {
                try {
                    const hudConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    config = { ...config, ...hudConfig };
                } catch (e) {
                    //console.error(`Ошибка чтения конфига для ${hudDir}:`, e);
                }
            }

            huds.push(config);
        }
    });

    return huds;
}

// Маршруты для HUD
app.get('/api/huds', (req, res) => {
    res.json(scanHUDs());
});

app.get('/hud/:hudId', (req, res) => {
    const { hudId } = req.params;
    res.render(`huds/${hudId}/template`, { hudId });
});

app.get('/hud/:hudId/:file', (req, res) => {
    const { hudId, file } = req.params;
    res.sendFile(path.join(__dirname, `../public/huds/${hudId}/${file}`));
});

// Инициализация начального состояния игры
const gameState = {
    map: {
        name: '',
        mode: '',
        num_matches_to_win_series: '',
        phase: '',
        round: '',
        round_wins: {},
        team_ct: {
            consecutive_round_losses: '',
            matches_won_this_series: '',
            timeouts_remaining: '',
            score: '',
            name: '',
            flag: ''
        },
        team_t: {
            consecutive_round_losses: '',
            matches_won_this_series: '',
            timeouts_remaining: '',
            score: '',
            name: '',
            flag: ''
        }
    },
    phase_countdowns: {
        phase: '',
        phase_ends_in: ''
    },
    player: {
        name: '',
        team: '',
        state: {
            health: 100,
            armor: 0,
            money: 0
        },
        match_stats: {
            kills: 0,
            assists: 0,
            deaths: 0
        },
        weapons: {}
    },
    allplayers: {},
    bomb: {},
    grenades: {},
    previously: {},
    provider: {},
    round: {},
};

// GSI endpoints

gsiApp.post('/gsi', async (req, res) => {
    try {
        const data = req.body;
        if (!data) {
            //console.log('Ошибка: Нет данных в GSI запросе');
            return res.sendStatus(400);
        }

        // Получаем активный матч с дополнительной информацией
        const match = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    m.*,
                    t1.name as team1_name, t1.logo as team1_logo,
                    t2.name as team2_name, t2.logo as team2_logo
                FROM matches m
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE m.status = 'active'
                LIMIT 1
            `, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Добавляем флаг matchup в gameState
        gameState.matchupis = !!match;

        if (match) {
            // Добавляем формат матча в gameState
            gameState.match = {
                format: match.format || 'bo1', // bo1, bo2, bo3, bo5
                status: match.status, // pending, active, completed
                //score_team1_map: match.score_team1 || 0, // Исправлено с team1Score на score_team1
                //score_team2_map: match.score_team2 || 0,  // Исправлено с team2Score на score_team2
                matchupis: gameState.matchupis
            };

            //const currentRound = data.map.round || 0;


            // ... existing code ...

            // ... existing code ...

            // Основное время (0-27 раундов)
            /*if (currentRound >= 0) {
                // Определяем, нужно ли менять счет местами
                const shouldSwapScores = (
                    // Основное время: вторая половина (12-26)
                    (currentRound >= 12 && currentRound <= 26) ||
                    // Овертаймы: каждая вторая половина (33-38, 46-51, 59-64, ...)
                    (currentRound >= 27 && ((Math.floor((currentRound - 27) / 6) % 2) === 1))
                );
                
                // Специальная обработка для 27 раунда (первый раунд овертайма)
                const isFirstOvertimeRound = currentRound === 27;
                
                // Добавляем проверку на фазу игры - меняем счет только после окончания перерыва
                // Для 27 раунда (первый раунд овертайма) НЕ исключаем фазу intermission
                if (shouldSwapScores && 
                    (isFirstOvertimeRound || 
                     (data.map.phase !== "intermission" && data.round.phase !== "over"))) {
                    const tempScore = gameState.match.score_team1_map;
                    gameState.match.score_team1_map = gameState.match.score_team2_map;
                    gameState.match.score_team2_map = tempScore;
                }
            }*/


// ... existing code ...
                        


// ... existing code ...

// ... existing code ...



            // Получаем данные о картах матча
            const matchMaps = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        mm.*,
                        t1.name as team1_name,
                        t2.name as team2_name
                    FROM match_maps mm
                    LEFT JOIN teams t1 ON mm.pick_team = t1.id
                    LEFT JOIN teams t2 ON mm.side_pick_team = t2.id
                    WHERE match_id = ?
                    ORDER BY order_number
                `, [match.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            if (matchMaps && matchMaps.length > 0) {
                // Добавляем информацию о картах в gameState
                gameState.match_maps = matchMaps.map(map => ({
                    id: map.id,
                    map_name: map.map_name,
                    pick_team: map.pick_team,
                    side_pick_team: map.side_pick_team,
                    status: map.status || 'pending',
                    score_team1: map.score_team1 || 0,
                    score_team2: map.score_team2 || 0,
                    order_number: map.order_number,
                    name_team_pick: map.original_pick_team_name || (map.pick_team === 'team1' ? match.team1_name : match.team2_name),
                    logo_team_pick: map.original_pick_team_logo || (map.pick_team === 'team1' ? match.team1_logo : match.team2_logo),
                    winner_team: map.winner_team || null,
                    winner_logo: map.winner_logo || null
                }));
            

                // Находим текущую карту в match_maps
                const currentMap = gameState.match_maps.find(map => 
                    map.map_name.toLowerCase() === data.map.name.toLowerCase()
                );

                if (currentMap) {
                    // Проверяем фазу игры для определения завершения карты
                    const isGameOver = data.map.phase === 'gameover' || data.round?.phase === 'gameover';
                    
                    // Обновляем статусы карт
                    gameState.match_maps.forEach(map => {
                        if (map.map_name.toLowerCase() === data.map.name.toLowerCase()) {
                            if (!isGameOver) {
                                map.status = 'active';
                            }
                        }
                    });
                
                    // Всегда обновляем счет
                    currentMap.score_team1 = data.map.team_ct?.score || 0;
                    currentMap.score_team2 = data.map.team_t?.score || 0;
                
                    // Сначала обновляем счет в БД
                    await new Promise((resolve, reject) => {
                        db.run(`
                            UPDATE match_maps 
                            SET 
                                score_team1 = ?, 
                                score_team2 = ?
                            WHERE id = ?
                        `, [
                            currentMap.score_team1, 
                            currentMap.score_team2, 
                            currentMap.id
                        ], (err) => {
                            if (err) {
                                console.error('Ошибка обновления счета:', err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                
                    // Если игра завершена и статус еще не completed, определяем победителя
                    if (isGameOver && currentMap.status !== 'completed') {
                        // Небольшая задержка для гарантии получения финального счета
                        setTimeout(async () => {
                            const winnerTeamId = currentMap.score_team1 > currentMap.score_team2 ? 
                                match.team1_id : match.team2_id;
                            
                            if (winnerTeamId) {
                                const winnerTeam = await new Promise((resolve, reject) => {
                                    db.get('SELECT name, logo FROM teams WHERE id = ?', [winnerTeamId], (err, row) => {
                                        if (err) reject(err);
                                        else resolve(row);
                                    });
                                });
                
                                if (winnerTeam) {
                                    currentMap.winner_team = winnerTeam.name;
                                    currentMap.winner_logo = winnerTeam.logo ? winnerTeam.logo.replace('/uploads/', '') : null;
                                    currentMap.status = 'completed';
                
                                    // Обновляем БД с финальным счетом и победителем
                                    await new Promise((resolve, reject) => {
                                        db.run(`
                                            UPDATE match_maps 
                                            SET 
                                                score_team1 = ?,
                                                score_team2 = ?,
                                                status = ?, 
                                                winner_team = ?,
                                                winner_logo = ?
                                            WHERE id = ? AND winner_team IS NULL
                                        `, [
                                            currentMap.score_team1,
                                            currentMap.score_team2,
                                            'completed',
                                            currentMap.winner_team,
                                            currentMap.winner_logo,
                                            currentMap.id
                                        ], (err) => {
                                            if (err) {
                                                console.error('Ошибка обновления победителя:', err);
                                                reject(err);
                                            } else {
                                                //console.log('Победитель карты определен:', {
                                                    //mapId: currentMap.id,
                                                    //winner: currentMap.winner_team,
                                                    //finalScore: `${currentMap.score_team1}:${currentMap.score_team2}`
                                                //});
                                                resolve();
                                            }
                                        });
                                    });
                                }
                            }
                        }, 1000); // Задержка в 1 секунду для получения финального счета
                    }
                
            
                    // Логируем обновление
                    //console.log('Данные карты обновлены:', {
                    //    map: currentMap.map_name,
                    //    score_team1: currentMap.score_team1,
                    //    score_team2: currentMap.score_team2,
                    //    status: currentMap.status,
                    //    winner_team: currentMap.winner_team,
                    //    winner_logo: currentMap.winner_logo,
                    //    name_team_pick: currentMap.name_team_pick,
                    //    logo_team_pick: currentMap.logo_team_pick
                    //});
                    
                        // Отправляем обновленные данные в GSI
                        io.emit('gsi', gameState);
                    }
                }
        } else {
            // Если нет активного матча, очищаем связанные с матчем данные
            //gameState.match = null;
            gameState.match_maps = null;
        }

        /*if (data.map) {
            gameState.map = data.map;
        }*/


        // Обновление состояния игры
        if (data.map) {
            gameState.map = data.map;
        
            const currentRound = data.map.round || 0;
            
            // Проверяем, есть ли активный матч
            const activeMatch = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        m.*,
                        t1.name as team1_name, t1.logo as team1_logo,
                        t2.name as team2_name, t2.logo as team2_logo
                    FROM matches m
                    LEFT JOIN teams t1 ON m.team1_id = t1.id
                    LEFT JOIN teams t2 ON m.team2_id = t2.id
                    WHERE m.status = 'active'
                    LIMIT 1
                `, [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
                        // Для активного матча также учитываем фазу игры при смене сторон
                        if (activeMatch) {
                            // Логика смены сторон
                            let shouldSwap = false;
            
                            // Определяем текущую сторону команд
                            let currentCTTeam = activeMatch.team1_name;
                            let currentCTLogo = activeMatch.team1_logo;
                            let score_team1_map = activeMatch.score_team1;
                            let score_team2_map = activeMatch.score_team2;
                            let currentTTeam = activeMatch.team2_name;
                            let currentTLogo = activeMatch.team2_logo;
            
                            // Основное время (0-27 раундов)
                            if (currentRound >= 0) {
                                // Основное время: первая половина (0-11): CT/T
                                if (currentRound <= 11) {
                                    currentCTTeam = activeMatch.team1_name;
                                    currentCTLogo = activeMatch.team1_logo;
                                    score_team1_map = activeMatch.score_team1;
                                    score_team2_map = activeMatch.score_team2;
                                    currentTTeam = activeMatch.team2_name;
                                    currentTLogo = activeMatch.team2_logo;
                                } 
                                // Основное время: вторая половина (12-26): T/CT
                                // Добавляем проверку на фазу игры - меняем стороны только после окончания перерыва
                                else if (currentRound >= 12 && currentRound <= 26 && data.map.phase !== "intermission") {
                                    currentCTTeam = activeMatch.team2_name;
                                    currentCTLogo = activeMatch.team2_logo;
                                    score_team1_map = activeMatch.score_team2;
                                    score_team2_map = activeMatch.score_team1;
                                    currentTTeam = activeMatch.team1_name;
                                    currentTLogo = activeMatch.team1_logo;
                                }

                    // Овертаймы (27+)
                    else if (currentRound >= 27) {
                        // Определяем номер овертайма (0 для первого, 1 для второго и т.д.)
                        const overtimeNumber = Math.floor((currentRound - 27) / 6);
                        // Определяем номер раунда внутри текущего овертайма (0-5)
                        const roundInOvertime = (currentRound - 27) % 6;
                        
                        // Проверяем фазу игры
                        const isIntermission = data.map.phase === "intermission";
                        
                        // Специальная обработка для первого раунда первого овертайма (раунд 27)
                        if (currentRound === 27 && isIntermission) {
                            //console.log(`Раунд 27 (первый раунд первого овертайма) в фазе перерыва. Сохраняем предыдущие стороны.`);
                            
                            // Для раунда 27 в фазе перерыва сохраняем стороны как в последнем раунде основного времени
                            // (т.е. team2 = CT, team1 = T)
                            currentCTTeam = activeMatch.team2_name;
                            currentCTLogo = activeMatch.team2_logo;
                            score_team1_map = activeMatch.score_team2;
                            score_team2_map = activeMatch.score_team1;
                            currentTTeam = activeMatch.team1_name;
                            currentTLogo = activeMatch.team1_logo;
                        }
                        // Для всех остальных случаев или когда перерыв закончился
                        else {
                            // Четные овертаймы (0, 2, 4...) - team1 CT, team2 T
                            if (overtimeNumber % 2 === 0 && (!isIntermission || currentRound > 27)) {
                                currentCTTeam = activeMatch.team1_name;
                                currentCTLogo = activeMatch.team1_logo;
                                score_team1_map = activeMatch.score_team1;
                                score_team2_map = activeMatch.score_team2;
                                currentTTeam = activeMatch.team2_name;
                                currentTLogo = activeMatch.team2_logo;
                                //console.log(`Четный овертайм ${overtimeNumber + 1}, CT: ${currentCTTeam}, T: ${currentTTeam}`);
                            } 
                            // Нечетные овертаймы (1, 3, 5...) - team2 CT, team1 T
                            else if (overtimeNumber % 2 === 1 && !isIntermission) {
                                currentCTTeam = activeMatch.team2_name;
                                currentCTLogo = activeMatch.team2_logo;
                                score_team1_map = activeMatch.score_team2;
                                score_team2_map = activeMatch.score_team1;
                                currentTTeam = activeMatch.team1_name;
                                currentTLogo = activeMatch.team1_logo;
                                //console.log(`Нечетный овертайм ${overtimeNumber + 1}, CT: ${currentCTTeam}, T: ${currentTTeam}`);
                            }
                        }
                    }
                }
                
                // Устанавливаем актуальные названия команд
                // Для раунда 27 в фазе перерыва используем специальную логику
                if (currentRound === 27 && data.map.phase === "intermission") {
                    // Не меняем стороны в gameState, сохраняем как было в последнем раунде основного времени
                    console.log(`Сохраняем стороны для раунда 27 в перерыве: CT=${currentCTTeam}, T=${currentTTeam}`);
                    gameState.map.team_ct.name = currentCTTeam;
                    gameState.map.team_ct.logo = currentCTLogo;
                    gameState.map.team_ct.matches_won_this_series = score_team1_map;
                    gameState.map.team_t.matches_won_this_series = score_team2_map;
                    gameState.map.team_t.name = currentTTeam;
                    gameState.map.team_t.logo = currentTLogo;
                }
                // Для всех остальных случаев

                    gameState.map.team_ct.name = currentCTTeam;
                    gameState.map.team_ct.logo = currentCTLogo;
                    gameState.map.team_t.name = currentTTeam;
                    gameState.map.team_t.logo = currentTLogo;
                    gameState.map.team_ct.matches_won_this_series = score_team1_map;
                    gameState.map.team_t.matches_won_this_series = score_team2_map;

                // Логика определения победителя
                const ctScore = data.map.team_ct?.score || 0;
                const tScore = data.map.team_t?.score || 0;
                let winner = null;
                
                // Проверяем статус игры для определения победителя
                if (data.map.phase === 'gameover') {
                    // Определяем победителя просто по большему счету
                    if (ctScore > tScore) {
                        winner = 'CT';
                        winnerTeam = currentCTTeam;
                        winnerLogo = currentCTLogo;
                    } else if (tScore > ctScore) {
                        winner = 'T';
                        winnerTeam = currentTTeam;
                        winnerLogo = currentTLogo;
                    }
                    
                    //console.log(`Определен победитель при gameover: ${winnerTeam}, счет ${ctScore}:${tScore}`);

                    // Если есть победитель, обновляем данные
                    if (winner) {
                        //console.log(`Обновляем информацию о победителе: ${winnerTeam}, лого: ${winnerLogo}`);
                        
                        // Обновляем gameState с информацией о победителе
                        gameState.map.winner = {
                            team: winnerTeam,
                            logo: winnerLogo
                        };
                        
                        // Находим текущую карту
                        const currentMap = gameState.match_maps?.find(map => 
                            map.map_name.toLowerCase() === data.map.name.toLowerCase()
                        );
                        
                        if (currentMap) {
                            currentMap.status = 'completed';
                            currentMap.winner_team = winnerTeam;
                            currentMap.winner_logo = winnerLogo;
                            
                            //console.log(`Обновляем статус карты ${currentMap.map_name} на completed, победитель: ${winnerTeam}`);
                            
                            // Обновляем базу данных с информацией о победителе и статусом карты
                            await new Promise((resolve, reject) => {
                                db.run(`
                                    UPDATE match_maps 
                                    SET winner_team = ?, 
                                        winner_logo = ?,
                                        status = 'completed'
                                    WHERE match_id = ? AND map_name = ?
                                `, [winnerTeam, winnerLogo, activeMatch.id, data.map.name], (err) => {
                                    if (err) {
                                        console.error('Ошибка при обновлении данных о победителе:', err);
                                        reject(err);
                                    } else {
                                        //console.log('Данные о победителе успешно обновлены в базе данных');
                                        resolve();
                                    }
                                });
                            });
                        } else {
                            //console.log(`Не удалось найти текущую карту ${data.map.name} в списке карт матча`);
                        }
                    }
                }
            } else {
                // Если нет активного матча, используем имена команд из игры
                gameState.map.team_ct.name = data.map.team_ct?.name || 'CT';
                gameState.map.team_ct.logo = data.map.team_ct?.logo || '';
                gameState.map.team_t.name = data.map.team_t?.name || 'T';
                gameState.map.team_t.logo = data.map.team_t?.logo || '';
            }

             // Проверяем, есть ли информация о победителе
                if (data.map.winner) {
                    const { team: winnerTeam, logo: winnerLogo } = data.map.winner;

                    // Обновляем базу данных с информацией о победителе
                    await new Promise((resolve, reject) => {
                        db.run(`
                            UPDATE match_maps 
                            SET winner_team = ?, 
                                winner_logo = ?,
                                status = 'completed'  /* Добавляем изменение статуса на completed */
                            WHERE map_name = ? AND match_id = ?
                        `, [
                            winnerTeam, 
                            winnerLogo, 
                            data.map.name,
                            activeMatch.id
                        ], (err) => {
                            if (err) {
                                console.error('Ошибка при обновлении данных о победителе:', err);
                                reject(err);
                            } else {
                                //console.log('Данные о победителе обновлены:', { 
                                    //winnerTeam, 
                                    //winnerLogo,
                                    //status: 'completed',
                                    //mapName: data.map.name
                                //});
                                resolve();
                            }
                        });
                    });

                    // Также обновляем статус в gameState
                    if (gameState.match_maps) {
                        const currentMap = gameState.match_maps.find(map => 
                            map.map_name.toLowerCase() === data.map.name.toLowerCase()
                        );
                        if (currentMap) {
                            currentMap.status = 'completed';
                        }
                    }
                }
            
            // Отправляем обновленные данные клиентам
            io.emit('gsi', gameState);
        }
        

            
        
    

        if (data.player) {
            // Логируем SteamID игрока
            //console.log('Обработка игрока:', data.player.steamid);
        
            // Получаем аватар из базы данных по SteamID
            const playerAvatar = await new Promise((resolve, reject) => {
                db.get('SELECT avatar FROM players WHERE steam64 = ?', [data.player.steamid], (err, row) => {
                    if (err) {
                        console.error('Ошибка при запросе аватара из базы:', err);
                        reject(err);
                    } else {
                        //console.log('Аватар из базы для', data.player.steamid, ':', row?.avatar || 'не найден');
                        resolve(row?.avatar || null);
                    }
                });
            });
        
            // Логируем аватар из GSI данных
            //console.log('Аватар из GSI для', data.player.steamid, ':', data.player.avatar || 'не предоставлен');
        
            // Проверяем, существует ли data.player.state
            const playerState = data.player.state || {};
            
            // Получаем имя игрока из базы данных по SteamID
            const playerName = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM players WHERE steam64 = ?', [data.player.steamid], (err, row) => {
                    if (err) {
                        console.error('Ошибка при получении имени игрока из базы:', err);
                        reject(err);
                    } else {

                        resolve(row?.nickname || null);
                    }
                });
            });

            // Находим игрока в allplayers по steamid
            const playerInAllPlayers = data.allplayers?.[data.player.steamid];
            
            gameState.player = {
                // Используем имя из базы данных, если оно есть, иначе из GSI
                name: playerName || data.player.name || gameState.player.name,
                team: data.player.team || gameState.player.team,
                state: {
                    health: playerState.health ?? gameState.player.state.health,
                    armor: playerState.armor ?? gameState.player.state.armor,
                    money: playerState.money ?? gameState.player.state.money,
                    // Используем только значение из allplayers для текущего игрока
                    defusekit: playerInAllPlayers?.state?.defusekit || false,
                    burning: playerState.burning,
                    flashed: playerState.flashed,
                    smoked: playerState.smoked,
                    round_killhs: playerState.round_killhs,
                    round_kills: playerState.round_kills,
                    round_totaldmg: playerState.round_totaldmg,
                    round_hs: playerState.round_hs,
                    round_adr: playerState.round_adr
                },
                slot: data.player.observer_slot,
                spectarget: gameState.player.steam64,
                steamid: data.player.steamid,
                teamid: gameState.player.team,
                position: data.player.position,
                match_stats: data.player.match_stats,
                weapons: data.player.weapons,
                // Используем аватар из базы данных или из GSI, убираем /uploads/ из пути
                avatar: playerAvatar ? playerAvatar.replace('/uploads/', '') : 
                       (data.player.avatar ? data.player.avatar.replace('/uploads/', '') : null)
            };
        
            // Логируем итоговый аватар
            //console.log('Итоговый аватар для', data.player.steamid, ':', gameState.player.avatar || 'не установлен');
        }
        
        if (data.allplayers) {
            gameState.allplayers = {};
            for (const [steamId, playerData] of Object.entries(data.allplayers)) {
                // Получаем данные игрока из базы данных по SteamID
                const playerInfo = await new Promise((resolve, reject) => {
                    db.get('SELECT avatar, nickname, realName FROM players WHERE steam64 = ?', [steamId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row || {});
                    });
                });

                gameState.allplayers[steamId] = {
                    ...playerData,
                    // Используем аватар из базы данных или из GSI, убираем /uploads/ из пути
                    avatar: playerInfo.avatar ? playerInfo.avatar.replace('/uploads/', '') : 
                           (playerData.avatar ? playerData.avatar.replace('/uploads/', '') : null),
                    // Добавляем никнейм и настоящее имя
                    name: playerInfo.nickname || playerData.name || '',
                    realName: playerInfo.realName || playerData.realName || ''
                };
            }
        }
        
        if (data.bomb) {
            gameState.bomb = data.bomb;
        }

        if (data.grenades) {
            gameState.grenades = data.grenades;
        }

        if (data.previously) {
            gameState.previously = data.previously;
        }

        if (data.provider) {
            gameState.provider = data.provider;
        }

        if (data.round) {
            gameState.round = data.round;
        }

        if (data.phase_countdowns) {
            gameState.phase_countdowns = {
                phase: data.phase_countdowns.phase || gameState.phase_countdowns.phase,
                phase_ends_in: data.phase_countdowns.phase_ends_in ?? gameState.phase_countdowns.phase_ends_in
            };
        }

 
        // Отправка обновленных данных клиентам
        io.emit('gsi', gameState);
        //  console.log('9. Данные отправлены клиентам');
        res.sendStatus(200);

    } catch (error) {
        //console.error('Ошибка при обработке GSI данных:', error);
        res.sendStatus(500);
    }
});


// Socket.IO подключения
io.on('connection', (socket) => {
    //console.log('Клиент подключился');

    socket.on('ready', () => {
        // Отправляем текущее состояние игры
        socket.emit('gsi', gameState);
        
        // Получаем активный матч и данные команд
        db.get(`
            SELECT 
                m.*,
                t1.name as team1_name, t1.logo as team1_logo,
                t2.name as team2_name, t2.logo as team2_logo
            FROM matches m
            LEFT JOIN teams t1 ON m.team1_id = t1.id
            LEFT JOIN teams t2 ON m.team2_id = t2.id
            WHERE m.status = 'active'
            ORDER BY m.created_at DESC
            LIMIT 1
        `, [], (err, match) => {
            if (err) {
                //console.error('Ошибка при получении данных матча:', err);
                return;
            }
            
            if (match) {
                // Отправляем информацию о командах
                socket.emit('match_data', {
                    teams: {
                        team_1: {
                            team: {
                                name: match.team1_name,
                                logo: match.team1_logo
                            },
                            score: match.score_team1 || 0
                        },
                        team_2: {
                            team: {
                                name: match.team2_name,
                                logo: match.team2_logo
                            },
                            score: match.score_team2 || 0
                        }
                    },
                    match_status: 'active',
                    format: match.format || 'bo1'
                });
            } else {
                // Если нет активного матча, проверяем наличие ожидающих матчей
                db.get(`
                    SELECT 
                        m.*,
                        t1.name as team1_name, t1.logo as team1_logo,
                        t2.name as team2_name, t2.logo as team2_logo
                    FROM matches m
                    LEFT JOIN teams t1 ON m.team1_id = t1.id
                    LEFT JOIN teams t2 ON m.team2_id = t2.id
                    WHERE m.status = 'pending'
                    ORDER BY m.created_at DESC
                    LIMIT 1
                `, [], (err, pendingMatch) => {
                    if (err || !pendingMatch) return;
                    
                    // Отправляем информацию о командах из ожидающего матча
                    socket.emit('match_data', {
                        teams: {
                            team_1: {
                                team: {
                                    name: pendingMatch.team1_name,
                                    logo: pendingMatch.team1_logo
                                },
                                score: pendingMatch.score_team1 || 0
                            },
                            team_2: {
                                team: {
                                    name: pendingMatch.team2_name,
                                    logo: pendingMatch.team2_logo
                                },
                                score: pendingMatch.score_team2 || 0
                            }
                        },
                        match_status: 'pending',
                        format: 'bo1' // Всегда bo1 для pending матчей
                    });
                });
            }
        });
    });

    socket.on('disconnect', () => {
        //console.log('Клиент отключился');
    });
});



// Проверяем, что GSI сервер запущен на правильном порту
// Запускаем основной сервер



// Порты для серверов
const PORT = 2626;
const GSI_PORT = 1350;
const open = require('../node_modules/open'); // Указываем полный путь к модулю

// Функция запуска серверов
const startServers = async () => {
    try {
        // Запускаем основной сервер
        await new Promise((resolve) => {
            http.listen(PORT, () => {
                console.log('=================================');
                console.log(`Сервер запущен на http://${serverIP}:${PORT}`);
                console.log(`Socket.IO готов к подключениям`);
                console.log('=================================');
                
                // Используем альтернативный метод для Windows
                const { exec } = require('child_process');
                const platform = process.platform;
                const url = `http://${serverIP}:${PORT}`;

                let command;
                switch (platform) {
                    case 'win32':
                        command = `start ${url}`;
                        break;
                    case 'darwin':
                        command = `open ${url}`;
                        break;
                    case 'linux':
                        command = `xdg-open ${url}`;
                        break;
                    default:
                        console.log(`Платформа ${platform} не поддерживается для автоматического открытия браузера`);
                        return;
                }

                exec(command, (err) => {
                    if (err) {
                        console.error('Ошибка при открытии браузера:', err);
                    }
                });
                
                resolve();
            });
        });

        // Запускаем GSI сервер
        await new Promise((resolve) => {
            gsiServer.listen(GSI_PORT, () => {
                console.log(`GSI сервер запущен на порту ${GSI_PORT}`);
                resolve();
            });
        });

    } catch (error) {
        console.error('Ошибка при запуске серверов:', error);
        process.exit(1);
    }
};

// Запускаем серверы
startServers();

// Обработка ошибок процесса
process.on('uncaughtException', (error) => {
    console.error('Необработанное исключение:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Необработанное отклонение промиса:', error);
});

// Перед отправкой обновлений GSI
if (!global.lastGsiUpdate) {
    global.lastGsiUpdate = 300;
    global.gsiThrottleInterval = 300; // Интервал в мс (30 fps)
}

// Отправка обновленных данных клиентам с дросселированием
const now = Date.now();
if (now - global.lastGsiUpdate > global.gsiThrottleInterval) {
    global.lastGsiUpdate = now;
    io.emit('gsi', gameState);
}

// Добавьте эти переменные в начало модуля радара
const NodeCache = require('node-cache');
const radarCache = new NodeCache({ stdTTL: 5, checkperiod: 10 });
const throttle = require('lodash.throttle');

// Кэширование данных игроков и буферизация обновлений
let playersBuffer = {};
let updatesPending = false;

// Дросселирование функции обновления позиций
const updateRadarPositions = throttle(function() {
    // Код обновления позиций игроков на радаре
    for (const steamId in playersBuffer) {
        const playerData = playersBuffer[steamId];
        // Обновление DOM
    }
    playersBuffer = {};
    updatesPending = false;
}, 16); // ~60fps

// Вместо прямого обновления при получении данных
function handleGsiUpdate(data) {
    // Буферизация данных
    if (data.allplayers) {
        for (const [steamId, player] of Object.entries(data.allplayers)) {
            // Кэшируем предыдущую позицию для сравнения
            const prevPos = radarCache.get(`player_${steamId}_pos`);
            const currentPos = player.position;
            
            // Обновляем только при значительном изменении позиции
            if (!prevPos || 
                Math.abs(prevPos.x - currentPos.x) > 5 || 
                Math.abs(prevPos.y - currentPos.y) > 5) {
                
                // Сохраняем в буфер и кэш
                playersBuffer[steamId] = player;
                radarCache.set(`player_${steamId}_pos`, currentPos);
                
                if (!updatesPending) {
                    updatesPending = true;
                    requestAnimationFrame(updateRadarPositions);
                }
            }
        }
    }
}

// Оптимизация очистки неиспользуемых элементов
// Вызывайте эту функцию реже, например каждые 30 кадров
let cleanupCounter = 0;
function cleanupUnusedElements() {
    cleanupCounter++;
    if (cleanupCounter < 30) return;
    cleanupCounter = 0;
    
    // Код очистки неиспользуемых элементов
}