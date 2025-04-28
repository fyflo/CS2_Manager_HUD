// Глобальный буфер для GSI данных
let gsiDataBuffer = null;
// Глобальные переменные для информации о сервере
let serverIP = 'localhost';
let serverPort = 2626;

// Функция для получения информации о сервере
async function initializeServerInfo() {
    try {
        const response = await fetch('/api/server-info');
        const serverInfo = await response.json();
        serverIP = serverInfo.ip;
        serverPort = serverInfo.port;
        //console.log(`Сервер обнаружен на http://${serverIP}:${serverPort}`);
    } catch (error) {
        console.error('Ошибка при получении информации о сервере:', error);
    }
}


// Обновляем существующий обработчик DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    // Сначала получаем информацию о сервере
    await initializeServerInfo();
    
    // Остальной существующий код
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });


    // Показываем только секцию матча по умолчанию
    const matchSection = document.getElementById('match-section');
    if (matchSection) {
        matchSection.classList.add('active');
    }

    // Отмечаем соответствующую кнопку в меню как активную
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.section === 'match-section') {
            btn.classList.add('active');
        }
    });

    // Инициализируем остальные компоненты
    initializeNavigation();
    initializeGSI();
    loadInitialData();
    initFormHandlers();
});

// Инициализация навигации
function initializeNavigation() {
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', () => {
            // Убираем активный класс у всех кнопок и секций
            document.querySelectorAll('.nav-button').forEach(btn => 
                btn.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(section => 
                section.classList.remove('active'));
            
            // Добавляем активный класс нажатой кнопке
            button.classList.add('active');
            
            // Показываем соответствующую секцию
            const sectionId = button.dataset.section;
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.add('active');
                if (sectionId === 'scoreboard-section') {
                    updateGameInfo(); // Обновляем скорборд при переключении
                }
            }
        });
    });
}



// Инициализация GSI
function initializeGSI() {
    if (typeof window.gsiManager === 'undefined') {
        console.error('GSIManager не инициализирован');
        return;
    }

    window.gsiManager.subscribe((event) => {
        switch(event.type) {
            case 'connect':
                console.log('Подключено к серверу GSI');
                break;
            case 'disconnect':
                console.log('Отключено от сервера GSI');
                break;
            case 'update':
                gsiDataBuffer = event.data;
                updateGameInfo();
                break;
        }
    });
}


// Загрузка начальных данных
function loadInitialData() {
    loadTeams();
    loadPlayers();
    loadHUDs();
}



// Вспомогательная функция для загрузки команд в select
async function loadTeamsForMatchSelect(selectElement, selectedValue = '') {
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();
        
        selectElement.innerHTML = '<option value="">Выберите команду</option>';
        
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            if (selectedValue === team.id.toString()) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка при загрузке списка команд:', error);
    }
}


// Добавляем новую функцию для инициализации кнопок редактирования
function initializeEditButtons() {
    document.querySelectorAll('.edit-match-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const matchId = this.dataset.matchId;
            await loadMatchDetails(matchId);
            modal.style.display = 'block';
        });
    });
}






// Заменяем вызов loadTeamsIntoSelects на loadTeamsForSelect
document.querySelectorAll('.nav-button').forEach(button => {
    button.addEventListener('click', () => {
        const sectionId = button.dataset.section;
        if (sectionId === 'match-section') {
            const team1Select = document.getElementById('team1-select');
            const team2Select = document.getElementById('team2-select');
            if (team1Select && team2Select) {
                loadTeamsForSelect(team1Select);
                loadTeamsForSelect(team2Select);
            }
        }
    });
});

// ... existing code ...

// Заменяем прямое обращение к форме на безопасную проверку
document.addEventListener('DOMContentLoaded', () => {
    const createMatchForm = document.getElementById('createMatchForm');
    
    if (createMatchForm) {
        createMatchForm.onsubmit = async (e) => {
            e.preventDefault();
            
            try {
                const team1Id = document.getElementById('team1Select')?.value;
                const team2Id = document.getElementById('team2Select')?.value;

                if (!team1Id || !team2Id) {
                    alert('Пожалуйста, выберите обе команды');
                    return;
                }

                const response = await fetch('/api/matches', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        team1_id: team1Id,
                        team2_id: team2Id
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Ошибка при создании матча');
                }

                // Безопасно получаем и проверяем модальное окно
                const modal = document.getElementById('createMatchModal');
                if (modal) {
                    modal.style.display = 'none';
                }
                
                // Обновляем список матчей
                await loadMatchesList();
                
                // Очищаем форму
                createMatchForm.reset();

            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка при создании матча: ' + error.message);
            }
        };
    }
});

// Функция для обновления названий команд в зависимости от раунда
function updateTeamNamesBasedOnRound(currentRound) {
    if (!matchTeams) return;

    // Определяем, нужно ли менять стороны
    let shouldSwap = false;

    // Вторая половина (раунды 12–23)
    if (currentRound >= 12 && currentRound <= 23) {
        shouldSwap = true;
    }
    // Овертаймы (каждые 6 раундов, смена после каждых 3 раундов)
    else if (currentRound > 23) {
        const overtimeRound = currentRound - 24; // Нумерация овертаймов с 0
        if (overtimeRound % 3 === 0 && overtimeRound !== 0) {
            shouldSwap = true;
        }
    }

    if (shouldSwap) {
        // Меняем названия команд местами
        const tempName = matchTeams.team1.name;
        matchTeams.team1.name = matchTeams.team2.name;
        matchTeams.team2.name = tempName;

        console.log('Смена названий команд на раунде:', currentRound, {
            new_team1: matchTeams.team1.name,
            new_team2: matchTeams.team2.name
        });
    }
}

// Функция для обновления данных матча
function updateMatchData(data) {
    if (data.map) {
        const currentRound = data.map.round || 0;
        updateTeamNamesBasedOnRound(currentRound);

        // Обновляем отображение команд
        updateTeamTurn();
        updateMapsOrder(matchFormat);
    }
}



// Глобальные переменные для отслеживания состояния выбора карт
let selectedMaps = [];
let currentTeam = 1; // 1 или 2
let matchFormat = 'bo1';
let matchTeams = { team1: null, team2: null };

// Обновляем функцию editMatch
// Добавляем функцию для редактирования матча
// ... existing code ...



// ... existing code ...

// Функция для выбора карты
window.pickMap = function(mapId, matchId) {
    const mapItem = document.querySelector(`[data-map-id="${mapId}"]`);
    const mapName = mapItem.querySelector('.map-name').textContent;
    
    if (selectedMaps.length >= getRequiredMapsCount()) {
        alert('Все необходимые карты уже выбраны');
        return;
    }

    const mapInfo = {
        id: mapId,
        name: mapName,
        type: 'pick',
        team: currentTeam,
        order: selectedMaps.length + 1
    };

    selectedMaps.push(mapInfo);
    mapItem.classList.add('picked');
    mapItem.dataset.status = `picked-team${currentTeam}`;
    
    updateMapStatus(mapItem, `Pick Team ${currentTeam}`);
    updateMapsOrderDisplay();
    switchTeam();
};

// Функция для бана карты
window.banMap = function(mapId, matchId) {
    const mapItem = document.querySelector(`[data-map-id="${mapId}"]`);
    
    mapItem.classList.add('banned');
    mapItem.dataset.status = `banned-team${currentTeam}`;
    updateMapStatus(mapItem, `Ban Team ${currentTeam}`);
    switchTeam();
};

// Вспомогательные функции
function switchTeam() {
    currentTeam = currentTeam === 1 ? 2 : 1;
    updateTeamTurn();
}

function updateTeamTurn() {
    const teamTurnDisplay = document.createElement('div');
    teamTurnDisplay.className = 'team-turn';
    teamTurnDisplay.textContent = `Ход команды: ${matchTeams[`team${currentTeam}`].name}`;
    
    const existingDisplay = document.querySelector('.team-turn');
    if (existingDisplay) {
        existingDisplay.replaceWith(teamTurnDisplay);
    } else {
        document.querySelector('.maps-container').insertBefore(teamTurnDisplay, document.getElementById('mapsPool'));
    }
}

function updateMapStatus(mapItem, status) {
    const statusDiv = mapItem.querySelector('.map-status');
    statusDiv.textContent = status;
}

function getRequiredMapsCount() {
    const counts = { bo1: 1, bo2: 2, bo3: 3, bo5: 5 };
    return counts[matchFormat] || 1;
}

function updateMapsOrderDisplay() {
    const mapsOrder = document.getElementById('mapsOrder');
    const mapsList = mapsOrder.querySelector('.maps-list');
    
    mapsList.innerHTML = selectedMaps.map((map, index) => `
        <div class="map-slot" data-index="${index}">
            <span data-i18n="mapNumber" class="map-number">Карта ${index + 1}</span>
            <div data-i18n="mapInfo" class="map-info">
                ${map.name} (Pick: Team ${map.team})
                <div class="side-pick">
                    <button data-i18n="ct" onclick="selectSide(${index}, 'CT', ${map.team})">CT</button>
                    <button data-i18n="t" onclick="selectSide(${index}, 'T', ${map.team})">T</button>
                </div>
            </div>
        </div>
    `).join('');
}

function resetMapSelection() {
    selectedMaps = [];
    currentTeam = 1;
    const mapItems = document.querySelectorAll('.map-item');
    mapItems.forEach(item => {
        item.classList.remove('picked', 'banned');
        item.dataset.status = '';
        item.querySelector('.map-status').textContent = '';
    });
    updateMapsOrderDisplay();
}

async function saveMatchSettings(e, matchId) {
    e.preventDefault();
    
    try {
        // Подготавливаем данные для отправки
        const validMaps = selectedMaps.filter(map => map && map.mapId).map(map => ({
            mapId: map.mapId,
            pickTeam: map.pickTeam || null,
            startingSide: map.startingSide || null,
            score: {
                team1: map.score?.team1 || 0,
                team2: map.score?.team2 || 0
            }
        }));

        const response = await fetch(`/api/matches/${matchId}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                format: matchFormat,
                maps: validMaps
            })
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Ошибка при сохранении настроек');
        }

        alert('Настройки матча сохранены');
        document.getElementById('editMatchModal').style.display = 'none';
        await loadMatchesList();
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
        alert('Ошибка при сохранении: ' + error.message);
    }
}

// Добавляем функцию resetMapPool
function resetMapPool() {
    const mapItems = document.querySelectorAll('.map-item');
    mapItems.forEach(item => {
        item.classList.remove('picked', 'banned');
        item.dataset.status = '';
        const statusDiv = item.querySelector('.map-status');
        if (statusDiv) {
            statusDiv.textContent = '';
        }
    });
    
    selectedMaps = [];
    currentTeam = 1;
    updateMapsOrderDisplay();
    updateTeamTurn();
}



function updateMapsContainer() {
    const format = elements.format.value;
    const mapCount = {
        'bo1': 1,
        'bo2': 2,
        'bo3': 3,
        'bo5': 5
    }[format] || 1;

    // Получаем текущие значения перед обновлением содержимого
    let currentMaps = [];
    try {
        currentMaps = Array.from(elements.mapsContainer.querySelectorAll('.map-item'))
            .map(item => ({
                mapValue: item.querySelector('.map-select')?.value || '',
                pickTeam: item.querySelector('.pick-team-select')?.value || '',
                teamLogoId: item.querySelector('.pick-team-select')?.selectedOptions[0]?.dataset?.logoId || ''
            }));
    } catch (error) {
        console.error('Ошибка при получении текущих значений:', error);
        currentMaps = [];
    }

    elements.mapsContainer.innerHTML = `
        <div class="maps-pool edit-match-maps">
            ${Array(mapCount).fill(0).map((_, index) => `
                <div class="map-item">
                    <div class="map-preview">
                        <img src="/images/maps/tba.png" alt="Map preview" class="map-image">
                        <div class="map-overlay">
                            <span class="map-number">Карта ${index + 1}</span>
                            <div class="map-controls">
                                <div class="map-select-container">
                                    <select data-i18n="mapNumber" name="map${index + 1}" id="editMap${index + 1}" class="map-select">
                                        <option  value="">Выберите карту</option>
                                        <option value="de_dust2" data-image="/images/maps/de_dust2.png">Dust II</option>
                                        <option value="de_mirage" data-image="/images/maps/de_mirage.png">Mirage</option>
                                        <option value="de_inferno" data-image="/images/maps/de_inferno.png">Inferno</option>
                                        <option value="de_nuke" data-image="/images/maps/de_nuke.png">Nuke</option>
                                        <option value="de_overpass" data-image="/images/maps/de_overpass.png">Overpass</option>
                                        <option value="de_ancient" data-image="/images/maps/de_ancient.png">Ancient</option>
                                        <option value="de_anubis" data-image="/images/maps/de_anubis.png">Anubis</option>
                                        <option value="de_vertigo" data-image="/images/maps/de_vertigo.png">Vertigo</option>
                                        <option value="de_cache" data-image="/images/maps/de_cache.png">Cache</option>
                                        <option value="de_train" data-image="/images/maps/de_train.png">Train</option>
                                    </select>
                                </div>
                                <div class="team-select-container">
                                    <select data-i18n="pickTeam" class="pick-team-select" name="pickTeam${index + 1}" onchange="updateTeamLogo(this, ${index})">
                                        <option data-i18n="pickTeam" value="">Выберите команду</option>
                                        <option data-i18n="team1" value="team1" data-logo-id="${elements.team1.value}">${elements.team1.options[elements.team1.selectedIndex]?.text || 'Команда 1'}</option>
                                        <option data-i18n="team2" value="team2" data-logo-id="${elements.team2.value}">${elements.team2.options[elements.team2.selectedIndex]?.text || 'Команда 2'}</option>
                                    </select>
                                    <img src="/images/default-team-logo.png" alt="Pick Team Logo" class="pick-team-logo">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Восстанавливаем значения



        

        // Обновляем контейнер карт при изменении формата
        elements.format.addEventListener('change', updateMapsContainer);
        
        // Инициализируем контейнер карт
        updateMapsContainer();

        // Добавляем обработчик для кнопки свапа
        if (elements.swapBtn) {
            elements.swapBtn.onclick = () => {
                const team1Value = elements.team1.value;
                const team2Value = elements.team2.value;
                elements.team1.value = team2Value;
                elements.team2.value = team1Value;

                // Анимация кнопки
                elements.swapBtn.style.transform = 'rotate(180deg)';
                setTimeout(() => {
                    elements.swapBtn.style.transform = 'rotate(0deg)';
                }, 300);
            };
        }

        // Обработчик отправки формы
        form.onsubmit = async (e) => {
            e.preventDefault();
            try {
                // Проверяем выбор одинаковых команд
                if (elements.team1.value === elements.team2.value && elements.team1.value !== '') {
                    alert('Нельзя выбрать одну и ту же команду');
                    return;
                }

                // Собираем данные о картах
                const maps = Array.from(elements.mapsContainer.querySelectorAll('.map-item'))
            .map(item => ({
                mapId: item.querySelector('.map-select').value,
                pickTeam: item.querySelector('.pick-team-select').value
            }))
            .filter(map => map.mapId !== '');

                const formData = {
                    team1_id: parseInt(elements.team1.value),
                    team2_id: parseInt(elements.team2.value),
                    format: elements.format.value,
                    maps: maps
                };

                console.log('Отправляемые данные:', formData);

                const updateResponse = await fetch(`/api/matches/${matchId}/update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    console.error('Ответ сервера:', errorText);
                    throw new Error('Ошибка при обновлении матча: ' + updateResponse.status);
                }

                const result = await updateResponse.json();
                console.log('Результат обновления:', result);

                if (result.success) {
                    modal.style.display = 'none';
                    alert(i18n('matchUpdatedSuccess'));
                    await loadMatchesList();
                } else {
                    throw new Error(result.message || 'Неизвестная ошибка при обновлении матча');
                }
            } catch (error) {
                console.error('Ошибка при сохранении:', error);
                alert(i18n('matchSaveError'));
            }
        };

        // Обработчики закрытия модального окна
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }

        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

        // Показываем модальное окно
        modal.style.display = 'block';

    }





