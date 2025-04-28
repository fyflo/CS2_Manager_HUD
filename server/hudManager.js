const hudManager = {
    elements: {}, // Кэшируем элементы DOM

    init: function() {
        console.log('Инициализация HUD...');
        
        // Инициализируем кэш элементов
        this.cacheElements();

        // Подписываемся на данные с сервера
        if (window.socket) {
            window.socket.on('hud-update', (data) => {
                this.updateHUD(data);
            });
        }
    },

    // Кэшируем только основные элементы
    cacheElements: function() {
        this.elements = {
            // Основные контейнеры
            hudContainer: document.querySelector('.hud-container'),
            mapName: document.querySelector('.map-name'),
            roundNumber: document.querySelector('.round-number'),
            timer: document.querySelector('.timer'),
            bombStatus: document.querySelector('.bomb-status'),
            bombTimer: document.querySelector('.bomb-timer')
        };
    },

    // Безопасное обновление текстового содержимого
    setElementText: function(element, text) {
        if (element) {
            element.textContent = text;
        }
    },

    updateHUD: function(data) {
        if (!data) return;

        try {
            // Обновляем только необходимые данные
            if (data.map) {
                this.updateMapData(data.map);
            }

            if (data.players) {
                this.updatePlayers(data.players);
            }

            if (data.bomb) {
                this.updateBomb(data.bomb);
            }

        } catch (error) {
            console.error('Ошибка при обновлении HUD:', error);
        }
    },

    updateMapData: function(mapData) {
        this.setElementText(this.elements.mapName, mapData.name);
        this.setElementText(this.elements.roundNumber, `Round ${mapData.round}`);

        // Обновляем таймер
        if (mapData.phase_ends_in) {
            const time = Math.max(0, Math.ceil(mapData.phase_ends_in));
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            this.setElementText(
                this.elements.timer, 
                `${minutes}:${seconds.toString().padStart(2, '0')}`
            );
        }
    },

    updatePlayers: function(players) {
        const { hudContainer } = this.elements;
        if (!hudContainer) return;

        // Очищаем контейнер
        hudContainer.innerHTML = '';

        // Создаем элементы через Pug
        const playersHtml = players.map(player => `
            .player
                .player-info
                    .player-name ${player.name}
                    .player-stats
                        span.kills ${player.kills}
                        span.assists ${player.assists}
                        span.deaths ${player.deaths}
        `).join('');

        hudContainer.innerHTML = playersHtml;
    },

    updateBomb: function(bombData) {
        this.setElementText(this.elements.bombStatus, bombData.state);
        if (bombData.state === 'planted') {
            const time = Math.max(0, Math.ceil(bombData.time_left));
            this.setElementText(this.elements.bombTimer, `${time}s`);
        } else {
            this.setElementText(this.elements.bombTimer, '');
        }
    }
};