import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
process.env.DIGITAL_PET_STATIC_EXPORT = "1"
process.env.DIGITAL_PET_DATABASE_PATH = resolve(packageRoot, "dist-static", ".no-host-database")
await import("../dist/server.js")
