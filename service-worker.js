// service-worker.js

// Версия кеша.
const CACHE_VERSION = "0.1.1";
const CACHE_NAME = `heic-to-jpeg-${CACHE_VERSION}`;

const CDN_URL =
  "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";

// Файлы, которые необходимо кешировать для работы офлайн.
const urlsToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/worker.js",
  "/manifest.json",
  CDN_URL,
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// 1. Установка Service Worker
self.addEventListener("install", (event) => {
  console.log("Service Worker: Установка...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Кеширование основных файлов");
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// 2. Активация Service Worker
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Активация...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Service Worker: Удаление старого кеша:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// 3. Перехват сетевых запросов (Fetch) - ГИБРИДНАЯ СТРАТЕГИЯ
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  // Стратегия "Cache First" для критической зависимости воркера
  if (event.request.url === CDN_URL) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Если есть в кеше, отдаем сразу
        if (cachedResponse) {
          return cachedResponse;
        }
        // Если нет, идем в сеть и кешируем
        return fetch(event.request).then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return; // Важно, чтобы не выполнялась следующая стратегия
  }

  // Стратегия "Network First" для остальных ресурсов приложения
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        // Если сети нет, отдаем из кеша
        return caches.match(event.request);
      })
  );
});
