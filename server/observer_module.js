const EventEmitter = require('events');

class ObserverAI extends EventEmitter {
    constructor() {
        super();
        this.gameState = null;
        this.previousState = null;
        this.lastSwitch = Date.now();
        this.cooldownTime = 4000; // 4 секунды между рекомендациями
        this.bombPlanted = false;
        this.playersStats = new Map();
        this.currentObserver = null;
        this.enabled = true;
    }

    // Включение/выключение системы
    toggleEnabled() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    // Обновляем текущее состояние игры
    update(gameState) {
        if (!this.enabled) return;
        
        this.previousState = this.gameState;
        this.gameState = gameState;
        
        // Простая тестовая рекомендация при обновлении состояния
        if (gameState && gameState.allplayers) {
            const players = Object.entries(gameState.allplayers);
            if (players.length > 0) {
                // Выбираем случайного игрока раз в 10 секунд для теста
                if (Date.now() - this.lastSwitch > 10000) {
                    const randomIndex = Math.floor(Math.random() * players.length);
                    const [steamId, player] = players[randomIndex];
                    
                    if (player && player.state && player.state.health > 0) {
                        this.emit('recommendation', {
                            steamId,
                            playerName: player.name || 'Игрок ' + randomIndex,
                            keyToPress: (randomIndex + 1).toString().slice(-1),
                            team: player.team || 'CT',
                            health: player.state.health,
                            reason: 'тестовая рекомендация',
                            timestamp: Date.now()
                        });
                        this.lastSwitch = Date.now();
                    }
                }
            }
        }
    }
}

// Экспортируем одиночный экземпляр
const observerAI = new ObserverAI();
module.exports = observerAI;