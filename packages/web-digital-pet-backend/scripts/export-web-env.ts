import { appendFile, readFile } from "node:fs/promises"
import { webEnvironment } from "../infrastructure/deployment-config.ts"

const [source] = process.argv.slice(2)
if (!source || !process.env.GITHUB_ENV) throw new Error("Usage: export-web-env.ts outputs.json (requires GITHUB_ENV)")
const settings = webEnvironment(JSON.parse(await readFile(source, "utf8")))
await appendFile(
  process.env.GITHUB_ENV,
  Object.entries(settings)
    .map(([key, value]) => `${key}=${value}\n`)
    .join(""),
)
