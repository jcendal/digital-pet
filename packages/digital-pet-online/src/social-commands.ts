import { OnlineError, record } from "./contracts.ts"
export const SOCIAL_COMMAND_TYPES = [
  "profile.read",
  "profile.rename",
  "profile.publish",
  "profile.lookup",
  "inbox.read",
  "battle.decide",
  "invitation.send",
  "invitation.decide",
  "friend.remove",
  "gift.send",
  "gift.claim",
  "gift.applied",
  "trade.read",
  "trade.prepare",
  "trade.confirm",
  "trade.cancel",
  "trade.applied",
  "challenge.send",
] as const
export type SocialCommandType = (typeof SOCIAL_COMMAND_TYPES)[number]
export type SocialCommand = { type: SocialCommandType; input: Record<string, unknown> }
export const parseSocialCommand = (input: unknown): SocialCommand => {
  const value = record(input)
  if (typeof value.type !== "string" || !SOCIAL_COMMAND_TYPES.some((type) => type === value.type))
    throw new OnlineError("invalid-command")
  return { type: value.type as SocialCommandType, input: record(value.input) }
}

/** HTTP compatibility belongs at the transport boundary, not in domain services. */
export const socialCommandFor = (
  method: string,
  path: string,
  input: Record<string, unknown>,
  after?: string,
): SocialCommand | undefined => {
  path = path.replace(/^\/api\/v1/, "")
  const command = (type: SocialCommandType, values = input): SocialCommand => ({ type, input: values })
  if (path === "/me/profile") {
    if (method === "GET") return command("profile.read")
    if (method === "PUT") return command("profile.rename")
  }
  if (path === "/me/inbox" && method === "GET") return command("inbox.read", { after: after ?? "" })
  if (path === "/me/presence" && method === "POST") return command("profile.publish")
  if (path === "/me/battle-decision" && method === "POST") return command("battle.decide")
  if (path === "/invitations" && method === "POST") return command("invitation.send")
  const lookup = /^\/profiles\/by-code\/([A-HJ-NP-Z2-9]{16})$/.exec(path)
  if (lookup && method === "GET") return command("profile.lookup", { code: lookup[1] })
  const pair =
    /^\/relationships\/([a-f0-9]{64})(?:\/(invitations|gifts|trades|challenges)(?:\/([A-Za-z0-9_-]+)(?:\/(decision|claim|applied|confirm|cancel))?)?)?$/.exec(
      path,
    )
  if (!pair) return
  const [, relationship, resource, operation, action] = pair
  const args = { ...input, relationship, operation }
  if (resource === "trades" && operation && !action && method === "GET") return command("trade.read", args)
  if (!resource && method === "DELETE") return command("friend.remove", args)
  if (method !== "POST") return
  if (resource === "challenges" && !operation) return command("challenge.send", args)
  if (resource === "invitations" && operation && action === "decision") return command("invitation.decide", args)
  if (resource === "gifts") {
    if (!operation) return command("gift.send", args)
    if (action === "claim" || action === "applied") return command(`gift.${action}`, args)
  }
  if (resource === "trades") {
    if (!operation) return command("trade.prepare", args)
    if (action === "confirm" || action === "cancel" || action === "applied") return command(`trade.${action}`, args)
  }
}
