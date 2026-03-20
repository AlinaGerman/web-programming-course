# PWA & Offline-first: Expanded Cheatsheet

Короткие практические рецепты по теме.

---

## 1. Быстрый маршрут внедрения

1. Сначала стабилизируйте online CRUD
2. Подключите `manifest.webmanifest`
3. Напишите Service Worker в `src/sw.ts` и соберите `public/sw.js`
4. Добавьте `offline.html`
5. Введите `online/offline` индикатор
6. Добавьте локальную очередь операций
7. Добавьте синхронизацию по событию `online`
8. Прогоните сценарий `online -> offline -> online`

---

## 2. Регистрация Service Worker

```ts
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (error) {
      console.error('SW registration failed', error);
    }
  });
}
```

Частая ошибка:

1. Регистрация раньше `load`
2. Неверный путь к файлу SW

---

## 3. Минимальный `src/sw.ts`

```ts
/// <reference lib="WebWorker" />
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = 'app-shell-v1';
const APP_SHELL = ['/', '/index.html', '/offline.html'];

sw.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

sw.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

sw.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || caches.match('/offline.html');
      })
  );
});
```

Практика:

1. Редактируйте `src/sw.ts`, а не `public/sw.js` вручную
2. После изменений выполняйте `npm run build:sw`
3. Меняйте версию кэша при изменении стратегии (`app-shell-v2`)
4. Не пытайтесь кэшировать POST/PATCH/DELETE через `fetch` в SW

Сборка SW:

```bash
# ЛИНУКС / WINDOWS (PowerShell)
npm run build:sw
```

---

## 4. `offline.html` (шаблон)

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Нет сети</title>
  </head>
  <body>
    <h1>Нет подключения к интернету</h1>
    <p>Продолжайте работу, изменения будут отправлены позже.</p>
  </body>
</html>
```

---

## 5. Manifest (минимум)

```json
{
  "name": "Offline App",
  "short_name": "OfflineApp",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

И подключение:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#0f172a" />
```

---

## 6. Индикатор сети (TypeScript)

```ts
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}
```

Минимальный UX:

1. Текстовый статус `online/offline`
2. Число операций в очереди
3. Статус синхронизации (`idle/syncing/error`)

---

## 7. Формат очереди операций

```ts
export type QueueAction =
  | { id: string; type: 'create'; payload: { title: string }; ts: number }
  | { id: string; type: 'update'; payload: { id: number; done?: boolean; title?: string }; ts: number }
  | { id: string; type: 'delete'; payload: { id: number }; ts: number };
```

Почему так:

1. Операции легко повторять
2. Есть порядок действий
3. Удобно логировать и отлаживать

---

## 8. Хранилище очереди

```ts
const QUEUE_KEY = 'offline_queue';

export function readQueue(): QueueAction[] {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueueAction[];
}

export function writeQueue(items: QueueAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function pushQueue(action: Omit<QueueAction, 'id' | 'ts'>) {
  const item: QueueAction = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    ...action,
  } as QueueAction;

  writeQueue([...readQueue(), item]);
}
```

---

## 9. Универсальный `sendAction`

```ts
const API_BASE_URL = 'http://localhost:3000';

async function sendAction(action: QueueAction): Promise<void> {
  if (action.type === 'create') {
    const response = await fetch(`${API_BASE_URL}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action.payload),
    });
    if (!response.ok) throw new Error(`create failed: ${response.status}`);
    return;
  }

  if (action.type === 'update') {
    const { id, ...rest } = action.payload;
    const response = await fetch(`${API_BASE_URL}/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rest),
    });
    if (!response.ok) throw new Error(`update failed: ${response.status}`);
    return;
  }

  const response = await fetch(`${API_BASE_URL}/api/items/${action.payload.id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`delete failed: ${response.status}`);
}
```

---

## 10. Синхронизация очереди (с lock)

```ts
let isSyncInProgress = false;

export async function syncQueue(): Promise<number> {
  if (isSyncInProgress) return readQueue().length;
  isSyncInProgress = true;

  try {
    const queue = readQueue();
    const rest: QueueAction[] = [];

    for (const action of queue) {
      try {
        await sendAction(action);
      } catch {
        rest.push(action);
        break;
      }
    }

    writeQueue(rest);
    return rest.length;
  } finally {
    isSyncInProgress = false;
  }
}

window.addEventListener('online', () => {
  void syncQueue();
});
```

Важно:

1. Удаляйте элементы из очереди только после успеха
2. При ошибке оставляйте хвост очереди

---

## 11. Рецепт обработчика UI

```ts
async function onCreate(title: string) {
  const action = { type: 'create', payload: { title } } as const;

  if (navigator.onLine) {
    try {
      await sendAction({ id: crypto.randomUUID(), ts: Date.now(), ...action });
      return;
    } catch {
      pushQueue(action);
      return;
    }
  }

  pushQueue(action);
}
```

Идея:

1. В online пытаемся отправить сразу
2. При ошибке fallback в очередь
3. В offline сразу пишем в очередь

---

## 12. Идемпотентность (если нужна)

Если backend поддерживает idempotency-key, добавляйте его:

```ts
const key = action.id;

await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': key,
  },
  body: JSON.stringify(payload),
});
```

---

## 13. Диагностика: что проверять первым

Если не работает SW:

1. `Application -> Service Workers`
2. Путь регистрации `/sw.js`
3. Выполнялась ли сборка `npm run build:sw`
4. Origin (`localhost`/`https`)

Если не работает установка:

1. `Application -> Manifest`
2. Иконки 192/512
3. Активный SW

Если не работает sync:

1. Содержимое `offline_queue` в Storage
2. Событие `online` реально приходит
3. Ответы API и HTTP-коды

---

## 14. Тестовый сценарий (обязательный)

1. Online: сделать create/update/delete
2. Перейти в offline
3. Повторить create/update/delete
4. Проверить, что queue выросла
5. Вернуться online
6. Проверить, что queue уменьшилась
7. Перезагрузить страницу и сверить данные с сервером

---

## 15. Микро-чеклист перед сдачей

1. Online CRUD работает
2. PWA устанавливается
3. Offline fallback есть
4. Операции не теряются в offline
5. Синхронизация отрабатывает после reconnect
6. Пользователь видит статус сети и sync
