import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { createServer } from "vite"

import { entries } from "../src/server/rendering/build-resources.ts"
import { resourceFiles } from "../tooling/resources.ts"

const root = fileURLToPath(new URL("..", import.meta.url))
const server = await createServer({ root, server: { host: "127.0.0.1", port: Number(process.env.PORT ?? 5173) } })
const assets = Object.fromEntries(Object.entries(resourceFiles(root)).map(([url, path]) => [url, `/@fs${path}`]))
server.middlewares.use(async (request, response, next) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname
  if (pathname === "/manifest.webmanifest") {
    const manifest = JSON.parse(await readFile(new URL("../assets/manifest.webmanifest", import.meta.url), "utf8"))
    const images = [...manifest.icons, ...(manifest.screenshots ?? [])]
    for (const shortcut of manifest.shortcuts ?? []) images.push(...(shortcut.icons ?? []))
    for (const image of images) image.src = assets[image.src]
    response.setHeader("Content-Type", "application/manifest+json")
    response.end(JSON.stringify(manifest))
    return
  }
  if (!/^\/(?:api\/|view\/|$|dex$|history$)/.test(pathname)) return next()
  try {
    const { createWebHandler } = await server.ssrLoadModule("/src/server/http/app.ts")
    const resources = {
      mode: "local",
      development: true,
      assets,
      entryTags: (entry) =>
        `<script type="module" src="/@vite/client"></script><script type="module" src="/${entries[entry]}"></script>`,
    }
    await createWebHandler(resources)(request, response)
  } catch (error) {
    server.ssrFixStacktrace(error)
    next(error)
  }
})
await server.listen()
server.printUrls()
