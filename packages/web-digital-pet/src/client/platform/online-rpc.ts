import type { SocialCommand } from "@jcendal/digital-pet-online/social-commands.ts"

/** Transport port: API consumers do not own sockets or depend on their lifecycle. */
type Sender = (accountId: string, command: SocialCommand) => Promise<Response>
let sender: Sender | undefined
export const installSocialSender = (value: Sender): void => {
  sender = value
}
export const sendSocialCommand = (accountId: string, command: SocialCommand): Promise<Response> =>
  sender ? sender(accountId, command) : Promise.reject(new Error("online.offline"))