// ... rest of the code ...
/*
// Обновляем функцию updateMapsOrder для более детального отображения информации
function updateMapsOrder(format) {
    const mapsOrder = document.getElementById('mapsOrder');
    const mapCount = {
        bo1: 1,
        bo2: 2,
        bo3: 3,
        bo5: 5
    }[format] || 1;

    mapsOrder.innerHTML = `
        <h3>Порядок карт (${format.toUpperCase()})</h3>
        <div class="maps-list">
            ${Array(mapCount).fill(0).map((_, i) => `
                <div class="map-slot" data-index="${i}">
                    <div class="map-header">
                        <span class="map-number">Карта ${i + 1}</span>
                        <span class="map-score">
                            <input type="number" min="0" max="16" value="0" class="score-input team1-score" onchange="updateMapScore(${i}, 1, this.value)">
                            :
                            <input type="number" min="0" max="16" value="0" class="score-input team2-score" onchange="updateMapScore(${i}, 2, this.value)">
                        </span>
                    </div>
                    <div class="map-details">
                        <div class="map-pick-info">
                            <span class="pick-team">Выбор: 
                                <select onchange="updateMapPickTeam(${i}, this.value)">
                                    <option value="">-</option>
                                    <option value="1">${matchTeams.team1?.name || 'Команда 1'}</option>
                                    <option value="2">${matchTeams.team2?.name || 'Команда 2'}</option>
                                </select>
                            </span>
                        </div>
                        <div class="map-name-select">
                            <select class="map-select" onchange="updateMapSelection(${i}, this.value)">
                                <option value="">Выберите карту</option>
                                <option value="de_dust2">Dust II</option>
                                <option value="de_mirage">Mirage</option>
                                <option value="de_inferno">Inferno</option>
                                <option value="de_nuke">Nuke</option>
                                <option value="de_overpass">Overpass</option>
                                <option value="de_ancient">Ancient</option>
                                <option value="de_anubis">Anubis</option>
                                <option value="de_vertigo">Vertigo</option>
                                <option value="de_train">Train</option>
                            </select>
                        </div>
                        <div class="side-selection">
                            <span>Выбор сторон:</span>
                            <div class="side-buttons">
                                <button onclick="selectSide(${i}, 'CT', 1)" class="side-btn ct-btn">CT - ${matchTeams.team1?.name || 'Команда 1'}</button>
                                <button onclick="selectSide(${i}, 'T', 1)" class="side-btn t-btn">T - ${matchTeams.team1?.name || 'Команда 1'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}*/

// Функции для обновления информации о картах
window.updateMapScore = function(mapIndex, team, score) {
    if (!selectedMaps[mapIndex]) {
        selectedMaps[mapIndex] = { score: {} };
    }
    selectedMaps[mapIndex].score = selectedMaps[mapIndex].score || {};
    selectedMaps[mapIndex].score[`team${team}`] = parseInt(score);
};

window.updateMapPickTeam = function(mapIndex, teamNumber) {
    if (!selectedMaps[mapIndex]) {
        selectedMaps[mapIndex] = {};
    }
    selectedMaps[mapIndex].pickTeam = teamNumber;
};

window.updateMapSelection = function(mapIndex, mapId) {
    if (!selectedMaps[mapIndex]) {
        selectedMaps[mapIndex] = {};
    }
    selectedMaps[mapIndex].mapId = mapId;
    selectedMaps[mapIndex].mapName = document.querySelector(`option[value="${mapId}"]`).textContent;
};

window.selectSide = function(mapIndex, side, team) {
    if (!selectedMaps[mapIndex]) {
        selectedMaps[mapIndex] = {};
    }
    selectedMaps[mapIndex].startingSide = {
        team: team,
        side: side
    };
    
    // Обновляем визуальное отображение выбранной стороны
    const sideButtons = document.querySelectorAll(`.map-slot[data-index="${mapIndex}"] .side-btn`);
    sideButtons.forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
};

window.pickMap = function(mapId) {
    // Реализация выбора карты
};

window.banMap = function(mapId) {
    // Реализация бана карты
};

function getMapsOrder() {
    // Получение порядка карт
    return [];
}

