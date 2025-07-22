const EventEmitter = require('events');

class ObserverAI extends EventEmitter {
    constructor() {
        super();
        this.enabled = true;
        this.gameState = null;
        console.log('AI Observer запущен');
    }
    
    update(gameState) {
        this.gameState = gameState;
        
        // Для тестирования создаем рекомендацию при обновлении состояния
        // Вы можете заменить это на настоящую логику позже
        if (this.enabled && gameState && gameState.allplayers) {
            const players = Object.entries(gameState.allplayers);
            if (players.length > 0) {
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
                }
            }
        }
    }
    
    toggleEnabled() {
        this.enabled = !this.enabled;
        console.log(`ObserverAI ${this.enabled ? 'включен' : 'выключен'}`);
        return this.enabled;
    }
}

const observerAI = new ObserverAI();

module.exports = {
    observerAI,
    
    setupRoutes: function(app) {
        // Добавляем API endpoints
        app.get('/api/auto-observer/toggle', (req, res) => {
            try {
                const isEnabled = observerAI.toggleEnabled();
                res.json({ 
                    error: false,
                    enabled: isEnabled,
                    message: isEnabled ? 'Автонаблюдение включено' : 'Автонаблюдение выключено' 
                });
            } catch (err) {
                console.error('Ошибка:', err);
                res.status(500).json({ 
                    error: true, 
                    message: 'Ошибка при переключении автонаблюдения' 
                });
            }
        });
        
        app.get('/api/auto-observer/status', (req, res) => {
            try {
                res.json({ 
                    error: false,
                    enabled: observerAI.enabled,
                    message: 'Статус успешно получен'
                });
            } catch (err) {
                console.error('Ошибка:', err);
                res.status(500).json({ 
                    error: true, 
                    message: 'Ошибка при получении статуса',
                    enabled: false
                });
            }
        });
    },
    
    setupSocketHandlers: function(io) {
        // Прослушивание событий и отправка через Socket.IO
        observerAI.on('recommendation', (recommendation) => {
            console.log(`✨ Рекомендация: игрок ${recommendation.playerName} (${recommendation.keyToPress})`);
            io.emit('observer_recommendation', recommendation);
        });
    }
};