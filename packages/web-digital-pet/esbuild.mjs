import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "esbuild"

const root = dirname(fileURLToPath(import.meta.url))
await mkdir(resolve(root, "dist"), { recursive: true })
await build({
  entryPoints: [resolve(root, "src/server.ts")],
  outfile: resolve(root, "dist/server.js"),
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  packages: "bundle",
  sourcemap: false,
  logLevel: "info",
})