// Добавляем функцию для смены сторон в матче
window.swapMatchTeams = async function(matchId) {
    try {
        const response = await fetch(`/api/matches/${matchId}/swap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Ответ сервера не в формате JSON');
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка при смене сторон');
        }

        const result = await response.json();
        if (result.success) {
            // Обновляем интерфейс после успешной смены сторон
            const matchElement = document.querySelector(`[data-match-id="${matchId}"]`);
            if (matchElement) {
                const team1ScoreElement = matchElement.querySelector('.team1-score');
                const team2ScoreElement = matchElement.querySelector('.team2-score');
                
                // Меняем местами счет команд
                const tempScore = team1ScoreElement.textContent;
                team1ScoreElement.textContent = team2ScoreElement.textContent;
                team2ScoreElement.textContent = tempScore;
            }

            // Перезагружаем список матчей только после того, как сервер подтвердит обновление
            setTimeout(async () => {
                await loadMatchesList();
            }, 500); // Задержка для обеспечения обновления данных на сервере
        } else {
            throw new Error(result.error || 'Не удалось поменять команды местами');
        }
        
    } catch (error) {
        console.error('Ошибка при смене сторон:', error);
        alert('Ошибка при смене сторон: ' + error.message);
    }
};

// ... оставляем весь остальной существующий код без изменений ...
/*
// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initMatchForm();
    loadMatchesList();
});*/

// Глобальные функции для кнопок
// Функция для запуска/остановки матча


// ... existing code ...

// Обновляем обработчик формы создания матча
document.addEventListener('DOMContentLoaded', () => {
    const createMatchForm = document.getElementById('match-form');
    if (createMatchForm) {
        const team1Select = createMatchForm.querySelector('select[name="team1"]');
        const team2Select = createMatchForm.querySelector('select[name="team2"]');
        const team1Logo = createMatchForm.querySelector('#team1-logo');
        const team2Logo = createMatchForm.querySelector('#team2-logo');

        // Функция для обновления логотипа команды
        const updateTeamLogo = async (selectElement, logoElement) => {
            const teamId = selectElement.value;
            if (teamId) {
                try {
                    const response = await fetch(`/api/teams/${teamId}`);
                    const team = await response.json();
                    logoElement.src = team.logo || '/images/default-team-logo.png';
                    logoElement.style.display = 'block';
                } catch (error) {
                    console.error('Ошибка при загрузке логотипа:', error);
                    logoElement.src = '/images/default-team-logo.png';
                }
            } else {
                logoElement.style.display = 'none';
            }
        };

        // Обработчики изменения выбора команды
        if (team1Select && team1Logo) {
            team1Select.addEventListener('change', () => updateTeamLogo(team1Select, team1Logo));
        }
        if (team2Select && team2Logo) {
            team2Select.addEventListener('change', () => updateTeamLogo(team2Select, team2Logo));
        }

        // Обработчик отправки формы
        createMatchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Форма отправляется...');

            // Проверка на выбор одинаковых команд
            if (team1Select.value === team2Select.value && team1Select.value !== '') {
                alert('Нельзя выбрать одну и ту же команду');
                return;
            }

            // Собираем данные формы
            const matchData = {
                team1_id: team1Select.value,
                team2_id: team2Select.value,
                match_name: createMatchForm.querySelector('input[name="matchName"]').value,
                map: createMatchForm.querySelector('select[name="map"]').value,
                format: createMatchForm.querySelector('select[name="format"]').value || 'bo1'
            };

            console.log('Отправляемые данные:', matchData);

            try {
                const response = await fetch('/api/matches', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(matchData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Ошибка при создании матча');
                }

                const result = await response.json();
                console.log('Результат:', result);

                // Закрываем модальное окно, если оно есть
                const modal = document.getElementById('createMatchModal');
                if (modal) {
                    modal.style.display = 'none';
                }

                // Обновляем список матчей
                await loadMatchesList();
                
                // Очищаем форму только после успешного создания
                createMatchForm.reset();
                
                alert(i18n('matchCreatedSuccess'));

            } catch (error) {
                console.error('Ошибка:', error);
                alert(i18n('matchCreateError'));
            }
        });
    }
});


// Обновляем функцию loadMatchesList
async function loadMatchesList() {
    try {
        const matchesContainer = document.getElementById('matches-list');
        if (!matchesContainer) return;

        // Сначала получаем данные о командах
        const teamsResponse = await fetch('/api/teams');
        const teams = await teamsResponse.json();
        
        // Создаем мапу для быстрого доступа к данным команд
        const teamsMap = new Map(teams.map(team => [team.id, team]));

        // Получаем матчи
        const matchesResponse = await fetch('/api/matches');
        const matches = await matchesResponse.json();

        matchesContainer.innerHTML = matches.map(match => {
            // Получаем полные данные команд из мапы
            const team1Data = teamsMap.get(match.team1_id);
            const team2Data = teamsMap.get(match.team2_id);

            console.log('Team data from map:', {
                team1: team1Data,
                team2: team2Data
            });

            const shouldSwap = shouldSwapTeamsBasedOnRound(match.current_round);

            // Получаем данные команд с учетом свапа
            const team1Name = shouldSwap ? match.team2_name : match.team1_name;
            const team2Name = shouldSwap ? match.team1_name : match.team2_name;
            const team1Score = shouldSwap ? match.score_team2 : match.score_team1;
            const team2Score = shouldSwap ? match.score_team1 : match.score_team2;
            const team1Logo = shouldSwap ? team2Data?.logo : team1Data?.logo;
            const team2Logo = shouldSwap ? team1Data?.logo : team2Data?.logo;

            // Отладочный вывод для логотипов
            console.log('Team logos before formatting:', {
                team1: {
                    name: team1Name,
                    logo: team1Logo,
                    raw: team1Data
                },
                team2: {
                    name: team2Name,
                    logo: team2Logo,
                    raw: team2Data
                }
            });

            const formatLogoPath = (logo) => {
                if (!logo) return '/images/default-team-logo.png';
                if (logo.startsWith('http') || logo.startsWith('/uploads/')) return logo;
                return `/uploads/${logo}`;
            };

            const team1LogoPath = formatLogoPath(team1Logo);
            const team2LogoPath = formatLogoPath(team2Logo);

            console.log('Formatted logo paths:', {
                team1: team1LogoPath,
                team2: team2LogoPath
            });

            return `
                <div class="match-item" data-match-id="${match.id}">
                    <div class="match-header">
                        <span data-i18n="matchId" class="match-map">${match.id}</span>
                        <span data-i18n="matchStatus" class="match-status ${match.status}">${match.status}</span>
                    </div>
                    <div class="match-teams">
                        <div class="team team1">
                            <img src="${team1LogoPath}" 
                                 alt="${team1Name}" 
                                 class="team-logo" 
                                 onerror="this.onerror=null; this.src='/images/default-team-logo.png'; console.log('Logo load error for team1:', this.src, 'Team1 data:', team1Data);">
                            <div data-i18n="team1Name" class="match-team1">${team1Name || 'Команда 1'}</div>
                        </div>
                        <div class="match-score">
                            <div class="score-controls">
                                <button class="score-btn minus" onclick="updateScore(${match.id}, 1, -1)">-</button>
                                <span class="score team1-score">${team1Score || 0}</span>
                                <button class="score-btn plus" onclick="updateScore(${match.id}, 1, 1)">+</button>
                            </div>
                            <span class="score-separator">:</span>
                            <div class="score-controls">
                                <button class="score-btn minus" onclick="updateScore(${match.id}, 2, -1)">-</button>
                                <span class="score team2-score">${team2Score || 0}</span>
                                <button class="score-btn plus" onclick="updateScore(${match.id}, 2, 1)">+</button>
                            </div>
                        </div>
                        <div class="team team2">
                            <div data-i18n="team2Name" class="match-team2">${team2Name}</div>
                            <img src="${team2LogoPath}" 
                                 alt="${team2Name}" 
                                 class="team-logo" 
                                 onerror="this.onerror=null; this.src='/images/default-team-logo.png'; console.log('Logo load error for team2:', this.src, 'Team2 data:', team2Data);">
                        </div>
                        <div class="match-actions">
                        ${match.status === 'active' 
                            ? `<button onclick="stopMatch('${match.id}')" class="stop-match-btn">
                                <i class="fas fa-stop"></i> <span data-i18n="stopMatch">ОСТАНОВИТЬ МАТЧ</span>
                               </button>`
                            : `<button onclick="startMatch('${match.id}')" class="start-match-btn">
                                <i class="fas fa-play"></i> <span data-i18n="startMatch">НАЧАТЬ МАТЧ</span>
                               </button>`
                        }
                        <button onclick="editMatch('${match.id}')" class="edit-match-btn">
                            <i class="fas fa-edit"></i> <span data-i18n="mapVeto">MAP VETO</span>
                        </button>
                        <button onclick="swapMatchTeams('${match.id}')" class="swap-teams-btn">
                            <i data-i18n="swapTeams" class="fas fa-exchange-alt"> </i>
                        </button>
                        <button onclick="deleteMatch('${match.id}')" class="delete-match-btn">
                            <i class="fas fa-trash"></i> <span data-i18n="deleteMatch">Удалить матч</span>
                        </button>
                    </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Ошибка при загрузке матчей:', error);
        matchesContainer.innerHTML = '<p class="error-message">Ошибка при загрузке списка матчей</p>';
    }
}


// Добавляем функцию обновления счета
async function updateScore(matchId, teamNumber, change) {
    try {
        // Получаем текущие значения счета перед обновлением
        const matchElement = document.querySelector(`[data-match-id="${matchId}"]`);
        const team1ScoreElement = matchElement.querySelector('.team1-score');
        const team2ScoreElement = matchElement.querySelector('.team2-score');
        
        const currentTeam1Score = parseInt(team1ScoreElement.textContent) || 0;
        const currentTeam2Score = parseInt(team2ScoreElement.textContent) || 0;
        
        // Вычисляем новые значения
        let newTeam1Score = currentTeam1Score;
        let newTeam2Score = currentTeam2Score;
        
        if (teamNumber === 1) {
            newTeam1Score = Math.max(0, currentTeam1Score + change);
        } else {
            newTeam2Score = Math.max(0, currentTeam2Score + change);
        }

        // Отправляем данные на сервер
        const response = await fetch(`/api/matches/${matchId}/score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                team: teamNumber,
                change: change,
                team1Score: newTeam1Score,
                team2Score: newTeam2Score
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка при обновлении счета');
        }

        // После успешного ответа от сервера обновляем DOM
        team1ScoreElement.textContent = newTeam1Score;
        team2ScoreElement.textContent = newTeam2Score;

        // Обновляем GSI данные
        if (gsiDataBuffer && gsiDataBuffer.matches) {
            const gsiMatch = gsiDataBuffer.matches.find(m => m.id === matchId);
            if (gsiMatch) {
                gsiMatch.team1Score = newTeam1Score;
                gsiMatch.team2Score = newTeam2Score;
            }
        }

        // Отправляем данные напрямую в GSI через WebSocket
        if (socket) {
            socket.emit('score_update', {
                matchId: matchId,
                team1Score: newTeam1Score,
                team2Score: newTeam2Score
            });
        }

        // Вызываем обновление интерфейса
        updateGameInfo();

    } catch (error) {
        console.error('Ошибка обновления счета:', error);
        alert('Ошибка при обновлении счета');
    }
}

// ... existing code ...

// Функция для определения, нужно ли менять команды местами в зависимости от раунда
function shouldSwapTeamsBasedOnRound(currentRound) {
    if (!currentRound) return false;

    // Вторая половина (раунды 12–23)
    if (currentRound >= 12 && currentRound <= 23) {
        return true;
    }
    // Овертаймы (каждые 6 раундов, смена после каждых 3 раундов)
    else if (currentRound > 23) {
        const overtimeRound = currentRound - 24; // Нумерация овертаймов с 0
        if (overtimeRound % 3 === 0 && overtimeRound !== 0) {
            return true;
        }
    }

    return false;
}

function determineWinnerWithSwaps(match) {
    const shouldSwap = shouldSwapTeamsBasedOnRound(match.current_round);
    
    const team1Score = shouldSwap ? match.score_team2 : match.score_team1;
    const team2Score = shouldSwap ? match.score_team1 : match.score_team2;
    
    if (team1Score > team2Score) {
        return shouldSwap ? match.team2_id : match.team1_id;
    } else if (team2Score > team1Score) {
        return shouldSwap ? match.team1_id : match.team2_id;
    }
    
    return null; // Ничья
}

// Функция для запуска матча
window.startMatch = async function(matchId) {
    try {
        const response = await fetch(`/api/matches/${matchId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при запуске матча');
        }

        // Обновляем список матчей
        await loadMatchesList();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при запуске матча: ' + error.message);
    }

    // После обновления DOM, вызываем локализацию
    translatePage();
}

// Функция для остановки матча
window.stopMatch = async function(matchId) {
    try {
        const response = await fetch(`/api/matches/${matchId}/stop`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при остановке матча');
        }

        // Обновляем список матчей
        await loadMatchesList();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при остановке матча: ' + error.message);
    }

    // После обновления DOM, вызываем локализацию
    translatePage();
}


// ... existing code ...

// Функция загрузки команд в селекты
/*async function loadTeamsIntoSelects() {
    try {
        const team1Select = document.getElementById('team1-select');
        const team2Select = document.getElementById('team2-select');
        
        // Проверяем, находимся ли мы на странице админки
        if (!team1Select || !team2Select) {
            // Если мы не на странице админки, просто выходим без ошибки
            return;
        }

        const response = await fetch('/api/teams');
        const teams = await response.json();

        const createOptions = (select) => {
            select.innerHTML = '<option value="">Выберите команду</option>';
            teams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.id;
                option.textContent = team.name;
                select.appendChild(option);
            });
        };

        createOptions(team1Select);
        createOptions(team2Select);

    } catch (error) {
        console.error('Ошибка при загрузке команд:', error);
    }
}*/

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Определяем, на какой странице мы находимся
    const isAdminPage = document.getElementById('admin-panel') !== null;
    const isHudPage = document.querySelector('.hud-container') !== null;

    if (isAdminPage) {
        // Код для страницы админки
        loadMatchesList();
        loadTeamsIntoSelects();
        
        // Добавляем обработчик формы создания матча
        const createMatchForm = document.getElementById('create-match-form');
        if (createMatchForm) {
            createMatchForm.addEventListener('submit', handleCreateMatch);
        }
    }

    if (isHudPage) {
        // Код для страницы HUD
        console.log('Инициализация HUD...');
        // Здесь может быть специфичный код для HUD
    }
});

// Обновление списка матчей только на странице админки
setInterval(() => {
    if (document.getElementById('admin-panel')) {
        loadMatchesList();
    }
}, 5000);

// Обновляем функцию handleCreateMatch для отправки логотипов команд


// Функция для отправки логотипов команд в GSI
function sendTeamLogosToGSI(team1Logo, team2Logo) {
    if (window.gsiManager) {
        window.gsiManager.send({
            type: 'team_logos',
            data: {
                team1_logo: team1Logo,
                team2_logo: team2Logo
            }
        });
    }
}

// Обновляем функцию createMatchElement для корректной обработки логотипов
function createMatchElement(match) {
    const matchElement = document.createElement('div');
    matchElement.className = 'match-item';
    matchElement.dataset.matchId = match.id;
    console.log(match);
    // Функция для получения корректного пути к логотипу
    const getLogoPath = (logo) => {
        if (!logo) return '/images/default-team-logo.png';
        return logo.startsWith('/uploads/') ? logo : `/uploads/${logo}`;
    };

    matchElement.innerHTML = `
        <div class="match-header">
            <span class="match-name">${match.match_name || 'Без названия'}</span>
            <span class="match-map">${match.map || '-'}</span>
            <span class="match-status ${match.status}">${match.status}</span>
        </div>
        <div class="match-teams">
            <div class="team team1">
                <img src="${getLogoPath(match.team1_logo)}" 
                     alt="${match.team1_name || i18n('defaultTeam1') || 'Команда 1'}" 
                     class="team-logo"
                     onerror="this.src='/images/default-team-logo.png'">
                ${match.team1_name || i18n('defaultTeam1') || 'Команда 1'}
            </div>
            <div class="match-score">
                <div class="score-controls">
                    <button class="score-btn minus" onclick="updateMatchScore('${match.id}', 1, -1)">-</button>
                    <span class="score team1-score">${match.score_team1 || 0}</span>
                    <button class="score-btn plus" onclick="updateMatchScore('${match.id}', 1, 1)">+</button>
                </div>
                <span class="score-separator">:</span>
                <div class="score-controls">
                    <button class="score-btn minus" onclick="updateMatchScore('${match.id}', 2, -1)">-</button>
                    <span class="score team2-score">${match.score_team2 || 0}</span>
                    <button class="score-btn plus" onclick="updateMatchScore('${match.id}', 2, 1)">+</button>
                </div>
            </div>
            <div class="team team2">
                <img src="${getLogoPath(match.team2_logo)}" 
                     alt="${match.team2_name || i18n('defaultTeam2') || 'Команда 2'}" 
                     class="team-logo"
                     onerror="this.src='/images/default-team-logo.png'">
                <h3>${match.team2_name || i18n('defaultTeam2')}</h3>
            </div>
        </div>
        // ... остальная часть кода ...
    `;

    return matchElement;
}

// Функция обновления счета
window.updateMatchScore = async function(matchId, teamNumber, change) {
    try {
        console.log('Обновление счета:', { matchId, teamNumber, change });

        const response = await fetch(`/api/matches/${matchId}/score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                team: parseInt(teamNumber),
                change: parseInt(change)
            })
        });

        const data = await response.json();
        console.log('Ответ сервера:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Ошибка при обновлении счета');
        }

        // Обновляем только конкретный матч в DOM
        const matchElement = document.querySelector(`[data-match-id="${matchId}"]`);
        if (matchElement) {
            const scoreElement = matchElement.querySelector(
                teamNumber === 1 ? '.team1-score' : '.team2-score'
            );
            if (scoreElement) {
                const currentScore = parseInt(scoreElement.textContent || '0');
                scoreElement.textContent = Math.max(0, currentScore + change);
            }
        }

    } catch (error) {
        console.error('Ошибка обновления счета:', error);
        alert(`Ошибка при обновлении счета: ${error.message}`);
    }
};




window.deleteMatch = async function(matchId) {
    /*if (!confirm('Вы уверены, что хотите удалить этот матч?')) return;*/

    try {
        const response = await fetch(`/api/matches/${matchId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadMatchesList();
        } else {
            throw new Error('Ошибка при удалении матча');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert(i18n('matchDeleteError'));
    }
};


// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initMatchForm();
    loadMatchesList(); // Загружаем список матчей при загрузке страницы
});



