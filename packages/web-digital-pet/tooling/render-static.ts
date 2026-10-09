import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { hasHostDatabase } from "../src/server/persistence/sqlite.ts"
import { loadBuildResources } from "../src/server/rendering/build-resources.ts"
import { renderPage, renderShell, stableStaticNonce } from "../src/server/rendering/pages.ts"

if (hasHostDatabase()) throw new Error("Static export requires browser mode without a host database")
const root = fileURLToPath(new URL(".", import.meta.url))
const output = resolve(root, "client")
const resources = await loadBuildResources(output, "browser")
resources.views = {}
await mkdir(resolve(output, "view"), { recursive: true })
for (const page of ["sidebar", "dex", "history"] as const) {
  const html = stableStaticNonce(renderPage(page, resources))
  const hash = createHash("sha256").update(html).digest("hex").slice(0, 12)
  const path = `assets/${page}-${hash}.html`
  await writeFile(resolve(output, path), html)
  await writeFile(resolve(output, `view/${page}.html`), html)
  resources.views[page] = `/${path}`
}
await writeFile(resolve(output, "index.html"), stableStaticNonce(renderShell("sidebar", resources)))
await mkdir(resolve(output, "api"), { recursive: true })
await writeFile(resolve(output, "api/browser.json"), '{"mode":"browser"}\n')
const manifest = JSON.parse(await readFile(resolve(root, "../assets/manifest.webmanifest"), "utf8"))
for (const icon of manifest.icons) {
  const url = resources.assets[icon.src]
  if (!url) throw new Error(`Missing manifest icon: ${icon.src}`)
  icon.src = url
}
await writeFile(resolve(output, "manifest.webmanifest"), JSON.stringify(manifest, null, 2))
