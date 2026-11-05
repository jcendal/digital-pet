import { mkdir, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const root = fileURLToPath(new URL("../", import.meta.url))
await rm(`${root}/dist`, { recursive: true, force: true })
await mkdir(`${root}/dist`, { recursive: true })
await build({
  absWorkingDir: root,
  entryPoints: ["auth", "authorizer", "saves", "social", "realtime"].map((name) => `src/handlers/${name}.ts`),
  outdir: "dist",
  outExtension: { ".js": ".cjs" },
  platform: "node",
  target: "node24",
  bundle: true,
  format: "cjs",
  minify: true,
  sourcemap: "external",
  logLevel: "info",
})
