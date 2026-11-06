import { sameDestination } from "@jcendal/digital-pet-online/contracts.ts"
import type { InboxPage, OnlineProfile, OnlineRelationship, OnlineTrade } from "@jcendal/digital-pet-online/social.ts"
import { type Event, type Offer, type Profile, parseProfile } from "../../../domain/social/model.ts"
import { readArenaFighter } from "../../persistence/arena-store.ts"
import {
  beginGiftClaim,
  clearGiftIntent,
  mergeOnlineRelationship,
  readGiftIntent,
} from "../../persistence/online-social-store.ts"
import { assertContext, type OnlineContext, sameContext } from "../../persistence/online-store.ts"
import { readLocalState, readPendingBattle } from "../../persistence/pet-store.ts"
import { prepareTrade, queueSocial, readSocial, updateSocial } from "../../persistence/social-store.ts"
import { ApiError, api, newOperationId, onlineConfigured, onlineContext } from "../../platform/online-api.ts"
import { onlineWire } from "../../platform/online-wire.ts"
import { browserSaveSelected, refreshBrowserViews } from "../../platform/save-source.ts"

type Pair = { id: string; value: OnlineRelationship; profile: OnlineProfile }
export class SocialSession {
  code = ""
  ready = false
  otherTab = false
  readonly channels = new Map<string, { profile: Profile }>()
  private pairs = new Map<string, Pair>()
  private context: OnlineContext | undefined
  private available = new Set<string>()
  private enabled = false
  private owner = false
  private queue: Promise<void> = Promise.resolve()
  private profileAccount = ""
  private published = ""
  private syncing: Promise<void> | undefined
  private syncAgain = false
  private hintTimer: number | undefined
  private retryTimer?: number
  private retryAttempt = 0
  private expiryTimer?: number
  constructor(
    private changed: () => void,
    private error: (error: unknown) => void,
    private busy: () => boolean,
  ) {}
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const task = this.queue.then(work)
    this.queue = task.then(
      () => {},
      () => {},
    )
    return task
  }
  async start(): Promise<void> {
    this.enabled = browserSaveSelected()
    window.addEventListener("pagehide", () => this.stop())
    window.addEventListener("digital-pet:online-disconnected", () => this.stop())
    for (const event of [
      "online",
      "pageshow",
      "digital-pet:online-ready",
      "digital-pet:online-released",
      "digital-pet:online-ownership",
    ])
      window.addEventListener(event, () => {
        void this.reconnect().catch(this.error)
      })
    window.addEventListener("digital-pet:account-changed", () => {
      this.profileAccount = ""
      this.context = undefined
      this.pairs.clear()
      this.published = ""
      void this.reconnect().catch(this.error)
    })
    const reconcile = () => {
      if (this.hintTimer !== undefined) return
      this.hintTimer = window.setTimeout(() => {
        this.hintTimer = undefined
        void this.reconnect().catch(this.error)
      }, 50)
    }
    window.addEventListener("digital-pet:online-social", reconcile)
    // Opening a social view also recovers a notification lost during a connection gap.
    const reconcileView = (path: string) => {
      if (/^\/?#(?:friends|activity|profile|arena)(?:$|\?)/.test(path)) reconcile()
    }
    window.addEventListener("digital-pet:navigate", (event) => {
      if (event instanceof CustomEvent && typeof event.detail === "string") reconcileView(event.detail)
    })
    window.addEventListener("hashchange", () => reconcileView(location.hash))
    window.addEventListener("digital-pet:save-updated", () => {
      if (this.owner && this.ready && !document.hidden) void this.publishProfile().catch(this.error)
    })
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop()
      else void this.reconnect().catch(this.error)
    })
    await this.reconnect()
  }
  setEnabled(value: boolean): void {
    if (this.enabled === value) return
    this.enabled = value
    if (!value) this.stop()
    else void this.reconnect().catch(this.error)
  }
  get online(): Set<string> {
    return new Set(this.available)
  }
  async reconnect(): Promise<void> {
    if (!onlineConfigured() || !this.enabled || !browserSaveSelected() || document.hidden || !navigator.onLine) return
    this.owner = onlineWire.connected
    this.otherTab = onlineWire.waitingForConnection
    if (!this.owner) {
      this.ready = false
      this.changed()
      return
    }
    if (this.syncing) {
      this.syncAgain = true
      return this.syncing
    }
    window.clearTimeout(this.retryTimer)
    this.syncing = this.exclusive(async () => {
      do {
        this.syncAgain = false
        if (!this.owner || !this.enabled || document.hidden) return
        try {
          await this.sync()
          if (!this.owner || !onlineWire.connected) return
          this.ready = true
          this.retryAttempt = 0
        } catch (error) {
          this.ready = false
          this.available.clear()
          if (!(error instanceof Error && ["online.signIn", "online.adoptFirst"].includes(error.message))) {
            this.error(error)
            if (this.retryAttempt < 3)
              this.retryTimer = window.setTimeout(
                () => {
                  void this.reconnect().catch(this.error)
                },
                1000 * 2 ** this.retryAttempt++,
              )
          }
          this.syncAgain = false
        }
        this.changed()
      } while (this.syncAgain)
    }).finally(() => {
      this.syncing = undefined
    })
    return this.syncing
  }
  private async sync(): Promise<void> {
    const context = await onlineContext()
    if (this.profileAccount !== context.accountId) {
      const me = await api<OnlineProfile>("/api/v1/me/profile", "GET", undefined, context.accountId)
      this.code = me.code
      this.profileAccount = context.accountId
      this.published = JSON.stringify([me.alias, me.nodeId, me.arenaNodeId])
    }
    await this.publish(context)
    const intent = await readGiftIntent()
    if (intent && sameContext(intent.context, context)) {
      try {
        await api(
          `/api/v1/relationships/${intent.pair}/gifts/${intent.id}/claim`,
          "POST",
          { generation: intent.generation, destination: context },
          context.accountId,
        )
      } catch (error) {
        if (error instanceof ApiError && [404, 409].includes(error.status)) await clearGiftIntent(context, intent.id)
        else throw error
      }
    }
    let after: string | null = ""
    const pairs = new Map<string, Pair>()
    const profiles = new Map<string, OnlineProfile>()
    for (let pageNumber = 0; after !== null && pageNumber < 40; pageNumber++) {
      const page: InboxPage = await api(
        `/api/v1/me/inbox?after=${encodeURIComponent(after)}`,
        "GET",
        undefined,
        context.accountId,
      )
      for (const profile of page.profiles) profiles.set(profile.id, profile)
      for (const entry of page.relationships) {
        const other = entry.value.members.find((member) => member !== context.accountId)
        const profile = other ? profiles.get(other) : undefined
        if (!profile) throw new Error("social.invalid")
        const pair: Pair = { ...entry, profile }
        await this.recoverPrepared(context, pair)
        const acks = await mergeOnlineRelationship(context, pair.id, pair.value, profile)
        for (const ack of acks)
          await api(
            `/api/v1/relationships/${ack.pair}/${ack.kind}/${ack.id}/applied`,
            "POST",
            { destination: context },
            context.accountId,
          )
        pairs.set(profile.code, pair)
        this.channels.set(profile.code, { profile: parseProfile(profile) })
        if (pair.value.active && page.online.includes(profile.id)) this.available.add(profile.code)
        else this.available.delete(profile.code)
      }
      after = page.next
    }
    if (after !== null) throw new Error("social.full")
    this.pairs = pairs
    this.context = context
    window.clearTimeout(this.expiryTimer)
    const deadlines = [...pairs.values()]
      .flatMap(({ value }) => [
        ...value.invitations.filter((item) => item.state === "pending").map((item) => item.expiresAt),
        ...value.gifts.filter((item) => item.state === "pending").map((item) => item.expiresAt),
        ...value.trades.filter((item) => item.state === "pending").map((item) => item.expiresAt),
        ...(value.challenges ?? []).map((item) => item.expiresAt),
      ])
      .filter((deadline) => deadline > Date.now())
    if (deadlines.length)
      this.expiryTimer = window.setTimeout(
        () => {
          void this.reconnect().catch(this.error)
        },
        Math.min(...deadlines) - Date.now() + 100,
      )
    for (const code of this.available) if (!pairs.has(code)) this.available.delete(code)
    refreshBrowserViews()
  }
  private async recoverPrepared(context: OnlineContext & { accountId: string }, pair: Pair): Promise<void> {
    const saved = await readSocial()
    for (let index = 0; index < pair.value.trades.length; index++) {
      const trade = pair.value.trades[index]
      if (!trade || !pair.value.active || trade.state !== "pending" || trade.expiresAt <= Date.now()) continue
      const local = saved.trades[trade.id]
      if (local?.phase !== "prepared") continue
      let side = trade.sides[context.accountId]
      if (side && !sameDestination(side.destination, context)) continue
      if (!side) {
        const prepared = await api<OnlineTrade>(
          `/api/v1/relationships/${pair.id}/trades`,
          "POST",
          { id: trade.id, generation: pair.value.generation, destination: context, offer: local.local },
          context.accountId,
        )
        pair.value.trades[index] = prepared
        side = prepared.sides[context.accountId]
      }
      if (side && !trade.confirmed.includes(context.accountId)) {
        try {
          pair.value.trades[index] = await api<OnlineTrade>(
            `/api/v1/relationships/${pair.id}/trades/${trade.id}/confirm`,
            "POST",
            { destination: context },
            context.accountId,
          )
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409) throw error
        }
      }
    }
  }
  private async publish(context: OnlineContext & { accountId: string }): Promise<void> {
    const social = await readSocial()
    if (!social.profile) return
    const pet = await readLocalState()
    const fighter = await readArenaFighter(pet)
    const signature = JSON.stringify([social.profile.alias, pet.currentNodeId, fighter.currentNodeId])
    if (signature === this.published) return
    await api(
      "/api/v1/me/presence",
      "POST",
      { profile: { ...social.profile, nodeId: pet.currentNodeId, arenaNodeId: fighter.currentNodeId } },
      context.accountId,
    )
    this.published = signature
  }
  publishProfile(): Promise<void> {
    return this.exclusive(async () => {
      await this.publish(await onlineContext())
    })
  }
  connect(code: string): void {
    void this.exclusive(async () => {
      const profile = await api<OnlineProfile>(`/api/v1/profiles/by-code/${code}`)
      this.channels.set(code, { profile: parseProfile(profile) })
      this.changed()
    }).catch(this.error)
  }
  friendAccount(code: string): string {
    const pair = this.pair(code)
    if (!pair.value.active) throw new Error("social.notFriend")
    return pair.profile.id
  }
  get recoveries(): Array<{ id: string; code: string; alias: string }> {
    const context = this.context
    if (!context?.accountId) return []
    const accountId = context.accountId
    return [...this.pairs.values()].flatMap((pair) =>
      pair.value.trades.flatMap((trade) => {
        const side = trade.sides[accountId]
        return trade.state === "committed" && side && !side.applied && !sameDestination(side.destination, context)
          ? [{ id: trade.id, code: pair.profile.code, alias: pair.profile.alias }]
          : []
      }),
    )
  }
  releaseTrade(id: string): Promise<void> {
    return this.exclusive(async () => {
      const recovery = this.recoveries.find((item) => item.id === id)
      if (!recovery) throw new Error("social.invalid")
      const context = await onlineContext()
      await api(
        `/api/v1/relationships/${this.pair(recovery.code).id}/trades/${id}/release`,
        "POST",
        { destination: context },
        context.accountId,
      )
      await this.sync()
      this.changed()
    })
  }
  private pair(code: string): Pair {
    const pair = this.pairs.get(code)
    if (!pair) throw new Error("social.notFriend")
    return pair
  }
  async deliver(id: string): Promise<void> {
    return this.exclusive(async () => {
      if (!this.owner) throw new Error("social.anotherTab")
      const context = await onlineContext()
      const entry = (await readSocial()).outbox[id]
      if (!entry) return
      const event = entry.event
      if (event.kind === "invite") await api("/api/v1/invitations", "POST", { id, code: entry.code }, context.accountId)
      else {
        const pair = this.pair(entry.code)
        const path = `/api/v1/relationships/${pair.id}`
        if (event.kind === "gift")
          await api(`${path}/gifts`, "POST", { id, generation: pair.value.generation }, context.accountId)
        else if (event.kind === "trade-offer")
          await api(
            `${path}/trades`,
            "POST",
            { id, generation: pair.value.generation, destination: context, offer: event.offer },
            context.accountId,
          )
        else if (event.kind === "challenge")
          await api(
            `${path}/challenges`,
            "POST",
            { id, generation: pair.value.generation, battleCode: event.battleCode },
            context.accountId,
          )
        else throw new Error("social.invalid")
      }
      await this.sync()
      this.changed()
    })
  }
  async sendEvent(code: string, event: Event, _displayAlias?: string): Promise<string> {
    if (code === this.code) throw new Error("social.self")
    if (!this.ready || !this.owner) throw new Error("social.offline")
    if (event.kind === "trade-cancel" || event.kind === "trade-abort-request") {
      await this.cancelTrade(event.tradeId, code)
      return event.tradeId
    }
    const context = await onlineContext()
    const id = await queueSocial(code, event, newOperationId(), context)
    try {
      await this.deliver(id)
    } catch (error) {
      this.error(error)
      this.changed()
    }
    return id
  }
  decide(id: string, accepted: boolean): Promise<void> {
    return this.exclusive(async () => {
      const context = await onlineContext()
      const entry = (await readSocial()).inbox[id]
      if (!entry) throw new Error("social.invalid")
      await api(
        `/api/v1/relationships/${this.pair(entry.code).id}/invitations/${id}/decision`,
        "POST",
        { decision: accepted ? "accepted" : "declined" },
        context.accountId,
      )
      await this.sync()
      this.changed()
    })
  }
  withdraw(id: string): Promise<void> {
    return this.exclusive(async () => {
      const context = await onlineContext()
      const entry = (await readSocial()).outbox[id]
      if (!entry) return
      try {
        await api("/api/v1/invitations", "POST", { id, code: entry.code }, context.accountId)
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          !["account-not-found", "operation-expired", "already-friends", "invitation-pending"].includes(error.code)
        )
          throw error
      }
      await this.sync()
      const pair = this.pairs.get(entry.code)
      if (pair?.value.invitations.some((item) => item.id === id && item.state === "pending")) {
        try {
          await api(
            `/api/v1/relationships/${pair.id}/invitations/${id}/decision`,
            "POST",
            { decision: "canceled" },
            context.accountId,
          )
        } catch (error) {
          if (!(error instanceof ApiError) || error.code !== "invitation-finished") throw error
        }
      }
      await updateSocial(async (state, store) => {
        await assertContext(store, context)
        const item = state.outbox[id]
        if (item) item.state = "done"
      })
      await this.sync()
      this.changed()
    })
  }
  remove(code: string): Promise<void> {
    return this.exclusive(async () => {
      const context = await onlineContext(),
        pair = this.pair(code)
      await api(`/api/v1/relationships/${pair.id}`, "DELETE", { generation: pair.value.generation }, context.accountId)
      await this.sync()
      this.changed()
    })
  }
  collect(id: string): Promise<void> {
    return this.exclusive(async () => {
      const context = await onlineContext()
      const entry = (await readSocial()).inbox[id]
      if (!entry) throw new Error("social.invalid")
      const pair = this.pair(entry.code)
      await beginGiftClaim({ context, id, pair: pair.id, generation: pair.value.generation })
      await this.sync()
      this.changed()
    })
  }
  readyTrade(id: string, local: Offer): Promise<void> {
    return this.exclusive(async () => {
      if (this.busy() || !browserSaveSelected() || (await readPendingBattle())) throw new Error("social.busy")
      const context = await onlineContext()
      const entry = (await readSocial()).inbox[id]
      if (!entry || entry.event.kind !== "trade-offer") throw new Error("social.invalid")
      await prepareTrade(
        {
          id,
          code: entry.code,
          coordinator: false,
          local,
          remote: entry.event.offer,
          phase: "prepared",
          played: false,
        },
        context,
      )
      await this.sync()
      this.changed()
    })
  }
  confirmTrade(readyId: string): Promise<void> {
    return this.exclusive(async () => {
      if (this.busy() || !browserSaveSelected()) throw new Error("social.busy")
      const context = await onlineContext(),
        saved = await readSocial(),
        ready = saved.inbox[readyId]
      if (!ready || ready.event.kind !== "trade-ready") throw new Error("social.invalid")
      const offer = saved.outbox[ready.event.tradeId]
      if (!offer || offer.event.kind !== "trade-offer") throw new Error("social.invalid")
      await prepareTrade(
        {
          id: offer.id,
          code: offer.code,
          coordinator: true,
          local: offer.event.offer,
          remote: ready.event.offer,
          phase: "prepared",
          played: false,
        },
        context,
      )
      await this.sync()
      this.changed()
    })
  }
  cancelTrade(id: string, code: string): Promise<boolean> {
    return this.exclusive(async () => {
      const context = await onlineContext()
      let canceled = true
      try {
        await api(`/api/v1/relationships/${this.pair(code).id}/trades/${id}/cancel`, "POST", {}, context.accountId)
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "trade-committed") throw error
        canceled = false
      }
      await this.sync()
      this.changed()
      return canceled
    })
  }
  stop(): void {
    window.clearTimeout(this.expiryTimer)
    window.clearTimeout(this.retryTimer)
    window.clearTimeout(this.hintTimer)
    this.hintTimer = undefined
    this.ready = false
    this.owner = false
    this.otherTab = onlineWire.waitingForConnection
    this.available.clear()
    this.changed()
  }
}
