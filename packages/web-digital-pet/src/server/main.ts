import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createWebServer } from "./http/app.ts"
import { databasePath } from "./persistence/sqlite.ts"
import { loadBuildResources } from "./rendering/build-resources.ts"

const clientRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "client")
const port = Number(process.env.PORT ?? 4173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535")
const server = createWebServer(await loadBuildResources(clientRoot, "local"), clientRoot)
server.listen(port, "127.0.0.1", () =>
  console.log(`Digital Pet Web: http://localhost:${port} (database: ${databasePath})`),
)
