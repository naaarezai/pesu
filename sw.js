// sw.js - Basic Service Worker for PWA installability

const CACHE_NAME = 'pesu-cache-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  // Verkkopyyntöjen läpivienti sellaisenaan, jotta näytetään aina reaaliaikaista dataa
  event.respondWith(fetch(event.request));
});