// Инициализация обработчиков форм
function initFormHandlers() {
    // Форма команды
    const teamForm = document.getElementById('team-form');
    if (teamForm) {
        teamForm.addEventListener('submit', handleTeamSubmit);
    }

    // Форма игрока
    const playerForm = document.getElementById('player-form');
    if (playerForm) {
        playerForm.addEventListener('submit', handlePlayerSubmit);
    }
}

// Обработчик отправки формы команды
async function handleTeamSubmit(e) {
    e.preventDefault();
    try {
        const formData = new FormData(e.target);
        const response = await fetch('/api/teams', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Ошибка при добавлении команды');
        }

        e.target.reset();
        loadTeams();
        alert('Команда успешно добавлена!');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при добавлении команды: ' + error.message);
    }
}

// Обработчик отправки формы игрока
async function handlePlayerSubmit(e) {
    e.preventDefault();
    try {
        const formData = new FormData(e.target);
        const response = await fetch('/api/players', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Ошибка при добавлении игрока');
        }

        e.target.reset();
        loadPlayers();
        alert('Игрок успешно добавлен!');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при добавлении игрока: ' + error.message);
    }
}

// ... existing code ...

// Функция загрузки списка команд
async function loadTeamsList() {
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();
        
        const teamSelect = document.getElementById('teamSelect');
        if (!teamSelect) return; // Проверяем существование элемента
        
        teamSelect.innerHTML = '<option value="">Выберите команду</option>';
        
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            teamSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка при загрузке списка команд:', error);
    }
}

// Загружаем список команд при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Находим кнопку создания игрока
    const createPlayerBtn = document.getElementById('createPlayerBtn');
    if (createPlayerBtn) {
        createPlayerBtn.addEventListener('click', () => {
            // Загружаем список команд только если он еще не загружен
            const teamSelect = document.getElementById('teamSelect');
            if (!teamSelect || teamSelect.options.length <= 1) {
                loadTeamsList();
            }
        });
    }

    // Загружаем список команд при первой загрузке страницы
    loadTeamsList();
});

// ... existing code ...

// Функция обновления селекторов команд
function updateTeamSelects(teams) {
    // Находим все селекторы команд на странице
    const teamSelects = document.querySelectorAll('select[name="teamId"]');
    
    // Формируем HTML опций
    const optionsHTML = `
        <option value="">Выберите команду</option>
        ${teams.map(team => `
            <option value="${team.id}">${team.name}</option>
        `).join('')}
    `;
    
    // Обновляем каждый селектор
    teamSelects.forEach(select => {
        // Сохраняем текущее выбранное значение
        const currentValue = select.value;
        
        // Обновляем опции
        select.innerHTML = optionsHTML;
        
        // Восстанавливаем выбранное значение
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// ... existing code ...

async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();
        
        const teamsList = document.getElementById('teams-list');
        if (teamsList) {
            teamsList.innerHTML = `
                <div class="search-bar">
                    <input data-i18n="teamSearchPlaceholder" type="text" id="teamSearch" placeholder="Поиск по названию или региону" class="search-input">
                </div>
                <div class="teams-container">
                    ${teams.map(team => {
                        // Проверяем, начинается ли путь уже с /uploads/
                        const logoPath = team.logo 
                            ? (team.logo.startsWith('/uploads/') ? team.logo : `/uploads/${team.logo}`)
                            : '/images/default-team-logo.png';
                        
                        //console.log('Сформированный путь к лого:', logoPath);
                        
                        return `
                            <div class="team-card" data-team-id="${team.id}">
                                <div class="team-info">
                                    <img src="${logoPath}" 
                                         class="team-logo" 
                                         alt="${team.name}"
                                         onerror="this.onerror=null; this.src='/images/default-team-logo.png';">
                                    <div class="team-details">
                                        <h3 class="team-name">${team.name}</h3>
                                        <p data-i18n="teamRegion" class="team-region">${team.region || 'Регион не указан'}</p>
                                    </div>
                                </div>
                                <div class="team-actions">
                                    <button class="edit-team-btn" onclick="editTeam(${team.id})">Редактировать</button>
                                    <button class="delete-team-btn" onclick="deleteTeam(${team.id})">Удалить</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            initializeTeamSearch();
        }
    } catch (error) {
        console.error('Ошибка при загрузке команд:', error);
    }
}

// ... existing code ...

// Обновляем функцию searchTeams для использования более современного подхода
function searchTeams(query) {
    const searchQuery = query.toLowerCase();
    const teamCards = document.querySelectorAll('.team-card');
    
    requestAnimationFrame(() => {
        teamCards.forEach(card => {
            const nameElement = card.querySelector('.team-name');
            const regionElement = card.querySelector('.team-region');
            
            if (!nameElement || !regionElement) {
                return;
            }
            
            const name = nameElement.textContent.toLowerCase();
            const region = regionElement.textContent.toLowerCase();
            
            // Используем CSS display вместо прямой манипуляции DOM
            card.style.display = (name.includes(searchQuery) || 
                                region.includes(searchQuery)) ? '' : 'none';
        });
    });
}

// Обновляем функцию initializeTeamSearch
function initializeTeamSearch() {
    const searchInput = document.getElementById('teamSearch');
    if (!searchInput) return;

    const debouncedSearch = debounce((e) => {
        requestAnimationFrame(() => {
            searchTeams(e.target.value);
        });
    }, 300);

    searchInput.addEventListener('input', debouncedSearch);
}

// ... existing code ...


// Редактирование команды
async function editTeam(teamId) {
    try {
        const response = await fetch(`/api/teams/${teamId}`);
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Ошибка при получении данных команды');
        }
        
        const team = await response.json();
        const form = document.getElementById('team-form');
        
        // Заполняем форму данными команды
        form.name.value = team.name;
        form.region.value = team.region || '';
        
        // Отмечаем, что это редактирование
        form.dataset.editId = teamId;
        
        // Меняем текст кнопки
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Обновить команду';
        
        // Прокручиваем к форме
        form.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Ошибка:', error);
        alert(error.message);
    }
}

