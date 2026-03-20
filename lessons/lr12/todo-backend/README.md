# LR12 Todo Backend (local only)

Локальный backend для самостоятельной работы LR12.

## Stack

- Hono
- SQLite (better-sqlite3)
- dotenv

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Сервер стартует на `http://localhost:3001`.

## API

- `GET /health`
- `GET /api/todos`
- `POST /api/todos` `{ "title": "..." }`
- `PATCH /api/todos/:id` `{ "title"?: "...", "done"?: true|false }`
- `DELETE /api/todos/:id`

## Пример

```bash
curl http://localhost:3001/api/todos
curl -X POST http://localhost:3001/api/todos -H "Content-Type: application/json" -d '{"title":"Купить молоко"}'
```
