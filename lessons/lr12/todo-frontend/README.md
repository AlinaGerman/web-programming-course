# Todo Starter (React + TypeScript)

Стартовый фронтенд для LR12 по теме PWA & Offline-first.

## Что уже работает

1. Запрос списка todo с backend
2. Добавление задачи
3. Удаление задачи
4. Переключение `done`
5. Базовый UI на React + TypeScript

## Что реализовать

1. Регистрация Service Worker в клиентском коде
2. Логику в `src/sw.ts` (кэш, fallback, стратегия fetch)
3. Обработку `online/offline` в UI
4. Локальную очередь действий `add/toggle/delete`
5. Синхронизацию очереди после reconnect

## Быстрый маршрут

1. Запустить backend
2. Запустить frontend
3. Проверить, что starter CRUD работает
4. Реализовать PWA-шаги по TODO-меткам

## Запуск

### Backend

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

### Frontend

```bash
# ЛИНУКС / WINDOWS (PowerShell)
cd lessons/lr12/todo-frontend
npm install
npm run dev
```

По умолчанию API: `http://localhost:3001`.

## Подсказка по Service Worker (TS)

1. В курсе SW пишем в `src/sw.ts`, а не вручную в JS.
2. Для браузера используется собранный файл `public/sw.js`.
3. Сборка SW: `npm run build:sw`.
4. Непрерывная пересборка SW: `npm run sw:watch`.

## Где искать точки доработки

1. `src/App.tsx` — TODO по регистрации SW, online/offline, очереди и sync
2. `src/sw.ts` — TODO по стратегии кэширования и fallback

## Troubleshooting

Если видите белый экран и ошибку `Root element #app not found`:

1. Проверьте, что открыли актуальный порт из вывода Vite (`http://localhost:5173`, `5174` и т.д.)
2. Откройте `DevTools -> Application -> Service Workers` и нажмите `Unregister`
3. Откройте `DevTools -> Application -> Storage` и нажмите `Clear site data`
4. Выполните `Hard Reload` страницы
