/* Template do service worker do Custo da Carcaça — offline completo já na
   2ª abertura. O build (vite.config.ts) injeta a versão do cache e a lista
   real de assets com hash nos marcadores abaixo, o que também torna o sw.js
   diferente a cada deploy (reinstala, e o activate remove caches antigos —
   sem acúmulo).
   - install: precache do casco + TODOS os bundles do build;
   - navegações: network-first com fallback ao cache (app atualiza com rede);
   - demais GET same-origin: cache-first; gravações protegidas por
     event.waitUntil (o browser não pode matar o worker no meio da escrita). */
/* global self, caches, fetch, URL */
/* global __PRECACHE_ASSETS__ -- marcador substituído no build (vite.config.ts) */

const CACHE_NAME = 'carcass-cost-__CACHE_VERSION__';
const PRECACHE = __PRECACHE_ASSETS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy)));
          return response;
        })
        .catch(() => caches.match('./index.html', { ignoreVary: true })),
    );
    return;
  }

  // ignoreVary: servidores estáticos (ex.: vite preview) respondem com
  // "Vary: Origin"; a request de module script leva header Origin e sem isso
  // nunca bateria com a entrada do precache — offline quebraria só no bundle.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      if (cached !== undefined) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      });
    }),
  );
});
