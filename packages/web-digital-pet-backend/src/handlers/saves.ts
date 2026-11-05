import { services } from "../runtime/saves.ts"
import { savesHandler } from "../saves-http.ts"
export const handler = savesHandler(services)
