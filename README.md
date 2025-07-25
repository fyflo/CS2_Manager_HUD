[MY DISCORD](https://discord.gg/Kh5NMW3P ) We discuss, propose and try to implement together.

# CS2 HUD Manager

## Описание
CS2 HUD Manager - это комплексное приложение для управления и отображения игрового интерфейса наблюдателя (HUD) в Counter-Strike 2. Приложение позволяет создавать и настраивать матчи, команды и игроков, а также отображать информацию о текущей игре в реальном времени через оверлей или в браузере.

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

В разделе "Скрытие игроков" (бета-функция) можно:
- Скрыть отдельных игроков из отображения на HUD

### Камеры
- Настроить камеру игрока

