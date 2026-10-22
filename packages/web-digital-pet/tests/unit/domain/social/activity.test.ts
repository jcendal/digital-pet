import { describe, expect, test } from "bun:test"
import { socialActivity } from "../../../../src/domain/social/activity.ts"
import { emptySocial, type Offer, type Receipt } from "../../../../src/domain/social/model.ts"

const receipt = (id: string, event: Receipt["event"]): Receipt => ({
  id,
  event,
  code: "Y8KC4TNB7RWA2VDF",
  profile: { alias: "Remote", nodeId: null, revision: 1 },
  createdAt: Date.now(),
  state: "pending",
})
// The grouping operation never reads partner contents.
const offer = {} as Offer

describe("pending social operations", () => {
  test("a prepared exchange replaces its offer and ready receipts in the total", () => {
    const state = emptySocial()
    state.inbox.ready = receipt("ready", { kind: "trade-ready", tradeId: "trade", offer })
    state.outbox.trade = { ...receipt("trade", { kind: "trade-offer", offer }), delivery: "delivered" }
    state.trades.trade = {
      id: "trade",
      code: "Y8KC4TNB7RWA2VDF",
      coordinator: true,
      local: offer,
      remote: offer,
      phase: "prepared",
      played: false,
    }
    const activity = socialActivity(state)
    expect(activity.count).toBe(1)
    expect(activity.incoming).toHaveLength(0)
    expect(activity.outgoing).toHaveLength(0)
    expect(activity.trade?.id).toBe("trade")
    state.trades.trade.phase = "committed"
    expect(socialActivity(state).count).toBe(1)
    state.trades.trade.phase = "resolved"
    state.inbox.ready.state = "done"
    state.outbox.trade.state = "done"
    expect(socialActivity(state).count).toBe(0)
  })
  test("a ready proposal is counted once before local preparation", () => {
    const state = emptySocial()
    state.inbox.ready = receipt("ready", { kind: "trade-ready", tradeId: "trade", offer })
    state.outbox.trade = { ...receipt("trade", { kind: "trade-offer", offer }), delivery: "delivered" }
    expect(socialActivity(state).count).toBe(1)
    expect(socialActivity(state).incoming.map((r) => r.id)).toEqual(["ready"])
  })
  test("counts independent requests and gifts alongside a recoverable trade", () => {
    const state = emptySocial()
    state.inbox.gift = receipt("gift", { kind: "gift", day: "2026-10-22" })
    state.outbox.invite = { ...receipt("invite", { kind: "invite" }), delivery: "unavailable" }
    state.trades.trade = {
      id: "trade",
      code: "Y8KC4TNB7RWA2VDF",
      coordinator: false,
      local: offer,
      remote: offer,
      phase: "prepared",
      played: false,
    }
    expect(socialActivity(state).count).toBe(3)
  })
})
