import { expect, test } from "bun:test"
import { accountConnection } from "../../../src/domain/account/connection.ts"
import { emptySocial } from "../../../src/domain/social/model.ts"

test("a first Google session connects a local game without a second activation", () => {
  const social = emptySocial()
  social.profile = { alias: "Aki", revision: 1 }
  expect(accountConnection(null, "google-a", social)).toBe("connect")
  expect(accountConnection(null, "google-a")).toBe("connect")
})

test("returning to the same account does not migrate or clear social data", () => {
  const social = emptySocial()
  social.log.push({ kind: "gift", alias: "Noa", at: 1 })
  expect(accountConnection("google-a", "google-a", social)).toBe("ready")
  expect(social.log).toHaveLength(1)
})

test("another account always requires a choice, even with an empty friend list", () => {
  expect(accountConnection("google-a", "google-b", emptySocial())).toBe("confirm")
})

test("legacy activity cannot be silently discarded on the first sign-in", () => {
  const social = emptySocial()
  social.log.push({ kind: "gift", alias: "Noa", at: 1 })
  expect(accountConnection(null, "google-a", social)).toBe("confirm")
  const gifts = emptySocial()
  gifts.giftDays.Noa = "2026-11-06"
  expect(accountConnection(null, "google-a", gifts)).toBe("confirm")
})
