import { authHandler } from "../auth-http.ts"
import { services } from "../runtime/auth.ts"
export const handler = authHandler(services)
