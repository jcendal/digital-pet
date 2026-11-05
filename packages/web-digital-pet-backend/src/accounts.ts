import { createHash } from "node:crypto"
import { boundedText, identifier, OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import type { OnlineProfile } from "@jcendal/digital-pet-online/social.ts"
import { parseProfile, validAlias } from "@jcendal/web-digital-pet/protocol/social"
import { change, type ObjectStore } from "./store.ts"

export type AccountProfile = OnlineProfile
export class Accounts {
  constructor(private readonly store: ObjectStore) {}
  async ensure(id: string): Promise<AccountProfile> {
    identifier(id)
    const found = await this.store.get<AccountProfile>(`profiles/${id}`)
    if (found) return found.value
    for (let attempt = 0; attempt < 4; attempt++) {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
      const bytes = createHash("sha256").update(`${id}:${attempt}`).digest().subarray(0, 16)
      const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
      const existing = await this.store.get<{ id: string }>(`codes/${code}`)
      if (existing && existing.value.id !== id) continue
      if (!existing && !(await this.store.put(`codes/${code}`, { id }, null))) continue
      const profile: OnlineProfile = { id, code, alias: "PLAYER", revision: 0, nodeId: null, seenAt: 0 }
      if (await this.store.put(`profiles/${id}`, profile, null)) return profile
      const winner = await this.store.get<AccountProfile>(`profiles/${id}`)
      if (winner) return winner.value
    }
    throw new OnlineError("registration-retry", 409)
  }
  async find(code: string): Promise<AccountProfile> {
    if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code)) throw new OnlineError("invalid-code")
    const found = await this.store.get<{ id: string }>(`codes/${code}`)
    if (!found) throw new OnlineError("account-not-found", 404)
    return this.ensure(found.value.id)
  }
  async rename(id: string, alias: string): Promise<AccountProfile> {
    boundedText(alias, 16)
    if (!validAlias(alias)) throw new OnlineError("invalid-profile")
    const profile = await this.ensure(id)
    return change(
      this.store,
      `profiles/${identifier(id)}`,
      () => profile,
      (value) => {
        value.alias = alias.trim()
        return value
      },
    )
  }

  async presence(id: string, input: unknown): Promise<AccountProfile> {
    let profile: ReturnType<typeof parseProfile>
    try {
      profile = parseProfile(input)
    } catch {
      throw new OnlineError("invalid-profile")
    }
    const current = await this.ensure(id)
    if (
      current.alias === profile.alias &&
      current.nodeId === profile.nodeId &&
      current.arenaNodeId === profile.arenaNodeId
    )
      return current
    return change(
      this.store,
      `profiles/${identifier(id)}`,
      () => current,
      (value) => {
        value.alias = profile.alias
        value.nodeId = profile.nodeId
        value.revision++
        value.seenAt = Date.now()
        if (profile.arenaNodeId) value.arenaNodeId = profile.arenaNodeId
        else delete value.arenaNodeId
        return value
      },
    )
  }
}
