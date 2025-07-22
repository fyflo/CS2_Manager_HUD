const { app, BrowserWindow, dialog, protocol, session } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const { fixDatabase } = require("./db-fix");
const { runServer } = require("./server-wrapper");
const { patchServerFile } = require("./server-patch"); // Добавляем импорт патча

// Глобальные переменные
let mainWindow;
let serverProcess;

// Определяем основной путь к ресурсам
const getResourcePath = () => {
  // В упакованном приложении ресурсы находятся в process.resourcesPath
  // В режиме разработки используем текущую директорию приложения
  return app.isPackaged
    ? process.resourcesPath
    : path.join(app.getAppPath(), "..");
};

// Проверка, запущен ли уже сервер на порту 2626
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once("error", () => {
        resolve(true); // Порт занят
      })
      .once("listening", () => {
        server.close();
        resolve(false); // Порт свободен
      })
      .listen(port);
  });
}

// Функция для установки зависимостей
async function installDependencies(targetDir) {
  console.log(`Установка зависимостей в ${targetDir}...`);

  // Проверяем наличие package.json
  const packageJsonPath = path.join(targetDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`Файл package.json не найден в ${targetDir}`);

    // Создаем минимальный package.json
    const minPackage = {
      name: "cs2-hud-manager-server",
      version: "1.0.0",
      main: "server.js",
      dependencies: {
        express: "^4.18.2",
        "socket.io": "^4.6.1",
        cors: "^2.8.5",
        "body-parser": "^1.20.2",
        multer: "^1.4.5-lts.1",
        sqlite3: "^5.1.6",
      },
    };

    try {
      fs.writeFileSync(packageJsonPath, JSON.stringify(minPackage, null, 2));
      console.log(`Создан файл package.json в ${targetDir}`);
    } catch (error) {
      console.error(`Ошибка при создании package.json: ${error.message}`);
      return false;
    }
  }

  // Запуск установки зависимостей
  try {
    const { execSync } = require("child_process");
    execSync("npm install --production", {
      cwd: targetDir,
      stdio: "inherit",
      timeout: 120000, // 2 минуты таймаут
    });
    console.log(`Зависимости успешно установлены в ${targetDir}`);
    return true;
  } catch (error) {
    console.error(`Ошибка при установке зависимостей: ${error.message}`);
    return false;
  }
}

// Функция для запуска скрипта обновления базы данных
async function runDatabaseUpdate() {
  console.log("Запуск скрипта обновления базы данных...");

  // Определяем пути к ресурсам
  const resourcePath = getResourcePath();
  const scriptPath = path.join(resourcePath, "server", "add_short_name.js");
  const serverDir = path.join(resourcePath, "server");

  if (!fs.existsSync(scriptPath)) {
    console.error("Скрипт обновления базы данных не найден:", scriptPath);
    return false;
  }

  try {
    const { execSync } = require("child_process");
    execSync(`node "${scriptPath}"`, {
      cwd: serverDir,
      stdio: "inherit",
    });
    console.log("Скрипт обновления базы данных выполнен успешно");
    return true;
  } catch (error) {
    console.error(
      "Ошибка при выполнении скрипта обновления базы данных:",
      error
    );
    return false;
  }
}

// Функция для запуска сервера
async function startServer() {
  console.log("Запуск сервера...");

  // Проверяем, запущен ли уже сервер
  const portInUse = await isPortInUse(2626);
  if (portInUse) {
    console.log(
      "Порт 2626 уже используется, предполагаем, что сервер уже запущен"
    );
    // Не проверяем API матчей, просто продолжаем запуск приложения!
    return null;
  }

  // Исправляем проблему с базой данных
  try {
    console.log("Исправление проблем с базой данных...");
    fixDatabase();
    console.log("База данных исправлена");
  } catch (error) {
    console.error("Ошибка при исправлении проблемы с db:", error);
  }

  // Применяем патч к server.js для исправления проблемы с модулем open
  try {
    console.log("Применение патча к server.js...");
    patchServerFile();
    console.log("Патч к server.js применен");
  } catch (error) {
    console.error("Ошибка при применении патча к server.js:", error);
  }

  // Запускаем скрипт обновления базы данных
  try {
    console.log("Обновление структуры базы данных...");
    await runDatabaseUpdate();
    console.log("Структура базы данных обновлена");
  } catch (error) {
    console.error("Ошибка при обновлении структуры базы данных:", error);
  }

  // Определяем корень проекта и путь к серверу
  const projectRoot = path.resolve(__dirname, "..");
  const serverDir = path.join(projectRoot, "server");
  const serverPath = path.join(serverDir, "server.js");

  console.log("Путь к ресурсам:", getResourcePath());
  console.log("Путь к серверу:", serverPath);
  console.log("Файл сервера существует:", fs.existsSync(serverPath));

  // Проверяем наличие node_modules в директории сервера
  const nodeModulesPath = path.join(serverDir, "node_modules");
  console.log("Путь к node_modules сервера:", nodeModulesPath);
  console.log("node_modules существует:", fs.existsSync(nodeModulesPath));

  // Если нет node_modules, устанавливаем зависимости
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(
      "Директория node_modules не найдена, устанавливаем зависимости..."
    );
    try {
      // Пробуем установить зависимости
      const installed = await installDependencies(serverDir);
      if (!installed) {
        console.error("Не удалось установить зависимости для сервера");
      }
    } catch (error) {
      console.error("Ошибка при установке зависимостей:", error);
    }
  }

  // Запускаем сервер
  console.log("Запуск сервера через обертку...");
  const serverProcess = runServer(projectRoot);

  if (serverProcess) {
    console.log("Сервер запущен успешно, PID:", serverProcess.pid);
  } else {
    console.error("Не удалось запустить сервер");

    // Создаем временный сервер для обработки запросов к /api/matches
    createTemporaryMatchesAPI();
  }

  return serverProcess;
}

