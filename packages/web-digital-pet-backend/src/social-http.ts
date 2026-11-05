import { OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import { socialCommandFor } from "@jcendal/digital-pet-online/social-commands.ts"
import { authorizedHandler } from "./api-http.ts"
import { response } from "./http.ts"
import { executeSocial, type SocialServices } from "./social-application.ts"
export const socialHandler = (services: SocialServices & { origin: string }) =>
  authorizedHandler(services.origin, async ({ actor, method, path, body, event }) => {
    const command = socialCommandFor(method, path, body, event.queryStringParameters?.after)
    if (!command) throw new OnlineError("not-found", 404)
    return response(200, await executeSocial(services, actor, command))
  })
