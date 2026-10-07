const CACHE_NAME = "web-digital-pet-v6"
const APP_FILES = [
  "/",
  "/dex",
  "/history",
  "/view/sidebar",
  "/view/dex",
  "/view/history",
  "/browser-local.js",
  "/browser-pairing.js",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/fonts/Silkscreen-Regular.ttf",
  "/images/digital-world-lake-background.png",
  "/icons/digital-pet-16.png",
  "/icons/digital-pet-32.png",
  "/icons/digital-pet-180.png",
  "/icons/digital-pet-192.png",
  "/icons/digital-pet-512.png",
  "/icons/digital-pet-maskable-192.png",
  "/icons/digital-pet-maskable-512.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ]),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname === "/service-worker.js" || url.pathname.startsWith("/api/"))
    return
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(request, response.clone())
        }
        return response
      } catch {
        const cache = await caches.open(CACHE_NAME)
        return (await cache.match(request, { ignoreSearch: request.mode === "navigate" })) || Response.error()
      }
    })(),
  )
})
