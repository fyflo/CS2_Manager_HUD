const sqlite3 = require('sqlite3').verbose();

class DatabasePool {
    constructor(dbPath, maxConnections = 5) {
        this.dbPath = dbPath;
        this.maxConnections = maxConnections;
        this.connections = [];
        this.availableConnections = [];
        this.waitingQueries = [];
    }

    // Получение соединения из пула
    getConnection() {
        return new Promise((resolve, reject) => {
            if (this.availableConnections.length > 0) {
                const connection = this.availableConnections.pop();
                resolve(connection);
            } else if (this.connections.length < this.maxConnections) {
                const connection = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.connections.push(connection);
                        resolve(connection);
                    }
                });
            } else {
                this.waitingQueries.push({ resolve, reject });
            }
        });
    }

    // Возврат соединения в пул
    releaseConnection(connection) {
        if (this.waitingQueries.length > 0) {
            const { resolve } = this.waitingQueries.shift();
            resolve(connection);
        } else {
            this.availableConnections.push(connection);
        }
    }

    // Выполнение запроса с использованием пула
    async query(sql, params = []) {
        const connection = await this.getConnection();
        try {
            return new Promise((resolve, reject) => {
                connection.all(sql, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
        } finally {
            this.releaseConnection(connection);
        }
    }

    // Закрытие всех соединений
    close() {
        return Promise.all(this.connections.map(connection => {
            return new Promise((resolve) => {
                connection.close(resolve);
            });
        }));
    }
}

// Создаем и экспортируем экземпляр пула
const dbPool = new DatabasePool('database.db');
module.exports = dbPool; 