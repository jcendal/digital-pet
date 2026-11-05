import type { Destination } from "./contracts.ts"

export type OnlineProfile = {
  id: string
  code: string
  alias: string
  revision: number
  nodeId: string | null
  arenaNodeId?: string
  seenAt: number
}
export type OnlineInvitation = {
  id: string
  sender: string
  createdAt: number
  expiresAt: number
  state: "pending" | "accepted" | "declined" | "canceled"
}
export type OnlineGift = {
  id: string
  sender: string
  recipient: string
  day: string
  createdAt: number
  expiresAt: number
  state: "pending" | "claimed" | "canceled"
  destination?: Destination
  applied?: boolean
}
export type OnlineTrade = {
  id: string
  generation: number
  createdAt: number
  expiresAt: number
  state: "pending" | "committed" | "canceled"
  sides: Record<string, { destination: Destination; offer: unknown; applied: boolean }>
  confirmed: string[]
}
export type OnlineChallenge = { id: string; sender: string; battleCode: string; createdAt: number; expiresAt: number }
export type OnlineRelationship = {
  members: [string, string]
  generation: number
  active: boolean
  invitations: OnlineInvitation[]
  gifts: OnlineGift[]
  trades: OnlineTrade[]
  challenges?: OnlineChallenge[]
}
export type InboxPage = {
  relationships: Array<{ id: string; value: OnlineRelationship }>
  profiles: OnlineProfile[]
  online: string[]
  next: string | null
}
