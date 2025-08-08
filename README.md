[MY DISCORD](https://discord.gg/Kh5NMW3P ) We discuss, propose and try to implement together.

# CS2 HUD Manager

## Описание
CS2 HUD Manager - это комплексное приложение для управления и отображения игрового интерфейса наблюдателя (HUD) в Counter-Strike 2. Приложение позволяет создавать и настраивать матчи, команды и игроков, а также отображать информацию о текущей игре в реальном времени через оверлей или в браузере.
=========================================================================
# CS2 HUD Manager

## Description
CS2 HUD Manager is a comprehensive application for managing and displaying the in-game Heads-Up Display (HUD) in Counter-Strike 2. The application allows you to create and customize matches, teams and players, as well as display information about the current game in real time via an overlay or in the browser.

<img width="1619" height="802" alt="image" src="https://github.com/user-attachments/assets/e348ac17-4344-4beb-8c18-c7b14fe180c2" />
<img width="1636" height="843" alt="image" src="https://github.com/user-attachments/assets/8758f8da-3974-4e1b-9ff4-9d6ac00b2d26" />
<img width="1633" height="647" alt="image" src="https://github.com/user-attachments/assets/07c1cab3-0d45-4c5d-9432-f9a2288f2a09" />
<img width="1654" height="718" alt="image" src="https://github.com/user-attachments/assets/134158e9-52b5-465e-8b29-c50a2c939781" />
<img width="859" height="340" alt="image" src="https://github.com/user-attachments/assets/fc664299-da18-49da-b785-2a8800b89502" />
<img width="526" height="806" alt="image" src="https://github.com/user-attachments/assets/fb62e33e-73f3-4fe2-8286-76f831dad638" />
<img width="1648" height="225" alt="image" src="https://github.com/user-attachments/assets/83621c70-2558-419e-9f0d-fbb203ad208b" />
<img width="161" height="153" alt="image" src="https://github.com/user-attachments/assets/615e992d-2833-45cd-9a87-95bcaa3c1924" />
<img width="1618" height="809" alt="image" src="https://github.com/user-attachments/assets/8509ed0a-cdaa-48f3-a54e-4105cc6eaa92" />
<img width="1167" height="828" alt="image" src="https://github.com/user-attachments/assets/2b5f8169-0ad3-425f-b215-9e591d1fffad" />

## Возможности

- **Управление командами и игроками**
  - Создание и редактирование команд с логотипами
  - Добавление игроков с аватарами и статистикой
  - Назначение игроков в команды

- **Управление матчами**
  - Создание матчей между командами
  - Настройка формата матча (BO1, BO3, BO5)
  - Отслеживание счета и статистики

- **Отображение HUD**
  - Интерактивный HUD с информацией о текущем раунде
  - Отображение экономики команд и игроков
  - Показ статистики игроков (убийства, смерти, ассисты)
  - Индикаторы бомбы, разминирования и таймаутов
  - Радар с отображением позиций игроков

- **Интеграция с CS2**
  - Получение данных через Game State Integration (GSI)
  - Автоматическое обновление информации в реальном времени

- **Оверлей**
  - Отображение HUD поверх игры через Electron-приложение
  - Настройка прозрачности и позиции оверлея

## Системные требования

- Windows 10/11
- Node.js 16+ (включен в установщик)
- Counter-Strike 2
- 100 МБ свободного места на диске

## Установка

### Автоматическая установка

1. Запустите `install.exe`
2. Следуйте инструкциям установщика
3. После установки запустите приложение через `start_fhud.exe`
4. Если не запустилось приложение, то используем `start_spare_fhud.exe`
5. В меню выбираем раздел CS2 интеграция и устанавливаем CFG

## Структура интерфейса

### Главное меню

- **Matches** - управление матчами
- **Teams** - управление командами
- **Players** - управление игроками
- **Settings** - настройки приложения
- **HUD** - просмот HUD

### Раздел Matches

- Создание новых матчей
- Выбор команд для матча
- Настройка формата матча (BO1, BO3, BO5)
- Выбор карт
- Управление текущим матчем

### Раздел Teams

- Добавление и редактирование команд
- Загрузка логотипов команд
- Управление составом команды
- Просмотр статистики команды

### Раздел Players

- Добавление и редактирование игроков
- Загрузка аватаров игроков
- Настройка информации об игроке (никнейм, имя, страна)

### Скорборд
- Просмотр статистики игрока

### Раздел HUD

- Просмотр текущего HUD
- Выбор HUD

## Использование HUD

- **Копировать ссылку для OBS** - копирует URL для добавления в OBS
- **Открыть в браузере** - открывает HUD в новой вкладке браузера
- **Запустить оверлей на главном мониторе** - запускает оверлей поверх игры

### Скрытие игроков

В разделе "Скрытие игроков" можно:
- Скрыть отдельных игроков из отображения на HUD

### Камеры Beta
- Настроить камеру игрока
=====================================================================================
## Features

- **Team and Player Management**
- Create and edit teams with logos
- Add players with avatars and statistics
- Assign players to teams

- **Match Management**
- Create matches between teams
- Configure match format (BO1, BO3, BO5)
- Track scores and statistics

- **HUD Display**
- Interactive HUD with information about the current round
- Display team and player economy
- Display player statistics (kills, deaths, assists)
- Bomb, defuse and timeout indicators
- Radar with player positions

- **CS2 Integration**
- Receive data via Game State Integration (GSI)
- Automatic real-time information update

- **Overlay**
- Display HUD over the game via Electron application
- Configure overlay transparency and position

## System requirements

- Windows 10/11
- Node.js 16+ (included in the installer)
- Counter-Strike 2
- 100 MB of free disk space

## Installation

### Automatic installation

1. Run `install.exe`
2. Follow the instructions of the installer
3. After installation, run the application via `start_fhud.exe`
4. If the application does not start, use `start_spare_fhud.exe`
5. In the menu, select the CS2 integration section and install CFG

## Interface structure

### Main menu

- **Matches** - match management
- **Teams** - team management
- **Players** - player management
- **Settings** - application settings
- **HUD** - HUD viewing

### Matches section

- Creating new matches
- Selecting teams for the match
- Match format settings (BO1, BO3, BO5)
- Map selection
- Manage the current match

### Teams section

- Adding and editing teams
- Uploading team logos
- Managing the team roster
- Viewing team statistics

### Players section

- Adding and editing players
- Uploading player avatars
- Setting up player information (nickname, name, country)

### Scoreboard
- Viewing player statistics

### HUD section

- Viewing the current HUD
- Selecting a HUD

## Using a HUD

- **Copy link for OBS** - copies the URL to add to OBS
- **Open in browser** - opens the HUD in a new browser tab
- **Launch overlay on main monitor** - launches the overlay on top of the game

### Hiding players

In the "Hiding players" section you can:
- Hide individual players from being displayed on the HUD

### Cameras Beta
- Set up player camera
