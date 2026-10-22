import { pendingTrade, type Receipt, type SocialState } from "./model.ts"

/** Count operations, not protocol receipts: a prepared exchange is one pending item. */
export const socialActivity = (state: SocialState) => {
  const trade = pendingTrade(state)
  const coveredByTrade = (r: Receipt) =>
    Boolean(trade && (r.id === trade.id || (r.event.kind === "trade-ready" && r.event.tradeId === trade.id)))
  const incoming = Object.values(state.inbox).filter(
    (r) => r.state === "pending" && r.event.kind !== "trade-cancel" && !coveredByTrade(r),
  )
  const outgoing = Object.values(state.outbox).filter(
    (r) =>
      r.state === "pending" &&
      ["invite", "gift", "trade-offer", "decision"].includes(r.event.kind) &&
      !coveredByTrade(r) &&
      !(
        r.event.kind === "trade-offer" &&
        Object.values(state.inbox).some(
          (receipt) =>
            receipt.event.kind === "trade-ready" && receipt.event.tradeId === r.id && receipt.state === "pending",
        )
      ),
  )
  return { incoming, outgoing, trade, count: incoming.length + outgoing.length + (trade ? 1 : 0) }
}
