// Offline support: the app shell is cached, so Flow opens without a connection.
// Navigations: network first (fresh deploys win), cache as fallback.
// Static assets: cache first (they are content-hashed by Vite).
const CACHE = 'flow-v3'

self.addEventListener('install', (e) => {
  // Cache the page plus every script/style it references, so Flow opens offline
  // already after the very first visit.
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE)
      const res = await fetch('./', { cache: 'reload' })
      const html = await res.clone().text()
      await c.put('./', res)
      const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1])
      await c.addAll([...new Set(assets), './manifest.webmanifest', './icon-192.png', './favicon.svg'])
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./')),
    )
    return
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
