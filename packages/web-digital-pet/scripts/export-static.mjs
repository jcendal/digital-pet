import { cp, mkdir, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const output = resolve(root, "dist-static")
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
await cp(resolve(root, "dist/client"), output, { recursive: true, filter: (path) => !path.includes("/.vite") })
console.log(`Static Digital Pet exported to ${output}`)
