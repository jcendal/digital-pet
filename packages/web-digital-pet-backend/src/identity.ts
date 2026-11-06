import { createHash } from "node:crypto"
import { identifier, OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
export const digest = (value: string): string => createHash("sha256").update(value).digest("hex")

export const relationshipId = (a: string, b: string): string => {
  identifier(a)
  identifier(b)
  if (a === b) throw new OnlineError("same-account")
  return digest(JSON.stringify([a, b].sort()))
}
