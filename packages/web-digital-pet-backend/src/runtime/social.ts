import { Accounts } from "../accounts.ts"
import { SocialService } from "../social.ts"
import { dataStore, delivery, origin, realtime } from "./realtime.ts"

export { delivery }
export const services = { origin, realtime, accounts: new Accounts(dataStore), social: new SocialService(dataStore) }
