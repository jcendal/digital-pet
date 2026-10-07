const CACHE_NAME = "web-digital-pet-v13"
const CACHE_PREFIX = "web-digital-pet-"
const APP_FILES = [
  "/",
  "/dex",
  "/history",
  "/view/sidebar",
  "/view/dex",
  "/view/history",
  "/browser-local.js",
  "/browser-pairing.js",
  "/browser-options.js",
  "/browser-world.js",
  "/browser-scenery.js",
  "/regions/dragon-eye-lake/background.png",
  "/regions/gear-savannah/scene.svg",
  "/regions/digital-ocean/scene.svg",
  "/regions/dragon-eye-lake/scene.svg",
  "/regions/wasteland/scene.svg",
  "/regions/digital-forest/scene.svg",
  "/regions/digital-city/scene.svg",
  "/regions/village-of-beginnings/scene.svg",
  "/regions/ancient-dino-region/scene.svg",
  "/regions/tropical-jungle/scene.svg",
  "/regions/vamdemon-castle/scene.svg",
  "/regions/upside-down-pyramid/scene.svg",
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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
          ),
        ),
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
      const cache = await caches.open(CACHE_NAME)
      if (url.pathname.startsWith("/revisions/")) {
        const cached = await cache.match(request)
        if (cached) return cached
      }
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch {
        return (await cache.match(request, { ignoreSearch: request.mode === "navigate" })) || Response.error()
      }
    })(),
  )
})
