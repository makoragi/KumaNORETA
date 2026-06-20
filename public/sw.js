const CACHE_NAME = 'kumanoreta-v2'
const STATIC_ASSETS = ['/KumaNORETA/manifest.webmanifest', '/KumaNORETA/icon.svg']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const requestUrl = new URL(event.request.url)
  const isAppNavigation =
    event.request.mode === 'navigate' ||
    (requestUrl.origin === self.location.origin && requestUrl.pathname === '/KumaNORETA/')

  if (isAppNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone()
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put('/KumaNORETA/', responseClone)))
          return response
        })
        .catch(async () => {
          const cached = await caches.match('/KumaNORETA/')
          return cached ?? Response.error()
        }),
    )
    return
  }

  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)))
})