async function deleteTeam(teamId) {
    try {
        const response = await fetch(`/api/teams/${teamId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Ошибка при удалении команды');
        }

        // Перезагружаем список команд после успешного удаления
        await loadTeams();
        
        // Показываем уведомление об успешном удалении
        alert('Команда успешно удалена');
        
    } catch (error) {
        console.error('Ошибка при удалении команды:', error);
        alert('Ошибка при удалении команды');
    }
}

// Обработчик отправки формы команды
async function handleTeamSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const teamId = form.dataset.editId;
    
    try {
        const url = teamId ? `/api/teams/${teamId}` : '/api/teams';
        const method = teamId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Ошибка при сохранении команды');
        }

        // Сброс формы
        form.reset();
        delete form.dataset.editId;
        form.querySelector('button[type="submit"]').textContent = 'Добавить команду';
        
        await loadTeams();
        alert(teamId ? 'Команда успешно обновлена!' : 'Команда успешно добавлена!');
    } catch (error) {
        console.error('Ошибка:', error);
        alert(error.message);
    }
}

// Инициализация обработчиков
document.addEventListener('DOMContentLoaded', () => {
    const teamForm = document.getElementById('team-form');
    if (teamForm) {
        teamForm.addEventListener('submit', handleTeamSubmit);
    }
    
    // Загружаем команды при загрузке страницы
    loadTeams();
});

// Функция загрузки списка команд
async function loadTeamsForSelect(selectElement) {
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();
        
        // Сохраняем текущее выбранное значение
        const currentValue = selectElement.value;
        
        // Очищаем список и добавляем первый пустой option
        selectElement.innerHTML = '<option value="">Выберите команду</option>';
        
        // Добавляем команды в список
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            // Если это была выбранная команда, отмечаем её
            if (currentValue === team.id.toString()) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка при загрузке списка команд:', error);
    }
}

// Функция инициализации формы игрока
function initPlayerForm() {
    const teamSelect = document.querySelector('select[name="teamId"]');
    if (teamSelect) {
        // Загружаем команды при загрузке страницы
        loadTeamsForSelect(teamSelect);

        // Обновляем список команд при открытии select
        teamSelect.addEventListener('mousedown', function() {
            loadTeamsForSelect(this);
        });
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initPlayerForm();
});

// Обновляем обработчик редактирования игрока
function editPlayer(playerId) {
    fetch(`/api/players/${playerId}`)
        .then(response => response.json())
        .then(player => {
            const form = document.getElementById('player-form');
            form.dataset.editId = playerId;
            form.querySelector('input[name="nickname"]').value = player.nickname;
            form.querySelector('input[name="realName"]').value = player.realName || '';
            form.querySelector('input[name="steam64"]').value = player.steam64;
            
            const teamSelect = form.querySelector('select[name="teamId"]');
            // Загружаем команды и устанавливаем выбранную
            loadTeamsForSelect(teamSelect).then(() => {
                if (player.teamId) {
                    teamSelect.value = player.teamId;
                }
            });

            form.querySelector('button[type="submit"]').textContent = 'Сохранить изменения';
            
            // Прокручиваем к форме
            form.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            console.error('Ошибка при загрузке данных игрока:', error);
            alert('Ошибка при загрузке данных игрока');
        });
}

// Обновляем обработчик отправки формы
async function handlePlayerSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const playerId = form.dataset.editId;
    
    try {
        const url = playerId ? `/api/players/${playerId}` : '/api/players';
        const method = playerId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Ошибка при сохранении игрока');
        }

        // Очищаем форму и сбрасываем состояние редактирования
        form.reset();
        form.removeAttribute('data-edit-id');
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Добавить игрока';
        
        // Обновляем список игроков
        await loadPlayers();
        alert(playerId ? 'Игрок успешно обновлен!' : 'Игрок успешно добавлен!');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при сохранении игрока: ' + error.message);
    }
}

// Функция поиска игроков
function searchPlayers(query) {
    const searchQuery = query.toLowerCase();
    document.querySelectorAll('.player-row').forEach(row => {
        const nicknameElement = row.querySelector('.player-nickname');
        const steam64Element = row.querySelector('.player-steam64');
        
        if (!nicknameElement || !steam64Element) {
            console.warn('Не найдены необходимые элементы для строки игрока:', row);
            return; // Пропускаем эту строку
        }
        
        const nickname = nicknameElement.textContent.toLowerCase();
        const steam64 = steam64Element.textContent.toLowerCase();
        
        // Показываем/скрываем строку в зависимости от совпадения
        const matches = nickname.includes(searchQuery) || steam64.includes(searchQuery);
        row.style.display = matches ? '' : 'none';
    });
}

// Обновляем добавление обработчика поиска
function initializeSearch() {
    const searchInput = document.getElementById('playerSearch');
    if (searchInput) {
        // Удаляем старый обработчик, если он есть
        const oldHandler = searchInput.onInput;
        if (oldHandler) {
            searchInput.removeEventListener('input', oldHandler);
        }
        
        // Добавляем новый обработчик с debounce
        searchInput.addEventListener('input', debounce((e) => {
            if (document.querySelector('.players-table')) {
                searchPlayers(e.target.value);
            }
        }, 300));
    }
}

// Функция debounce для оптимизации поиска
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Обновляем функцию loadPlayers
async function loadPlayers() {
    try {
        const response = await fetch('/api/players');
        const players = await response.json();
        
        const playersList = document.getElementById('players-list');
        if (playersList) {
            playersList.innerHTML = `
                <div class="players-controls">
                    <input data-i18n="playerSearchPlaceholder" type="text" id="playerSearch" placeholder="Поиск по никнейму или Steam64" class="search-input">
                </div>
                <div class="players-table-container">
                    <table class="players-table">
                        <thead>
                            <tr>
                                <th width="60" data-i18n="avatar">Аватар</th>
                                <th data-i18n="nickname">Никнейм</th>
                                <th data-i18n="realName">Реальное имя</th>
                                <th data-i18n="steam64">Steam64</th>
                                <th data-i18n="team">Команда</th>
                                <th width="150" data-i18n="actions">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${players.map(player => `
                                <tr class="player-row" data-id="${player.id}">
                                    <td class="avatar-cell">
                                        <div class="avatar-container">
                                            <img src="${player.avatar || '/images/default-avatar.png'}" 
                                                 class="player-avatar" 
                                                 alt="${player.nickname}"
                                                 onerror="this.src='/images/default-avatar.png'">
                                        </div>
                                    </td>
                                    <td class="player-nickname">${player.nickname}</td>
                                    <td>${player.realName || '-'}</td>
                                    <td class="player-steam64">${player.steam64}</td>
                                    <td>${player.teamName || '-'}</td>
                                    <td class="player-actions">
                                        <button class="edit-btn" onclick="editPlayer(${player.id})" data-i18n="editPlayer">Редактировать</button>
                                        <button class="delete-btn" onclick="deletePlayer(${player.id})" data-i18n="deletePlayer">Удалить</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            // Инициализируем поиск после загрузки таблицы
            initializeSearch();
        }
    } catch (error) {
        console.error('Ошибка загрузки игроков:', error);
    }
}

async function deletePlayer(playerId) {
    try {
        const response = await fetch(`/api/players/${playerId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Ошибка при удалении игрока');
        }

        // Перезагружаем список игроков после успешного удаления
        await loadPlayers();
        
        // Показываем уведомление об успешном удалении
        alert('Игрок успешно удален');
        
    } catch (error) {
        console.error('Ошибка при удалении игрока:', error);
        alert('Ошибка при удалении игрока');
    }
}

async function loadHUDs() {
    try {
        const response = await fetch('/api/huds');
        const huds = await response.json();
        
        const hudsList = document.getElementById('huds-list');
        if (hudsList) {
            hudsList.innerHTML = `
                <div class="players-controls">
                    <input data-i18n="hudSearchPlaceholder" type="text" id="hudSearch" placeholder="Поиск по названию HUD" class="search-input">
                </div>
                <h3 data-i18n="closeOverlayHint">ALT+Q - Закрыть оверлей</h3>
                <h3 data-i18n="toggleOverlayHint">ALT+X - Свернуть/Развернуть оверлей</h3>
                <div class="players-table-container">
                    <table class="players-table">
                        <thead>
                            <tr>
                                <th width="60" data-i18n="preview">Превью</th>
                                <th data-i18n="name">Название</th>
                                <th data-i18n="description">Описание</th>
                                <th width="300" data-i18n="actions">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${huds.map(hud => `
                                <tr class="hud-row" data-hud-id="${hud.id}">
                                    <td class="preview-cell">
                                        <div class="preview-container">
                                            <img src="/huds/${hud.id}/preview.png" 
                                                class="hud-preview" 
                                                alt="${hud.name}"
                                                onerror="this.src='/images/default-hud.png'">
                                        </div>
                                    </td>
                                    <td>${hud.name}</td>
                                    <td>${hud.description || '-'}</td>
                                    <td class="hud-actions">
                                        <button class="copy-url-btn" onclick="copyHUDUrl('${hud.id}')" data-i18n="copyHUDUrl">
                                            ${i18n('copyHUDUrl')}
                                        </button>
                                        <a href="/hud/${hud.id}" target="_blank" class="button" data-i18n="openInBrowser">
                                            ${i18n('openInBrowser')}
                                        </a>
                                        <button class="overlay-button" data-hud="${hud.id}" data-i18n="launchOverlay">
                                            ${i18n('launchOverlay')}
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            // Добавляем обработчики для кнопок оверлея
            hudsList.querySelectorAll('.overlay-button').forEach(button => {
                button.addEventListener('click', () => {
                    const hudId = button.dataset.hud;
                    if (window.overlayManager) {
                        window.overlayManager.startOverlay(hudId);
                    }
                });
            });

            // Инициализируем поиск
            initializeHUDSearch();
        }
    } catch (error) {
        console.error('Ошибка загрузки HUD:', error);
    }
}

// ... existing code ...

// Обновленная функция копирования ссылки HUD
function copyHUDUrl(hudId) {
    const url = `${window.location.origin}/hud/${hudId}`;
    
    // Создаем временный input элемент
    const tempInput = document.createElement('input');
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    tempInput.value = url;
    document.body.appendChild(tempInput);

    try {
        // Выбираем текст
        tempInput.select();
        tempInput.setSelectionRange(0, 99999); // Для мобильных устройств

        // Пытаемся скопировать
        const successful = document.execCommand('copy');
        if (successful) {
            alert(i18n('copyHUDUrlSuccess'));
        } else {
            throw new Error(i18n('copyHUDUrlError'));
        }
    } catch (err) {
        console.error('Ошибка при копировании:', err);
        // Показываем ссылку пользователю для ручного копирования
        prompt(i18n('copyHUDUrlManual'), url);
    } finally {
        // Удаляем временный элемент
        document.body.removeChild(tempInput);
    }
}

// ... existing code ...

// Функция поиска HUD'ов
function searchHUDs(query) {
    const searchQuery = query.toLowerCase();
    const hudRows = document.querySelectorAll('.hud-row');
    
    requestAnimationFrame(() => {
        hudRows.forEach(row => {
            const nameElement = row.children[1]; // Название находится во втором столбце
            const descElement = row.children[2]; // Описание в третьем столбце
            
            if (!nameElement || !descElement) return;
            
            const name = nameElement.textContent.toLowerCase();
            const description = descElement.textContent.toLowerCase();
            
            row.style.display = (name.includes(searchQuery) || 
                               description.includes(searchQuery)) ? '' : 'none';
        });
    });
}

// Инициализация поиска HUD'ов
function initializeHUDSearch() {
    const searchInput = document.getElementById('hudSearch');
    if (!searchInput) return;

    const debouncedSearch = debounce((e) => {
        requestAnimationFrame(() => {
            searchHUDs(e.target.value);
        });
    }, 300);

    searchInput.addEventListener('input', debouncedSearch);
}

// Глобальные переменные
let socket;
let pauseUpdates = false;
let lastTableHTML = '';
let previousScores = {
    ct: '0',
    t: '0'
};

// ... existing code ...

// Обновляем функцию updateGameInfo для использования данных из текущего матча
async function updateGameInfo() {
    const scoreboardSection = document.getElementById('scoreboard-section');
    if (!scoreboardSection?.classList.contains('active') || !gsiDataBuffer) {
        return;
    }

    try {
        const data = gsiDataBuffer;
        
        // Получаем данные текущего матча
        const currentMatch = await getCurrentMatch();
        
        // Получаем названия команд и лого
        const ctName = data.map?.team_ct?.name || currentMatch.team1_name;
        const tName = data.map?.team_t?.name || currentMatch.team2_name;
        const ctLogo = currentMatch.team1_logo;
        const tLogo = currentMatch.team2_logo;
        
        // Обновляем счет команд
        const ctScore = data.map?.team_ct?.score || '0';
        const tScore = data.map?.team_t?.score || '0';
        
        // Обновляем таблицу только если нет паузы
        const statsTable = document.querySelector('#scoreboard-section .player-stats-table');
        if (!statsTable) return;

        if (!pauseUpdates) {
            const newTableHTML = `
                <div class="scoreboard-header">
                    <div class="team-info">
                        <img src="${ctLogo}" alt="${ctName}" class="team-logo" onerror="this.src='/images/default-team-logo.png'">
                        <span class="team-name" data-i18n="teamName">${ctName}</span>
                    </div>
                    <div class="team-score ct">
                        <span class="score" data-i18n="score">${ctScore}</span>
                    </div>
                    <div class="score-divider">:</div>
                    <div class="team-score t">
                        <span class="score" data-i18n="score">${tScore}</span>
                    </div>
                    <div class="team-info">
                        <span class="team-name" data-i18n="teamName">${tName}</span>
                        <img src="${tLogo}" alt="${tName}" class="team-logo" onerror="this.src='/images/default-team-logo.png'">
                    </div>
                </div>
                <table class="players-table">
                    <thead>
                        <tr>
                            <th data-i18n="playerName">Игрок</th>
                            <th data-i18n="steam64">Steam64</th>
                            <th data-i18n="team">Команда</th>
                            <th data-i18n="kills">Убийства</th>
                            <th data-i18n="deaths">Смерти</th>
                            <th data-i18n="assists">Помощь</th>
                            <th data-i18n="mvps">MVP</th>
                            <th data-i18n="score">Счёт</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(data.allplayers || {}).map(([steamid, player]) => `
                            <tr class="player-row ${player.team.toLowerCase()}">
                                <td class="selectable" title="Выделите текст для копирования" data-i18n="playerName">${player.name}</td>
                                <td class="selectable" title="Выделите текст для копирования" data-i18n="steam64">${steamid}</td>
                                <td>${player.team === 'CT' ? ctName : tName}</td>
                                <td>${player.match_stats?.kills || 0}</td>
                                <td>${player.match_stats?.deaths || 0}</td>
                                <td>${player.match_stats?.assists || 0}</td>
                                <td>${player.match_stats?.mvps || 0}</td>
                                <td>${player.match_stats?.score || 0}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            
            if (newTableHTML !== lastTableHTML) {
                statsTable.innerHTML = newTableHTML;
                lastTableHTML = newTableHTML;
            }
        }

    } catch (error) {
        console.error('Ошибка обновления данных:', error);
    }
}

// Функция для получения текущего матча
async function getCurrentMatch() {
    try {
        // Получаем список матчей
        const response = await fetch('/api/matches');
        if (!response.ok) {
            throw new Error('Ошибка при получении списка матчей');
        }

        const matches = await response.json();
        
        // Ищем активный матч
        const currentMatch = matches.find(match => match.status === 'active');
        
        if (currentMatch) {
            return {
                team1_logo: currentMatch.team1_logo || '/images/default-team-logo.png',
                team2_logo: currentMatch.team2_logo || '/images/default-team-logo.png',
                team1_name: currentMatch.team1_name || 'Команда 1',
                team2_name: currentMatch.team2_name || 'Команда 2',
                format: currentMatch.format || 'bo1',
                maps: currentMatch.maps || []
            };
        } else {
            // Если активного матча нет, возвращаем значения по умолчанию
            return {
                team1_logo: '/images/default-team-logo.png',
                team2_logo: '/images/default-team-logo.png',
                team1_name: 'Команда 1',
                team2_name: 'Команда 2',
                format: 'bo1',
                maps: []
            };
        }
    } catch (error) {
        console.error('Ошибка при получении текущего матча:', error);
        // Возвращаем значения по умолчанию в случае ошибки
        return {
            team1_logo: '/images/default-team-logo.png',
            team2_logo: '/images/default-team-logo.png',
            team1_name: 'Команда 1',
            team2_name: 'Команда 2',
            format: 'bo1',
            maps: []
        };
    }
}

// Обработка ошибок
window.addEventListener('error', (event) => {
    console.error('Глобальная ошибка:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Необработанное отклонение промиса:', event.reason);
});

// ... existing code ...

// Удалите или закомментируйте этот код
/*
document.querySelector('.main-content').innerHTML += `
    <button id="openCreateMatch" class="primary-btn">Создать матч</button>
`;
*/

// Вместо этого, добавим обработчики для существующих элементов
document.addEventListener('DOMContentLoaded', () => {
    // Находим существующую кнопку
    const openBtn = document.getElementById('openCreateMatch');
    const closeBtn = document.getElementById('closeMatchModal');
    const modal = document.getElementById('createMatchModal');
    const matchSection = document.getElementById('match-section');

    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            // Скрываем секцию создания матча
            if (matchSection) {
                matchSection.style.display = 'none';
            }
            // Показываем модальное окно
            modal.style.display = 'block';
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            // Показываем секцию создания матча
            if (matchSection) {
                matchSection.style.display = 'block';
            }
        });
    }

    // Закрытие по клику вне модального окна
    if (modal) {
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                // Показываем секцию создания матча
                if (matchSection) {
                    matchSection.style.display = 'block';
                }
            }
        });
    }
});

// Инициализация создателя матчей только если все необходимые элементы существуют
if (document.getElementById('createMatchModal')) {

}

// Объединенная функция для загрузки команд в селекты
async function loadTeamsForSelect(selectElement, selectedValue = '') {
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();
        
        selectElement.innerHTML = '<option data-i18n="selectTeam" value="">Выберите команду</option>';
        
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            if (selectedValue && selectedValue.toString() === team.id.toString()) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка при загрузке списка команд:', error);
        selectElement.innerHTML = '<option data-i18n="selectTeamError" value="">Ошибка загрузки команд</option>';
    }
}

