# PWA & Offline-first: Подробный Guide

## Для чего этот гайд

Этот материал объясняет не только **что** нужно сделать, но и **как** это сделать на практике.

Цель: реализовать веб-приложение (например, Todo), которое:

1. Работает в online-режиме как обычное SPA
2. Устанавливается как PWA
3. Не теряет действия пользователя при offline
4. Синхронизирует накопленные действия после reconnect

---

## Что подготовить заранее

1. Проект на TypeScript
2. Базовый API (для CRUD)
3. Локальный запуск приложения на `localhost`

Почему `localhost` важен:

1. Service Worker требует безопасный контекст
2. В браузере `localhost` считается безопасным контекстом

---

## Рекомендуемая структура файлов

```text
src/
  index.ts
  sw.ts
  api/
    client.ts
  pwa/
    register-sw.ts
    network-status.ts
    queue.ts
    sync.ts
public/
  sw.js (собирается из src/sw.ts)
  offline.html
  manifest.webmanifest
  icons/
    icon-192.png
    icon-512.png
```

1. Service Worker пишем в `src/sw.ts`
2. В браузере регистрируется собранный файл `public/sw.js`
3. Минимальная команда сборки: `npm run build:sw`

---

## Шаг 1: Сначала сделайте стабильный online CRUD

Не начинайте с PWA. Сначала убедитесь, что бизнес-логика работает без offline.

### Минимальный online-флоу

1. Загрузка списка сущностей
2. Добавление
3. Изменение
4. Удаление

### Пример API слоя (TypeScript)

```ts
export type Item = {
  id: number;
  title: string;
  done: boolean;
};

const API_BASE = 'http://localhost:3000';

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchItems(): Promise<Item[]> {
  const response = await fetch(`${API_BASE}/api/items`);
  const data = await parse<{ items: Item[] }>(response);
  return data.items;
}
```

### Критерий завершения шага

1. Полностью рабочий online CRUD
2. После перезагрузки страницы данные консистентны с сервером

---

## Шаг 2: Добавьте Web App Manifest

`manifest.webmanifest` описывает приложение для браузера и установки.

### Минимальный manifest

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

### Подключение в HTML

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#0f172a" />
```

### Что проверить

1. `Application -> Manifest` в DevTools
2. Нет критичных ошибок

---

## Шаг 3: Добавьте Service Worker

### 3.1 Регистрация SW

Создайте `src/pwa/register-sw.ts`:

```ts
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (error) {
      console.error('SW registration failed', error);
    }
  });
}
```

И вызовите в точке входа приложения (`src/main.tsx` или `src/index.ts`, в зависимости от структуры проекта).

### 3.2 Базовый `src/sw.ts`

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

После изменения `src/sw.ts` соберите файл для регистрации:

```bash
# ЛИНУКС / WINDOWS (PowerShell)
npm run build:sw
```

Если вносите правки в SW часто, держите watcher:

```bash
# ЛИНУКС / WINDOWS (PowerShell)
npm run sw:watch
```

### 3.3 Fallback страница

`public/offline.html` нужна, чтобы пользователь не видел белый экран.

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <title>Нет сети</title>
  </head>
  <body>
    <h1>Нет подключения к сети</h1>
    <p>Продолжайте работу, изменения будут отправлены позже.</p>
  </body>
</html>
```

---

## Шаг 4: Добавьте online/offline состояние в UI

Пользователь должен понимать, что происходит.

### Хук состояния сети (TypeScript)

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

### Рекомендация по UI

1. Плашка `online/offline`
2. Сообщение: "Изменения сохраняются локально"
3. Количество элементов в очереди

---

## Шаг 5: Реализуйте локальную очередь операций

Ключевой принцип: храните **операции**, а не снапшот DOM.

### Тип очереди (TypeScript)

```ts
export type QueueAction =
  | { id: string; type: 'create'; payload: { title: string }; ts: number }
  | { id: string; type: 'update'; payload: { id: number; done?: boolean; title?: string }; ts: number }
  | { id: string; type: 'delete'; payload: { id: number }; ts: number };
```

### Хранилище очереди

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

### Как использовать в обработчике

```ts
if (navigator.onLine) {
  await apiCreate(title);
} else {
  pushQueue({ type: 'create', payload: { title } });
}
```

---

## Шаг 6: Реализуйте синхронизацию после reconnect

### Почему нужен lock

Без lock можно запустить несколько sync циклов одновременно и получить дубли.

### Базовая реализация sync

```ts
let isSyncInProgress = false;

async function sendAction(action: QueueAction): Promise<void> {
  if (action.type === 'create') {
    await apiCreate(action.payload.title);
    return;
  }

  if (action.type === 'update') {
    const { id, ...rest } = action.payload;
    await apiUpdate(id, rest);
    return;
  }

  if (action.type === 'delete') {
    await apiDelete(action.payload.id);
  }
}

export async function syncQueue() {
  if (isSyncInProgress) return;
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
  } finally {
    isSyncInProgress = false;
  }
}

window.addEventListener('online', () => {
  syncQueue();
});
```

### Практический прием

После успешного sync всегда делайте повторную загрузку данных с сервера.

---

## Порядок операций: важный момент

Если очередь была:

1. `create A`
2. `update A done=true`
3. `delete A`

и вы поменяете порядок, состояние на сервере может оказаться неверным.

Поэтому:

1. Отправляйте строго по `ts`
2. Не сортируйте "как удобно"

---

## Обработка ошибок sync

Рекомендуемый минимум:

1. Если операция упала, остановить sync
2. Оставить неотправленные операции в очереди
3. Показать пользователю статус `sync error`
4. Дать кнопку "Повторить синхронизацию"

---

## Что тестировать вручную

### Сценарий 1

1. Online: добавить элемент
2. Перезагрузить
3. Элемент должен быть на месте

### Сценарий 2

1. Включить `Network -> Offline`
2. Сделать `create/update/delete`
3. Проверить, что действия ушли в очередь

### Сценарий 3

1. Вернуть `Online`
2. Проверить, что queue уменьшается
3. Проверить, что данные появились на сервере

### Сценарий 4

1. Обновить страницу до sync
2. Queue не должна пропасть

---

## DevTools: где смотреть

1. `Application -> Service Workers`
2. `Application -> Manifest`
3. `Application -> Storage`
4. `Network -> Offline`

---

## Частые ошибки и как исправить

1. SW не активируется
Причина: неверный путь или не `localhost/https`.
Что делать: проверить `register('/sw.js')`, пересобрать `public/sw.js` командой `npm run build:sw` и проверить origin.

2. Очередь очищается, но данные не дошли
Причина: очищение до успешного ответа.
Что делать: удалять элементы только после `response.ok`.

3. Дубли операций
Причина: несколько параллельных sync.
Что делать: ввести `isSyncInProgress` lock.

4. Offline fallback не срабатывает
Причина: `offline.html` не в кэше.
Что делать: добавить в `APP_SHELL`.

5. Установка не появляется
Причина: проблемы с manifest или SW.
Что делать: проверить `Application -> Manifest` и статус SW.

---

## Итоговый чеклист

1. Online CRUD стабилен
2. Manifest корректен
3. SW зарегистрирован и активен
4. Есть offline fallback
5. Offline-действия сохраняются в очередь
6. После reconnect очередь синхронизируется
7. Пользователь видит online/offline и статус sync
