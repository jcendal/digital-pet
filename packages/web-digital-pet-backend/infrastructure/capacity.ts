export const HANDLERS = ["auth", "authorizer", "saves", "social", "realtime"] as const
export const checkCapacity = (unreserved: number): number => {
  if (!Number.isInteger(unreserved) || unreserved < 0) throw new Error("Invalid Lambda account concurrency response")
  if (unreserved === 0)
    throw new Error("No shared Lambda concurrency available; check the account's existing reservations")
  return unreserved
}
