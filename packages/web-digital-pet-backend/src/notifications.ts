import type { OnlineRelationship } from "@jcendal/digital-pet-online/social.ts"
import type { BattleRelationship } from "./battle-decisions.ts"
import type { RealtimeService } from "./realtime.ts"
import type { ObjectStore } from "./store.ts"

/** S3 retries these hints independently of the HTTP mutation that committed them. */
export class Notifications {
  constructor(
    private store: ObjectStore,
    private realtime: RealtimeService,
  ) {}

  async changed(key: string, revision: string): Promise<void> {
    const recipients = new Set<string>()
    let topic: "social" | "battle" = "social"
    if (key.startsWith("relationships/")) {
      const pair = await this.store.get<BattleRelationship>(key)
      for (const member of pair?.value.members ?? []) recipients.add(member)
      if (Object.keys(pair?.value.battles ?? {}).length)
        await Promise.all(
          [...recipients].map((account) => this.realtime.notify(account, "battle", `${key}:${revision}`)),
        )
    } else if (key.startsWith("battle-decisions/")) {
      const decision = await this.store.get<{ members: Array<{ accountId: string }> }>(key)
      for (const member of decision?.value.members ?? []) recipients.add(member.accountId)
      topic = "battle"
    } else if (key.startsWith("profiles/") || key.startsWith("realtime/subscribers/")) {
      const account = key.split("/").at(-1)!
      if (key.startsWith("profiles/")) recipients.add(account)
      const index = await this.store.get<{ relationships: string[] }>(`social-index/${account}`)
      const ids = index?.value.relationships ?? []
      // The social service bounds the index; batch reads to avoid an unbounded fanout.
      for (let offset = 0; offset < ids.length; offset += 8) {
        const pairs = await Promise.all(
          ids.slice(offset, offset + 8).map((id) => this.store.get<OnlineRelationship>(`relationships/${id}`)),
        )
        for (const pair of pairs)
          if (pair?.value.active && pair.value.members.includes(account))
            for (const member of pair.value.members) if (member !== account) recipients.add(member)
      }
    }
    const accounts = [...recipients]
    for (let offset = 0; offset < accounts.length; offset += 8)
      await Promise.all(
        accounts.slice(offset, offset + 8).map((account) => this.realtime.notify(account, topic, `${key}:${revision}`)),
      )
  }
}
