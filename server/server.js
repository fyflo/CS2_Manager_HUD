const express = require("express");
const ip = require("ip");
const path = require("path"); // Перемещаем сюда импорт path
const app = express();
const gsiApp = express();
const https = require("https");
const fs = require("fs");
const selfsigned = require("selfsigned");
const { Server } = require("socket.io"); // Добавляем импорт Server из socket.io
const compression = require("compression");

// Включаем сжатие для всех ответов
app.use(compression());
gsiApp.use(compression());

// 2. Добавим функцию генерации сертификатов
function generateCertificate() {
  console.log("Генерация самоподписанных SSL-сертификатов...");
  const attrs = [{ name: "commonName", value: "localhost" }];
  const pems = selfsigned.generate(attrs, { days: 365 });

  const certPath = path.join(__dirname, "ssl-cert.pem");
  const keyPath = path.join(__dirname, "ssl-key.pem");

  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(keyPath, pems.private);

  return {
    cert: pems.cert,
    key: pems.private,
  };
}

// 3. Проверяем существование или создаем сертификаты
let sslOptions;
try {
  const certPath = path.join(__dirname, "ssl-cert.pem");
  const keyPath = path.join(__dirname, "ssl-key.pem");

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log("Загружаем существующие SSL-сертификаты");
    sslOptions = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  } else {
    sslOptions = generateCertificate();
  }
} catch (error) {
  console.error("Ошибка при подготовке SSL:", error);
  // В случае ошибки продолжаем работу в HTTP режиме
  sslOptions = null;
}

// 1. Объявите переменную ioHttps ДО использования
// Переместите эту строку перед блоком if (sslOptions)
let ioHttps = null;

// 4. Создаем оба сервера - HTTP и HTTPS
// Оставляем оригинальный HTTP для совместимости
const http = require("http").createServer(app);
// Добавляем HTTPS сервер
let httpsServer = null;
let httpsGsiServer = null;

if (sslOptions) {
  try {
    httpsServer = https.createServer(sslOptions, app);
    httpsGsiServer = https.createServer(sslOptions, gsiApp);
    console.log("HTTPS серверы созданы успешно");

    // Инициализация Socket.IO для HTTPS - теперь переменная уже объявлена
    ioHttps = new Server(httpsServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });
    console.log("ioHttps (Socket.IO для HTTPS) инициализирован");

    // Настройка обработчиков событий
    ioHttps.on("connection", function (socket) {
      console.log("Новое подключение к HTTPS WebSocket");

      socket.on("ready", () => {
        console.log("Клиент на HTTPS отправил ready");
        socket.emit("gsi", gameState);

        // Получаем активный матч и данные команд
        // ... (аналогично коду для HTTP WebSocket)
      });

      socket.on("disconnect", () => {
        console.log("Клиент отключился от HTTPS WebSocket");
      });

      socket.on("hud_data", (data) => {
        console.log("Получены hud_data через HTTPS WebSocket:", data.type);
        ioHttps.emit("hud_data", data);
      });
    });
  } catch (error) {
    console.error("Ошибка при создании HTTPS серверов:", error);
    httpsServer = null;
    httpsGsiServer = null;
    ioHttps = null; // Теперь это нормально, т.к. переменная уже объявлена
  }
}

// 5. Создаем Socket.IO для HTTP
const io = new Server(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Удалите или закомментируйте эти строки, так как ioHttps уже объявлен выше
// Если HTTPS успешно создан, также подключаем Socket.IO к нему
// let ioHttps = null;
if (httpsServer && ioHttps) {
  // Дублируем обработчики событий с io на ioHttps
  ioHttps.on("connection", (socket) => {
    socket.on("ready", () => {
      socket.emit("gsi", gameState);

      // Получаем активный матч и данные команд (код такой же как для io)
      db.get(
        `
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
            `,
        [],
        (err, match) => {
          if (err) return;

          if (match) {
            socket.emit("match_data", {
              teams: {
                team_1: {
                  team: {
                    name: match.team1_name,
                    logo: match.team1_logo,
                  },
                  score: match.score_team1 || 0,
                },
                team_2: {
                  team: {
                    name: match.team2_name,
                    logo: match.team2_logo,
                  },
                  score: match.score_team2 || 0,
                },
              },
              match_status: "active",
              format: match.format || "bo1",
            });
          } else {
            // Если нет активного матча, проверяем наличие ожидающих матчей
            db.get(
              `
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
                    `,
              [],
              (err, pendingMatch) => {
                if (err || !pendingMatch) return;

                socket.emit("match_data", {
                  teams: {
                    team_1: {
                      team: {
                        name: pendingMatch.team1_name,
                        logo: pendingMatch.team1_logo,
                      },
                      score: pendingMatch.score_team1 || 0,
                    },
                    team_2: {
                      team: {
                        name: pendingMatch.team2_name,
                        logo: pendingMatch.team2_logo,
                      },
                      score: pendingMatch.score_team2 || 0,
                    },
                  },
                  match_status: "pending",
                  format: pendingMatch.format || "bo1",
                });
              }
            );
          }
        }
      );
    });

    socket.on("hud_data", (data) => {
      ioHttps.emit("hud_data", data);
    });
  });
}

// 6. Изменяем отправку событий - нужно отправлять в оба сокета
// Создаем функцию для рассылки
function broadcastToAllClients(event, data) {
  // Всегда отправляем через HTTP Socket.IO
  io.emit(event, data);

  // Если есть HTTPS Socket.IO, отправляем и через него
  if (ioHttps) {
    ioHttps.emit(event, data);
  }
}

// Получаем IP адрес сервера
const serverIP = ip.address();

// Настройка статических файлов
app.use(express.static("public"));

// Настройка кэширования для статических файлов
app.use(
  express.static("public", {
    maxAge: "1h",
    etag: true,
    lastModified: true,
  })
);

// Настройка кэширования для GSI-сервера
gsiApp.use(
  express.static("public", {
    maxAge: "1h",
    etag: true,
    lastModified: true,
  })
);

// Socket.IO подключения
io.on("connection", (socket) => {
  //console.log('Клиент подключился');

  socket.on("disconnect", () => {
    //console.log('Клиент отключился');
  });
});

// Маршрут для получения информации о сервере
app.get("/api/server-info", (req, res) => {
  res.json({
    ip: serverIP,
    port: PORT,
  });
});

const multer = require("multer");
const { exec } = require("child_process");
const sqlite3 = require("sqlite3").verbose();
//// ELECTRON_APP_PATCH
// Определяем путь к базе данных в зависимости от окружения
const dbPath = process.env.ELECTRON_APP
  ? path.join(__dirname, "../database.db") // Путь для Electron приложения
  : "database.db"; // Стандартный путь

console.log("Используется база данных:", dbPath);
const db = new sqlite3.Database(dbPath); // Изменить с database.sqlite на database.db

// Загрузка локализаций
const locales = {
  ru: require("../public/locales/ru.js"),
  en: require("../public/locales/en.js"),
  zh: require("../public/locales/zh.js"),
};

// Создаем отдельный сервер для GSI данных
const gsiServer = require("http").createServer(gsiApp);

// Добавляем парсеры для JSON и URL-encoded данных
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
gsiApp.use(express.json({ limit: "50mb" }));
gsiApp.use(express.urlencoded({ extended: true }));

// Настройка статических файлов для основного сервера
app.use(express.static(path.join(__dirname, "../public")));
app.use("/huds", express.static(path.join(__dirname, "../public/huds")));

// Настройка статических файлов для GSI-сервера
gsiApp.use(express.static(path.join(__dirname, "../public")));
gsiApp.use(
  "/uploads",
  express.static(path.join(__dirname, "../public/uploads"))
);
gsiApp.use("/images", express.static(path.join(__dirname, "../public/images")));

// Настройка хранения файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// Создаем папку для загрузок, если её нет
const uploadsDir = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Подключаем маршруты API
const matchesRoutes = require("./routes/matches");
const teamsRoutes = require("./routes/teams");
const playersRoutes = require("./routes/players");

// Делаем базу данных доступной в маршрутах
app.locals.db = db;

// Используем маршруты
app.use("/api/matches", matchesRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/players", playersRoutes);

// Middleware для определения языка (исправленный с проверкой на undefined)
app.use((req, res, next) => {
  // Проверяем, что cookies определены
  const cookies = req.cookies || {};

  // Получаем предпочтительный язык из куки или параметра запроса
  let lang = cookies.lang || req.query.lang || "ru"; // По умолчанию русский

  // Проверяем, поддерживается ли выбранный язык
  if (!locales[lang]) {
    lang = "ru";
  }

  // Сохраняем выбранный язык в куки на 1 год, если он был передан в запросе
  if (req.query.lang && req.query.lang !== cookies.lang) {
    res.cookie("lang", lang, { maxAge: 365 * 24 * 60 * 60 * 1000 });
  }

  // Добавляем переменные локализации к res.locals для использования в шаблонах
  res.locals.lang = lang;
  res.locals.t = locales[lang];

  next();
});

// API для изменения языка
app.get("/api/change-language", (req, res) => {
  const lang = req.query.lang || "ru";

  if (locales[lang]) {
    // Просто возвращаем выбранный язык без сохранения в cookies
    res.json({ success: true, language: lang });
  } else {
    res.status(400).json({ success: false, message: "Unsupported language" });
  }
});

// API для получения текущего языка и всех доступных переводов
app.get("/api/get-translations", (req, res) => {
  const lang = req.query.lang || "ru";
  const translationsToSend = locales[lang] || locales["ru"]; // Если выбранного языка нет, используем русский

  res.json({
    language: lang,
    translations: translationsToSend,
  });
});

// Настройка базы данных
// DB_FIX_APPLIED - Используем существующее подключение к базе данных

// Проверяем наличие колонки short_name в таблице teams
db.all(`PRAGMA table_info(teams)`, (err, rows) => {
  if (err) {
    console.error("Ошибка при проверке схемы таблицы teams:", err);
    return;
  }

  // Проверяем существование колонки short_name
  const hasShortName = rows && rows.some((row) => row.name === "short_name");

  if (!hasShortName) {
    db.run(`ALTER TABLE teams ADD COLUMN short_name TEXT`, (err) => {
      if (err) {
        console.error("Ошибка при добавлении колонки short_name:", err);
      } else {
        console.log("Колонка short_name успешно добавлена в таблицу teams");
      }
    });
  } else {
    console.log("Колонка short_name уже существует в таблице teams");
  }
});

// В начале файла после создания базы данных
db.serialize(() => {
  // Создание таблицы teams
  db.run(`CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        logo TEXT,
        region TEXT,
        short_name TEXT
    )`);

  // Создание таблицы players
  db.run(`CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL,
        realName TEXT,
        steam64 TEXT,
        teamId INTEGER,
        avatar TEXT,
        cameraLink TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(teamId) REFERENCES teams(id)
    )`);

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
  db.run(
    `
        SELECT score_team1 FROM matches LIMIT 1
    `,
    [],
    (err) => {
      if (err) {
        // Колонка не существует, добавляем её
        db.run(`ALTER TABLE matches ADD COLUMN score_team1 INTEGER DEFAULT 0`);
      }
    }
  );

  db.run(
    `
        SELECT score_team2 FROM matches LIMIT 1
    `,
    [],
    (err) => {
      if (err) {
        // Колонка не существует, добавляем её
        db.run(`ALTER TABLE matches ADD COLUMN score_team2 INTEGER DEFAULT 0`);
      }
    }
  );

  // Проверяем наличие столбца format
  db.all("PRAGMA table_info(matches)", [], (err, rows) => {
    if (err) {
      console.error("Ошибка при проверке структуры таблицы:", err);
      return;
    }

    // Используем метод .some() на массиве rows
    const hasFormatColumn =
      Array.isArray(rows) && rows.some((row) => row.name === "format");

    if (!hasFormatColumn) {
      db.run(
        "ALTER TABLE matches ADD COLUMN format TEXT DEFAULT 'bo1'",
        [],
        (err) => {
          if (err) {
            console.error("Ошибка при добавлении столбца format:", err);
            return;
          }
          console.log("Столбец format успешно добавлен в таблицу matches");
        }
      );
    }
  });

  // Проверяем наличие колонки cameraLink в таблице players
  db.all("PRAGMA table_info(players)", [], (err, rows) => {
    if (err) {
      console.error("Ошибка при проверке структуры таблицы players:", err);
      return;
    }

    const hasCameraLinkColumn =
      Array.isArray(rows) && rows.some((row) => row.name === "cameraLink");

    if (!hasCameraLinkColumn) {
      db.run("ALTER TABLE players ADD COLUMN cameraLink TEXT", [], (err) => {
        if (err) {
          console.error("Ошибка при добавлении столбца cameraLink:", err);
          return;
        }
        console.log("Столбец cameraLink успешно добавлен в таблицу players");
      });
    }
    
    // Проверяем наличие колонки created_at
    const hasCreatedAtColumn =
      Array.isArray(rows) && rows.some((row) => row.name === "created_at");
      
    if (!hasCreatedAtColumn) {
      console.log("Добавляем колонку created_at в таблицу players...");
      // Создаем новую таблицу с нужной структурой
      db.run(`
          CREATE TABLE IF NOT EXISTS players_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              nickname TEXT NOT NULL,
              realName TEXT,
              steam64 TEXT,
              teamId INTEGER,
              avatar TEXT,
              cameraLink TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(teamId) REFERENCES teams(id)
          )
      `, (err) => {
          if (err) {
              console.error("Ошибка при создании новой таблицы players_new:", err);
              return;
          }
          
          // Копируем данные из старой таблицы
          db.run(`
              INSERT INTO players_new (id, nickname, realName, steam64, teamId, avatar, cameraLink)
              SELECT id, nickname, realName, steam64, teamId, avatar, cameraLink FROM players
          `, (err) => {
              if (err) {
                  console.error("Ошибка при копировании данных в новую таблицу:", err);
                  return;
              }
              
              // Удаляем старую таблицу
              db.run("DROP TABLE players", (err) => {
                  if (err) {
                      console.error("Ошибка при удалении старой таблицы:", err);
                      return;
                  }
                  
                  // Переименовываем новую таблицу
                  db.run("ALTER TABLE players_new RENAME TO players", (err) => {
                      if (err) {
                          console.error("Ошибка при переименовании таблицы:", err);
                          return;
                      }
                      
                      console.log("Таблица players успешно обновлена с колонкой created_at");
                  });
              });
          });
      });
    }
  });
});

// Настройка шаблонизатора
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "../public"));

