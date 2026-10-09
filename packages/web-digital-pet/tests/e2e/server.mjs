import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { preview } from "vite"

let workerVersion = 0
let shellStatus = 200
let failInstallation = false
let requests = []
await preview({
  preview: { host: "127.0.0.1", port: 4175, strictPort: true },
  plugins: [
    {
      name: "test-network-observer",
      configurePreviewServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const url = new URL(request.url, "http://127.0.0.1:4175")
          if (url.pathname === "/__test") {
            if (url.searchParams.has("reset")) {
              requests = []
              shellStatus = 200
            }
            if (url.searchParams.has("update")) {
              workerVersion++
              failInstallation = false
            }
            if (url.searchParams.has("fail-install")) {
              workerVersion++
              failInstallation = true
            }
            if (url.searchParams.has("status")) shellStatus = Number(url.searchParams.get("status"))
            response.setHeader("Content-Type", "application/json")
            response.end(JSON.stringify(requests))
            return
          }
          requests.push(url.pathname)
          if (["/", "/index.html", "/dex", "/history"].includes(url.pathname) && shellStatus !== 200) {
            response.writeHead(shellStatus)
            response.end("Temporarily unavailable")
            return
          }
          if (url.pathname === "/service-worker.js") {
            response.setHeader("Content-Type", "text/javascript")
            response.setHeader("Cache-Control", "no-cache")
            response.end(
              (await readFile(resolve("dist/client/service-worker.js"), "utf8")) +
                `\n// test update ${workerVersion}\n${failInstallation ? 'self.addEventListener("install", event => event.waitUntil(Promise.reject(new Error("Test installation failure"))))' : ""}`,
            )
            return
          }
          if (url.pathname === "/assets/future-release.js") {
            response.setHeader("Content-Type", "text/javascript")
            response.end("export const version = 2")
            return
          }
          next()
        })
      },
    },
  ],
})
