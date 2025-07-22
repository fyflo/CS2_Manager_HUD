const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Функция для проверки наличия столбца в таблице
function checkColumnExists(db, tableName, columnName) {
  return new Promise((resolve, reject) => {
    db.get(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      // Проверяем, есть ли столбец в результатах
      const columnExists = rows && rows.some((row) => row.name === columnName);
      resolve(columnExists);
    });
  });
}

// Функция для добавления столбца, если его нет
async function addColumnIfNotExists(dbPath) {
  console.log(`Проверка и обновление базы данных: ${dbPath}`);

  // Проверяем существование файла базы данных
  if (!fs.existsSync(dbPath)) {
    console.error(`База данных не найдена: ${dbPath}`);
    return false;
  }

  const db = new sqlite3.Database(dbPath);

  try {
    // Проверяем наличие столбца short_name
    const columnExists = await checkColumnExists(db, "teams", "short_name");

    if (!columnExists) {
      console.log("Столбец short_name не найден в таблице teams. Добавляем...");

      // Добавляем столбец
      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE teams ADD COLUMN short_name TEXT`, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });

      console.log("Столбец short_name успешно добавлен в таблицу teams");
      return true;
    } else {
      console.log("Столбец short_name уже существует в таблице teams");
      return false;
    }
  } catch (error) {
    console.error("Ошибка при обновлении базы данных:", error);
    return false;
  } finally {
    // Закрываем соединение с базой данных
    db.close();
  }
}

// Пути к базам данных
const dbPaths = [path.join(__dirname, "..", "database.db")];

// Обновляем все базы данных
async function updateAllDatabases() {
  console.log("Начало обновления баз данных...");

  for (const dbPath of dbPaths) {
    try {
      const updated = await addColumnIfNotExists(dbPath);
      console.log(
        `База данных ${dbPath}: ${
          updated ? "обновлена" : "не требует обновления"
        }`
      );
    } catch (error) {
      console.error(`Ошибка при обновлении базы данных ${dbPath}:`, error);
    }
  }

  console.log("Обновление баз данных завершено");
}

// Запускаем обновление
updateAllDatabases()
  .then(() => {
    console.log("Скрипт завершен");
  })
  .catch((error) => {
    console.error("Ошибка выполнения скрипта:", error);
  });
