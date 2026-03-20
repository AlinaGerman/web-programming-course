/// <reference lib="WebWorker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = 'todo-pwa-starter-v1';

sw.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // TODO(PWA-SW-1): предкэшируйте shell-ресурсы приложения.
      // Пример: '/', '/index.html'.
      await sw.skipWaiting();
    })()
  );
});

sw.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // TODO(PWA-SW-2): очистите старые кэши и оставьте только актуальную версию.
      // Пример шагов:
      // 1) получить список ключей через caches.keys()
      // 2) удалить все, кроме CACHE_NAME
      await sw.clients.claim();
    })()
  );
});

sw.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') return;

  // TODO(PWA-SW-3): реализуйте стратегию для GET-запросов.
  // Рекомендуемый минимум для лабы:
  // 1) network-first для HTML
  // 2) fallback на offline.html
  // 3) cache-first или stale-while-revalidate для статических ресурсов

  event.respondWith(fetch(event.request));
});
