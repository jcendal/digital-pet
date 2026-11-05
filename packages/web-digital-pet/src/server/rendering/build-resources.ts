import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { Manifest } from "vite"

export interface WebResources {
  views?: Partial<Record<"sidebar" | "dex" | "history", string>>
  mode: "browser" | "local"
  development?: boolean
  online?: { socketUrl: string; backupOrigin: string }
  assets: Record<string, string>
  entryTags: (entry: "shell" | "frame") => string
}
export const assetUrl = (resources: WebResources, path: string): string => {
  const url = resources.assets[path]
  if (!url) throw new Error(`Unknown web asset: ${path}`)
  return url
}

export const entries = {
  shell: "src/client/shell/main.browser.js",
  frame: "src/client/bridge/frame.browser.js",
} as const

export const loadBuildResources = async (clientRoot: string, mode: WebResources["mode"]): Promise<WebResources> => {
  const manifest: Manifest = JSON.parse(await readFile(resolve(clientRoot, ".vite/manifest.json"), "utf8"))
  const assets: Record<string, string> = JSON.parse(await readFile(resolve(clientRoot, ".vite/resources.json"), "utf8"))
  return {
    mode,
    ...onlineResources(mode),
    assets,
    entryTags(entry) {
      const styles = new Set<string>()
      const visited = new Set<string>()
      const visit = (key: string) => {
        if (visited.has(key)) return
        visited.add(key)
        const chunk = manifest[key]
        if (!chunk) throw new Error(`Missing Vite entry: ${key}`)
        for (const imported of chunk.imports ?? []) visit(imported)
        for (const css of chunk.css ?? []) styles.add(css)
      }
      visit(entries[entry])
      return (
        [...styles].map((css) => `<link rel="stylesheet" href="/${css}">`).join("") +
        `<script type="module" src="/${manifest[entries[entry]]!.file}"></script>`
      )
    },
  }
}

export const onlineResources = (mode: WebResources["mode"]): Pick<WebResources, "online"> => {
  if (mode !== "browser" || !process.env.DIGITAL_PET_WEBSOCKET_URL) return {}
  const socket = new URL(process.env.DIGITAL_PET_WEBSOCKET_URL)
  const backup = new URL(process.env.DIGITAL_PET_BACKUP_ORIGIN ?? "")
  const local = (url: URL) => ["127.0.0.1", "localhost"].includes(url.hostname)
  if (
    (socket.protocol !== "wss:" && !(local(socket) && socket.protocol === "ws:")) ||
    (backup.protocol !== "https:" && !(local(backup) && backup.protocol === "http:")) ||
    socket.username ||
    socket.password ||
    backup.username ||
    backup.password ||
    socket.search ||
    socket.hash ||
    backup.href !== `${backup.origin}/`
  )
    throw new Error("Invalid online service origins")
  return { online: { socketUrl: socket.href, backupOrigin: backup.origin } }
}