// Объединенная функция инициализации формы матча
function initMatchForm() {
    const matchForm = document.getElementById('match-form');
    const team1Select = document.querySelector('select[name="team1"]');
    const team2Select = document.querySelector('select[name="team2"]');
    const swapTeamsBtn = document.getElementById('swapTeamsBtn');

    // Добавляем обработчик для кнопки смены сторон
    if (swapTeamsBtn) {
        swapTeamsBtn.addEventListener('click', () => {
            // Сохраняем текущие значения
            const team1Value = team1Select.value;
            const team2Value = team2Select.value;

            // Меняем значения местами
            team1Select.value = team2Value;
            team2Select.value = team1Value;

            // Добавляем анимацию вращения кнопки
            swapTeamsBtn.style.transform = 'rotate(180deg)';
            setTimeout(() => {
                swapTeamsBtn.style.transform = 'rotate(0deg)';
            }, 300);
        });
    }

    // Загружаем команды при загрузке страницы
    if (team1Select && team2Select) {
        loadTeamsForSelect(team1Select);
        loadTeamsForSelect(team2Select);

        // Обновляем списки при открытии
        team1Select.addEventListener('mousedown', () => loadTeamsForSelect(team1Select, team1Select.value));
        team2Select.addEventListener('mousedown', () => loadTeamsForSelect(team2Select, team2Select.value));
    }

    // Обработка отправки формы
    if (matchForm) {
        matchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Форма отправляется...'); // Отладочный вывод

            // Проверка на выбор одинаковых команд
            if (team1Select.value === team2Select.value && team1Select.value !== '') {
                alert('Нельзя выбрать одну и ту же команду');
                return;
            }

            // Сохраняем текущие значения
            const currentValues = {
                team1: team1Select.value,
                team2: team2Select.value,
                matchName: matchForm.querySelector('input[name="matchName"]').value,
                map: matchForm.querySelector('select[name="map"]').value,
                format: matchForm.querySelector('select[name="format"]').value
            };

            // Собираем все данные формы
            const matchData = {
                team1_id: currentValues.team1,
                team2_id: currentValues.team2,
                match_name: currentValues.matchName,
                map: currentValues.map,
                format: currentValues.format || 'bo1'
            };

            console.log('Отправляемые данные:', matchData);

            try {
                const response = await fetch('/api/matches', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(matchData)
                });

                console.log('Статус ответа:', response.status);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Ошибка при создании матча');
                }

                const result = await response.json();
                console.log('Результат:', result);

                alert(i18n('matchCreatedSuccess'));
                
                // Обновляем списки команд, сохраняя выбранные значения
                if (team1Select && team2Select) {
                    await loadTeamsForSelect(team1Select, currentValues.team1);
                    await loadTeamsForSelect(team2Select, currentValues.team2);
                }
                
                // Восстанавливаем значения в форме
                team1Select.value = currentValues.team1;
                team2Select.value = currentValues.team2;
                matchForm.querySelector('input[name="matchName"]').value = currentValues.matchName;
                matchForm.querySelector('select[name="map"]').value = currentValues.map;
                matchForm.querySelector('select[name="format"]').value = currentValues.format;
                
                // Обновляем список матчей
                await loadMatchesList();
            } catch (error) {
                console.error('Ошибка:', error);
                alert(error.message || 'Ошибка при создании матча');
            }
        });
    }
    
    // Обработчик для модального окна создания матча
    const createMatchForm = document.getElementById('createMatchForm');
    if (createMatchForm) {
        createMatchForm.onsubmit = async (e) => {
            e.preventDefault();
            
            try {
                const team1Id = document.getElementById('team1Select')?.value;
                const team2Id = document.getElementById('team2Select')?.value;

                if (!team1Id || !team2Id) {
                    alert(i18n('pleaseSelectBothTeams'));
                    return;
                }

                const response = await fetch('/api/matches', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        team1_id: team1Id,
                        team2_id: team2Id
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Ошибка при создании матча');
                }

                // Безопасно получаем и проверяем модальное окно
                const modal = document.getElementById('createMatchModal');
                if (modal) {
                    modal.style.display = 'none';
                }
                
                // Обновляем список матчей
                await loadMatchesList();
                
                // Очищаем форму
                createMatchForm.reset();

            } catch (error) {
                console.error('Ошибка:', error);
                alert(i18n('matchCreateError'));
            }
        };
    }
}
/*
// Добавляем функцию updateMapsContainer
function updateMapsContainer() {
    const formatSelect = document.getElementById('editFormat');
    const mapsContainer = document.querySelector('.maps-container');
    
    if (!formatSelect || !mapsContainer) {
        console.error('Не найдены необходимые элементы для обновления карт');
        return;
    }
    
    const format = formatSelect.value;
    let mapCount = 1; // По умолчанию одна карта
    
    // Определяем количество карт в зависимости от формата
    if (format === 'bo3') {
        mapCount = 3;
    } else if (format === 'bo2') {
        mapCount = 2;
    } else if (format === 'bo5') {
        mapCount = 5;
    }
    
    // Очищаем контейнер
    mapsContainer.innerHTML = '';
    
    // Создаем элементы для каждой карты
    for (let i = 0; i < mapCount; i++) {
        const mapItem = document.createElement('div');
        mapItem.className = 'map-item';
        
        mapItem.innerHTML = `
            <div class="map-number">Карта ${i + 1}</div>
            <select class="map-select">
                <option value="">Выберите карту</option>
                <option value="de_dust2">Dust II</option>
                <option value="de_mirage">Mirage</option>
                <option value="de_inferno">Inferno</option>
                <option value="de_nuke">Nuke</option>
                <option value="de_overpass">Overpass</option>
                <option value="de_vertigo">Vertigo</option>
                <option value="de_ancient">Ancient</option>
                <option value="de_anubis">Anubis</option>
                <option value="de_train">Train</option>
            </select>
            <select class="pick-team-select">
                <option value="">Выбор команды</option>
                <option value="team1">Команда 1</option>
                <option value="team2">Команда 2</option>
            </select>
        `;
        
        mapsContainer.appendChild(mapItem);
    }
    
    // Обновляем названия команд в селекторах выбора
    const team1Element = document.getElementById('editTeam1');
    const team2Element = document.getElementById('editTeam2');
    
    if (team1Element && team2Element) {
        const team1Name = team1Element.options[team1Element.selectedIndex]?.text || 'Команда 1';
        const team2Name = team2Element.options[team2Element.selectedIndex]?.text || 'Команда 2';
        
        document.querySelectorAll('.pick-team-select').forEach(select => {
            const team1Option = select.querySelector('option[value="team1"]');
            const team2Option = select.querySelector('option[value="team2"]');
            
            if (team1Option) team1Option.textContent = team1Name;
            if (team2Option) team2Option.textContent = team2Name;
        });
    }
}*/

