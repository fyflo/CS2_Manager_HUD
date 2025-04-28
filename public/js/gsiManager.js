class GSIManager {
    constructor() {
        this.socket = io('http://127.0.0.1:2626', {
            withCredentials: true,
            transports: ['websocket', 'polling']
        });
        
        this.gameState = {
            map: {
                name: "",
                mode: "",
                phase: "",
                round: 0,
                team_ct: { score: 0, name: "CT", flag: "" },
                team_t: { score: 0, name: "T", flag: "" }
            },
            phase_countdowns: {
                phase: "",
                phase_ends_in: 0
            },
            player: {
                name: "",
                team: "",
                state: { health: 100, armor: 0, money: 0 },
                match_stats: { kills: 0, assists: 0, deaths: 0 }
            },
            allplayers: {},
            bomb: { state: "" },
            grenades: {},
            previously: {},

        };

        this.callbacks = [];
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Подключено к серверу');
            this.notifyCallbacks({ type: 'connect' });
        });

        this.socket.on('disconnect', () => {
            console.log('Отключено от сервера');
            this.notifyCallbacks({ type: 'disconnect' });
        });

        this.socket.on('gsi', (data) => {
            this.gameState = data;
            this.notifyCallbacks({ type: 'update', data: this.gameState });
        });

        // Отправляем сигнал готовности
        this.socket.emit('ready');
    }

    subscribe(callback) {
        this.callbacks.push(callback);
        return () => {
            this.callbacks = this.callbacks.filter(cb => cb !== callback);
        };
    }

    notifyCallbacks(event) {
        this.callbacks.forEach(callback => callback(event));
    }

    getGameState() {
        return this.gameState;
    }
}

// Создаем единственный экземпляр
window.gsiManager = window.gsiManager || new GSIManager();