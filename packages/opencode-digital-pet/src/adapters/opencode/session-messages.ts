import type { Message, SessionMessagesResponse } from "@opencode-ai/sdk"
import { IntlModule } from "../../i18n.ts"

export type SessionMessagesFetcher = (sessionID: string) => Promise<readonly Message[]>

export type SessionMessagesClient = {
  readonly session: {
    messages: (options: { readonly path: { readonly id: string } }) => Promise<{
      readonly data: SessionMessagesResponse | undefined
    }>
  }
}

export const createSessionMessagesFetcher = (client: SessionMessagesClient): SessionMessagesFetcher => {
  return async (sessionID) => {
    const result = await client.session.messages({ path: { id: sessionID } })
    if (result.data === undefined)
      throw new Error(
        IntlModule.translate("sessionMessages.unableToListMessagesForIdleSession", { sessionID: sessionID }),
      )
    return result.data.map(({ info }) => info)
  }
}
