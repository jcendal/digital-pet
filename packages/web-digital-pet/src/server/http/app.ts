import { createServer, type ServerResponse } from "node:http"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { REGIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import { buildWorldPanelModel } from "@jcendal/digital-pet-webviews/panels/world/world-model.ts"
import { IntlModule } from "../../shared/i18n.ts"
import { hasHostDatabase, readArchive } from "../persistence/sqlite.ts"
import type { WebResources } from "../rendering/build-resources.ts"
import { dexModel, historyModel, sidebarData } from "../rendering/host-models.ts"
import { renderPage, renderShell } from "../rendering/pages.ts"
import { serveAsset } from "./assets.ts"

const send = (response: ServerResponse, status: number, contentType: string, body: string | Buffer): void => {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  response.end(body)
}

export const createWebServer = (resources: WebResources, clientRoot?: string) =>
  createServer(createWebHandler(resources, clientRoot))

export const createWebHandler = (resources: WebResources, clientRoot?: string) => {
  return async (request: import("node:http").IncomingMessage, response: ServerResponse) => {
    try {
      if (request.method !== "GET" || !request.url)
        return send(response, 405, "text/plain; charset=utf-8", IntlModule.translate("app.methodNotAllowed"))
      const host = request.headers.host ?? ""
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
        return send(response, 403, "text/plain; charset=utf-8", "Forbidden")
      const url = new URL(request.url, `http://${host}`)
      if (clientRoot && (await serveAsset(request, response, url.pathname, clientRoot))) return
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
          return send(response, 400, "text/plain; charset=utf-8", IntlModule.translate("app.unknownRegion"))
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
        return send(response, 404, "text/plain; charset=utf-8", IntlModule.translate("app.recordUnavailable"))
      }
      if (url.pathname === "/view/sidebar" || url.pathname === "/view/dex" || url.pathname === "/view/history") {
        const page = url.pathname.slice(6) as "sidebar" | "dex" | "history"
        return send(response, 200, "text/html; charset=utf-8", renderPage(page, resources))
      }
      if (url.pathname === "/" || url.pathname === "/dex" || url.pathname === "/history") {
        const page = url.pathname === "/" ? "sidebar" : (url.pathname.slice(1) as "dex" | "history")
        return send(response, 200, "text/html; charset=utf-8", renderShell(page, resources))
      }
      return send(response, 404, "text/plain; charset=utf-8", IntlModule.translate("app.notFound"))
    } catch (error) {
      console.error(error)
      return send(response, 500, "text/plain; charset=utf-8", IntlModule.translate("app.digitalPetCouldNotLoad"))
    }
  }
}
