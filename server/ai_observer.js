// Создадим новый файл server/ai_observer.js

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
        
        // Определяем ключевые события
        this.detectEvents();
        
        // Рассчитываем наиболее интересного игрока
        const targetPlayer = this.getMostInterestingPlayer();
        
        // Проверяем, можем ли сделать рекомендацию
        if (targetPlayer && this.canSwitchNow() && targetPlayer !== this.currentObserver) {
            this.recommendPlayer(targetPlayer);
            this.lastSwitch = Date.now();
        }
    }
    
    // Обнаружение важных игровых событий
    detectEvents() {
        if (!this.previousState || !this.gameState) return;
        
        // Обнаружение начала раунда
        if (this.gameState.round && this.gameState.round.phase === 'live' && 
            (!this.previousState.round || this.previousState.round.phase !== 'live')) {
            this.bombPlanted = false;
        }
        
        // Обнаружение установки бомбы
        if (this.gameState.bomb && this.gameState.bomb.state === 'planted' && 
            (!this.previousState.bomb || this.previousState.bomb.state !== 'planted')) {
            this.bombPlanted = true;
            this.cooldownTime = 2000; // Сокращаем время между переключениями
        }
        
        // Возвращаем стандартный кулдаун после обезвреживания/взрыва бомбы
        if (this.bombPlanted && this.gameState.bomb && 
            (this.gameState.bomb.state === 'defused' || this.gameState.bomb.state === 'exploded')) {
            this.cooldownTime = 4000;
            this.bombPlanted = false;
        }
        
        // Обновляем статистику игроков
        this.updatePlayersStats();
    }
    
    // Обновление статистики игроков
    updatePlayersStats() {
        if (!this.gameState.allplayers) return;
        
        Object.entries(this.gameState.allplayers).forEach(([steamId, player]) => {
            if (!this.playersStats.has(steamId)) {
                this.playersStats.set(steamId, {
                    lastKill: 0,
                    killCount: 0,
                    lastDamage: 0,
                    health: player.state.health
                });
            }
            
            const stats = this.playersStats.get(steamId);
            
            // Обнаружение убийств
            if (player.match_stats && this.previousState.allplayers && 
                this.previousState.allplayers[steamId] && 
                player.match_stats.kills > this.previousState.allplayers[steamId].match_stats.kills) {
                stats.lastKill = Date.now();
                stats.killCount++;
            }
            
            // Обнаружение получения урона
            if (player.state && this.previousState.allplayers && 
                this.previousState.allplayers[steamId] && 
                player.state.health < this.previousState.allplayers[steamId].state.health) {
                stats.lastDamage = Date.now();
            }
            
            stats.health = player.state.health;
            this.playersStats.set(steamId, stats);
        });
    }
    
    // Определение самого интересного игрока для наблюдения
    getMostInterestingPlayer() {
        if (!this.gameState.allplayers) return null;
        
        const now = Date.now();
        let bestPlayer = null;
        let bestScore = -1;
        
        Object.entries(this.gameState.allplayers).forEach(([steamId, player]) => {
            // Пропускаем мертвых игроков
            if (player.state.health <= 0) return;
            
            const stats = this.playersStats.get(steamId) || {
                lastKill: 0,
                killCount: 0,
                lastDamage: 0
            };
            
            // Расчет интересности игрока
            const killRelevance = Math.max(0, 1 - (now - stats.lastKill) / 10000);
            const damageRelevance = Math.max(0, 1 - (now - stats.lastDamage) / 5000);
            const bombBonus = player.weapons && Object.values(player.weapons).some(w => w.type === 'C4') ? 0.5 : 0;
            const lowHealthBonus = player.state.health < 30 ? (1 - player.state.health / 30) * 0.3 : 0;
            
            let bombProximityBonus = 0;
            if (this.bombPlanted && this.gameState.bomb && this.gameState.bomb.position && player.position) {
                const dx = this.gameState.bomb.position[0] - player.position[0];
                const dy = this.gameState.bomb.position[1] - player.position[1];
                const distance = Math.sqrt(dx*dx + dy*dy);
                if (distance < 500) {
                    bombProximityBonus = 0.8 * (1 - distance / 500);
                }
            }
            
            const score = killRelevance * 1.5 + 
                          damageRelevance * 1.2 + 
                          bombBonus + 
                          lowHealthBonus + 
                          bombProximityBonus;
            
            if (score > bestScore) {
                bestScore = score;
                bestPlayer = steamId;
            }
        });
        
        return bestScore > 0.3 ? bestPlayer : null;
    }
    
    // Проверка возможности рекомендации по времени
    canSwitchNow() {
        return Date.now() - this.lastSwitch > this.cooldownTime;
    }
    
    // Рекомендация игрока для наблюдения
    recommendPlayer(steamId) {
        if (!this.gameState.allplayers || !this.gameState.allplayers[steamId]) return;
        
        const player = this.gameState.allplayers[steamId];
        const playerIndex = Object.keys(this.gameState.allplayers).indexOf(steamId);
        
        if (playerIndex >= 0) {
            const keyNumber = playerIndex + 1;
            const keyToPress = keyNumber <= 9 ? keyNumber.toString() : '0';
            
            // Отправляем рекомендацию
            this.emit('recommendation', {
                steamId: steamId,
                playerName: player.name,
                keyToPress: keyToPress,
                team: player.team,
                health: player.state.health,
                reason: this.getRecommendationReason(steamId),
                timestamp: Date.now()
            });
            
            this.currentObserver = steamId;
        }
    }
    
    // Получение причины рекомендации
    getRecommendationReason(steamId) {
        const stats = this.playersStats.get(steamId);
        const player = this.gameState.allplayers[steamId];
        const now = Date.now();
        
        if (stats && now - stats.lastKill < 5000) {
            return "недавнее убийство";
        }
        
        if (stats && now - stats.lastDamage < 3000) {
            return "в перестрелке";
        }
        
        if (player.weapons && Object.values(player.weapons).some(w => w.type === 'C4')) {
            return "несет бомбу";
        }
        
        if (this.bombPlanted && this.gameState.bomb && this.gameState.bomb.position && player.position) {
            const dx = this.gameState.bomb.position[0] - player.position[0];
            const dy = this.gameState.bomb.position[1] - player.position[1];
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance < 300) {
                return "около бомбы";
            }
        }
        
        if (player.state.health < 30) {
            return "низкое здоровье";
        }
        
        return "активные действия";
    }
}

module.exports = ObserverAI;