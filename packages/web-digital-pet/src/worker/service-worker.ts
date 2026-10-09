/// <reference lib="webworker" />
import { cacheNames, setCacheNameDetails } from "workbox-core"
import { matchPrecache, precache } from "workbox-precaching"
import { registerRoute } from "workbox-routing"
import { CacheFirst, NetworkFirst } from "workbox-strategies"

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

setCacheNameDetails({ prefix: "web-digital-pet", suffix: "v2" })
precache(self.__WB_MANIFEST)

const eligible = (request: Request, url: URL) =>
  url.origin === self.location.origin && request.cache !== "no-store" && !request.headers.has("range")
const immutableCache = new CacheFirst({ cacheName: cacheNames.runtime })
registerRoute(
  ({ request, url }) => eligible(request, url) && url.pathname.startsWith("/assets/"),
  async ({ request, event }) => {
    try {
      const cached = await matchPrecache(request.url)
      if (cached) return cached
    } catch {
      /* A storage failure must not prevent an online load. */
    }
    try {
      return await immutableCache.handle({ request, event })
    } catch {
      return fetch(request)
    }
  },
)
const shellCache = new NetworkFirst({
  cacheName: `${cacheNames.runtime}-shell`,
  plugins: [
    {
      cacheKeyWillBeUsed: async () => new URL("/", self.location.origin).href,
      // Treat server errors as offline; preserve real 404 responses.
      fetchDidSucceed: async ({ response }) => {
        if (response.status >= 500) throw new Error("Shell temporarily unavailable")
        return response
      },
    },
  ],
})
registerRoute(
  ({ request, url }) => eligible(request, url) && ["/", "/index.html", "/dex", "/history"].includes(url.pathname),
  async ({ request, event }) => {
    try {
      return await shellCache.handle({ request, event })
    } catch {
      try {
        const cached = await matchPrecache("/index.html")
        if (cached) return cached
      } catch {
        /* Fall through to the network when storage is unavailable. */
      }
      return fetch(request)
    }
  },
)
// Waiting workers activate after the old pages close. Never interrupt an active save.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const retained = new Set([cacheNames.precache])
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith("web-digital-pet-") && !retained.has(key))
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})
