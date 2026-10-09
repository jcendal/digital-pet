import { readFile } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import { extname, resolve, sep } from "node:path"
import { gzipSync } from "node:zlib"
import { sendCachedAsset } from "./cache.ts"

const contentTypes: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
}

export const serveAsset = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  root: string,
): Promise<boolean> => {
  if (!pathname.startsWith("/assets/") && pathname !== "/manifest.webmanifest" && pathname !== "/service-worker.js")
    return false
  const path = resolve(root, `.${decodeURIComponent(pathname)}`)
  if (pathname.startsWith("/assets/") && !path.startsWith(`${resolve(root, "assets")}${sep}`)) return false
  const type = contentTypes[extname(path)]
  if (!type) return false
  let body: Buffer
  try {
    body = await readFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
  const compressible = /\.(js|css|html|svg)$/.test(path)
  const gzip = compressible && /\bgzip\b/.test(request.headers["accept-encoding"] ?? "")
  sendCachedAsset(
    request,
    response,
    type,
    gzip ? gzipSync(body) : body,
    gzip ? "gzip" : undefined,
    compressible,
    pathname.startsWith("/assets/"),
  )
  return true
}