// Обновляем функцию редактирования матча для сохранения выбранных карт
window.editMatch = async function(matchId) {
    try {
        // Получаем данные матча
        const response = await fetch(`/api/matches/${matchId}`);
        if (!response.ok) throw new Error('Ошибка при загрузке данных матча');
        const match = await response.json();

        // Находим модальное окно и его элементы
        const modal = document.getElementById('editMatchModal');
        if (!modal) {
            console.error('Модальное окно редактирования не найдено');
            return;
        }

        // Находим форму и элементы формы
        const form = document.getElementById('editMatchForm');
        if (!form) {
            console.error('Форма редактирования не найдена');
            return;
        }

        // Скрываем все контейнеры карт
        document.querySelectorAll('.maps-container').forEach(container => {
            container.style.display = 'none';
        });

        // Находим или создаем контейнер для текущего матча
        const mapsContainerId = `maps-container-${matchId}`;
        let mapsContainer = document.getElementById(mapsContainerId);
        if (!mapsContainer) {
            mapsContainer = createMapsContainer(matchId, form);
        }
        mapsContainer.style.display = 'block'; // Показываем контейнер для текущего матча

        // Находим все необходимые элементы формы
        const elements = {
            team1: document.getElementById('editTeam1'),
            team2: document.getElementById('editTeam2'),
            format: document.getElementById('editFormat'),
            mapsContainer: mapsContainer,
            swapBtn: document.getElementById('editSwapTeamsBtn')
        };

        // Проверяем наличие всех необходимых элементов
        for (const [key, element] of Object.entries(elements)) {
            if (!element) {
                console.error(`Элемент ${key} не найден в форме редактирования`);
                return;
            }
        }

        // Загружаем команды в селекты
        await Promise.all([
            loadTeamsForSelect(elements.team1, match.team1_id),
            loadTeamsForSelect(elements.team2, match.team2_id)
        ]);

        // Устанавливаем значения формы
        elements.team1.value = match.team1_id;
        elements.team2.value = match.team2_id;
        elements.format.value = match.format || 'bo1';

        // Обновляем названия команд в селекторах выбора
        const team1Name = elements.team1.options[elements.team1.selectedIndex]?.text || 'Команда 1';
        const team2Name = elements.team2.options[elements.team2.selectedIndex]?.text || 'Команда 2';

        // Обновляем контейнер карт при изменении формата
        elements.format.addEventListener('change', updateMapsContainerWithElements);
        
        // Инициализируем контейнер карт
        updateMapsContainerWithElements();

        // Добавляем обработчик для кнопки свапа
        if (elements.swapBtn) {
            elements.swapBtn.onclick = () => {
                const team1Value = elements.team1.value;
                const team2Value = elements.team2.value;
                elements.team1.value = team2Value;
                elements.team2.value = team1Value;

                // Анимация кнопки
                elements.swapBtn.style.transform = 'rotate(180deg)';
                setTimeout(() => {
                    elements.swapBtn.style.transform = 'rotate(0deg)';
                }, 300);
                
                // Обновляем названия команд в селекторах после свапа
                updateMapsContainerWithElements();
            };
        }

        // Создаем замыкание для функции updateMapsContainer с доступом к elements и match
        // Обновляем функцию updateMapsContainerWithElements для добавления кнопки редактирования счета
const updateMapsContainerWithElements = () => {
    const formatSelect = elements.format;
    const mapsContainer = elements.mapsContainer;
    
    if (!formatSelect || !mapsContainer) {
        console.error('Не найдены необходимые элементы для обновления карт');
        return;
    }
    
    const format = formatSelect.value;
    let mapCount = 1; // По умолчанию одна карта
    
    // Определяем количество карт в зависимости от формата
    if (format === 'bo3') {
        mapCount = 3;
    } else if (format === 'bo2') {
        mapCount = 2;
    } else if (format === 'bo5') {
        mapCount = 5;
    }
    
    // Сохраняем текущие выбранные карты
    const currentMaps = Array.from(mapsContainer.querySelectorAll('.map-item')).map(item => ({
        mapId: item.querySelector('.map-select').value,
        pickTeam: item.querySelector('.pick-team-select').value
    }));

    // Очищаем контейнер
    mapsContainer.innerHTML = '';

    // Создаем элементы для каждой карты
    for (let i = 0; i < mapCount; i++) {
        const mapItem = document.createElement('div');
        mapItem.className = 'map-item';
        
        mapItem.innerHTML = `
            <div class="map-number">${i18n('mapNumber').replace('{0}', i + 1)}</div>
            <select id="map-select" class="map-select">
                <option data-i18n="mapSelect" value="">Выберите карту</option>
                <option value="de_dust2">Dust II</option>
                <option value="de_mirage">Mirage</option>
                <option value="de_inferno">Inferno</option>
                <option value="de_nuke">Nuke</option>
                <option value="de_overpass">Overpass</option>
                <option value="de_vertigo">Vertigo</option>
                <option value="de_ancient">Ancient</option>
                <option value="de_anubis">Anubis</option>
                <option value="de_train">Train</option>
            </select>
            <select id="pick-team-select" class="pick-team-select">
                <option data-i18n="pickTeam" value="">Выбор команды 2</option>
                <option value="team1">${team1Name}</option>
                <option value="team2">${team2Name}</option>
                <option value="DECIDER">DECIDER</option>
            </select>
            <button data-i18n="editScore2" class="edit-score-btn" data-map-index="${i}">Редактировать счет</button>
        `;
        
        mapsContainer.appendChild(mapItem);

        // Восстанавливаем сохраненные значения карт, если они есть
        if (currentMaps[i]) {
            mapItem.querySelector('.map-select').value = currentMaps[i].mapId;
            mapItem.querySelector('.pick-team-select').value = currentMaps[i].pickTeam;
        }
    }
    
    // Добавляем обработчики для кнопок редактирования счета
    mapsContainer.querySelectorAll('.edit-score-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const mapIndex = button.dataset.mapIndex;
            const mapSelect = button.parentElement.querySelector('.map-select');
            const mapName = mapSelect.options[mapSelect.selectedIndex].text;
            openScoreEditModal(matchId, mapIndex, mapName);
        });
    });
};


        // Обновляем контейнер карт при изменении формата
        elements.format.addEventListener('change', updateMapsContainerWithElements);
        
        // Инициализируем контейнер карт
        updateMapsContainerWithElements();

        // Добавляем обработчик для кнопки свапа
        if (elements.swapBtn) {
            elements.swapBtn.onclick = () => {
                const team1Value = elements.team1.value;
                const team2Value = elements.team2.value;
                elements.team1.value = team2Value;
                elements.team2.value = team1Value;

                // Анимация кнопки
                elements.swapBtn.style.transform = 'rotate(180deg)';
                setTimeout(() => {
                    elements.swapBtn.style.transform = 'rotate(0deg)';
                }, 300);
                
                // Обновляем названия команд в селекторах после свапа
                updateMapsContainerWithElements();
            };
        }

        // Обработчик отправки формы
        form.onsubmit = async (e) => {
            e.preventDefault();
            try {
                // Проверяем выбор одинаковых команд
                if (elements.team1.value === elements.team2.value && elements.team1.value !== '') {
                    alert('Нельзя выбрать одну и ту же команду');
                    return;
                }

                // Собираем данные о картах
                const maps = Array.from(elements.mapsContainer.querySelectorAll('.map-item'))
                    .map(item => ({
                        mapId: item.querySelector('.map-select').value,
                        pickTeam: item.querySelector('.pick-team-select').value
                    }))
                    .filter(map => map.mapId !== '');

                const formData = {
                    team1_id: parseInt(elements.team1.value),
                    team2_id: parseInt(elements.team2.value),
                    format: elements.format.value,
                    maps: maps
                };

                console.log('Отправляемые данные:', formData);

                const updateResponse = await fetch(`/api/matches/${matchId}/update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    console.error('Ответ сервера:', errorText);
                    throw new Error('Ошибка при обновлении матча: ' + updateResponse.status);
                }

                const result = await updateResponse.json();
                console.log('Результат обновления:', result);

                if (result.success) {
                    modal.style.display = 'none';
                    alert(i18n('matchUpdatedSuccess'));
                    await loadMatchesList();
                } else {
                    throw new Error(result.message || 'Неизвестная ошибка при обновлении матча');
                }
            } catch (error) {
                console.error('Ошибка при сохранении:', error);
                alert(i18n('matchSaveError'));
            }
        };

        // Обработчики закрытия модального окна
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }

        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

        // Показываем модальное окно
        modal.style.display = 'block';

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных матча: ' + error.message);
    }
};

// Функция для создания контейнера карт для конкретного матча
function createMapsContainer(matchId, form) {
    const container = document.createElement('div');
    container.id = `maps-container-${matchId}`;
    container.className = 'maps-container';
    form.appendChild(container); // Добавляем контейнер в форму редактирования
    return container;
}

// Объединенный обработчик DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    // Сначала получаем информацию о сервере
    await initializeServerInfo();
    
    // Инициализация основных компонентов
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Показываем только секцию матча по умолчанию
    const matchSection = document.getElementById('match-section');
    if (matchSection) {
        matchSection.classList.add('active');
    }

    // Отмечаем соответствующую кнопку в меню как активную
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.section === 'match-section') {
            btn.classList.add('active');
        }
    });

    // Инициализируем остальные компоненты
    initializeNavigation();
    initializeGSI();
    loadInitialData();
    initFormHandlers();
    
    // Инициализация формы матча и загрузка списка матчей
    initMatchForm();
    loadMatchesList();
    
    // Загружаем команды в селекты модального окна создания матча
    const team1Select = document.getElementById('team1Select');
    const team2Select = document.getElementById('team2Select');
    
    if (team1Select) {
        loadTeamsForSelect(team1Select);
    }
    
    if (team2Select) {
        loadTeamsForSelect(team2Select);
    }
    
    // Обработчики для модального окна создания матча
    const openBtn = document.getElementById('openCreateMatch');
    const closeBtn = document.getElementById('closeMatchModal');
    const modal = document.getElementById('createMatchModal');

    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            // Обновляем списки команд при открытии модального окна
            if (team1Select) loadTeamsForSelect(team1Select);
            if (team2Select) loadTeamsForSelect(team2Select);
            
            // Скрываем секцию создания матча
            if (matchSection) {
                matchSection.style.display = 'none';
            }
            // Показываем модальное окно
            modal.style.display = 'block';
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            // Показываем секцию создания матча
            if (matchSection) {
                matchSection.style.display = 'block';
            }
        });
    }

    // Закрытие по клику вне модального окна
    if (modal) {
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                // Показываем секцию создания матча
                if (matchSection) {
                    matchSection.style.display = 'block';
                }
            }
        });
    }
});

// Функция для открытия модального окна редактирования счета
// Глобальная функция для обновления контейнера карт
function updateMapsContainerWithElements(elements, team1Name, team2Name, matchId) {
    const formatSelect = elements.format;
    const mapsContainer = elements.mapsContainer;
    
    if (!formatSelect || !mapsContainer) {
        console.error('Не найдены необходимые элементы для обновления карт');
        return;
    }
    
    const format = formatSelect.value;
    let mapCount = 1; // По умолчанию одна карта
    
    // Определяем количество карт в зависимости от формата
    if (format === 'bo3') {
        mapCount = 3;
    } else if (format === 'bo2') {
        mapCount = 2;
    } else if (format === 'bo5') {
        mapCount = 5;
    }
    
    // Сохраняем текущие выбранные карты
    const currentMaps = Array.from(mapsContainer.querySelectorAll('.map-item')).map(item => ({
        mapId: item.querySelector('.map-select').value,
        pickTeam: item.querySelector('.pick-team-select').value
    }));

    // Очищаем контейнер
    mapsContainer.innerHTML = '';

    // Создаем элементы для каждой карты
    for (let i = 0; i < mapCount; i++) {
        const mapItem = document.createElement('div');
        mapItem.className = 'map-item';
        
        mapItem.innerHTML = `
            <div class="map-number"><span data-i18n="mapText">Карта</span> ${i + 1}</div>
            <select id="map-select" class="map-select">
                <option value="">Выберите карту</option>
                <option value="de_dust2">Dust II</option>
                <option value="de_mirage">Mirage</option>
                <option value="de_inferno">Inferno</option>
                <option value="de_nuke">Nuke</option>
                <option value="de_overpass">Overpass</option>
                <option value="de_vertigo">Vertigo</option>
                <option value="de_ancient">Ancient</option>
                <option value="de_anubis">Anubis</option>
                <option value="de_train">Train</option>
            </select>
            <select class="pick-team-select">
                <option data-i18n="pickTeam" value="">Выбор команды</option>
                <option value="team1">${team1Name}</option>
                <option value="team2">${team2Name}</option>
                <option value="DECIDER">DECIDER</option>
            </select>
            <button class="edit-score-btn" data-map-index="${i}" data-i18n="editScore">Редактировать счет</button>
        `;
        
        mapsContainer.appendChild(mapItem);

        // Восстанавливаем сохраненные значения карт, если они есть
        if (currentMaps[i]) {
            mapItem.querySelector('.map-select').value = currentMaps[i].mapId;
            mapItem.querySelector('.pick-team-select').value = currentMaps[i].pickTeam;
        }
    }
    
    // Добавляем обработчики для кнопок редактирования счета
    mapsContainer.querySelectorAll('.edit-score-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const mapIndex = button.dataset.mapIndex;
            const mapSelect = button.parentElement.querySelector('.map-select');
            const mapName = mapSelect.options[mapSelect.selectedIndex].text;
            openScoreEditModal(matchId, mapIndex, mapName);
        });
    });
}

// Функция для открытия модального окна редактирования счета
// Функция для открытия модального окна редактирования счета
function openScoreEditModal(matchId, mapIndex, mapName) {
    // Получаем данные о матче и его картах
    fetch(`/api/matches/${matchId}`)
        .then(response => {
            if (!response.ok) throw new Error('Ошибка при загрузке данных матча');
            return response.json();
        })
        .then(matchData => {
            console.log('Данные матча:', matchData);
            
            // Получаем данные о матче и картах
            const match = matchData;
            const maps = matchData.maps || [];
            
            const team1Name = match.team1_name || 'Команда 1';
            const team2Name = match.team2_name || 'Команда 2';
            
            // Получаем данные о текущей карте
            const currentMap = maps[mapIndex] || {};
            const team1Score = currentMap.score_team1 || 0;
            const team2Score = currentMap.score_team2 || 0;
            
            // Определяем текущего победителя
            let currentWinner = '';
            if (currentMap.winner_team === team1Name) {
                currentWinner = 'team1';
            } else if (currentMap.winner_team === team2Name) {
                currentWinner = 'team2';
            }
            
            // Проверяем, существует ли уже модальное окно
            let scoreModal = document.getElementById('scoreEditModal');
            
            // Если модального окна нет, создаем его
            if (!scoreModal) {
                scoreModal = document.createElement('div');
                scoreModal.id = 'scoreEditModal';
                scoreModal.className = 'modal';
                
                // Создаем содержимое модального окна
                scoreModal.innerHTML = `
                    <div class="modal-content">
                        <span class="close">&times;</span>
                        <h2 data-i18n="editScore3">Редактирование счета</h2>
                        <div id="scoreEditContent"></div>
                    </div>
                `;
                
                // Добавляем модальное окно в DOM
                document.body.appendChild(scoreModal);
                
                // Добавляем обработчик для закрытия модального окна
                const closeBtn = scoreModal.querySelector('.close');
                closeBtn.onclick = () => {
                    scoreModal.style.display = 'none';
                };
                
                // Закрытие по клику вне модального окна
                window.addEventListener('click', (e) => {
                    if (e.target === scoreModal) {
                        scoreModal.style.display = 'none';
                    }
                });
            }
            
            // Получаем содержимое модального окна
            const scoreEditContent = document.getElementById('scoreEditContent');
            
            // Заполняем содержимое модального окна
            scoreEditContent.innerHTML = `
                <form id="scoreEditForm" data-match-id="${matchId}" data-map-index="${mapIndex}">
                    <div class="map-info">
                        <h3 data-i18n="mapName">${mapName}</h3>
                        <p data-i18n="mapStatus">Статус: ${currentMap.status || 'pending'}</p>
                    </div>
                    <div class="score-edit-container">
                        <div class="team-score-edit">
                            <input type="number" id="team1Score" name="team1Score" min="0" max="99" value="${team1Score}">
                        </div>
                        <div class="team-score-edit">
                            <input type="number" id="team2Score" name="team2Score" min="0" max="99" value="${team2Score}">
                        </div>
                    </div>
                    <div class="winner-select-container">
                        <label for="winnerSelect" data-i18n="winnerSelect">Победитель карты:</label>
                        <select id="winnerSelect" name="winnerSelect">
                            <option data-i18n="winnerSelect" value="">Не выбрано</option>
                            <option value="team1" ${currentWinner === 'team1' ? 'selected' : ''}>${team1Name}</option>
                            <option value="team2" ${currentWinner === 'team2' ? 'selected' : ''}>${team2Name}</option>
                        </select>
                    </div>
                    <button type="submit" data-i18n="saveScore">Сохранить счет</button>
                </form>
            `;
            
            // Добавляем обработчик отправки формы
            const scoreEditForm = document.getElementById('scoreEditForm');
            scoreEditForm.onsubmit = async (e) => {
                e.preventDefault();
                
                const matchId = scoreEditForm.dataset.matchId;
                const mapIndex = scoreEditForm.dataset.mapIndex;
                const team1Score = document.getElementById('team1Score').value;
                const team2Score = document.getElementById('team2Score').value;
                const winner = document.getElementById('winnerSelect').value;
                
                try {
                    // Отправляем данные на сервер
                    const response = await fetch(`/api/matches/${matchId}/map-score`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            mapIndex: parseInt(mapIndex),
                            team1Score: parseInt(team1Score),
                            team2Score: parseInt(team2Score),
                            winner: winner,
                            team1Name: team1Name,
                            team2Name: team2Name
                        })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Ошибка при обновлении счета');
                    }
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Закрываем модальное окно
                        scoreModal.style.display = 'none';
                        
                        // Показываем сообщение об успешном обновлении
                        alert('Счет успешно обновлен!');
                        
                        // Обновляем список матчей
                        await loadMatchesList();
                    } else {
                        throw new Error(result.message || 'Неизвестная ошибка при обновлении счета');
                    }
                } catch (error) {
                    console.error('Ошибка при сохранении счета:', error);
                    alert('Ошибка при сохранении счета: ' + error.message);
                }
            };
            
            // Показываем модальное окно
            scoreModal.style.display = 'block';
        })
        .catch(error => {
            console.error('Ошибка при загрузке данных матча:', error);
            alert('Ошибка при загрузке данных матча: ' + error.message);
        });
}

// Функция для создания контейнера карт для конкретного матча
function createMapsContainer(matchId, form) {
    const container = document.createElement('div');
    container.id = `maps-container-${matchId}`;
    container.className = 'maps-container';
    form.appendChild(container); // Добавляем контейнер в форму редактирования
    return container;
}

// Функция редактирования матча
window.editMatch = async function(matchId) {
    try {
        // Получаем данные матча
        const response = await fetch(`/api/matches/${matchId}`);
        if (!response.ok) throw new Error('Ошибка при загрузке данных матча');
        const match = await response.json();

        // Находим модальное окно и его элементы
        const modal = document.getElementById('editMatchModal');
        if (!modal) {
            console.error('Модальное окно редактирования не найдено');
            return;
        }

        // Находим форму и элементы формы
        const form = document.getElementById('editMatchForm');
        if (!form) {
            console.error('Форма редактирования не найдена');
            return;
        }

        // Скрываем все контейнеры карт
        document.querySelectorAll('.maps-container').forEach(container => {
            container.style.display = 'none';
        });

        // Находим или создаем контейнер для текущего матча
        const mapsContainerId = `maps-container-${matchId}`;
        let mapsContainer = document.getElementById(mapsContainerId);
        if (!mapsContainer) {
            mapsContainer = createMapsContainer(matchId, form);
        }
        mapsContainer.style.display = 'block'; // Показываем контейнер для текущего матча

        // Находим все необходимые элементы формы
        const elements = {
            team1: document.getElementById('editTeam1'),
            team2: document.getElementById('editTeam2'),
            format: document.getElementById('editFormat'),
            mapsContainer: mapsContainer,
            swapBtn: document.getElementById('editSwapTeamsBtn')
        };

        // Проверяем наличие всех необходимых элементов
        for (const [key, element] of Object.entries(elements)) {
            if (!element) {
                console.error(`Элемент ${key} не найден в форме редактирования`);
                return;
            }
        }

        // Загружаем команды в селекты
        await Promise.all([
            loadTeamsForSelect(elements.team1, match.team1_id),
            loadTeamsForSelect(elements.team2, match.team2_id)
        ]);

        // Устанавливаем значения формы
        elements.team1.value = match.team1_id;
        elements.team2.value = match.team2_id;
        elements.format.value = match.format || 'bo1';

        // Обновляем названия команд в селекторах выбора
        const team1Name = elements.team1.options[elements.team1.selectedIndex]?.text || 'Команда 1';
        const team2Name = elements.team2.options[elements.team2.selectedIndex]?.text || 'Команда 2';

        // Обновляем контейнер карт при изменении формата
        elements.format.addEventListener('change', () => {
            updateMapsContainerWithElements(elements, team1Name, team2Name, matchId);
        });
        
        // Инициализируем контейнер карт
        updateMapsContainerWithElements(elements, team1Name, team2Name, matchId);

        // Добавляем обработчик для кнопки свапа
        if (elements.swapBtn) {
            elements.swapBtn.onclick = () => {
                const team1Value = elements.team1.value;
                const team2Value = elements.team2.value;
                elements.team1.value = team2Value;
                elements.team2.value = team1Value;

                // Анимация кнопки
                elements.swapBtn.style.transform = 'rotate(180deg)';
                setTimeout(() => {
                    elements.swapBtn.style.transform = 'rotate(0deg)';
                }, 300);
                
                // Обновляем названия команд в селекторах после свапа
                const newTeam1Name = elements.team1.options[elements.team1.selectedIndex]?.text || 'Команда 1';
                const newTeam2Name = elements.team2.options[elements.team2.selectedIndex]?.text || 'Команда 2';
                updateMapsContainerWithElements(elements, newTeam1Name, newTeam2Name, matchId);
            };
        }

        // Обработчик отправки формы
        form.onsubmit = async (e) => {
            e.preventDefault();
            try {
                // Проверяем выбор одинаковых команд
                if (elements.team1.value === elements.team2.value && elements.team1.value !== '') {
                    alert('Нельзя выбрать одну и ту же команду');
                    return;
                }

                // Собираем данные о картах
                const maps = Array.from(elements.mapsContainer.querySelectorAll('.map-item'))
                    .map(item => ({
                        mapId: item.querySelector('.map-select').value,
                        pickTeam: item.querySelector('.pick-team-select').value
                    }))
                    .filter(map => map.mapId !== '');

                const formData = {
                    team1_id: parseInt(elements.team1.value),
                    team2_id: parseInt(elements.team2.value),
                    format: elements.format.value,
                    maps: maps
                };

                console.log('Отправляемые данные:', formData);

                const updateResponse = await fetch(`/api/matches/${matchId}/update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    console.error('Ответ сервера:', errorText);
                    throw new Error('Ошибка при обновлении матча: ' + updateResponse.status);
                }

                const result = await updateResponse.json();
                console.log('Результат обновления:', result);

                if (result.success) {
                    modal.style.display = 'none';
                    alert(i18n('matchUpdatedSuccess'));
                    await loadMatchesList();
                } else {
                    throw new Error(result.message || 'Неизвестная ошибка при обновлении матча');
                }
            } catch (error) {
                console.error('Ошибка при сохранении:', error);
                alert(i18n('matchSaveError'));
            }
        };

        // Обработчики закрытия модального окна
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }

        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

        // Показываем модальное окно
        modal.style.display = 'block';

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных матча: ' + error.message);
    }
};

