import { INVITATION_LIFETIME_MS, identifier, OnlineError } from "@jcendal/digital-pet-online/contracts.ts"

export const operationId = (value: unknown, now = Date.now()): string => {
  const id = identifier(value)
  const match = /^(\d{13})-[a-f0-9-]{36}$/.exec(id)
  const createdAt = Number(match?.[1])
  if (!match || createdAt > now + 60_000 || createdAt <= now - INVITATION_LIFETIME_MS)
    throw new OnlineError("operation-expired", 409)
  return id
}
export const numberOf = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new OnlineError("invalid-number")
  return value
}
