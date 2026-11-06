import { Accounts } from "../accounts.ts"
import { SocialService } from "../social.ts"
import { SocketRequests } from "../socket-requests.ts"
import { dataStore, delivery, origin, realtime } from "./realtime.ts"

export { delivery }
export const services = {
  origin,
  realtime,
  requests: new SocketRequests(dataStore),
  accounts: new Accounts(dataStore),
  social: new SocialService(dataStore),
}