// Создание главного окна
function createWindow() {
  console.log("Создание главного окна...");

  // Создаем окно браузера
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: "#1a1a1a", // Устанавливаем цвет фона
    show: false, // Не показываем окно до полной загрузки
    webPreferences: {
      webviewTag: true,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Отключаем для локальных файлов
    },
    icon: path.join(getResourcePath(), "favicon.ico"),
  });

  // Отключаем проверку SSL-сертификатов для локальных соединений
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: details.requestHeaders });
  });

  // Отключаем проверку SSL для WebView
  app.commandLine.appendSwitch("ignore-certificate-errors");
  app.commandLine.appendSwitch("allow-insecure-localhost", "true");

  // Проверяем наличие файла index.html
  const indexPath = path.join(__dirname, "index.html");
  console.log("Путь к index.html:", indexPath);
  console.log("Файл существует:", fs.existsSync(indexPath));

  try {
    // Загружаем локальную HTML страницу
    mainWindow.loadFile(indexPath);
    console.log("Загружен файл:", indexPath);
  } catch (error) {
    console.error("Ошибка загрузки index.html:", error);

    // Аварийная загрузка по URL, если файл не найден
    mainWindow.loadURL("http://localhost:2626");
    console.log("Файл не найден, загружен URL http://localhost:2626");
  }

  // Показываем окно когда содержимое загружено
  mainWindow.once("ready-to-show", () => {
    console.log("Окно готово к отображению");
    mainWindow.show();
  });

  // Открываем DevTools в режиме разработки
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
    console.log("Открыты инструменты разработчика");
  }

  // Обработка закрытия окна
  mainWindow.on("closed", () => {
    console.log("Окно закрыто");
    mainWindow = null;
  });
}

// Запуск приложения
app.whenReady().then(async () => {
  console.log("Electron app готов к запуску...");

  // Выводим информацию о путях
  console.log("Путь приложения:", app.getAppPath());
  console.log("Путь ресурсов:", getResourcePath());
  console.log("Рабочая директория:", process.cwd());

  // Запускаем сервер
  console.log("Запуск сервера...");
  serverProcess = await startServer();

  console.log("Ожидание запуска сервера (5 секунд)...");
  // Даем серверу больше времени на запуск
  setTimeout(() => {
    console.log("Создание основного окна приложения...");
    createWindow();
  }, 5000); // Увеличиваем задержку до 5 секунд
});

// Обработка закрытия всех окон
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Завершение работы сервера при закрытии приложения
app.on("before-quit", () => {
  if (serverProcess) {
    console.log("Завершение работы сервера...");
    serverProcess.kill();
  }
});

// Функция для создания временного API для /api/matches
function createTemporaryMatchesAPI() {
  try {
    console.log("Создание временного API для /api/matches...");

    const express = require("express");
    const cors = require("cors");
    const sqlite3 = require("sqlite3").verbose();
    const http = require("http");

    // Определяем путь к базе данных
    const dbPath = path.join(app.getAppPath(), "..", "database.db");
    console.log("Путь к базе данных для временного API:", dbPath);

    // Проверяем существование базы данных
    if (!fs.existsSync(dbPath)) {
      console.error("База данных не найдена:", dbPath);
      return;
    }

    // Создаем подключение к базе данных
    const db = new sqlite3.Database(dbPath);

    // Создаем временный сервер
    const tempApp = express();
    tempApp.use(cors());

    // Добавляем маршрут для /api/matches
    tempApp.get("/api/matches", (req, res) => {
      console.log("Получен запрос к /api/matches");

      const query = `
        SELECT 
          m.*,
          t1.name as team1_name,
          t2.name as team2_name,
          GROUP_CONCAT(mm.map_name) as maps
        FROM matches m
        LEFT JOIN teams t1 ON m.team1_id = t1.id
        LEFT JOIN teams t2 ON m.team2_id = t2.id
        LEFT JOIN match_maps mm ON m.id = mm.match_id
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `;

      db.all(query, [], (err, matches) => {
        if (err) {
          console.error("Ошибка при получении списка матчей:", err);
          return res.status(500).json({ error: "Внутренняя ошибка сервера" });
        }
        console.log(`Найдено ${matches.length} матчей`);
        res.json(matches);
      });
    });

    // Добавляем маршрут для корневого пути
    tempApp.get("/", (req, res) => {
      res.send("Временный API сервер работает");
    });

    // Запускаем сервер на порту 2626
    const tempServer = tempApp.listen(2626, () => {
      console.log("Временный API для /api/matches запущен на порту 2626");
    });

    return tempServer;
  } catch (error) {
    console.error("Ошибка при создании временного API:", error);
    return null;
  }
}