// Функция для проверки статуса конфигов CS2
async function checkCS2Configs(customPath) {
    try {
      let url = '/api/check-cs2-configs';
      if (customPath) {
        url += `?path=${encodeURIComponent(customPath)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        return data;
      } else {
        console.error('Ошибка при проверке конфигов:', data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Ошибка при выполнении запроса:', error);
      return null;
    }
  }
  
  // Функция для установки конфигов CS2
async function installCS2Configs() {
    try {
      const customPathInput = document.getElementById('cs2-custom-path');
      let url = '/api/install-cs2-configs';
      
      if (customPathInput && customPathInput.value) {
        url += `?path=${encodeURIComponent(customPathInput.value)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        alert('Конфиги CS2 успешно установлены!');
        updateConfigsStatus();
      } else {
        if (data.installed && (data.installed.gsi || data.installed.observer || data.installed.observer2 || data.installed.observer_off)) {
          let message = 'Частичная установка конфигов: ';
          if (data.installed.gsi) message += 'GSI установлен. ';
          if (data.installed.observer) message += 'Observer установлен. ';
          if (data.installed.observer2) message += 'Observer2 установлен. ';
          if (data.installed.observer_off) message += 'Observer_off установлен. ';
          message += '\nОшибка: ' + data.message;
          alert(message);
        } else {
          alert('Ошибка при установке конфигов: ' + data.message);
        }
        updateConfigsStatus();
      }
    } catch (error) {
      console.error('Ошибка при выполнении запроса:', error);
      alert('Ошибка при установке конфигов');
    }
  }
  
// Обновление статуса конфигов в интерфейсе
async function updateConfigsStatus() {
    const gsiStatusElement = document.getElementById('cs2-gsi-status');
    const observerStatusElement = document.getElementById('cs2-observer-status');
    const observer2StatusElement = document.getElementById('cs2-observer2-status');
    const observer_offStatusElement = document.getElementById('cs2-observer_off-status');
    const customPathInput = document.getElementById('cs2-custom-path');
    
    // Проверяем только обязательные элементы
    if (!gsiStatusElement || !observerStatusElement || !observer2StatusElement || !observer_offStatusElement) return;
    
    // Добавляем элемент для observer_off, если его нет
    /*let observer_offStatusElement = document.getElementById('cs2-observer_off-status');
    if (!observer_offStatusElement) {
      observer_offStatusElement = document.createElement('p');
      observer_offStatusElement.id = 'cs2-observer_off-status';
      observerStatusElement.parentNode.insertBefore(observer_offStatusElement, observerStatusElement.nextSibling);
    }*/
    
    // Устанавливаем начальные значения статусов
    gsiStatusElement.textContent = "Проверка статуса GSI конфига...";
    observerStatusElement.textContent = "Проверка статуса Observer конфига...";
    observer2StatusElement.textContent = "Проверка статуса Observer2 конфига...";
    observer_offStatusElement.textContent = "Проверка статуса Observer_off конфига...";
    
    const data = await checkCS2Configs(customPathInput ? customPathInput.value : null);
    
    if (data && data.success) {
      if (data.gsiInstalled) {
        gsiStatusElement.textContent = "✓ GSI конфиг установлен";
      } else {
        gsiStatusElement.textContent = "✗ GSI конфиг не установлен";
      }
      
      if (data.observerInstalled) {
        observerStatusElement.textContent = "✓ Observer конфиг установлен";
      } else {
        observerStatusElement.textContent = "✗ Observer конфиг не установлен";
      }

      if (data.observer2Installed) {
        observer2StatusElement.textContent = "✓ Observer2 конфиг установлен";
      } else {
        observer2StatusElement.textContent = "✗ Observer2 конфиг не установлен";
      }
      
      if (data.observer_offInstalled) {
        observer_offStatusElement.textContent = "✓ Observer_off конфиг установлен";
      } else {
        observer_offStatusElement.textContent = "✗ Observer_off конфиг не установлен";
      }
      
      const pathElement = document.getElementById('cs2-path');
      if (pathElement) {
        pathElement.textContent = data.configPath || `${data.path}\\game\\csgo\\cfg`;
        
        if (customPathInput && !customPathInput.value) {
          customPathInput.value = data.path;
        }
      }
    } else {
      gsiStatusElement.textContent = "? Не удалось проверить статус GSI конфига";
      observerStatusElement.textContent = "? Не удалось проверить статус Observer конфига";
      observer2StatusElement.textContent = "? Не удалось проверить статус Observer2 конфига";
      observer_offStatusElement.textContent = "? Не удалось проверить статус Observer_off конфига";
      
      const pathElement = document.getElementById('cs2-path');
      if (pathElement) {
        pathElement.textContent = data ? data.message : "Ошибка поиска CS2";
      }
    }
  }
  
  // Инициализация интерфейса для CS2
  function initializeCS2Tools() {
    // Добавляем обработчики событий для кнопок
    const installBtn = document.getElementById('install-cs2-configs');
    if (installBtn) {
      installBtn.addEventListener('click', installCS2Configs);
    }
    
    const checkBtn = document.getElementById('check-cs2-path');
    if (checkBtn) {
      checkBtn.addEventListener('click', updateConfigsStatus);
    }
    
    // Обновляем статус конфигов при загрузке
    updateConfigsStatus();
  }
  
  // Добавляем вызов инициализации
  window.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    initializeCS2Tools();
  });


// Глобальные переменные для локализации
let currentLanguage = 'ru';
let translations = {};

// Функция для загрузки переводов
async function loadTranslations(lang) {
  try {
    // Используем параметр запроса вместо cookies
    const response = await fetch(`/api/get-translations?lang=${lang || 'ru'}`);
    const data = await response.json();
    
    currentLanguage = data.language;
    translations = data.translations;
    
    // Сохраняем выбранный язык в localStorage
    localStorage.setItem('preferredLanguage', currentLanguage);
    
    // Обновляем интерфейс с новыми переводами
    updateUI();
    return translations;
  } catch (error) {
    console.error('Ошибка при загрузке переводов:', error);
    return {};
  }
}

// Функция для изменения языка
async function changeLanguage(lang) {
    try {
      await loadLanguage(lang);
      
      // Обновляем весь UI
      translatePage();
      
      // Перезагружаем динамически созданные элементы
      if (document.querySelector('#matches-list')) {
        await loadMatchesList();
      }
      
      if (document.querySelector('#teams-list')) {
        await loadTeamsList();
      }
      
      if (document.querySelector('#players-list')) {
        await loadPlayers();
      }
      
      if (document.querySelector('#huds-list')) {
        await loadHUDs();
      }
      
      // Обновляем CS2 статус если он открыт
      if (document.querySelector('#cs2-path')) {
        updateConfigsStatus();
      }
      
    } catch (error) {
      console.error('Ошибка при изменении языка:', error);
    }
  }

  async function loadLanguage(lang) {
    try {
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load language ${lang}`);
      }
      
      i18nTranslations = await response.json();
      i18nCurrentLang = lang;
      localStorage.setItem('i18nPreferredLanguage', lang);
      
      // Обновляем все элементы с data-i18n
      translatePage();
      
      console.log(`Язык изменен на ${lang}`);
      return true;
    } catch (error) {
      console.error('Ошибка при загрузке языка:', error);
      // Если загрузка не удалась, попробуем загрузить русский язык как резервный
      if (lang !== 'ru') {
        return loadLanguage('ru');
      }
      return false;
    }
  }

// Функция для перевода текста
function __(key) {
  return translations[key] || key;
}

// Обновление интерфейса с учетом выбранного языка
function updateUI() {
  // Обновляем тексты в CS2 секции
  const elements = {
    'cs2-integration-title': 'cs2Integration',
    'cs2-configs-status': 'cs2ConfigsStatus',
    'cs2-config-path-label': 'cs2ConfigPath',
    'check-cs2-path': 'cs2CheckPath',
    'install-cs2-configs': 'cs2InstallConfigs'
  };
  
  // Обновляем текст для всех элементов
  for (const [id, key] of Object.entries(elements)) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = __(key);
    }
  }
  
  // Обновляем placeholder для пути к CS2
  const customPathInput = document.getElementById('cs2-custom-path');
  if (customPathInput) {
    customPathInput.placeholder = __('cs2CustomPath');
  }
}

// Инициализация выбора языка
function initializeLanguageSelector() {
  const languageSelector = document.getElementById('language-selector');
  if (languageSelector) {
    // Устанавливаем текущий язык из localStorage или по умолчанию
    const savedLang = localStorage.getItem('preferredLanguage') || 'ru';
    languageSelector.value = savedLang;
    
    // Загружаем сохраненный язык
    loadTranslations(savedLang);
    
    // Добавляем обработчик изменения
    languageSelector.addEventListener('change', (e) => {
      changeLanguage(e.target.value);
    });
  }
}

// Обновляем инициализацию страницы
window.addEventListener('DOMContentLoaded', () => {
  // Инициализируем выбор языка
  initializeLanguageSelector();
  
  // Здесь могут быть вызовы других функций инициализации
  initializeCS2Tools();
});

// В функции смены языка
function changeLanguage(lang) {
  i18nCurrentLang = lang;
  localStorage.setItem('i18nPreferredLanguage', lang);
  // Остальной код...
}

// Добавить в конце каждой функции, которая обновляет содержимое
loadMatchesList().then(() => {
  translatePage(); // Локализуем обновленный контент
});