import { existsSync, readdirSync, readFileSync } from "node:fs"
import { basename, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { LOCATIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import type { Plugin } from "vite"

export const resourceFiles = (root: string): Record<string, string> => {
  const fields = resolve(root, "../digital-pet-fields/assets")
  const files: Record<string, string> = {
    "/fonts/Silkscreen-Regular.ttf": fileURLToPath(
      import.meta.resolve("@jcendal/digital-pet-webviews/assets/fonts/Silkscreen-Regular.ttf"),
    ),
    "/favicon.ico": resolve(root, "assets/icons/favicon.ico"),
  }
  for (const name of readdirSync(resolve(root, "assets/icons")).filter((name) => name.endsWith(".png")))
    files[`/icons/${name}`] = resolve(root, "assets/icons", name)
  for (const place of LOCATIONS) {
    files[`/regions/${place.id}/scene.svg`] = resolve(fields, "scenes", `${place.scene}.svg`)
    const background = resolve(fields, "backgrounds", place.backgroundFile)
    if (existsSync(background)) files[`/regions/${place.id}/background.png`] = background
  }
  return files
}

/** One inventory supplies browser imports, CSS resolution and the server's URL manifest. */
export const resourcesPlugin = (files: Record<string, string>): Plugin => {
  const references = new Map<string, string>()
  let development = false
  return {
    name: "digital-pet-resources",
    configResolved(config) {
      development = config.command === "serve"
    },
    buildStart() {
      if (development) return
      for (const [url, path] of Object.entries(files)) {
        this.addWatchFile(path)
        references.set(url, this.emitFile({ type: "asset", name: basename(path), source: readFileSync(path) }))
      }
    },
    resolveId(id) {
      if (id === "virtual:pet-assets") return "\0virtual:pet-assets"
    },
    load(id) {
      if (id !== "\0virtual:pet-assets") return
      const entries = Object.entries(files).map(
        ([url, path]) =>
          `${JSON.stringify(url)}: ${development ? JSON.stringify(`/@fs${path}`) : `import.meta.ROLLUP_FILE_URL_${references.get(url)}`}`,
      )
      return `export default {${entries.join(",")}}`
    },
    resolveFileUrl({ fileName }) {
      return JSON.stringify(`/${fileName}`)
    },
    generateBundle() {
      const assets = Object.fromEntries(
        [...references].map(([url, reference]) => [url, `/${this.getFileName(reference)}`]),
      )
      this.emitFile({ type: "asset", fileName: ".vite/resources.json", source: JSON.stringify(assets, null, 2) })
    },
  }
}

/** Preserve the shared renderers' Bun/esbuild text-import contract in Vite. */
export const textImportsPlugin = (): Plugin => ({
  name: "digital-pet-text-imports",
  enforce: "pre",
  transform(code, id) {
    if (!/\.[jt]s$/.test(id) || !code.includes('type: "text"')) return
    return {
      code: code.replace(
        /from "([^"]+)" with \{ type: "text" \}/g,
        (_match, path: string) => `from "${path.endsWith("?raw") ? path : `${path}?raw`}"`,
      ),
      map: null,
    }
  },
})
