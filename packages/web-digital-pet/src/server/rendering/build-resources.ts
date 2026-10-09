import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { Manifest } from "vite"

export interface WebResources {
  views?: Partial<Record<"sidebar" | "dex" | "history", string>>
  mode: "browser" | "local"
  development?: boolean
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
