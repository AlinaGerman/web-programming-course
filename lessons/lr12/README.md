# LR12: Самостоятельная работа — Todo PWA (Offline-first)

- Тема: **простое Todo-приложение**
- Никакого remote deploy: только локальный запуск
- Квиз в этой работе не используется

---

PWA-функционал:

1. `manifest.webmanifest`
2. Service Worker (пишем в `src/sw.ts`)
3. состояние сети `online/offline` в UI
4. локальная очередь операций
5. синхронизация очереди после reconnect

---

## Что уже дано

### Starter frontend (рабочий CRUD)

Путь: `lessons/lr12/todo-frontend`

Предоставлено:

- Vite + React + TypeScript инфраструктура
- Точка входа `src/main.tsx` и компонент `src/App.tsx`
- Рабочие операции: загрузка, добавление, удаление, toggle `done`
- TODO-метки в коде для PWA-этапов

### Быстрый запуск frontend

```bash
# ЛИНУКС / WINDOWS (PowerShell)
cd lessons/lr12/todo-frontend
npm install
npm run dev
```

Подсказка по Service Worker (TypeScript):

- писать код SW в `src/sw.ts`
- итоговый файл для регистрации: `public/sw.js`
- для пересборки SW вручную: `npm run build:sw`
- если часто меняете SW, можно держать отдельный watcher: `npm run sw:watch`

---

### Локальный backend (готовый)

Путь: `lessons/lr12/todo-backend`

Stack:

- Hono
- SQLite
- `.env` конфигурация
- Без авторизации, один пользователь

### Быстрый запуск backend

```bash
# ЛИНУКС
cd lessons/lr12/todo-backend
npm install
cp .env.example .env
npm run dev
```

```powershell
# WINDOWS (PowerShell)
cd lessons/lr12/todo-backend
npm install
Copy-Item .env.example .env
npm run dev
```

Backend по умолчанию: `http://localhost:3001`

---

## API для фронтенда

- `GET /health`
- `GET /api/todos`
- `POST /api/todos` body: `{ "title": "..." }`
- `PATCH /api/todos/:id` body: `{ "title"?: "...", "done"?: true|false }`
- `DELETE /api/todos/:id`

Пример ответа todo:

```json
{
  "id": 1,
  "title": "Купить молоко",
  "done": false,
  "createdAt": "2026-03-09 07:43:28",
  "updatedAt": "2026-03-09 07:43:28"
}
```

---

## Чекпоинты

### Чекпоинт 0: Старт и проверка окружения

### Что сделать

1. Запустить backend
2. Запустить frontend
3. Проверить, что starter-CRUD уже работает (загрузка списка, add/delete/toggle)

### Проверка

- `GET /health` возвращает `{"status":"ok"}`
- starter-frontend получает список todo и отправляет изменения в backend

### Вопросы

- зачем проверять backend отдельно от frontend перед PWA-частью
- что должно работать в starter до начала доработок
- почему `localhost` подходит для Service Worker

---

### Чекпоинт 1: Разбор starter-кода и точек расширения

### Что сделать

1. Найти TODO-метки в `src/App.tsx` и `src/sw.ts`
2. Определить место для регистрации SW
3. Определить место для обработки `online/offline`
4. Определить место для офлайн-очереди операций
5. Определить место для синхронизации после reconnect
6. Зафиксировать свой план доработки по этим точкам

### Проверка

- понятно, в каких местах кода вносить PWA-логику
- есть список конкретных TODO-зон для реализации

### Вопросы

- какие риски, если смешать CRUD и PWA-логику в одном большом блоке
- зачем заранее выделять точки расширения

---

### Чекпоинт 2: Manifest и установка

### Что сделать

1. Настроить `manifest.webmanifest`
2. Подключить manifest в `index.html`
3. Проверить иконки и корректность метаданных
4. Проверить возможность установки

### Проверка

- в `Application -> Manifest` нет критичных ошибок
- приложение можно установить

### Вопросы

- какую роль играет `manifest.webmanifest`
- почему обычно нужны иконки разных размеров
- что меняется для пользователя после установки

---

### Чекпоинт 3: Service Worker + состояние сети

### Что сделать

1. Реализовать логику в `src/sw.ts` и собрать `public/sw.js`
2. Добавить регистрацию SW в frontend-код
3. Реализовать обработчики `online/offline`
4. Отобразить состояние сети в UI

### Проверка

- в DevTools есть активный Service Worker
- индикатор сети меняется при смене состояния
- при offline пользователь видит понятный сценарий

### Вопросы

- зачем SW регистрируется из клиентского кода
- почему важно явно показывать состояние сети
- когда использовать fallback-страницу

---

### Чекпоинт 4: Офлайн-очередь и синхронизация

### Что сделать

1. При ошибке сети не терять `add/toggle/delete`
2. Сохранять действия в локальную очередь
3. На событие `online` запускать синхронизацию
4. Удалять действие из очереди только после успешной отправки

### Проверка

- офлайн-действия сохраняются
- после reconnect очередь отправляется в backend
- после перезагрузки несинхронизированные действия не теряются

### Вопросы

- почему в очереди лучше хранить операции, а не HTML
- почему важен порядок операций
- как избежать повторной отправки одной операции

---

### Чекпоинт 5: Финальная проверка

### Что сделать

1. Пройти сценарий: `online -> offline -> действия -> online`
2. Проверить `Application -> Service Workers/Manifest/Storage`
3. Пройти базовую проверку Lighthouse

### Проверка

- приложение ведет себя предсказуемо в online и offline
- очередь и sync отрабатывают стабильно
- PWA-часть завершена

### Вопросы

- что проверять первым, если offline-сценарий не работает
- по каким признакам видно, что sync завершился успешно
- зачем проверять через Lighthouse, даже если вручную все работает

---

## Типичные проблемы

| Проблема | Причина | Решение |
| -------- | ------- | ------- |
| Starter CRUD не работает | backend не запущен или неверный API URL | проверить backend и `VITE_API_URL` |
| Белый экран и ошибка `Root element #app not found` | браузер открыл неактуальную версию страницы (кэш/старый Service Worker) | открыть правильный `localhost` порт из Vite, сделать Hard Reload, в DevTools удалить Service Worker и очистить site data |
| SW не активируется | не собран `public/sw.js` или ошибка регистрации | проверить `register('/sw.js')`, выполнить `npm run build:sw` |
| Offline-действия теряются | очередь очищается слишком рано | удалять элементы очереди только после успешного ответа |
| После reconnect нет sync | нет обработчика `online` или sync-lock | добавить `window.addEventListener('online', ...)` и защиту от параллельного sync |
| Установка не появляется | проблемы с manifest или SW | проверить Manifest + статус SW в DevTools |

Быстрый сброс кэша для локальной отладки:

1. Открыть `DevTools -> Application -> Service Workers`, нажать `Unregister`
2. Открыть `DevTools -> Application -> Storage`, нажать `Clear site data`
3. Сделать `Hard Reload` страницы
4. Перезапустить `npm run dev` и открыть порт, который вывел Vite

---

## Материалы

- [GUIDE.md](docs/GUIDE.md)
- [CHEATSHEET.md](docs/CHEATSHEET.md)
- [interactive.html](docs/interactive.html)
- [slides.html](docs/slides-standalone/slides.html)

---

**Цель работы:** на основе готового CRUD-starter реализовать устойчивое PWA-поведение и offline-first сценарий.
