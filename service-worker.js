// service-worker.js

// Версия кеша.
const CACHE_VERSION = "0.1.3";
const CACHE_NAME = `heic-to-jpeg-${CACHE_VERSION}`;

// Файлы, которые необходимо кешировать для работы офлайн.
const urlsToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  // '/worker.js', // ИЗМЕНЕНО: Воркер больше не используется
  "/heic2any.min.js",
  "/manifest.json",
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
        // Принудительно активируем новый Service Worker сразу
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
            // Удаляем все старые кеши, которые не совпадают с текущим
            if (cacheName !== CACHE_NAME) {
              console.log("Service Worker: Удаление старого кеша:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Начинаем контролировать страницу сразу
        return self.clients.claim();
      })
  );
});

// 3. Перехват сетевых запросов (Fetch) - Стратегия "Network First"
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  // Используем стратегию "Network First" для всех запросов.
  // Это гарантирует, что пользователь всегда получит свежую версию, если есть интернет.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Клонируем ответ, чтобы положить его в кеш
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        // Если сети нет, пытаемся найти ответ в кеше
        return caches.match(event.request);
      })
  );
});
