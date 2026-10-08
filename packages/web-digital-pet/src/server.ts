import { createHash, randomBytes } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { createServer, type ServerResponse } from "node:http"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"
import { MonsterAnimationController } from "@jcendal/digital-pet-animation/idle/monster-animation.ts"
import { renderPositionedArtwork } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { LOCATIONS, REGIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import { buildDexPanelModel } from "@jcendal/digital-pet-webviews/panels/dex/dex-model.ts"
import { buildDexWebviewHtml } from "@jcendal/digital-pet-webviews/panels/dex/dex-render.ts"
import { buildHistoryPanelModel } from "@jcendal/digital-pet-webviews/panels/history/history-model.ts"
import { buildHistoryWebviewHtml } from "@jcendal/digital-pet-webviews/panels/history/history-render.ts"
import { buildWorldPanelModel } from "@jcendal/digital-pet-webviews/panels/world/world-model.ts"
import { worldMarkup, worldStyles } from "@jcendal/digital-pet-webviews/panels/world/world-render.ts"
import { PANEL_THEME } from "@jcendal/digital-pet-webviews/shared/theme.ts"
import { buildSidebarWebviewHtml } from "@jcendal/digital-pet-webviews/sidebar/sidebar-document.ts"
import { buildSidebarPresentation } from "@jcendal/digital-pet-webviews/sidebar/sidebar-presenter.ts"
import { databasePath, hasHostDatabase, readArchive, readSidebarSnapshot } from "./database.ts"
import { optionsMarkup, optionsStyles } from "./options-view.ts"
import { sceneMotionFor } from "./scene-motion.ts"
import webBridgeSource from "./web-bridge.browser.js" with { type: "text" }
import webFrameStyles from "./web-frame.css" with { type: "text" }
import webShellSource from "./web-shell.browser.js" with { type: "text" }
import webShellStyles from "./web-shell.css" with { type: "text" }
import webStylesSource from "./web-styles.css" with { type: "text" }

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fontPath = resolve(packageRoot, "..", "digital-pet-webviews", "media", "fonts", "Silkscreen-Regular.ttf")
const fieldsAssets = resolve(packageRoot, "..", "digital-pet-fields", "assets")
const backgroundPath = resolve(fieldsAssets, "backgrounds", "dragon-eye-lake.png")
const availablePhotos = LOCATIONS.filter((place) =>
  existsSync(resolve(fieldsAssets, "backgrounds", place.backgroundFile)),
).map((place) => place.id)
const browserWorldScript = readFile(resolve(packageRoot, "dist", "browser-world.js"))
const browserSceneryScript = readFile(resolve(packageRoot, "dist", "browser-scenery.js"))
const manifestPath = resolve(packageRoot, "assets", "manifest.webmanifest")
const serviceWorkerPath = resolve(packageRoot, "assets", "service-worker.js")
const browserLocalPath = resolve(packageRoot, "dist", "browser-local.js")
const browserLocalScript = readFile(browserLocalPath)
const browserLocalGzip = browserLocalScript.then((script) => gzipSync(script))
const browserOptionsPath = resolve(packageRoot, "dist", "browser-options.js")
const browserOptionsScript = readFile(browserOptionsPath)
const browserOptionsGzip = browserOptionsScript.then((script) => gzipSync(script))
const browserPairingPath = resolve(packageRoot, "dist", "browser-pairing.js")
const browserPairingScript = readFile(browserPairingPath)
const browserPairingGzip = browserPairingScript.then((script) => gzipSync(script))
const faviconPath = resolve(packageRoot, "assets", "favicon.ico")
const icon16Path = resolve(packageRoot, "assets", "icons", "digital-pet-16.png")
const icon32Path = resolve(packageRoot, "assets", "icons", "digital-pet-32.png")
const icon180Path = resolve(packageRoot, "assets", "icons", "digital-pet-180.png")
const icon192Path = resolve(packageRoot, "assets", "icons", "digital-pet-192.png")
const icon512Path = resolve(packageRoot, "assets", "icons", "digital-pet-512.png")
const maskable192Path = resolve(packageRoot, "assets", "icons", "digital-pet-maskable-192.png")
const maskable512Path = resolve(packageRoot, "assets", "icons", "digital-pet-maskable-512.png")
const animation = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
let currentPartner = ""

const dexModel = () => ({
  ...buildDexPanelModel(readArchive(), DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS),
  currentNodeId: readSidebarSnapshot()?.currentNodeId ?? null,
})
const historyModel = () => buildHistoryPanelModel(readArchive(), DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)

const sidebarData = (requestedWidth: number) => {
  const presentation = buildSidebarPresentation(readSidebarSnapshot())
  const identity = presentation.partner
  const partnerKey = identity ? `${identity.sprite}:${identity.isDigitama}` : ""
  if (partnerKey !== currentPartner) {
    currentPartner = partnerKey
    animation.dispatch({ kind: "partner_changed", partner: identity })
  }
  const width = Math.max(16, Math.min(120, Math.floor(requestedWidth) || 40))
  animation.dispatch({ kind: "viewport_resized", width })
  const frame = animation.dispatch({ kind: "tick" })
  return {
    model: presentation.payload,
    frame: {
      type: "animation-frame",
      artwork: renderPositionedArtwork(frame, width),
      motion: sceneMotionFor(frame, partnerKey, width),
    },
  }
}

const webStyles = webStylesSource

const bridgeScript = (page: "sidebar" | "dex" | "history") => /* javascript */ `${webBridgeSource}
initWebBridge(${JSON.stringify(page)}, ${JSON.stringify(LOCATIONS.map((place) => place.id))});`

const renderPage = (page: "sidebar" | "dex" | "history"): string => {
  const nonce = randomBytes(16).toString("hex")
  const resources = { nonce, fontUri: "/fonts/Silkscreen-Regular.ttf", cspSource: "'self'", webShell: true }
  const html =
    page === "sidebar"
      ? buildSidebarWebviewHtml(nonce, resources)
      : page === "dex"
        ? buildDexWebviewHtml(dexModel(), resources)
        : buildHistoryWebviewHtml(historyModel(), resources)
  const withWorld =
    page === "sidebar"
      ? html.replace(
          '<div id="content">',
          '<button id="world-location" type="button" aria-haspopup="dialog">Dragon Eye Lake →</button><div id="content">',
        )
      : html
  return withWorld
    .replace(
      "<html",
      '<html data-save-host="' + (process.env.DIGITAL_PET_STATIC_EXPORT === "1" ? "browser" : "local") + '"',
    )
    .replace('<svg id="artwork"', '<svg id="artwork" data-idle-alignment="xMidYMax"')
    .replace("script-src 'nonce-", "script-src 'self' 'nonce-")
    .replace("</style>", `${webStyles}${webFrameStyles}</style>`)
    .replace("<body>", `<body><script nonce="${nonce}">${bridgeScript(page)}</script>`)
}

const renderShell = (page: "sidebar" | "dex" | "history"): string => {
  const nonce = randomBytes(16).toString("hex")
  const views = (["sidebar", "dex", "history"] as const)
    .map(
      (view) =>
        `<iframe class="web-view${view === page ? " active" : ""}" data-page="${view}" src="/view/${view}" title="${view === "sidebar" ? "Partner" : view === "dex" ? "Digidex" : "History"}"${view === page ? "" : ' aria-hidden="true"'}></iframe>`,
    )
    .join("")
  const links = (["sidebar", "dex", "history"] as const)
    .map(
      (view) =>
        `<a href="${view === "sidebar" ? "/" : `/${view}`}" data-page="${view}"${view === page ? ' aria-current="page"' : ""}>${view === "sidebar" ? "PARTNER" : view.toUpperCase()}</a>`,
    )
    .join("")
  const script = /* javascript */ webShellSource
  return `<!DOCTYPE html><html lang="en" data-save-host="${process.env.DIGITAL_PET_STATIC_EXPORT === "1" ? "browser" : "local"}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#594130"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; manifest-src 'self'; frame-src 'self'; worker-src 'self'; font-src 'self'; img-src 'self'; style-src 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'; connect-src 'self' https://0.peerjs.com wss://0.peerjs.com"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" type="image/x-icon" href="/favicon.ico"><link rel="icon" type="image/png" sizes="16x16" href="/icons/digital-pet-16.png"><link rel="icon" type="image/png" sizes="32x32" href="/icons/digital-pet-32.png"><link rel="apple-touch-icon" sizes="180x180" href="/icons/digital-pet-180.png"><title>Digital Pet</title><style>@font-face { font-family: 'Digital Pet Pixel'; src: url('/fonts/Silkscreen-Regular.ttf') format('truetype'); font-display: swap; }${PANEL_THEME}${webStyles}${webShellStyles}${optionsStyles}${worldStyles}</style></head><body><div class="view-stack">${views}</div><nav class="web-nav" aria-label="Digital Pet">${links}<button id="options-button" type="button" aria-haspopup="dialog">OPTIONS</button></nav>${optionsMarkup}${worldMarkup(availablePhotos)}<script nonce="${nonce}">${script}</script></body></html>`
}

const send = (response: ServerResponse, status: number, contentType: string, body: string | Buffer): void => {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  response.end(body)
}

const port = Number(process.env.PORT ?? 4173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535")
const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" || !request.url)
      return send(response, 405, "text/plain; charset=utf-8", "Method not allowed")
    const host = request.headers.host ?? ""
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
      return send(response, 403, "text/plain; charset=utf-8", "Forbidden")
    const url = new URL(request.url, `http://${host}`)
    if (url.pathname === "/fonts/Silkscreen-Regular.ttf") {
      return send(response, 200, "font/ttf", await readFile(fontPath))
    }
    if (url.pathname === "/images/digital-world-lake-background.png") {
      return send(response, 200, "image/png", await readFile(backgroundPath))
    }
    if (url.pathname === "/browser-world.js")
      return send(response, 200, "text/javascript; charset=utf-8", await browserWorldScript)
    if (url.pathname === "/browser-scenery.js")
      return send(response, 200, "text/javascript; charset=utf-8", await browserSceneryScript)
    const worldAsset = /^\/regions\/([a-z-]+)\/(scene\.svg|background\.png)$/.exec(url.pathname)
    if (worldAsset) {
      const place = LOCATIONS.find((candidate) => candidate.id === worldAsset[1])
      if (!place) return send(response, 404, "text/plain; charset=utf-8", "Unknown location")
      if (worldAsset[2] === "scene.svg")
        return send(
          response,
          200,
          "image/svg+xml",
          await readFile(resolve(fieldsAssets, "scenes", `${place.scene}.svg`)),
        )
      if (!availablePhotos.includes(place.id))
        return send(response, 404, "text/plain; charset=utf-8", "Background coming soon")
      return send(
        response,
        200,
        "image/png",
        await readFile(resolve(fieldsAssets, "backgrounds", place.backgroundFile)),
      )
    }
    if (url.pathname === "/manifest.webmanifest") {
      return send(response, 200, "application/manifest+json; charset=utf-8", await readFile(manifestPath))
    }
    if (url.pathname === "/service-worker.js") {
      return send(response, 200, "text/javascript; charset=utf-8", await readFile(serviceWorkerPath))
    }
    if (url.pathname === "/browser-local.js") {
      if (request.headers["accept-encoding"]?.includes("gzip")) {
        response.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Content-Encoding": "gzip",
          Vary: "Accept-Encoding",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        return response.end(await browserLocalGzip)
      }
      return send(response, 200, "text/javascript; charset=utf-8", await browserLocalScript)
    }
    if (url.pathname === "/browser-options.js") {
      if (request.headers["accept-encoding"]?.includes("gzip")) {
        response.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Content-Encoding": "gzip",
          Vary: "Accept-Encoding",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        return response.end(await browserOptionsGzip)
      }
      return send(response, 200, "text/javascript; charset=utf-8", await browserOptionsScript)
    }
    if (url.pathname === "/browser-pairing.js") {
      if (request.headers["accept-encoding"]?.includes("gzip")) {
        response.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Content-Encoding": "gzip",
          Vary: "Accept-Encoding",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        return response.end(await browserPairingGzip)
      }
      return send(response, 200, "text/javascript; charset=utf-8", await browserPairingScript)
    }
    if (url.pathname === "/favicon.ico") {
      return send(response, 200, "image/x-icon", await readFile(faviconPath))
    }
    if (url.pathname === "/icons/digital-pet-16.png") {
      return send(response, 200, "image/png", await readFile(icon16Path))
    }
    if (url.pathname === "/icons/digital-pet-32.png") {
      return send(response, 200, "image/png", await readFile(icon32Path))
    }
    if (url.pathname === "/icons/digital-pet-180.png") {
      return send(response, 200, "image/png", await readFile(icon180Path))
    }
    if (url.pathname === "/icons/digital-pet-192.png") {
      return send(response, 200, "image/png", await readFile(icon192Path))
    }
    if (url.pathname === "/icons/digital-pet-512.png") {
      return send(response, 200, "image/png", await readFile(icon512Path))
    }
    if (url.pathname === "/icons/digital-pet-maskable-192.png") {
      return send(response, 200, "image/png", await readFile(maskable192Path))
    }
    if (url.pathname === "/icons/digital-pet-maskable-512.png") {
      return send(response, 200, "image/png", await readFile(maskable512Path))
    }
    if (url.pathname === "/api/mode") {
      return send(
        response,
        200,
        "application/json; charset=utf-8",
        JSON.stringify({ mode: hasHostDatabase() ? "sqlite" : "browser" }),
      )
    }
    if (url.pathname === "/api/world") {
      const regionId = url.searchParams.get("region") ?? "digital-ocean"
      if (!REGIONS.some((region) => region.id === regionId))
        return send(response, 400, "text/plain; charset=utf-8", "Unknown region")
      if (!hasHostDatabase()) return send(response, 200, "application/json; charset=utf-8", '{"mode":"browser"}')
      return send(
        response,
        200,
        "application/json; charset=utf-8",
        JSON.stringify(buildWorldPanelModel(regionId, readArchive(), DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)),
      )
    }
    if (url.pathname === "/api/sidebar") {
      if (!hasHostDatabase()) return send(response, 200, "application/json; charset=utf-8", '{"mode":"browser"}')
      const width = Number(url.searchParams.get("width") ?? 40)
      return send(response, 200, "application/json; charset=utf-8", JSON.stringify(sidebarData(width)))
    }
    if (url.pathname === "/api/dex") {
      if (!hasHostDatabase()) return send(response, 200, "application/json; charset=utf-8", '{"mode":"browser"}')
      return send(response, 200, "application/json; charset=utf-8", JSON.stringify(dexModel()))
    }
    if (url.pathname === "/api/history") {
      if (!hasHostDatabase()) return send(response, 200, "application/json; charset=utf-8", '{"mode":"browser"}')
      return send(response, 200, "application/json; charset=utf-8", JSON.stringify(historyModel()))
    }
    if (url.pathname === "/api/reference") {
      const id = url.searchParams.get("id")
      const entry =
        hasHostDatabase() && url.searchParams.get("source") !== "browser"
          ? dexModel().entries.find((candidate) => candidate.id === id && candidate.discovered)
          : DIGIMON_CATALOG.byId.get(id ?? "")
      if (entry?.url.startsWith("https://digimon.net/")) {
        response.writeHead(302, { Location: entry.url, "Cache-Control": "no-store" })
        return response.end()
      }
      return send(response, 404, "text/plain; charset=utf-8", "Record unavailable")
    }
    if (url.pathname === "/view/sidebar" || url.pathname === "/view/dex" || url.pathname === "/view/history") {
      const page = url.pathname.slice(6) as "sidebar" | "dex" | "history"
      return send(response, 200, "text/html; charset=utf-8", renderPage(page))
    }
    if (url.pathname === "/" || url.pathname === "/dex" || url.pathname === "/history") {
      const page = url.pathname === "/" ? "sidebar" : (url.pathname.slice(1) as "dex" | "history")
      return send(response, 200, "text/html; charset=utf-8", renderShell(page))
    }
    return send(response, 404, "text/plain; charset=utf-8", "Not found")
  } catch (error) {
    console.error(error)
    return send(response, 500, "text/plain; charset=utf-8", "Digital Pet could not load")
  }
})

