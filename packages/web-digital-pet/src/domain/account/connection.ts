import type { SocialState } from "../social/model.ts"

/** Reusing a session never resets contacts; legacy contacts require a migration choice. */
export const accountConnection = (
  localAccount: string | null,
  account: string,
  social?: SocialState,
): "ready" | "connect" | "confirm" => {
  if (localAccount === account) return "ready"
  if (localAccount) return "confirm"
  if (
    social &&
    (Object.keys(social.friends).length ||
      Object.keys(social.inbox).length ||
      Object.keys(social.outbox).length ||
      Object.keys(social.trades).length ||
      Object.keys(social.giftDays).length ||
      social.log.length)
  )
    return "confirm"
  return "connect"
}
