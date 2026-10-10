import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { build, context } from "esbuild"

const packageRoot = dirname(fileURLToPath(import.meta.url))
const distDirectory = resolve(packageRoot, "dist")
const require = createRequire(import.meta.url)
const wasmSource = require.resolve("sql.js/dist/sql-wasm.wasm")
const development = process.argv.includes("--development") || process.argv.includes("--watch")
await rm(distDirectory, { recursive: true, force: true })
await mkdir(distDirectory, { recursive: true })
await copyFile(wasmSource, resolve(distDirectory, "sql-wasm.wasm"))
const fontsDirectory = resolve(distDirectory, "assets/fonts")
const iconsDirectory = resolve(distDirectory, "assets/icons")
await mkdir(fontsDirectory, { recursive: true })
await mkdir(iconsDirectory, { recursive: true })
for (const name of ["Silkscreen-Regular.ttf", "OFL.txt"])
  await copyFile(require.resolve(`@jcendal/digital-pet-webviews/assets/fonts/${name}`), resolve(fontsDirectory, name))
await copyFile(resolve(packageRoot, "../../assets/branding/logo.png"), resolve(iconsDirectory, "logo.png"))

for (const locale of ["en", "ko", "es", "gl"]) {
  const dictionary = JSON.parse(await readFile(resolve(packageRoot, `assets/i18n/${locale}.json`), "utf8"))
  const metadata = Object.fromEntries(Object.entries(dictionary).filter(([key]) => key.startsWith("contributions.")))
  await writeFile(
    resolve(packageRoot, locale === "en" ? "package.nls.json" : `package.nls.${locale}.json`),
    JSON.stringify(metadata, null, 2) + "\n",
  )
}

const options = {
  entryPoints: [resolve(packageRoot, "src/extension.ts")],
  outfile: resolve(distDirectory, "extension.js"),
  bundle: true,
  platform: "node",
  target: "node22.13",
  format: "cjs",
  external: ["vscode", "bun:sqlite"],
  define: { __DIGITAL_PET_BUNDLE__: "true", "import.meta.url": "undefined" },
  minify: !development,
  sourcemap: development,
  logLevel: "info",
}

if (process.argv.includes("--watch")) {
  const buildContext = await context(options)
  await buildContext.watch()
  console.log("Watching cursor-digital-pet")
} else {
  await build(options)
}
