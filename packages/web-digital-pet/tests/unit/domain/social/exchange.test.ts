import { describe, expect, test } from "bun:test"
import { exchangeFrame } from "@jcendal/digital-pet-animation/sequences/partner-exchange.ts"
import type { LocalPetState } from "../../../../src/domain/pet/progress.ts"
import { applyExchange, exchangeOffer } from "../../../../src/domain/social/exchange.ts"
import {
  normalizeCode,
  parseEnvelope,
  parseOffer,
  parseProfile,
  validCode,
} from "../../../../src/domain/social/model.ts"

const now = Date.now()
const pet = (id: string, node = "3-001"): LocalPetState => ({
  partnerId: id,
  currentNodeId: node,
  createdAt: new Date(now - 5000).toISOString(),
  lastTickAt: now,
  gauge: 750,
  isTerminal: false,
  events: [{ currentNodeId: node, createdAt: new Date(now - 5000).toISOString() }],
  food: { kind: "scheduled", availableAt: now + 60000 },
})
describe("social exchange", () => {
  test("starts a recipient journey, closes the sender journey and keeps trainer progress local", () => {
    const local = {
      ...pet("local"),
      experienceLevel: "low" as const,
      worldVisit: { regionId: "dragon-eye-lake", locationId: "dragon-eye-lake" },
      reserve: { ...pet("reserve"), pausedAt: now },
    }
    const own = exchangeOffer(local, "principal", false)
    const other = exchangeOffer(pet("remote", "4-001"), "principal", false)
    const next = applyExchange(local, own, other, "received", now + 1000)
    expect(next.currentNodeId).toBe("4-001")
    expect(next.gauge).toBe(750)
    expect(next.food).toEqual(other.partner.food)
    expect(next.partnerId).toBe("received")
    expect(next.events).toEqual([{ currentNodeId: "4-001", createdAt: new Date(now + 1000).toISOString() }])
    expect(next.retiredPartners?.[0]?.events).toEqual(local.events)
    expect(next.retiredPartners?.[0]?.retiredAt).toBe(new Date(now + 1000).toISOString())
    expect(next.reserve).toEqual(local.reserve)
    expect(next.worldVisit).toEqual(local.worldVisit)
    expect(next.experienceLevel).toBe("low")
    expect(next.teamRevision).toBe(1)
  })
  test("reserve exchanges preserve the active companion and archive only the sent reserve", () => {
    const local = { ...pet("active"), reserve: { ...pet("reserve"), pausedAt: now } }
    const next = applyExchange(
      local,
      exchangeOffer(local, "reserve", false),
      exchangeOffer(pet("remote", "4-001"), "principal", false),
      "received",
      now + 1000,
    )
    expect(next.partnerId).toBe("active")
    expect(next.events).toEqual(local.events)
    expect(next.reserve?.partnerId).toBe("received")
    expect(next.retiredPartners?.[0]?.partnerId).toBe("reserve")
  })
  test("rejects eggs, occupied companions, stale snapshots and team metadata from a peer", () => {
    expect(() => exchangeOffer(pet("egg", "0-001"), "principal", false)).toThrow()
    expect(() => exchangeOffer(pet("busy"), "principal", true)).toThrow()
    const p = pet("local")
    const offer = exchangeOffer(p, "principal", false)
    expect(() => applyExchange({ ...p, gauge: 751 }, offer, offer, "new", now)).toThrow("social.stale")
    expect(() => parseOffer({ ...offer, partner: { ...offer.partner, reserve: pet("nested") } })).toThrow()
    expect(() => parseOffer({ ...offer, partner: { ...offer.partner, currentNodeId: "7-999" } })).toThrow()
  })
  test("normalizes permanent codes but keeps aliases separate and validates protocol boundaries", () => {
    const code = normalizeCode("k7md-9qxr 4nwa-6tby")
    expect(validCode(code)).toBe(true)
    expect(validCode("jcendal-9065786")).toBe(false)
    expect(() => parseProfile({ alias: "<img>", revision: 1, nodeId: null })).toThrow()
    expect(() => parseEnvelope({ version: 2, id: "id", event: { kind: "invite" } })).toThrow()
    expect(() => parseEnvelope({ version: 1, id: "id", event: { kind: "replace-save" } })).toThrow()
    expect(parseEnvelope({ version: 1, id: "id", event: { kind: "invite" } }).event.kind).toBe("invite")
  })
  test("Arena presence preserves the active thumbnail and accepts profiles from older peers", () => {
    const profile = { alias: "Alice", revision: 1, nodeId: "3-001" }
    expect(parseProfile(profile)).toEqual(profile)
    expect(parseProfile({ ...profile, arenaNodeId: "3-073" })).toEqual({ ...profile, arenaNodeId: "3-073" })
    expect(() => parseProfile({ ...profile, arenaNodeId: "unknown" })).toThrow()
  })
  test("animation has a bounded finish with a reduced motion alternative", () => {
    expect(exchangeFrame(0).phase).toBe("packing")
    expect(exchangeFrame(2000).phase).toBe("crossing")
    expect(exchangeFrame(4000).phase).toBe("arrival")
    expect(exchangeFrame(4800)).toEqual({ phase: "complete", progress: 1 })
    expect(exchangeFrame(600, true)).toEqual({ phase: "complete", progress: 1 })
  })
})