const exportStaticSite = async (): Promise<void> => {
  if (hasHostDatabase()) throw new Error("Static export requires browser mode without a host database")
  const outputRoot = resolve(packageRoot, "dist-static")
  await rm(outputRoot, { recursive: true, force: true })
  const write = async (path: string, content: string | Buffer): Promise<void> => {
    const destination = resolve(outputRoot, path)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, content)
  }
  const stableStaticNonce = (html: string): string => {
    const nonce = /nonce-([a-f0-9]{32})/u.exec(html)?.[1]
    if (!nonce) throw new Error("Missing static page nonce")
    const stable = createHash("sha256").update(html.replaceAll(nonce, "STATIC-NONCE")).digest("hex").slice(0, 32)
    return html.replaceAll(nonce, stable)
  }
  const shell = stableStaticNonce(renderShell("sidebar"))
  const views = (["sidebar", "dex", "history"] as const).map(
    (page) => [page, stableStaticNonce(renderPage(page))] as const,
  )
  const scripts = [
    ["browser-local.js", browserLocalPath],
    ["browser-pairing.js", browserPairingPath],
    ["browser-options.js", browserOptionsPath],
    ["browser-world.js", resolve(packageRoot, "dist", "browser-world.js")],
    ["browser-scenery.js", resolve(packageRoot, "dist", "browser-scenery.js")],
  ] as const
  const scriptContents = await Promise.all(
    scripts.map(async ([name, path]) => [name, await readFile(path, "utf8")] as const),
  )
  const files = [
    ["manifest.webmanifest", manifestPath],
    ["favicon.ico", faviconPath],
    ["fonts/Silkscreen-Regular.ttf", fontPath],
    ["images/digital-world-lake-background.png", backgroundPath],
    ["icons/digital-pet-16.png", icon16Path],
    ["icons/digital-pet-32.png", icon32Path],
    ["icons/digital-pet-180.png", icon180Path],
    ["icons/digital-pet-192.png", icon192Path],
    ["icons/digital-pet-512.png", icon512Path],
    ["icons/digital-pet-maskable-192.png", maskable192Path],
    ["icons/digital-pet-maskable-512.png", maskable512Path],
  ] as const
  const serviceWorker = await readFile(serviceWorkerPath, "utf8")
  const revision = createHash("sha256")
  revision.update(shell)
  for (const [, html] of views) revision.update(html)
  for (const [, script] of scriptContents) revision.update(script)
  revision.update(serviceWorker)
  for (const [, path] of files) revision.update(await readFile(path))
  for (const place of LOCATIONS) {
    revision.update(await readFile(resolve(fieldsAssets, "scenes", `${place.scene}.svg`)))
    if (availablePhotos.includes(place.id))
      revision.update(await readFile(resolve(fieldsAssets, "backgrounds", place.backgroundFile)))
  }
  const releaseId = revision.digest("hex").slice(0, 12)
  const releaseRoot = `revisions/${releaseId}`
  const rewriteScripts = (content: string): string =>
    scriptContents.reduce((text, [name]) => text.replaceAll(`/${name}`, `/${releaseRoot}/${name}`), content)

  let staticShell = rewriteScripts(shell)
  for (const [page, html] of views) {
    const revisedPath = `/${releaseRoot}/view/${page}.html`
    staticShell = staticShell.replace(`src="/view/${page}"`, `src="${revisedPath}"`)
    const revisedHtml = rewriteScripts(html)
    await write(`${releaseRoot}/view/${page}.html`, revisedHtml)
    await write(`view/${page}.html`, revisedHtml)
  }
  await write("index.html", staticShell)
  await write("api/browser.json", '{"mode":"browser"}\n')
  for (const [name, content] of scriptContents) await write(`${releaseRoot}/${name}`, rewriteScripts(content))
  for (const [destination, source] of files) await write(destination, await readFile(source))
  for (const place of LOCATIONS) {
    await write(`regions/${place.id}/scene.svg`, await readFile(resolve(fieldsAssets, "scenes", `${place.scene}.svg`)))
    if (availablePhotos.includes(place.id))
      await write(
        `regions/${place.id}/background.png`,
        await readFile(resolve(fieldsAssets, "backgrounds", place.backgroundFile)),
      )
  }
  let versionedServiceWorker = rewriteScripts(serviceWorker).replace(
    /^const CACHE_NAME = "[^"]+"$/mu,
    `const CACHE_NAME = "web-digital-pet-${releaseId}"`,
  )
  for (const [page] of views)
    versionedServiceWorker = versionedServiceWorker.replace(`"/view/${page}"`, `"/${releaseRoot}/view/${page}.html"`)
  if (!versionedServiceWorker.includes(`const CACHE_NAME = "web-digital-pet-${releaseId}"`))
    throw new Error("Could not version the service worker cache")
  await write("service-worker.js", versionedServiceWorker)
  const precachedPaths = /const APP_FILES = (\[[\s\S]*?\])/u.exec(versionedServiceWorker)?.[1]
  if (!precachedPaths) throw new Error("Could not find the service worker asset list")
  for (const match of precachedPaths.matchAll(/"([^"]+)"/gu)) {
    const path = match[1]
    if (path === undefined) throw new Error("Invalid precached asset path")
    const name =
      path === "/" || path === "/dex" || path === "/history"
        ? "index.html"
        : path.startsWith("/view/")
          ? `${path.slice(1)}.html`
          : path.slice(1)
    if (!existsSync(resolve(outputRoot, name))) throw new Error(`Missing precached asset: ${path}`)
  }
  console.log(`Static Digital Pet exported to ${outputRoot}`)
}

if (process.env.DIGITAL_PET_STATIC_EXPORT === "1") await exportStaticSite()
else
  server.listen(port, "127.0.0.1", () => {
    console.log(`Digital Pet Web: http://localhost:${port} (database: ${databasePath})`)
  })
