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
await build({
  entryPoints: [resolve(root, "src/browser-local.ts")],
  outfile: resolve(root, "dist/browser-local.js"),
  bundle: true,
  platform: "browser",
  target: "es2022",
  format: "esm",
  charset: "utf8",
  minify: true,
  sourcemap: false,
  logLevel: "info",
})
await build({
  entryPoints: [resolve(root, "src/browser-pairing.ts")],
  outfile: resolve(root, "dist/browser-pairing.js"),
  bundle: true,
  platform: "browser",
  target: "es2022",
  format: "esm",
  charset: "utf8",
  minify: true,
  sourcemap: false,
  logLevel: "info",
})