// В начале файла, где создаются таблицы

db.serialize(() => {
  // Создаем временную таблицу для хранения данных
  db.run(
    "CREATE TABLE IF NOT EXISTS matches_temp AS SELECT id, team1_id, team2_id, status, score_team1, score_team2, created_at, updated_at FROM matches"
  );

  // Удаляем исходную таблицу
  db.run("DROP TABLE IF EXISTS matches");

  // Создаем новую таблицу с нужной структурой
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
    `);

  // Копируем данные обратно из временной таблицы
  db.run(
    "INSERT INTO matches (id, team1_id, team2_id, status, score_team1, score_team2, created_at, updated_at) SELECT id, team1_id, team2_id, status, score_team1, score_team2, created_at, updated_at FROM matches_temp"
  );

  // Удаляем временную таблицу
  db.run("DROP TABLE IF EXISTS matches_temp");

  console.log("Таблица matches успешно пересоздана со столбцом format");
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
  "M:\\Steam",
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
      const libraryVdf = path.join(
        steamPath,
        "steamapps",
        "libraryfolders.vdf"
      );
      if (fs.existsSync(libraryVdf)) {
        try {
          const content = fs.readFileSync(libraryVdf, "utf8");
          // Простой парсинг путей в VDF (не идеальный, но работает для большинства случаев)
          const pathMatches = content.match(/"path"\s+"([^"]+)"/g);
          if (pathMatches) {
            for (const match of pathMatches) {
              const libPath = match
                .match(/"path"\s+"([^"]+)"/)[1]
                .replace(/\\\\/g, "\\");
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
      path.join(libraryPath, "common", "Counter-Strike 2"),
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
app.get("/api/check-cs2-configs", (req, res) => {
  try {
    const customPath = req.query.path; // Позволяем пользователю указать свой путь
    let cs2Path = customPath;

    if (!cs2Path) {
      cs2Path = findCS2Path();
    }

    if (!cs2Path || !fs.existsSync(cs2Path)) {
      return res.json({
        success: false,
        message: "CS2 не найден по стандартным путям. Укажите путь вручную.",
      });
    }

    //console.info("Найдена установка CS2 в", cs2Path);
    // Обновленный правильный путь к конфигам
    const configDir = path.join(cs2Path, "game", "csgo", "cfg");

    // Проверяем существование обоих конфигов
    const gsiConfigPath = path.join(
      configDir,
      "gamestate_integration_fhud.cfg"
    );
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
      configPath: configDir,
    });
  } catch (error) {
    console.error("Ошибка при проверке конфигов:", error);
    return res
      .status(500)
      .json({ success: false, message: "Ошибка при проверке конфигов" });
  }
});

// Установка конфигов CS2
app.get("/api/install-cs2-configs", (req, res) => {
  try {
    const customPath = req.query.path;
    let cs2Path = customPath;

    if (!cs2Path) {
      cs2Path = findCS2Path();
    }

    if (!cs2Path || !fs.existsSync(cs2Path)) {
      return res.json({
        success: false,
        message: "CS2 не найден по стандартным путям. Укажите путь вручную.",
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
    const sourceGsiPath = path.join(
      process.cwd(),
      "cfg",
      "gamestate_integration_fhud.cfg"
    );
    const sourceObserverPath = path.join(process.cwd(), "cfg", "observer.cfg");
    const sourceObserver_offPath = path.join(
      process.cwd(),
      "cfg",
      "observer_off.cfg"
    );
    const sourceObserver2Path = path.join(
      process.cwd(),
      "cfg",
      "observer2.cfg"
    ); // Add this line

    // Destination paths
    const destGsiPath = path.join(configDir, "gamestate_integration_fhud.cfg");
    const destObserverPath = path.join(configDir, "observer.cfg");
    const destObserver_offPath = path.join(configDir, "observer_off.cfg");
    const destObserver2Path = path.join(configDir, "observer2.cfg"); // Add this line

    let installed = {
      gsi: false,
      observer: false,
      observer_off: false,
      observer2: false,
    }; // Update this line
    let errors = [];

    // Копируем GSI конфиг
    if (fs.existsSync(sourceGsiPath)) {
      fs.copyFileSync(sourceGsiPath, destGsiPath);
      installed.gsi = true;
      //console.info("Установлен GSI конфиг в", destGsiPath);
    } else {
      errors.push("Не найден исходный файл GSI конфига");
    }

    // Копируем Observer конфиг
    if (fs.existsSync(sourceObserverPath)) {
      fs.copyFileSync(sourceObserverPath, destObserverPath);
      installed.observer = true;
      //console.info("Установлен Observer конфиг в", destObserverPath);
    } else {
      errors.push("Не найден исходный файл Observer конфига");
    }

    // Копируем Observer конфиг
    if (fs.existsSync(sourceObserver2Path)) {
      fs.copyFileSync(sourceObserver2Path, destObserver2Path);
      installed.observer2 = true;
      //console.info("Установлен Observer конфиг в", destObserverPath);
    } else {
      errors.push("Не найден исходный файл Observer2 конфига");
    }

    // Копируем Observer_off конфиг
    if (fs.existsSync(sourceObserver_offPath)) {
      fs.copyFileSync(sourceObserver_offPath, destObserver_offPath);
      installed.observer_off = true;
      //console.info("Установлен Observer_off конфиг в", destObserver_offPath);
    } else {
      errors.push("Не найден исходный файл Observer_off конфига");
    }
    if (errors.length > 0) {
      return res.json({
        success: false,
        message: errors.join(". "),
        installed: installed,
      });
    }

    return res.json({
      success: true,
      message: "Конфиги успешно установлены",
      installed: installed,
      configPath: configDir,
    });
  } catch (error) {
    //console.error("Ошибка при установке конфигов:", error);
    return res
      .status(500)
      .json({ success: false, message: "Ошибка при установке конфигов" });
  }
});

// Создание нового матча без использования поля format
app.post("/api/matches", (req, res) => {
  const { team1_id, team2_id } = req.body;

  // Проверка наличия обязательных полей
  if (!team1_id || !team2_id) {
    return res.status(400).json({
      error: "Обязательные поля отсутствуют",
      details: "team1_id и team2_id обязательны",
    });
  }

  db.run(
    `
        INSERT INTO matches (team1_id, team2_id, status) 
        VALUES (?, ?, 'pending')
    `,
    [team1_id, team2_id],
    function (err) {
      if (err) {
        console.error("Ошибка при создании матча:", err);
        return res.status(500).json({
          error: "Ошибка при создании матча",
          details: err.message,
        });
      }

      // Возвращаем ID созданного матча
      res.json({
        success: true,
        matchId: this.lastID,
        message: "Матч успешно создан",
      });
    }
  );
});

// Получение списка матчей
app.get("/api/matches", (req, res) => {
  logMatchesApi(
    `Запрос к /api/matches | DB_PATH: ${dbPath} | Параметры: ${JSON.stringify(
      req.query
    )}`
  );
  db.all(
    `
        SELECT 
            m.*,
            t1.name as team1_name,
            t1.short_name as team1_short_name,
            t2.name as team2_name,
            t2.short_name as team2_short_name,
            mm.id as map_id,
            mm.map_name,
            mm.pick_team,
            mm.side_pick_team,
            mm.order_number,
            mm.score_team1 as map_score_team1,
            mm.score_team2 as map_score_team2,
            mm.status as map_status,
            -- Используем winner_team и winner_logo напрямую
            mm.winner_team as winner_team,
            mm.winner_logo as winner_logo,
            mm.original_pick_team_name as pick_team_name,
            mm.original_pick_team_logo as pick_team_logo
        FROM matches m
        LEFT JOIN teams t1 ON m.team1_id = t1.id
        LEFT JOIN teams t2 ON m.team2_id = t2.id
        LEFT JOIN match_maps mm ON m.id = mm.match_id
        WHERE m.status IN ('pending', 'active')
        ORDER BY m.created_at DESC, mm.order_number ASC
    `,
    [],
    (err, rows) => {
      if (err) {
        //console.error('Ошибка при получении списка матчей:', err);
        return res.status(500).json({ error: err.message });
      }

      // Преобразуем результаты в структуру матчей с картами
      const matches = [];
      let currentMatch = null;

      rows.forEach((row) => {
        // Если это новый матч или первая запись
        if (!currentMatch || currentMatch.id !== row.id) {
          currentMatch = {
            id: row.id,
            team1_id: row.team1_id,
            team2_id: row.team2_id,
            team1_name: row.team1_name,
            team1_short_name: row.team1_short_name || "",
            team2_name: row.team2_name,
            team2_short_name: row.team2_short_name || "",
            format: row.format,
            status: row.status,
            score_team1: row.score_team1,
            score_team2: row.score_team2,
            created_at: row.created_at,
            maps: [],
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
            name_team_pick: row.pick_team_name || null,
            logo_team_pick: row.pick_team_logo || null,
            winner_team: row.winner_team,
            winner_logo: row.winner_logo,
          });
        }
      });

      res.json(matches);
    }
  );
});

// Обработчик обновления счета матча
app.post("/api/matches/:id/score", async (req, res) => {
  const matchId = req.params.id;
  const { team, change, swap } = req.body; // Добавляем параметр swap

  //console.log('Получен запрос на обновление счета:', { matchId, team, change, swap });

  try {
    // Проверяем существование матча
    const match = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM matches WHERE id = ?", [matchId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!match) {
      //console.log('Матч не найден:', matchId);
      return res.status(404).json({ error: "Матч не найден" });
    }

    // Определяем поле для обновления
    let scoreField = team === 1 ? "score_team1" : "score_team2";
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

      db.run(query, [newScore, matchId], function (err) {
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
      db.get("SELECT * FROM matches WHERE id = ?", [matchId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      success: true,
      match: updatedMatch,
    });
  } catch (error) {
    //console.error('Ошибка при обновлении счета:', error);
    res.status(500).json({
      error: "Ошибка при обновлении счета",
      details: error.message,
    });
  }
});

// Удаление матча
app.delete("/api/matches/:id", (req, res) => {
  const matchId = req.params.id;

  // Использование транзакции для удаления матча и связанных записей
  db.run("BEGIN TRANSACTION", (err) => {
    if (err) {
      console.error("Ошибка начала транзакции:", err);
      return res.status(500).json({ error: "Ошибка начала транзакции" });
    }

    // Сначала удаляем записи из match_maps
    db.run("DELETE FROM match_maps WHERE match_id = ?", [matchId], (err) => {
      if (err) {
        db.run("ROLLBACK");
        console.error("Ошибка при удалении карт матча:", err);
        return res
          .status(500)
          .json({ error: "Ошибка при удалении карт матча" });
      }

      // Затем удаляем сам матч
      db.run("DELETE FROM matches WHERE id = ?", [matchId], (err) => {
        if (err) {
          db.run("ROLLBACK");
          console.error("Ошибка при удалении матча:", err);
          return res.status(500).json({ error: "Ошибка при удалении матча" });
        }

        // Завершаем транзакцию
        db.run("COMMIT", (err) => {
          if (err) {
            console.error("Ошибка при завершении транзакции:", err);
            return res
              .status(500)
              .json({ error: "Ошибка при завершении транзакции" });
          }

          // Успешный ответ
          res.json({
            success: true,
            message: "Матч успешно удален",
          });
        });
      });
    });
  });
});

// Запуск матча
app.post("/api/matches/:id/start", (req, res) => {
  db.run(
    'UPDATE matches SET status = "active" WHERE id = ?',
    [req.params.id],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: "Матч запущен" });
    }
  );
});

// Смена сторон в матче
// Добавляем новые поля в таблицу match_maps для хранения оригинальных данных
app.post("/api/matches/:id/swap", (req, res) => {
  const matchId = req.params.id;

  // Сначала получаем текущие данные о матче и картах
  db.get(
    `
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
    `,
    [matchId],
    (err, match) => {
      if (err) {
        console.error("Ошибка при получении данных матча:", err);
        return res
          .status(500)
          .json({ error: "Ошибка при получении данных матча" });
      }

      if (!match) {
        return res.status(404).json({ error: "Матч не найден" });
      }

      // Получаем данные о картах
      db.all(
        `
            SELECT 
                mm.*,
                mm.original_pick_team_name as name_team_pick,
                mm.original_pick_team_logo as logo_team_pick
            FROM match_maps mm
            WHERE mm.match_id = ?
            ORDER BY mm.order_number
        `,
        [match.id],
        (err, maps) => {
          if (err) {
            console.error("Ошибка при получении данных карт:", err);
            return res
              .status(500)
              .json({ error: "Ошибка при получении данных карт" });
          }

          // Начинаем транзакцию
          db.run("BEGIN TRANSACTION", (beginErr) => {
            if (beginErr) {
              console.error("Ошибка начала транзакции:", beginErr);
              return res
                .status(500)
                .json({ error: "Ошибка начала транзакции" });
            }

            // Сначала сохраняем оригинальные данные о командах, пикнувших карты, если их еще нет
            const saveOriginalDataPromises = maps.map((map) => {
              return new Promise((resolve, reject) => {
                if (
                  !map.original_pick_team_name ||
                  !map.original_pick_team_logo
                ) {
                  let pickTeamName = null;
                  let pickTeamLogo = null;

                  if (map.pick_team === "team1") {
                    pickTeamName = match.team1_name;
                    pickTeamLogo =
                      map.original_pick_team_logo || match.team1_logo;
                  } else if (map.pick_team === "team2") {
                    pickTeamName = match.team2_name;
                    pickTeamLogo =
                      map.original_pick_team_logo || match.team2_logo;
                  } else if (map.pick_team === "DECIDER") {
                    pickTeamName = null;
                    pickTeamLogo = null;
                  }

                  db.run(
                    `
                                UPDATE match_maps 
                                SET original_pick_team_name = ?, original_pick_team_logo = ?
                                WHERE id = ?
                            `,
                    [pickTeamName, pickTeamLogo, map.id],
                    (err) => {
                      if (err) reject(err);
                      else resolve();
                    }
                  );
                } else {
                  resolve();
                }
              });
            });

            // Сохраняем original_winner_* если они еще не заданы
            const saveWinnerDataPromises = maps.map((map) => {
              return new Promise((resolve, reject) => {
                if (map.winner_team && !map.original_winner_team) {
                  console.log(
                    `Сохраняем original_winner_team=${map.winner_team} для карты ${map.map_name}`
                  );
                  db.run(
                    `
                                UPDATE match_maps 
                                SET original_winner_team = ?, original_winner_logo = ?
                                WHERE id = ?
                            `,
                    [map.winner_team, map.winner_logo, map.id],
                    (err) => {
                      if (err) reject(err);
                      else resolve();
                    }
                  );
                } else {
                  resolve();
                }
              });
            });

            // Дожидаемся сохранения оригинальных данных
            Promise.all([
              ...saveOriginalDataPromises,
              ...saveWinnerDataPromises,
            ]).then(() => {
              // Не меняем данные о победителях, просто продолжаем операцию swap
              console.log(
                "Выполняем swap операцию без изменения данных о победителях"
              );

              // Меняем значения pick_team для правильной работы селекторов
              db.run(
                `
                            UPDATE match_maps 
                            SET pick_team = CASE 
                                WHEN pick_team = 'team1' THEN 'team2'
                                WHEN pick_team = 'team2' THEN 'team1'
                                ELSE pick_team
                            END
                            WHERE match_id = ?
                        `,
                [matchId],
                (swapPickErr) => {
                  if (swapPickErr) {
                    db.run("ROLLBACK");
                    console.error(
                      "Ошибка при обновлении pick_team:",
                      swapPickErr
                    );
                    return res
                      .status(500)
                      .json({ error: "Ошибка при обновлении pick_team" });
                  }

                  // Выполняем свап команд в матче, но НЕ меняем данные о победителях карт
                  db.run(
                    `
                                UPDATE matches 
                                SET 
                                    team1_id = team2_id,
                                    team2_id = team1_id,
                                    score_team1 = score_team2,
                                    score_team2 = score_team1
                                WHERE id = ?
                            `,
                    [matchId],
                    (swapTeamsErr) => {
                      if (swapTeamsErr) {
                        db.run("ROLLBACK");
                        console.error("Ошибка при смене сторон:", swapTeamsErr);
                        return res
                          .status(500)
                          .json({ error: "Ошибка при смене сторон" });
                      }

                      // НОВЫЙ КОД: Синхронизируем поля winner_* с original_winner_* после свапа
                      db.run(
                        `
                                    UPDATE match_maps 
                                    SET winner_team = original_winner_team,
                                        winner_logo = original_winner_logo
                                    WHERE match_id = ? AND original_winner_team IS NOT NULL
                                `,
                        [matchId],
                        (syncErr) => {
                          if (syncErr) {
                            db.run("ROLLBACK");
                            console.error(
                              "Ошибка при синхронизации данных победителей:",
                              syncErr
                            );
                            return res.status(500).json({
                              error:
                                "Ошибка при синхронизации данных победителей",
                            });
                          }

                          // Остальной код остается без изменений...
                          // Подтверждаем транзакцию
                          db.run("COMMIT", (commitErr) => {
                            if (commitErr) {
                              console.error(
                                "Ошибка при подтверждении транзакции:",
                                commitErr
                              );
                              return res.status(500).json({
                                error: "Ошибка при подтверждении транзакции",
                              });
                            }

                            // Отправляем успешный ответ клиенту
                            res.json({
                              success: true,
                              message: "Стороны успешно изменены",
                            });
                          });
                        }
                      );
                    }
                  );
                }
              );
            });
          });
        }
      );
    }
  );
});

// Получение данных матча для редактирования
app.get("/api/matches/:id", (req, res) => {
  const matchId = req.params.id;

  db.get(
    `
        SELECT 
            m.*,
            t1.name as team1_name,
            t1.logo as team1_logo,
            t1.short_name as team1_short_name,
            t2.name as team2_name, 
            t2.logo as team2_logo,
            t2.short_name as team2_short_name
        FROM matches m
        LEFT JOIN teams t1 ON m.team1_id = t1.id
        LEFT JOIN teams t2 ON m.team2_id = t2.id
        WHERE m.id = ?
    `,
    [matchId],
    (err, match) => {
      if (err) {
        console.error("Ошибка при получении данных матча:", err);
        return res.status(500).json({ error: err.message });
      }
      if (!match) {
        return res.status(404).json({ error: "Матч не найден" });
      }

      // Получаем данные о картах матча
      db.all(
        `
            SELECT 
                mm.*,
                -- Используем winner_team и winner_logo напрямую без COALESCE
                mm.winner_team,
                mm.winner_logo
            FROM match_maps mm
            WHERE mm.match_id = ?
            ORDER BY mm.order_number
        `,
        [matchId],
        (err, maps) => {
          if (err) {
            console.error("Ошибка при получении данных о картах:", err);
            return res.status(500).json({ error: err.message });
          }

          match.maps = maps || [];
          res.json(match);
        }
      );
    }
  );
});

// Обновление данных матча
app.post("/api/matches/:id/update", async (req, res) => {
  const matchId = req.params.id;
  const { format, maps } = req.body;

  try {
    // Получаем информацию о командах матча
    const match = await new Promise((resolve, reject) => {
      db.get(
        `
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
            `,
        [matchId],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });

    // Начинаем транзакцию
    await new Promise((resolve, reject) => {
      db.run("BEGIN TRANSACTION", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Обновляем основные данные матча
    await new Promise((resolve, reject) => {
      db.run(
        `
                UPDATE matches 
                SET format = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
        [format, matchId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Удаляем существующие карты матча
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM match_maps WHERE match_id = ?", [matchId], (err) => {
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
                    original_pick_team_logo,
                    map_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

      for (const [index, map] of maps.entries()) {
        let pickTeamName = null;
        let pickTeamLogo = null;

        // Определяем имя и лого команды, выбравшей карту
        if (map.pickTeam === "team1") {
          pickTeamName = match.team1_name;
          pickTeamLogo = match.team1_logo;
        } else if (map.pickTeam === "team2") {
          pickTeamName = match.team2_name;
          pickTeamLogo = match.team2_logo;
        } else if (map.pickTeam === "DECIDER") {
          pickTeamName = null;
          pickTeamLogo = null;
        }

        await new Promise((resolve, reject) => {
          stmt.run(
            [
              matchId,
              map.mapId,
              map.pickTeam || null,
              map.startingSide?.team || null,
              index + 1,
              map.score?.team1 || 0,
              map.score?.team2 || 0,
              pickTeamName, // Сохраняем имя команды, пикнувшей карту
              pickTeamLogo, // Сохраняем лого команды, пикнувшей карту
              map.mapType || "pick",
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      stmt.finalize();
    }

    // Завершаем транзакцию
    await new Promise((resolve, reject) => {
      db.run("COMMIT", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({
      success: true,
      message: "Матч успешно обновлен",
    });
  } catch (error) {
    // В случае ошибки откатываем транзакцию
    await new Promise((resolve) => {
      db.run("ROLLBACK", () => resolve());
    });

    console.error("Ошибка при обновлении матча:", error);
    res.status(500).json({
      error: "Ошибка при обновлении матча",
      details: error.message,
    });
  }
});

// Обработчик обновления счета карты
app.post("/api/matches/:matchId/map-score", async (req, res) => {
  const matchId = req.params.matchId;
  const { mapIndex, team1Score, team2Score, winner, team1Name, team2Name } =
    req.body;

  //console.log('Получен запрос на обновление счета карты:', { matchId, mapIndex, team1Score, team2Score, winner });

  try {
    // Проверяем существование матча
    const match = await new Promise((resolve, reject) => {
      db.get(
        `
                SELECT 
                    m.*,
                    t1.name as team1_name, t1.logo as team1_logo,
                    t2.name as team2_name, t2.logo as team2_logo
                FROM matches m
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE m.id = ?
            `,
        [matchId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!match) {
      //console.log('Матч не найден:', matchId);
      return res.status(404).json({ error: "Матч не найден" });
    }

    // Получаем карты матча, отсортированные по order_number
    const maps = await new Promise((resolve, reject) => {
      db.all(
        `
                SELECT * FROM match_maps 
                WHERE match_id = ? 
                ORDER BY order_number ASC
            `,
        [matchId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Проверяем, существует ли карта с указанным индексом
    if (!maps || maps.length <= mapIndex) {
      //console.log('Карта не найдена:', { matchId, mapIndex });
      return res.status(404).json({ error: "Карта не найдена" });
    }

    const mapToUpdate = maps[mapIndex];

    // Определяем статус карты на основе выбора победителя
    let status = mapToUpdate.status; // Сохраняем текущий статус по умолчанию

    // Определяем победителя на основе выбора или счета
    let winnerTeam = null;
    let winnerLogo = null;

    if (winner === "team1") {
      winnerTeam = match.team1_name;
      winnerLogo = match.team1_logo;
      status = "completed";
    } else if (winner === "team2") {
      winnerTeam = match.team2_name;
      winnerLogo = match.team2_logo;
      status = "completed";
    } else if (team1Score > team2Score) {
      winnerTeam = match.team1_name;
      winnerLogo = match.team1_logo;
      status = "completed";
    } else if (team2Score > team1Score) {
      winnerTeam = match.team2_name;
      winnerLogo = match.team2_logo;
      status = "completed";
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
      db.run(
        `
                UPDATE match_maps 
                SET score_team1 = ?, score_team2 = ?, status = ?, winner_team = ?, winner_logo = ?,
                    original_winner_team = COALESCE(original_winner_team, ?), 
                    original_winner_logo = COALESCE(original_winner_logo, ?) 
                WHERE id = ?
            `,
        [
          team1Score,
          team2Score,
          status,
          winnerTeam,
          winnerLogo,
          winnerTeam,
          winnerLogo,
          mapToUpdate.id,
        ],
        function (err) {
          if (err) {
            //console.error('Ошибка SQL при обновлении счета карты:', err);
            reject(err);
          } else {
            //console.log('Счет карты обновлен успешно');
            resolve(this.changes);
          }
        }
      );
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
          io.emit("gsi_update", {
            type: "map_score_update",
            data: {
              matchId: parseInt(matchId),
              mapId: mapToUpdate.id,
              team1Score: team1Score,
              team2Score: team2Score,
              status: status,
              winnerTeam: winnerTeam,
              winnerLogo: winnerLogo,
            },
          });
          //console.log('Отправлено обновление счета карты через WebSocket');
        }
      }
    }

    // Получаем обновленные данные матча
    const updatedMatch = await new Promise((resolve, reject) => {
      db.get(
        `
                SELECT 
                    m.*,
                    t1.name as team1_name,
                    t1.short_name as team1_short_name,
                    t2.name as team2_name,
                    t2.short_name as team2_short_name
                FROM matches m
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE m.id = ?
            `,
        [matchId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // Получаем обновленные данные о картах
    const updatedMaps = await new Promise((resolve, reject) => {
      db.all(
        `
                SELECT 
                    mm.*,
                    mm.original_pick_team_name as pick_team_name,
                    mm.original_pick_team_logo as pick_team_logo,
                    -- Используем оригинальные данные о победителе, если они есть
                    COALESCE(mm.original_winner_team, mm.winner_team) as winner_team,
                    COALESCE(mm.original_winner_logo, mm.winner_logo) as winner_logo,
                    mm.original_winner_team,
                    mm.original_winner_logo
                FROM match_maps mm
                LEFT JOIN matches m ON mm.match_id = m.id
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE mm.match_id = ? 
                ORDER BY mm.order_number ASC
            `,
        [matchId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      message: "Счет карты успешно обновлен",
      match: updatedMatch,
      maps: updatedMaps,
    });
  } catch (error) {
    //console.error('Ошибка при обновлении счета карты:', error);
    res.status(500).json({
      error: "Ошибка при обновлении счета карты",
      details: error.message,
    });
  }
});

// Получение списка доступных карт
app.get("/api/maps", (req, res) => {
  const maps = [
    { id: "de_dust2", name: "Dust II" },
    { id: "de_mirage", name: "Mirage" },
    { id: "de_inferno", name: "Inferno" },
    { id: "de_nuke", name: "Nuke" },
    { id: "de_overpass", name: "Overpass" },
    { id: "de_ancient", name: "Ancient" },
    { id: "de_anubis", name: "Anubis" },
    { id: "de_vertigo", name: "Vertigo" },
    { id: "de_cache", name: "Cache" },
    { id: "de_train", name: "Train" },
  ];
  res.json(maps);
});

// Запуск матча
app.post("/api/matches/:id/start", (req, res) => {
  const matchId = req.params.id;
  db.run(
    'UPDATE matches SET status = "active" WHERE id = ?',
    [matchId],
    (err) => {
      if (err) {
        //console.error('Ошибка при запуске матча:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        success: true,
        message: "Матч запущен",
      });
    }
  );
});

// Остановка матча
app.post("/api/matches/:id/stop", (req, res) => {
  const matchId = req.params.id;
  db.run(
    'UPDATE matches SET status = "pending" WHERE id = ?',
    [matchId],
    function (err) {
      if (err) {
        //console.error('Ошибка при остановке матча:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        success: true,
        message: "Матч остановлен",
      });
    }
  );
});

// Обновляем маршрут получения списка матчей, чтобы включить только активные матчи
app.get("/api/matches", (req, res) => {
  logMatchesApi(
    `Запрос к /api/matches | DB_PATH: ${dbPath} | Параметры: ${JSON.stringify(
      req.query
    )}`
  );
  db.all(
    `
        SELECT 
            m.*,
            t1.name as team1_name,
            t1.short_name as team1_short_name,
            t2.name as team2_name,
            t2.short_name as team2_short_name,
            mm.id as map_id,
            mm.map_name,
            mm.pick_team,
            mm.side_pick_team,
            mm.order_number,
            mm.score_team1 as map_score_team1,
            mm.score_team2 as map_score_team2,
            mm.status as map_status,
            -- Используем winner_team и winner_logo напрямую
            mm.winner_team as winner_team,
            mm.winner_logo as winner_logo,
            mm.original_pick_team_name as pick_team_name,
            mm.original_pick_team_logo as pick_team_logo
        FROM matches m
        LEFT JOIN teams t1 ON m.team1_id = t1.id
        LEFT JOIN teams t2 ON m.team2_id = t2.id
        LEFT JOIN match_maps mm ON m.id = mm.match_id
        WHERE m.status IN ('pending', 'active')
        ORDER BY m.created_at DESC, mm.order_number ASC
    `,
    [],
    (err, rows) => {
      if (err) {
        //console.error('Ошибка при получении списка матчей:', err);
        return res.status(500).json({ error: err.message });
      }

      // Преобразуем результаты в структуру матчей с картами
      const matches = [];
      let currentMatch = null;

      rows.forEach((row) => {
        // Если это новый матч или первая запись
        if (!currentMatch || currentMatch.id !== row.id) {
          currentMatch = {
            id: row.id,
            team1_id: row.team1_id,
            team2_id: row.team2_id,
            team1_name: row.team1_name,
            team1_short_name: row.team1_short_name || "",
            team2_name: row.team2_name,
            team2_short_name: row.team2_short_name || "",
            format: row.format,
            status: row.status,
            score_team1: row.score_team1,
            score_team2: row.score_team2,
            created_at: row.created_at,
            maps: [],
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
            name_team_pick: row.pick_team_name || null,
            logo_team_pick: row.pick_team_logo || null,
            winner_team: row.winner_team,
            winner_logo: row.winner_logo,
          });
        }
      });

      res.json(matches);
    }
  );
});

// Обновление счета и статуса карты
app.put("/api/matches/:matchId/maps/:mapId", (req, res) => {
  const { matchId, mapId } = req.params;
  const { team1_score, team2_score, status, team1_side } = req.body;

  db.run(
    `UPDATE match_maps 
        SET team1_score = ?, team2_score = ?, status = ?, team1_side = ?
        WHERE id = ? AND match_id = ?`,
    [team1_score, team2_score, status, team1_side, mapId, matchId],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: "Обновлено успешно" });
    }
  );
});

app.post("/api/matches/:matchId/score", async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const { team, change } = req.body;

    //console.log('Получен запрос на обновление счета:', { matchId, team, change });

    // Проверяем структуру таблицы
    const tableInfo = await db.all("PRAGMA table_info(matches)");
    //console.log('Структура таблицы matches:', tableInfo.map(col => col.name));

    // Получаем текущий матч из базы данных
    const match = await db.get("SELECT * FROM matches WHERE id = ?", [matchId]);

    if (!match) {
      return res.status(404).json({ error: "Матч не найден" });
    }

    //console.log('Текущие данные матча:', match);

    // Определяем имена столбцов на основе структуры таблицы
    let team1ScoreField, team2ScoreField;

    // Проверяем возможные варианты имен столбцов
    if (match.hasOwnProperty("team1Score")) {
      team1ScoreField = "team1Score";
      team2ScoreField = "team2Score";
    } else if (match.hasOwnProperty("score_team1")) {
      team1ScoreField = "score_team1";
      team2ScoreField = "score_team2";
    } else if (match.hasOwnProperty("team1_score")) {
      team1ScoreField = "team1_score";
      team2ScoreField = "team2_score";
    } else {
      // Если не нашли подходящих столбцов, выводим все доступные поля
      //console.log('Доступные поля матча:', Object.keys(match));
      return res
        .status(500)
        .json({ error: "Не удалось определить столбцы для счета" });
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
    const updatedMatch = await db.get("SELECT * FROM matches WHERE id = ?", [
      matchId,
    ]);

    //console.log('Счет обновлен успешно');

    // Обновляем GSI данные
    if (global.gsiState) {
      // Если GSI данные еще не инициализированы, создаем структуру
      if (!global.gsiState.matches) {
        global.gsiState.matches = [];
      }

      // Ищем матч в GSI данных
      let gsiMatch = global.gsiState.matches.find(
        (m) => m.id === parseInt(matchId)
      );

      // Если матч не найден, добавляем его
      if (!gsiMatch) {
        gsiMatch = {
          id: parseInt(matchId),
          team1Score: 0,
          team2Score: 0,
        };
        global.gsiState.matches.push(gsiMatch);
      }

      // Обновляем счет в GSI данных
      gsiMatch.team1Score = updatedMatch[team1ScoreField] || 0;
      gsiMatch.team2Score = updatedMatch[team2ScoreField] || 0;

      //console.log('GSI данные обновлены:', gsiMatch);

      // Отправляем обновление всем подключенным клиентам через WebSocket
      if (io) {
        io.emit("gsi_update", {
          type: "score_update",
          data: {
            matchId: parseInt(matchId),
            team1Score: gsiMatch.team1Score,
            team2Score: gsiMatch.team2Score,
          },
        });
        //console.log('Отправлено обновление через WebSocket');
      }
    }

    res.json({
      success: true,
      team1Score: updatedMatch[team1ScoreField] || 0,
      team2Score: updatedMatch[team2ScoreField] || 0,
    });
  } catch (error) {
    //console.error('Ошибка при обновлении счета:', error);
    res
      .status(500)
      .json({ error: "Ошибка при обновлении счета", details: error.message });
  }
});

// Поиск команд
app.get("/api/teams/search", (req, res) => {
  const { query } = req.query;

  db.all(
    "SELECT * FROM teams WHERE name LIKE ? LIMIT 10",
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
app.get("/api/teams", (req, res) => {
  const query = `
        SELECT id, name, logo, region, short_name
        FROM teams 
        ORDER BY name ASC
    `;

  db.all(query, [], (err, teams) => {
    if (err) {
      //console.error('Ошибка при получении списка команд:', err);
      return res.status(500).json({
        error: "Ошибка при получении списка команд",
        details: err.message,
      });
    }

    res.json(teams);
  });
});

app.post("/api/teams", upload.single("logo"), (req, res) => {
  const { name, region, short_name } = req.body;
  // Сохраняем только имя файла, без /uploads/
  const logo = req.file ? req.file.filename : null;

  db.run(
    "INSERT INTO teams (name, region, logo, short_name) VALUES (?, ?, ?, ?)",
    [name, region, logo, short_name || ""],
    function (err) {
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
app.get("/api/fix-logo-paths", (req, res) => {
  // Исправляем пути к логотипам команд
  db.all("SELECT id, logo FROM teams", [], (err, teams) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    teams.forEach((team) => {
      if (team.logo && team.logo.startsWith("/uploads/")) {
        const fixedLogo = team.logo.replace("/uploads/", "");
        db.run("UPDATE teams SET logo = ? WHERE id = ?", [fixedLogo, team.id]);
      }
    });

    // Исправляем пути к аватарам игроков
    db.all("SELECT id, avatar FROM players", [], (err, players) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      players.forEach((player) => {
        if (player.avatar && player.avatar.startsWith("/uploads/")) {
          const fixedAvatar = player.avatar.replace("/uploads/", "");
          db.run("UPDATE players SET avatar = ? WHERE id = ?", [
            fixedAvatar,
            player.id,
          ]);
        }
      });

      res.json({ message: "Пути к логотипам и аватарам исправлены" });
    });
  });
});

app.delete("/api/teams/:id", async (req, res) => {
  try {
    const teamId = req.params.id;

    db.run("DELETE FROM teams WHERE id = ?", [teamId], function (err) {
      if (err) {
        //console.error('Ошибка при удалении:', err);
        return res.status(500).json({ message: "Ошибка при удалении команды" });
      }

      if (this.changes === 0) {
        return res
          .status(404)
          .json({ message: `Команда с ID ${teamId} не найдена` });
      }

      res.json({ message: "Команда успешно удалена" });
    });
  } catch (error) {
    //console.error('Ошибка при удалении команды:', error);
    res.status(500).json({ message: "Внутренняя ошибка сервера" });
  }
});

app.get("/api/teams/:id", (req, res) => {
  const teamId = req.params.id;

  const query = `
        SELECT * FROM teams WHERE id = ?
    `;

  db.get(query, [teamId], (err, team) => {
    if (err) {
      //console.error('Ошибка при получении данных команды:', err);
      return res.status(500).json({
        message: "Ошибка при получении данных команды",
        error: err.message,
      });
    }

    if (!team) {
      return res.status(404).json({
        message: `Команда с ID ${teamId} не найдена`,
      });
    }

    res.json(team);
  });
});

app.put("/api/teams/:id", upload.single("logo"), (req, res) => {
  const teamId = req.params.id;
  const { name, region, short_name } = req.body;

  db.get("SELECT id FROM teams WHERE id = ?", [teamId], (err, team) => {
    if (err) {
      return res.status(500).json({ message: "Ошибка сервера" });
    }

    if (!team) {
      return res
        .status(404)
        .json({ message: `Команда с ID ${teamId} не найдена` });
    }

    // Сохраняем только имя файла, без /uploads/
    const logo = req.file ? req.file.filename : null;
    let updateQuery = "UPDATE teams SET name = ?, region = ?, short_name = ?";
    let params = [name, region, short_name || ""];

    if (logo) {
      updateQuery += ", logo = ?";
      params.push(logo); // Теперь сохраняем только имя файла
    }

    updateQuery += " WHERE id = ?";
    params.push(teamId);

    db.run(updateQuery, params, function (err) {
      if (err) {
        return res
          .status(500)
          .json({ message: "Ошибка при обновлении команды" });
      }

      res.json({
        message: "Команда успешно обновлена",
        teamId: teamId,
      });
    });
  });
});

// ... existing code ...

app.get("/api/players", (req, res) => {
  const query = `
        SELECT 
            players.*,
            teams.name as teamName
        FROM players 
        LEFT JOIN teams ON players.teamId = teams.id
    `;

  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Дублирующие маршруты игроков были удалены, так как они уже обрабатываются через app.use("/api/players", playersRoutes)

app.get("/api/teams/:teamId/players", (req, res) => {
  const teamId = req.params.teamId;

  db.all(
    `
        SELECT * FROM players 
        WHERE teamId = ?
        ORDER BY nickname
    `,
    [teamId],
    (err, players) => {
      if (err) {
        //console.error('Ошибка при получении игроков команды:', err);
        return res.status(500).json({ error: "Ошибка при получении игроков" });
      }
      res.json(players || []); // Возвращаем пустой массив, если игроков нет
    }
  );
});

// ... existing code ...

// Endpoint для запуска оверлея
app.post("/api/start-overlay", (req, res) => {
  const { hudId } = req.body;

  // Путь к файлу start.bat в папке overlay
  const overlayPath = path.join(__dirname, "../overlay/start.bat");

  // Запускаем оверлей с параметром hudId
  exec(`"${overlayPath}" ${hudId}`, (error) => {
    if (error) {
      //console.error('Error starting overlay:', error);
      res.status(500).json({ error: "Failed to start overlay" });
      return;
    }
    res.json({ success: true });
  });
});

// Функция для сканирования HUD'ов
function scanHUDs() {
  const hudsPath = path.join(__dirname, "../public/huds");
  const huds = [];

  fs.readdirSync(hudsPath).forEach((hudDir) => {
    if (
      !fs.statSync(path.join(hudsPath, hudDir)).isDirectory() ||
      hudDir.startsWith(".")
    ) {
      return;
    }

    const hudPath = path.join(hudsPath, hudDir);
    if (
      fs.existsSync(path.join(hudPath, "template.pug")) ||
      fs.existsSync(path.join(hudPath, "index.html"))
    ) {
      let config = {
        id: hudDir,
        name: hudDir.charAt(0).toUpperCase() + hudDir.slice(1) + " HUD",
        description: "Custom HUD",
      };

      const configPath = path.join(hudPath, "config.json");
      if (fs.existsSync(configPath)) {
        try {
          const hudConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
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
app.get("/api/huds", (req, res) => {
  res.json(scanHUDs());
});

app.get("/hud/:hudId", (req, res) => {
  const { hudId } = req.params;
  res.render(`huds/${hudId}/template`, { hudId });
});

app.get("/hud/:hudId/:file", (req, res) => {
  const { hudId, file } = req.params;
  res.sendFile(path.join(__dirname, `../public/huds/${hudId}/${file}`));
});

// Инициализация начального состояния игры
const gameState = {
  map: {
    name: "",
    mode: "",
    num_matches_to_win_series: "",
    phase: "",
    round: "",
    round_wins: {},
    team_ct: {
      consecutive_round_losses: "",
      matches_won_this_series: "",
      timeouts_remaining: "",
      score: "",
      name: "",
      flag: "",
    },
    team_t: {
      consecutive_round_losses: "",
      matches_won_this_series: "",
      timeouts_remaining: "",
      score: "",
      name: "",
      flag: "",
    },
  },
  phase_countdowns: {
    phase: "",
    phase_ends_in: "",
  },
  player: {
    name: "",
    team: "",
    state: {
      health: 100,
      armor: 0,
      money: 0,
    },
    match_stats: {
      kills: 0,
      assists: 0,
      deaths: 0,
    },
    weapons: {},
  },
  allplayers: {},
  bomb: {},
  grenades: {},
  previously: {},
  provider: {},
  round: {},
};

// GSI endpoints

gsiApp.post("/gsi", async (req, res) => {
  try {
    //console.log('=== ПОЛУЧЕН GSI ЗАПРОС ===');
    //console.log(`Время: ${new Date().toISOString()}`);
    //console.log(`IP-адрес: ${req.ip || req.connection.remoteAddress}`);
    //console.log('Заголовки:');
    //console.log(JSON.stringify(req.headers, null, 2));

    const data = req.body;
    if (!data) {
      //console.log('Ошибка: Нет данных в GSI запросе');
      return res.sendStatus(400);
    }

    // Выводим частичную информацию о данных
    //console.log('Данные GSI (частично):');
    //console.log(JSON.stringify({
    //    provider: data.provider,
    //    map: data.map ? {
    //        name: data.map.name,
    //        phase: data.map.phase
    //    } : null,
    //    player_id: data.player ? data.player.steamid : null
    //}, null, 2));
    //console.log('=== КОНЕЦ GSI ЗАПРОСА ===');

    // Получаем активный матч с дополнительной информацией
    const match = await new Promise((resolve, reject) => {
      db.get(
        `
                SELECT 
                    m.*,
                    t1.name as team1_name, t1.logo as team1_logo,
                    t2.name as team2_name, t2.logo as team2_logo
                FROM matches m
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE m.status = 'active'
                LIMIT 1
            `,
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // Добавляем флаг matchup в gameState
    gameState.matchupis = !!match;

    if (match) {
      // Добавляем формат матча в gameState
      gameState.match = {
        format: match.format || "bo1", // bo1, bo2, bo3, bo5
        status: match.status, // pending, active, completed
        //score_team1_map: match.score_team1 || 0, // Исправлено с team1Score на score_team1
        //score_team2_map: match.score_team2 || 0,  // Исправлено с team2Score на score_team2
        matchupis: gameState.matchupis,
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
        db.all(
          `
                    SELECT 
                        mm.*,
                        t1.name as team1_name,
                        t2.name as team2_name
                    FROM match_maps mm
                    LEFT JOIN teams t1 ON mm.pick_team = t1.id
                    LEFT JOIN teams t2 ON mm.side_pick_team = t2.id
                    WHERE match_id = ?
                    ORDER BY order_number
                `,
          [match.id],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      if (matchMaps && matchMaps.length > 0) {
        // Добавляем информацию о картах в gameState
        gameState.match_maps = matchMaps.map((map) => ({
          id: map.id,
          map_name: map.map_name,
          pick_team: map.pick_team,
          side_pick_team: map.side_pick_team,
          status: map.status || "pending",
          score_team1: map.score_team1 || 0,
          score_team2: map.score_team2 || 0,
          order_number: map.order_number,
          name_team_pick:
            map.original_pick_team_name ||
            (map.pick_team === "team1" ? match.team1_name : match.team2_name),
          logo_team_pick:
            map.original_pick_team_logo ||
            (map.pick_team === "team1" ? match.team1_logo : match.team2_logo),
          winner_team: map.winner_team || null,
          winner_logo: map.winner_logo || null,
          original_winner_team:
            map.original_winner_team || map.winner_team || null,
          original_winner_logo:
            map.original_winner_logo || map.winner_logo || null,
        }));

        // Находим текущую карту в match_maps
        const currentMap = gameState.match_maps.find(
          (map) => map.map_name.toLowerCase() === data.map.name.toLowerCase()
        );

        if (currentMap) {
          // Проверяем фазу игры для определения завершения карты
          const isGameOver =
            data.map.phase === "gameover" || data.round?.phase === "gameover";

          // Обновляем статусы карт
          gameState.match_maps.forEach((map) => {
            if (map.map_name.toLowerCase() === data.map.name.toLowerCase()) {
              if (!isGameOver) {
                map.status = "active";
              }
            }
          });

          // Всегда обновляем счет
          currentMap.score_team1 = data.map.team_ct?.score || 0;
          currentMap.score_team2 = data.map.team_t?.score || 0;

          // Сначала обновляем счет в БД
          await new Promise((resolve, reject) => {
            db.run(
              `
                            UPDATE match_maps 
                            SET 
                                score_team1 = ?, 
                                score_team2 = ?
                            WHERE id = ?
                        `,
              [currentMap.score_team1, currentMap.score_team2, currentMap.id],
              (err) => {
                if (err) {
                  console.error("Ошибка обновления счета:", err);
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          });

          // Если игра завершена и статус еще не completed, определяем победителя
          if (isGameOver && currentMap.status !== "completed") {
            // Небольшая задержка для гарантии получения финального счета
            setTimeout(async () => {
              const winnerTeamId =
                currentMap.score_team1 > currentMap.score_team2
                  ? match.team1_id
                  : match.team2_id;

              if (winnerTeamId) {
                const winnerTeam = await new Promise((resolve, reject) => {
                  db.get(
                    "SELECT name, logo FROM teams WHERE id = ?",
                    [winnerTeamId],
                    (err, row) => {
                      if (err) reject(err);
                      else resolve(row);
                    }
                  );
                });

                if (winnerTeam) {
                  // Сохраняем информацию о победителе
                  currentMap.winner_team = winnerTeam.name;
                  currentMap.winner_logo = winnerTeam.logo
                    ? winnerTeam.logo.replace("/uploads/", "")
                    : null;
                  currentMap.status = "completed";

                  // Сохраняем original_winner только если они еще не установлены
                  if (!currentMap.original_winner_team) {
                    currentMap.original_winner_team = winnerTeam.name;
                    currentMap.original_winner_logo = winnerTeam.logo
                      ? winnerTeam.logo.replace("/uploads/", "")
                      : null;
                  }

                  console.log(
                    `Установлен победитель карты: ${currentMap.map_name}, team=${currentMap.winner_team}, original_team=${currentMap.original_winner_team}`
                  );

                  // Обновляем БД с финальным счетом и победителем
                  await new Promise((resolve, reject) => {
                    db.run(
                      `
                                            UPDATE match_maps 
                                            SET 
                                                score_team1 = ?,
                                                score_team2 = ?,
                                                status = ?, 
                                                winner_team = ?,
                                                winner_logo = ?,
                                                original_winner_team = COALESCE(original_winner_team, ?),
                                                original_winner_logo = COALESCE(original_winner_logo, ?)
                                            WHERE id = ? AND winner_team IS NULL
                                        `,
                      [
                        currentMap.score_team1,
                        currentMap.score_team2,
                        "completed",
                        currentMap.winner_team,
                        currentMap.winner_logo,
                        currentMap.winner_team, // Сохраняем original_winner_team, если он еще не установлен
                        currentMap.winner_logo, // Сохраняем original_winner_logo, если он еще не установлен
                        currentMap.id,
                      ],
                      (err) => {
                        if (err) {
                          console.error("Ошибка обновления победителя:", err);
                          reject(err);
                        } else {
                          //console.log('Победитель карты определен:', {
                          //mapId: currentMap.id,
                          //winner: currentMap.winner_team,
                          //finalScore: `${currentMap.score_team1}:${currentMap.score_team2}`
                          //});
                          resolve();
                        }
                      }
                    );
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
          broadcastGsiData(gameState);
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
        db.get(
          `
                    SELECT 
                        m.*,
                        t1.name as team1_name, t1.logo as team1_logo, t1.short_name as team1_short_name,
                        t2.name as team2_name, t2.logo as team2_logo, t2.short_name as team2_short_name
                    FROM matches m
                    LEFT JOIN teams t1 ON m.team1_id = t1.id
                    LEFT JOIN teams t2 ON m.team2_id = t2.id
                    WHERE m.status = 'active'
                    LIMIT 1
                `,
          [],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Для активного матча также учитываем фазу игры при смене сторон
      if (activeMatch) {
        // Логика смены сторон
        let shouldSwap = false;

        // Определяем текущую сторону команд
        let currentCTTeam = activeMatch.team1_name;
        let currentCTShortName = activeMatch.team1_short_name;
        let currentCTLogo = activeMatch.team1_logo;
        let score_team1_map = activeMatch.score_team1;
        let score_team2_map = activeMatch.score_team2;
        let currentTTeam = activeMatch.team2_name;
        let currentTShortName = activeMatch.team2_short_name;
        let currentTLogo = activeMatch.team2_logo;

        // Основное время (0-27 раундов)
        if (currentRound >= 0) {
          // Основное время: первая половина (0-11): CT/T
          if (currentRound <= 11) {
            currentCTTeam = activeMatch.team1_name;
            currentCTShortName = activeMatch.team1_short_name;
            currentCTLogo = activeMatch.team1_logo;
            score_team1_map = activeMatch.score_team1;
            score_team2_map = activeMatch.score_team2;
            currentTTeam = activeMatch.team2_name;
            currentTShortName = activeMatch.team2_short_name;
            currentTLogo = activeMatch.team2_logo;
          }
          // Основное время: вторая половина (12-26): T/CT
          // Добавляем проверку на фазу игры - меняем стороны только после окончания перерыва
          else if (
            currentRound >= 12 &&
            currentRound <= 26 &&
            data.map.phase !== "intermission"
          ) {
            currentCTTeam = activeMatch.team2_name;
            currentCTShortName = activeMatch.team2_short_name;
            currentCTLogo = activeMatch.team2_logo;
            score_team1_map = activeMatch.score_team2;
            score_team2_map = activeMatch.score_team1;
            currentTTeam = activeMatch.team1_name;
            currentTShortName = activeMatch.team1_short_name;
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
              currentCTShortName = activeMatch.team2_short_name;
              currentCTLogo = activeMatch.team2_logo;
              score_team1_map = activeMatch.score_team2;
              score_team2_map = activeMatch.score_team1;
              currentTTeam = activeMatch.team1_name;
              currentTShortName = activeMatch.team1_short_name;
              currentTLogo = activeMatch.team1_logo;
            }
            // Для всех остальных случаев или когда перерыв закончился
            else {
              // Четные овертаймы (0, 2, 4...) - team1 CT, team2 T
              if (
                overtimeNumber % 2 === 0 &&
                (!isIntermission || currentRound > 27)
              ) {
                currentCTTeam = activeMatch.team1_name;
                currentCTShortName = activeMatch.team1_short_name;
                currentCTLogo = activeMatch.team1_logo;
                score_team1_map = activeMatch.score_team1;
                score_team2_map = activeMatch.score_team2;
                currentTTeam = activeMatch.team2_name;
                currentTShortName = activeMatch.team2_short_name;
                currentTLogo = activeMatch.team2_logo;
                //console.log(`Четный овертайм ${overtimeNumber + 1}, CT: ${currentCTTeam}, T: ${currentTTeam}`);
              }
              // Нечетные овертаймы (1, 3, 5...) - team2 CT, team1 T
              else if (overtimeNumber % 2 === 1 && !isIntermission) {
                currentCTTeam = activeMatch.team2_name;
                currentCTShortName = activeMatch.team2_short_name;
                currentCTLogo = activeMatch.team2_logo;
                score_team1_map = activeMatch.score_team2;
                score_team2_map = activeMatch.score_team1;
                currentTTeam = activeMatch.team1_name;
                currentTShortName = activeMatch.team1_short_name;
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
          console.log(
            `Сохраняем стороны для раунда 27 в перерыве: CT=${currentCTTeam}, T=${currentTTeam}`
          );
          gameState.map.team_ct.name = currentCTTeam;
          gameState.map.team_ct.short_name = currentCTShortName;
          gameState.map.team_ct.logo = currentCTLogo;
          gameState.map.team_ct.matches_won_this_series = score_team1_map;
          gameState.map.team_t.matches_won_this_series = score_team2_map;
          gameState.map.team_t.name = currentTTeam;
          gameState.map.team_t.short_name = currentTShortName;
          gameState.map.team_t.logo = currentTLogo;
        }
        // Для всех остальных случаев

        gameState.map.team_ct.name = currentCTTeam;
        gameState.map.team_ct.short_name = currentCTShortName;
        gameState.map.team_ct.logo = currentCTLogo;
        gameState.map.team_t.name = currentTTeam;
        gameState.map.team_t.short_name = currentTShortName;
        gameState.map.team_t.logo = currentTLogo;
        gameState.map.team_ct.matches_won_this_series = score_team1_map;
        gameState.map.team_t.matches_won_this_series = score_team2_map;

        // Логика определения победителя
        const ctScore = data.map.team_ct?.score || 0;
        const tScore = data.map.team_t?.score || 0;
        let winner = null;

        // Проверяем статус игры для определения победителя
        if (data.map.phase === "gameover") {
          // Определяем победителя просто по большему счету
          if (ctScore > tScore) {
            winner = "CT";
            winnerTeam = currentCTTeam;
            winnerLogo = currentCTLogo;
          } else if (tScore > ctScore) {
            winner = "T";
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
              logo: winnerLogo,
              // Добавляем оригинальные данные для клиента
              original_team: winnerTeam,
              original_logo: winnerLogo,
            };

            // Находим текущую карту
            const currentMap = gameState.match_maps?.find(
              (map) =>
                map.map_name.toLowerCase() === data.map.name.toLowerCase()
            );

            if (currentMap) {
              currentMap.status = "completed";
              // Устанавливаем победителя
              currentMap.winner_team = winnerTeam;
              currentMap.winner_logo = winnerLogo;
              // Сохраняем оригинальные значения только при первом определении победителя
              if (currentMap.status !== "completed") {
                currentMap.original_winner_team = winnerTeam;
                currentMap.original_winner_logo = winnerLogo;
                console.log(
                  `Карта ${currentMap.map_name} завершена впервые, устанавливаем winner_team=${winnerTeam}, winner_logo=${winnerLogo}`
                );
              } else {
                console.log(
                  `Карта ${currentMap.map_name} уже была завершена, сохраняем только winner_team=${winnerTeam}, winner_logo=${winnerLogo}`
                );
              }

              console.log(
                `Обновляем статус карты ${currentMap.map_name} на completed, победитель: ${winnerTeam}, оригинал: ${currentMap.original_winner_team}`
              );

              // Обновляем базу данных с информацией о победителе и статусом карты
              await new Promise((resolve, reject) => {
                db.run(
                  `
                                    UPDATE match_maps 
                                    SET winner_team = ?, 
                                        winner_logo = ?,
                                        status = 'completed',
                                        -- Устанавливаем original_winner_* поля только если статус не был completed
                                        original_winner_team = CASE WHEN status != 'completed' THEN ? ELSE original_winner_team END,
                                        original_winner_logo = CASE WHEN status != 'completed' THEN ? ELSE original_winner_logo END
                                    WHERE map_name = ? AND match_id = ?
                                `,
                  [
                    winnerTeam,
                    winnerLogo,
                    winnerTeam,
                    winnerLogo,
                    activeMatch.id,
                    data.map.name,
                  ],
                  (err) => {
                    if (err) {
                      console.error(
                        "Ошибка при обновлении данных о победителе:",
                        err
                      );
                      reject(err);
                    } else {
                      //console.log('Данные о победителе успешно обновлены в базе данных');
                      resolve();
                    }
                  }
                );
              });
            } else {
              //console.log(`Не удалось найти текущую карту ${data.map.name} в списке карт матча`);
            }
          }
        }
      } else {
        // Если нет активного матча, используем имена команд из игры
        gameState.map.team_ct.name = data.map.team_ct?.name || "CT";
        gameState.map.team_ct.logo = data.map.team_ct?.logo || "";
        gameState.map.team_t.name = data.map.team_t?.name || "T";
        gameState.map.team_t.logo = data.map.team_t?.logo || "";
      }

      // Проверяем, есть ли информация о победителе
      if (data.map.winner) {
        // Используем оригинальные данные, если они есть
        const winnerTeam =
          data.map.winner.original_team || data.map.winner.team;
        const winnerLogo =
          data.map.winner.original_logo || data.map.winner.logo;

        // Логируем для отладки
        console.log(
          `GSI: Получены данные о победителе: team=${winnerTeam}, logo=${winnerLogo}, original_team=${
            data.map.winner.original_team || "не задано"
          }, original_logo=${data.map.winner.original_logo || "не задано"}`
        );

        console.log(
          `Получены данные о победителе из GSI: team=${winnerTeam}, logo=${winnerLogo}`
        );

        // Обновляем базу данных с информацией о победителе
        await new Promise((resolve, reject) => {
          db.run(
            `
                    UPDATE match_maps 
                    SET winner_team = ?, 
                        winner_logo = ?,
                        status = 'completed',  /* Добавляем изменение статуса на completed */
                        -- Всегда устанавливаем original_winner_* поля, если они пустые
                        original_winner_team = CASE WHEN original_winner_team IS NULL THEN ? ELSE original_winner_team END,
                        original_winner_logo = CASE WHEN original_winner_logo IS NULL THEN ? ELSE original_winner_logo END
                    WHERE map_name = ? AND match_id = ?
                `,
            [
              winnerTeam,
              winnerLogo,
              winnerTeam,
              winnerLogo,
              data.map.name,
              activeMatch.id,
            ],
            (err) => {
              if (err) {
                console.error(
                  "Ошибка при обновлении данных о победителе:",
                  err
                );
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
            }
          );
        });

        // Также обновляем статус и информацию о победителе в gameState
        if (gameState.match_maps) {
          const currentMap = gameState.match_maps.find(
            (map) => map.map_name.toLowerCase() === data.map.name.toLowerCase()
          );
          if (currentMap) {
            currentMap.status = "completed";
            // Обновляем данные о победителе с оригинальными значениями
            currentMap.winner_team = winnerTeam;
            currentMap.winner_logo = winnerLogo;
            currentMap.original_winner_team = winnerTeam;
            currentMap.original_winner_logo = winnerLogo;
            console.log(
              `GSI: Обновлен статус и победитель карты ${currentMap.map_name}: ${winnerTeam}`
            );
          }
        }
      }

      // Отправляем обновленные данные клиентам
      broadcastGsiData(gameState);
    }

    if (data.player) {
      // Логируем SteamID игрока
      //console.log('Обработка игрока:', data.player.steamid);

      // Получаем аватар из базы данных по SteamID
      const playerAvatar = await new Promise((resolve, reject) => {
        db.get(
          "SELECT avatar FROM players WHERE steam64 = ?",
          [data.player.steamid],
          (err, row) => {
            if (err) {
              console.error("Ошибка при запросе аватара из базы:", err);
              reject(err);
            } else {
              //console.log('Аватар из базы для', data.player.steamid, ':', row?.avatar || 'не найден');
              resolve(row?.avatar || null);
            }
          }
        );
      });

      // Логируем аватар из GSI данных
      //console.log('Аватар из GSI для', data.player.steamid, ':', data.player.avatar || 'не предоставлен');

      // Проверяем, существует ли data.player.state
      const playerState = data.player.state || {};

      // Получаем имя игрока из базы данных по SteamID
      const playerName = await new Promise((resolve, reject) => {
        db.get(
          "SELECT * FROM players WHERE steam64 = ?",
          [data.player.steamid],
          (err, row) => {
            if (err) {
              console.error("Ошибка при получении имени игрока из базы:", err);
              reject(err);
            } else {
              resolve(row?.nickname || null);
            }
          }
        );
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
          round_adr: playerState.round_adr,
        },
        slot: data.player.observer_slot,
        spectarget: gameState.player.steam64,
        steamid: data.player.steamid,
        teamid: gameState.player.team,
        position: data.player.position,
        match_stats: data.player.match_stats,
        weapons: data.player.weapons,
        camera_link: data.player.camera_link,
        // Используем аватар из базы данных или из GSI, убираем /uploads/ из пути
        avatar: playerAvatar
          ? playerAvatar.replace("/uploads/", "")
          : data.player.avatar
          ? data.player.avatar.replace("/uploads/", "")
          : null,
        cameraLink: cameraLinks[data.player.steamid] || "", // <-- добавляем ссылку камеры
      };

      // Логируем итоговый аватар
      //console.log('Итоговый аватар для', data.player.steamid, ':', gameState.player.avatar || 'не установлен');
    }

    if (data.allplayers) {
      gameState.allplayers = {};
      for (const [steamId, playerData] of Object.entries(data.allplayers)) {
        // Получаем данные игрока из базы данных по SteamID
        const playerInfo = await new Promise((resolve, reject) => {
          db.get(
            "SELECT avatar, nickname, realName FROM players WHERE steam64 = ?",
            [steamId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row || {});
            }
          );
        });

        gameState.allplayers[steamId] = {
          ...playerData,
          avatar: playerInfo.avatar
            ? playerInfo.avatar.replace("/uploads/", "")
            : playerData.avatar
            ? playerData.avatar.replace("/uploads/", "")
            : null,
          name: playerInfo.nickname || playerData.name || "",
          realName: playerInfo.realName || playerData.realName || "",
          match_stats: {
            ...playerData.match_stats,
            kd: (
              playerData.match_stats?.kills / playerData.match_stats?.deaths ||
              0
            ).toFixed(2),
          },
          cameraLink: cameraLinks[steamId] || "", // <-- добавляем ссылку камеры
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
        phase_ends_in:
          data.phase_countdowns.phase_ends_in ??
          gameState.phase_countdowns.phase_ends_in,
      };
    }

    // Отправка обновленных данных клиентам
    broadcastGsiData(gameState);
    //  console.log('9. Данные отправлены клиентам');
    res.sendStatus(200);
  } catch (error) {
    //console.error('Ошибка при обработке GSI данных:', error);
    res.sendStatus(500);
  }
});

// Socket.IO подключения
io.on("connection", (socket) => {
  //console.log('Клиент подключился');

  socket.on("ready", () => {
    // Отправляем текущее состояние игры
    socket.emit("gsi", gameState);

    // Получаем активный матч и данные команд
    db.get(
      `
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
        `,
      [],
      (err, match) => {
        if (err) {
          //console.error('Ошибка при получении данных матча:', err);
          return;
        }

        if (match) {
          // Отправляем информацию о командах
          socket.emit("match_data", {
            teams: {
              team_1: {
                team: {
                  name: match.team1_name,
                  logo: match.team1_logo,
                },
                score: match.score_team1 || 0,
              },
              team_2: {
                team: {
                  name: match.team2_name,
                  logo: match.team2_logo,
                },
                score: match.score_team2 || 0,
              },
            },
            match_status: "active",
            format: match.format || "bo1",
          });
        } else {
          // Если нет активного матча, проверяем наличие ожидающих матчей
          db.get(
            `
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
                `,
            [],
            (err, pendingMatch) => {
              if (err || !pendingMatch) return;

              // Отправляем информацию о командах из ожидающего матча
              socket.emit("match_data", {
                teams: {
                  team_1: {
                    team: {
                      name: pendingMatch.team1_name,
                      logo: pendingMatch.team1_logo,
                    },
                    score: pendingMatch.score_team1 || 0,
                  },
                  team_2: {
                    team: {
                      name: pendingMatch.team2_name,
                      logo: pendingMatch.team2_logo,
                    },
                    score: pendingMatch.score_team2 || 0,
                  },
                },
                match_status: "pending",
                format: "bo1", // Всегда bo1 для pending матчей
              });
            }
          );
        }
      }
    );
  });

  // Обработчик для принятия данных от клиента и пересылки их всем подключенным клиентам
  socket.on("hud_data", (data) => {
    console.log("Получены данные для HUD:", data.type);
    // Пересылаем всем клиентам
    io.emit("hud_data", data);
  });

  socket.on("disconnect", () => {
    //console.log('Клиент отключился');
  });
});

// Проверяем, что GSI сервер запущен на правильном порту
// Запускаем основной сервер

// Порты для серверов
const PORT = 2626;
const GSI_PORT = 1350;

// Функция запуска серверов
const startServers = async () => {
  try {
    // Запускаем основной сервер
    await new Promise((resolve) => {
      http.listen(PORT, () => {
        console.log("=================================");
        console.log(`Сервер запущен на http://${serverIP}:${PORT}`);
        console.log(`Socket.IO готов к подключениям`);
        console.log("=================================");

        // Открываем браузер только если не запущено через Electron
        if (!process.env.ELECTRON_APP) {
          const { exec } = require("child_process");
          const platform = process.platform;
          const url = `http://${serverIP}:${PORT}`;

          let command;
          switch (platform) {
            case "win32":
              command = `start ${url}`;
              break;
            case "darwin":
              command = `open ${url}`;
              break;
            case "linux":
              command = `xdg-open ${url}`;
              break;
            default:
              console.log(
                `Платформа ${platform} не поддерживается для автоматического открытия браузера`
              );
              return;
          }

          exec(command, (err) => {
            if (err) {
              console.error("Ошибка при открытии браузера:", err);
            }
          });
        } else {
          console.log(
            "Запущено через Electron, браузер не открывается автоматически"
          );
        }

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

    // Запускаем HTTPS серверы (если они созданы)
    if (httpsServer) {
      const HTTPS_PORT = PORT + 1; // 2627
      await new Promise((resolve) => {
        httpsServer.listen(HTTPS_PORT, () => {
          console.log(
            `HTTPS сервер запущен на https://${serverIP}:${HTTPS_PORT}`
          );
          resolve();
        });
      });
    }

    if (httpsGsiServer) {
      const HTTPS_GSI_PORT = GSI_PORT + 1; // 1351
      await new Promise((resolve) => {
        httpsGsiServer.listen(HTTPS_GSI_PORT, () => {
          console.log(`HTTPS GSI сервер запущен на порту ${HTTPS_GSI_PORT}`);
          resolve();
        });
      });
    }
  } catch (error) {
    console.error("Ошибка при запуске серверов:", error);
    process.exit(1);
  }
};

// Запускаем серверы
startServers();

// Обработка ошибок процесса
process.on("uncaughtException", (error) => {
  console.error("Необработанное исключение:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Необработанное отклонение промиса:", error);
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
  io.emit("gsi", gameState);
}

// Добавьте эти переменные в начало модуля радара
const NodeCache = require("node-cache");
const radarCache = new NodeCache({ stdTTL: 5, checkperiod: 10 });
const throttle = require("lodash.throttle");

// Кэширование данных игроков и буферизация обновлений
let playersBuffer = {};
let updatesPending = false;

// Дросселирование функции обновления позиций
const updateRadarPositions = throttle(function () {
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
      if (
        !prevPos ||
        Math.abs(prevPos.x - currentPos.x) > 5 ||
        Math.abs(prevPos.y - currentPos.y) > 5
      ) {
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

// Удаление конфигов CS2
app.get("/api/remove-cs2-configs", (req, res) => {
  try {
    const customPath = req.query.path;
    let cs2Path = customPath;

    if (!cs2Path) {
      cs2Path = findCS2Path();
    }

    if (!cs2Path || !fs.existsSync(cs2Path)) {
      return res.json({
        success: false,
        message: "CS2 не найден по стандартным путям. Укажите путь вручную.",
      });
    }

    const configDir = path.join(cs2Path, "game", "csgo", "cfg");

    // Пути к файлам конфигов
    const gsiPath = path.join(configDir, "gamestate_integration_fhud.cfg");
    const observerPath = path.join(configDir, "observer.cfg");
    const observer_offPath = path.join(configDir, "observer_off.cfg");
    const observer2Path = path.join(configDir, "observer2.cfg");

    let removed = {
      gsi: false,
      observer: false,
      observer_off: false,
      observer2: false,
    };

    // Удаляем файлы, если они существуют
    if (fs.existsSync(gsiPath)) {
      fs.unlinkSync(gsiPath);
      removed.gsi = true;
    }

    if (fs.existsSync(observerPath)) {
      fs.unlinkSync(observerPath);
      removed.observer = true;
    }

    if (fs.existsSync(observer2Path)) {
      fs.unlinkSync(observer2Path);
      removed.observer2 = true;
    }

    if (fs.existsSync(observer_offPath)) {
      fs.unlinkSync(observer_offPath);
      removed.observer_off = true;
    }

    return res.json({
      success: true,
      message: "Конфиги успешно удалены",
      removed: removed,
      configPath: configDir,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Ошибка при удалении конфигов" });
  }
});

// Добавьте в server/server.js следующие маршруты

// Маршруты для OBS интеграции - только маршруты HTML страниц
app.get("/obs/match-ticker", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/obs/match-ticker.html"));
});

app.get("/obs/match-scoreboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/obs/match-scoreboard.html"));
});

app.get("/obs/map-veto", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/obs/map-veto.html"));
});

app.get("/obs/match/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/obs/match-detail.html"));
});

// API эндпоинты для получения данных
app.get("/api/obs/matches", (req, res) => {
  // Получаем данные о всех матчах из базы данных
  db.getMatches()
    .then((matches) => res.json(matches))
    .catch((err) => {
      console.error("Ошибка при получении матчей:", err);
      res.status(500).json({ error: "Ошибка при получении списка матчей" });
    });
});

app.get("/api/obs/match/:id", (req, res) => {
  const matchId = req.params.id;
  db.getMatch(matchId)
    .then((match) => {
      if (!match) {
        return res.status(404).json({ error: "Матч не найден" });
      }
      res.json(match);
    })
    .catch((err) => {
      console.error("Ошибка при получении данных матча:", err);
      res.status(500).json({ error: "Ошибка при получении данных матча" });
    });
});

app.get("/api/obs/active-match", (req, res) => {
  // Получаем данные активного матча
  db.getActiveMatch()
    .then((match) => {
      if (!match) {
        return res.status(404).json({ error: "Активный матч не найден" });
      }
      res.json(match);
    })
    .catch((err) => {
      console.error("Ошибка при получении активного матча:", err);
      res.status(500).json({ error: "Ошибка при получении активного матча" });
    });
});

// Функция для пересоздания таблицы match_maps при запуске сервера
async function recreateMatchMapsTable() {
  try {
    // Сначала проверяем, существует ли таблица
    const tableExists = await new Promise((resolve, reject) => {
      db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='match_maps'",
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? true : false);
        }
      );
    });

    if (!tableExists) {
      console.log("Таблица match_maps не существует. Создаем...");
      // Создаем таблицу
      await new Promise((resolve, reject) => {
        db.run(
          `
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
                        original_winner_team TEXT,
                        original_winner_logo TEXT,
                        original_pick_team_name TEXT,
                        original_pick_team_logo TEXT,
                        map_type TEXT DEFAULT 'pick',
                        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
                    )
                `,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      console.log("Таблица match_maps создана");
      return;
    }

    // Далее продолжается существующий код проверки колонок и т.д.
    const columns = await new Promise((resolve, reject) => {
      // ... существующий код
    });

    // ... остальной код функции
  } catch (error) {
    console.error("Ошибка при пересоздании таблицы match_maps:", error);
  }
}

// Вызываем функцию в начале запуска сервера
(async () => {
  await recreateMatchMapsTable();
})();

// В начале файла server.js
db.run(
  "ALTER TABLE match_maps ADD COLUMN map_type TEXT DEFAULT 'pick'",
  (err) => {
    if (err) {
      // Игнорируем ошибку, если колонка уже существует
      console.log(
        "Информация: колонка map_type уже существует или произошла другая ошибка:",
        err.message
      );
    } else {
      console.log("Колонка map_type успешно добавлена в таблицу match_maps");
    }
  }
);

// Добавляем колонки для хранения оригинальной информации о победителе
db.run("ALTER TABLE match_maps ADD COLUMN original_winner_team TEXT", (err) => {
  if (err) {
    // Игнорируем ошибку, если колонка уже существует
    console.log(
      "Информация: колонка original_winner_team уже существует или произошла другая ошибка:",
      err.message
    );
  } else {
    console.log(
      "Колонка original_winner_team успешно добавлена в таблицу match_maps"
    );
  }
});

db.run("ALTER TABLE match_maps ADD COLUMN original_winner_logo TEXT", (err) => {
  if (err) {
    // Игнорируем ошибку, если колонка уже существует
    console.log(
      "Информация: колонка original_winner_logo уже существует или произошла другая ошибка:",
      err.message
    );
  } else {
    console.log(
      "Колонка original_winner_logo успешно добавлена в таблицу match_maps"
    );
  }
});

// Диагностический API-эндпоинт для проверки данных о картах матча
app.get("/api/matches/:id/maps-debug", async (req, res) => {
  try {
    const matchId = req.params.id;

    // Получаем информацию о матче
    const match = await new Promise((resolve, reject) => {
      db.get(
        `
                SELECT 
                    m.*,
                    t1.name as team1_name, t1.logo as team1_logo,
                    t2.name as team2_name, t2.logo as team2_logo
                FROM matches m
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE m.id = ?
            `,
        [matchId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!match) {
      return res.status(404).json({ error: "Матч не найден" });
    }

    // Получаем исходные данные карт
    const rawMaps = await new Promise((resolve, reject) => {
      db.all(
        `
                SELECT * FROM match_maps
                WHERE match_id = ?
                ORDER BY order_number ASC
            `,
        [matchId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Получаем обработанные данные карт
    const processedMaps = await new Promise((resolve, reject) => {
      db.all(
        `
                                SELECT 
                    mm.*,
                    COALESCE(mm.original_pick_team_name, 
                        CASE 
                            WHEN mm.pick_team = 'team1' THEN t1.name
                            WHEN mm.pick_team = 'team2' THEN t2.name
                            ELSE NULL
                        END
                    ) as name_team_pick,
                    COALESCE(mm.original_pick_team_logo, 
                        CASE 
                            WHEN mm.pick_team = 'team1' THEN t1.logo
                            WHEN mm.pick_team = 'team2' THEN t2.logo
                            ELSE NULL
                        END
                    ) as logo_team_pick,
                    COALESCE(mm.original_winner_team, mm.winner_team) as winner_team,
                    COALESCE(mm.original_winner_logo, mm.winner_logo) as winner_logo
                FROM match_maps mm
                LEFT JOIN matches m ON mm.match_id = m.id
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE mm.match_id = ? 
                ORDER BY mm.order_number ASC
            `,
        [matchId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Формируем объект ответа с данными для диагностики
    const response = {
      match: {
        id: match.id,
        team1_id: match.team1_id,
        team2_id: match.team2_id,
        team1_name: match.team1_name,
        team2_name: match.team2_name,
        team1_logo: match.team1_logo,
        team2_logo: match.team2_logo,
      },
      rawMaps: rawMaps,
      processedMaps: processedMaps,
    };

    res.json(response);
  } catch (error) {
    console.error("Ошибка при диагностике данных карт:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

// API-эндпоинт для обновления команды, пикнувшей карту
app.post("/api/maps/:mapId/update-pick-team", async (req, res) => {
  try {
    const mapId = req.params.mapId;
    const { name_team_pick, logo_team_pick } = req.body;

    // Проверяем существование карты
    const map = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM match_maps WHERE id = ?", [mapId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!map) {
      return res.status(404).json({ error: "Карта не найдена" });
    }

    // Обновляем данные о команде, пикнувшей карту
    await new Promise((resolve, reject) => {
      db.run(
        `
                UPDATE match_maps 
                SET original_pick_team_name = ?, original_pick_team_logo = ?
                WHERE id = ?
            `,
        [name_team_pick, logo_team_pick, mapId],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    // Получаем обновленные данные карты
    const updatedMap = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM match_maps WHERE id = ?", [mapId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      success: true,
      message: "Данные о команде, пикнувшей карту, успешно обновлены",
      map: updatedMap,
    });
  } catch (error) {
    console.error("Ошибка при обновлении данных карты:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

// API-эндпоинт для фиксации команд, пикнувших карты, для всего матча
app.post("/api/matches/:matchId/fix-pick-teams", async (req, res) => {
  try {
    const matchId = req.params.matchId;

    // Получаем информацию о матче
    const match = await new Promise((resolve, reject) => {
      db.get(
        `
                SELECT 
                    m.*,
                    t1.name as team1_name, t1.logo as team1_logo,
                    t2.name as team2_name, t2.logo as team2_logo
                FROM matches m
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE m.id = ?
            `,
        [matchId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!match) {
      return res.status(404).json({ error: "Матч не найден" });
    }

    // Получаем все карты матча
    const maps = await new Promise((resolve, reject) => {
      db.all(
        `
                SELECT * FROM match_maps
                WHERE match_id = ?
                ORDER BY order_number ASC
            `,
        [matchId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    if (!maps || !maps.length) {
      return res.status(404).json({ error: "Карты матча не найдены" });
    }

    // Обновляем оригинальные данные о командах, пикнувших карты
    const updatePromises = maps.map((map) => {
      // Определяем имя и лого команды
      let pickTeamName = null;
      let pickTeamLogo = null;

      if (map.pick_team === "team1") {
        pickTeamName = match.team1_name;
        pickTeamLogo = match.team1_logo;
      } else if (map.pick_team === "team2") {
        pickTeamName = match.team2_name;
        pickTeamLogo = match.team2_logo;
      } else if (map.pick_team === "DECIDER") {
        pickTeamName = null;
        pickTeamLogo = null;
      }

      // Сохраняем данные только если их нет или если параметр force=true
      return new Promise((resolve, reject) => {
        if (!map.original_pick_team_name || req.query.force === "true") {
          db.run(
            `
                        UPDATE match_maps 
                        SET original_pick_team_name = ?, original_pick_team_logo = ?
                        WHERE id = ?
                    `,
            [pickTeamName, pickTeamLogo, map.id],
            function (err) {
              if (err) reject(err);
              else resolve({ id: map.id, updated: true });
            }
          );
        } else {
          resolve({ id: map.id, updated: false });
        }
      });
    });

    // Ждем завершения всех обновлений
    const results = await Promise.all(updatePromises);

    // Получаем обновленные данные карт
    const updatedMaps = await new Promise((resolve, reject) => {
      db.all(
        `
                SELECT * FROM match_maps
                WHERE match_id = ?
                ORDER BY order_number ASC
            `,
        [matchId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      message: "Данные о командах, пикнувших карты, успешно зафиксированы",
      updateResults: results,
      maps: updatedMaps,
    });
  } catch (error) {
    console.error("Ошибка при фиксации данных о командах:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

// API-эндпоинт для обновления информации о победителе карты
app.post("/api/maps/:mapId/update-winner", async (req, res) => {
  try {
    const mapId = req.params.mapId;
    const { winner_team, winner_logo } = req.body;

    // Проверяем существование карты
    const map = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM match_maps WHERE id = ?", [mapId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!map) {
      return res.status(404).json({ error: "Карта не найдена" });
    }

    // Обновляем данные о победителе карты
    await new Promise((resolve, reject) => {
      db.run(
        `
                UPDATE match_maps 
                SET winner_team = ?, winner_logo = ?, 
                    original_winner_team = ?, original_winner_logo = ?,
                    status = CASE WHEN ? IS NOT NULL THEN 'completed' ELSE status END
                WHERE id = ?
            `,
        [
          winner_team,
          winner_logo,
          winner_team,
          winner_logo,
          winner_team,
          mapId,
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    // Получаем обновленные данные карты
    const updatedMap = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM match_maps WHERE id = ?", [mapId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      success: true,
      message: "Данные о победителе карты успешно обновлены",
      map: updatedMap,
    });
  } catch (error) {
    console.error("Ошибка при обновлении данных победителя:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

// API-эндпоинт для фиксации данных о победителях карт в матче
app.post("/api/matches/:matchId/fix-winner-teams", async (req, res) => {
  try {
    const matchId = req.params.matchId;

    // Получаем все карты матча
    const maps = await new Promise((resolve, reject) => {
      db.all(
        `
                SELECT * FROM match_maps
                WHERE match_id = ?
                ORDER BY order_number ASC
            `,
        [matchId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    if (!maps || !maps.length) {
      return res.status(404).json({ error: "Карты матча не найдены" });
    }

    // Обновляем оригинальные данные о победителях карт
    const updatePromises = maps.map((map) => {
      return new Promise((resolve, reject) => {
        // Обновляем только если есть победитель и нет оригинальных данных или force=true
        if (
          (map.winner_team && !map.original_winner_team) ||
          req.query.force === "true"
        ) {
          db.run(
            `
                        UPDATE match_maps 
                        SET original_winner_team = ?, original_winner_logo = ?
                        WHERE id = ?
                    `,
            [map.winner_team, map.winner_logo, map.id],
            function (err) {
              if (err) reject(err);
              else resolve({ id: map.id, updated: true });
            }
          );
        } else {
          resolve({ id: map.id, updated: false });
        }
      });
    });

    // Ждем завершения всех обновлений
    const results = await Promise.all(updatePromises);

    // Получаем обновленные данные карт
    const updatedMaps = await new Promise((resolve, reject) => {
      db.all(
        `
                SELECT * FROM match_maps
                WHERE match_id = ?
                ORDER BY order_number ASC
            `,
        [matchId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      message: "Данные о победителях карт успешно зафиксированы",
      updateResults: results,
      maps: updatedMaps,
    });
  } catch (error) {
    console.error("Ошибка при фиксации данных о победителях:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

// Продолжение существующего кода...

const cameraLinks = {}; // steamid -> ссылка камеры

app.post("/api/cameras", (req, res) => {
  const { steamid, camera_link } = req.body;
  if (steamid && typeof camera_link === "string") {
    cameraLinks[steamid] = camera_link;
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: "Некорректные данные" });
  }
});

// Обработчик для проксирования VDO.Ninja
app.use("/ninja-proxy", (req, res) => {
  // Устанавливаем заголовки CORS
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  // Проксируем запрос на VDO.Ninja
  const ninjaUrl = `https://vdo.ninja${req.url}`;

  // Простая проксировка через запрос
  https
    .get(ninjaUrl, (response) => {
      response.pipe(res);
    })
    .on("error", (err) => {
      console.error("Ошибка при проксировании запроса:", err);
      res.status(500).send("Ошибка при проксировании");
    });
});

// Добавьте в server.js после строки 3852

// Функция для отправки данных всем клиентам через WebSocket
function broadcastGsiData(data) {
  // Отправляем через HTTP WebSocket
  io.emit("gsi", data);
  console.log("Данные отправлены через HTTP WebSocket (порт 2626)");
  
  // Удаляем отправку через HTTPS WebSocket
  // if (ioHttps) {
  //   ioHttps.emit("gsi", data);
  //   console.log("Данные отправлены через HTTPS WebSocket (порт 2627)");
  // } else {
  //   console.log(
  //     "ioHttps не инициализирован, данные не отправлены через HTTPS"
  //   );
  // }
}

// Добавьте после строки 3867

// Создаем отдельный обработчик GSI для HTTPS, если он настроен
if (httpsGsiServer) {
  gsiApp.post("/gsi-https", async (req, res) => {
    try {
      console.log("Получен GSI запрос на HTTPS порт");
      // Такая же обработка как в обычном GSI эндпоинте
      const data = req.body;
      if (!data) {
        return res.sendStatus(400);
      }

      // Обработка данных и обновление gameState
      // ...

      // В конце обязательно вызываем broadcastGsiData
      broadcastGsiData(gameState);
      res.sendStatus(200);
    } catch (error) {
      console.error("Ошибка при обработке HTTPS GSI данных:", error);
      res.sendStatus(500);
    }
  });

  console.log("HTTPS GSI эндпоинт настроен на /gsi-https");
}

// После строки с console.log('HTTPS сервер запущен на https://${serverIP}:${HTTPS_PORT}');
// добавьте:

console.log("Настраиваем обработчики подключений для HTTPS WebSocket");

// Логирование подключений к HTTPS WebSocket
if (ioHttps) {
  console.log("ioHttps инициализирован, настраиваем обработчики");

  ioHttps.on("connection", (socket) => {
    console.log("Новое подключение к HTTPS WebSocket");

    socket.on("disconnect", () => {
      console.log("Клиент отключился от HTTPS WebSocket");
    });

    socket.on("ready", () => {
      console.log("Клиент на HTTPS WebSocket отправил ready");
      socket.emit("gsi", gameState);
      console.log("Отправлены начальные GSI данные через HTTPS WebSocket");
    });

    // Другие обработчики...
  });

  console.log("Обработчики для HTTPS WebSocket настроены");
}

// Настройте CORS для HTTPS сервера явно
if (httpsServer) {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });
}

// То же самое для GSI сервера
if (httpsGsiServer) {
  gsiApp.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });
}

// Добавьте перенаправление с HTTP на HTTPS
app.use((req, res, next) => {
  if (!req.secure) {
    console.log(`Перенаправление с HTTP на HTTPS: ${req.url}`);
    return res.redirect(`https://${serverIP}:${PORT + 1}${req.url}`);
  }
  next();
});

app.get("/steam-frame", (req, res) => {
  const url = req.query.url;

  if (!url || !url.includes("steamcommunity.com/broadcast")) {
    return res.status(400).send("Неверная ссылка на трансляцию");
  }

  // Отправляем HTML с iframe, который будет показывать только видео
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          overflow: hidden;
          width: 100%;
          height: 100%;
          background: transparent;
        }
        
        .container {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        }
        
        iframe {
          position: absolute;
          top: -80px;  /* Скрываем верхнюю часть с меню */
          left: 0;
          width: 100%;
          height: calc(100% + 160px);  /* Увеличиваем высоту, чтобы скрыть нижнюю часть */
          border: none;
          transform: scale(1.2);  /* Немного увеличиваем, чтобы скрыть боковые элементы */
          transform-origin: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <iframe src="${url}" frameborder="0" allowfullscreen></iframe>
      </div>
      
      <script>
        // Скрипт для удаления ненужных элементов из iframe
        document.addEventListener('DOMContentLoaded', () => {
          const iframe = document.querySelector('iframe');
          
          iframe.onload = function() {
            try {
              const doc = iframe.contentDocument || iframe.contentWindow.document;
              
              // Создаем стиль для скрытия ненужных элементов
              const style = doc.createElement('style');
              style.textContent = 
                .broadcast_chat_container, .broadcast_status_container, 
                .broadcast_info_container, .broadcast_title_container,
                .broadcast_thumbnail_container, .broadcast_footer,
                .broadcast_viewers_container, .broadcast_controls,
                .responsive_header, .responsive_page_template_content {
                  display: none !important;
                }
                
                .broadcast_viewer_container {
                  width: 100% !important;
                  height: 100% !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                
                .broadcast_actual_broadcast {
                  width: 100% !important;
                  height: 100% !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                
                body {
                  overflow: hidden !important;
                  background: transparent !important;
                }
              ;
              
              doc.head.appendChild(style);
            } catch (e) {
              console.error('Ошибка при настройке iframe:', e);
            }
          };
        });
      </script>
    </body>
    </html>
  `;

  res.send(html);
});

// В начале server.js после импортов
const packageInfo = require("../package.json");
const currentVersion = packageInfo.version;

// Функция для сравнения версий (семантическое версионирование)
function compareVersions(v1, v2) {
  const v1parts = v1.split(".").map(Number);
  const v2parts = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;

    if (v1part > v2part) return 1;
    if (v1part < v2part) return -1;
  }
  return 0;
}

// Функция для проверки наличия обновлений
async function checkForUpdates() {
  try {
    console.log("Проверка обновлений...");
    console.log(`Текущая версия: ${currentVersion}`);

    // Получаем последнюю версию с GitHub
    const response = await fetch(
      "https://raw.githubusercontent.com/fyflo/CS2_Manager_HUD/main/package.json",
      {
        headers: { "Cache-Control": "no-cache" },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }

    const repoPackage = await response.json();
    const latestVersion = repoPackage.version;
    console.log(`Последняя доступная версия: ${latestVersion}`);

    // Сравниваем версии
    if (compareVersions(currentVersion, latestVersion) < 0) {
      console.log(`=================================`);
      console.log(`Доступна новая версия: ${latestVersion}`);
      console.log(`Ваша текущая версия: ${currentVersion}`);
      console.log(`Пожалуйста, обновите приложение:`);
      console.log(`https://github.com/fyflo/CS2_Manager_HUD/releases/latest`);
      console.log(`=================================`);

      // Добавляем информацию об обновлении в gameState для отображения в HUD
      gameState.update_available = {
        current: currentVersion,
        latest: latestVersion,
        update_url: "https://github.com/fyflo/CS2_Manager_HUD/releases/latest",
      };

      return true;
    } else {
      console.log("У вас установлена последняя версия приложения");
      return false;
    }
  } catch (error) {
    console.error("Ошибка при проверке обновлений:", error);
    console.log("Детали ошибки:", error.message);
    return false;
  }
}

// Вызываем функцию проверки обновлений при запуске
(async () => {
  await checkForUpdates();
})();

// Добавьте этот маршрут в server.js
app.get("/api/check-updates", async (req, res) => {
  try {
    const updateAvailable = await checkForUpdates();

    if (updateAvailable) {
      res.json({
        update_available: true,
        current_version: currentVersion,
        latest_version: gameState.update_available.latest,
        update_url: "https://github.com/fyflo/CS2_Manager_HUD/releases/latest",
      });
    } else {
      res.json({
        update_available: false,
        current_version: currentVersion,
      });
    }
  } catch (error) {
    console.error("Ошибка при проверке обновлений:", error);
    res.status(500).json({ error: "Ошибка при проверке обновлений" });
  }
});

// Добавьте этот маршрут в server.js
app.get("/api/update-info", (req, res) => {
  if (gameState.update_available) {
    res.json({
      update_available: true,
      current_version: currentVersion,
      latest_version: gameState.update_available.latest,
      update_url: "https://github.com/fyflo/CS2_Manager_HUD/releases/latest",
    });
  } else {
    res.json({
      update_available: false,
      current_version: currentVersion,
    });
  }
});

// В server.js, где вы рендерите основной HTML
app.get("/", (req, res) => {
  res.render("index", {
    gameState: gameState,
    currentVersion: currentVersion,
  });
});

// Добавьте в server.js
app.get("/package-version", (req, res) => {
  const packageInfo = require("../package.json");
  res.json({ version: packageInfo.version });
});

// Добавьте этот маршрут в server.js
app.get("/api/version", (req, res) => {
  try {
    const packageInfo = require("../package.json");
    res.json({ version: packageInfo.version });
  } catch (error) {
    console.error("Ошибка при чтении package.json:", error);
    res
      .status(500)
      .json({ version: "0.0.0", error: "Не удалось прочитать версию" });
  }
});

// Добавляем колонку format в таблицу matches, если она не существует
db.run("PRAGMA table_info(matches)", function (err, rows) {
  if (err) {
    console.error("Ошибка при получении информации о таблице matches:", err);
    return;
  }

  // Проверяем, есть ли колонка format
  let hasFormatColumn = false;

  if (Array.isArray(rows)) {
    hasFormatColumn = rows.some((row) => row.name === "format");
  } else {
    // Если rows не массив, используем другой подход
    db.all("PRAGMA table_info(matches)", function (err, rows) {
      if (err) {
        console.error(
          "Ошибка при получении информации о таблице matches:",
          err
        );
        return;
      }

      hasFormatColumn = rows.some((row) => row.name === "format");

      if (!hasFormatColumn) {
        addFormatColumn();
      }
    });
    return;
  }

  if (!hasFormatColumn) {
    addFormatColumn();
  }
});

function addFormatColumn() {
  // Добавляем колонку format
  db.run(
    "ALTER TABLE matches ADD COLUMN format TEXT DEFAULT 'bo1'",
    function (err) {
      if (err) {
        console.error("Ошибка при добавлении колонки format:", err);
      } else {
        console.log("Колонка format успешно добавлена в таблицу matches");
      }
    }
  );

  // Создаем временную таблицу с нужной структурой
  db.run(
    `
        CREATE TABLE IF NOT EXISTS matches_temp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team1_id INTEGER,
            team2_id INTEGER,
            score_team1 INTEGER DEFAULT 0,
            score_team2 INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            format TEXT DEFAULT 'bo1'
        )
    `,
    function (err) {
      if (err) {
        console.error("Ошибка при создании временной таблицы:", err);
        return;
      }

      // Копируем данные из старой таблицы во временную
      db.run(
        `
            INSERT INTO matches_temp (id, team1_id, team2_id, score_team1, score_team2, status, created_at, format)
            SELECT id, team1_id, team2_id, score_team1, score_team2, status, created_at, 
                   COALESCE(format, 'bo1') as format
            FROM matches
        `,
        function (err) {
          if (err) {
            console.error(
              "Ошибка при копировании данных во временную таблицу:",
              err
            );
            return;
          }

          // Удаляем старую таблицу
          db.run("DROP TABLE matches", function (err) {
            if (err) {
              console.error("Ошибка при удалении старой таблицы:", err);
              return;
            }

            // Переименовываем временную таблицу
            db.run(
              "ALTER TABLE matches_temp RENAME TO matches",
              function (err) {
                if (err) {
                  console.error(
                    "Ошибка при переименовании временной таблицы:",
                    err
                  );
                } else {
                  console.log(
                    "Таблица matches успешно пересоздана со столбцом format"
                  );
                }
              }
            );
          });
        }
      );
    }
  );
}

const matchesApiLogPath = path.join(__dirname, "../matches-api.log");
function logMatchesApi(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(matchesApiLogPath, `[${timestamp}] ${message}\n`);
}
