import { expect, test } from "@playwright/test"
import { readPet, readSocialState, seedSocialPet } from "./helpers/social-peers.ts"

test("persistent identity, atomic exchange preparation and cross-view locks survive reload", async ({ page }) => {
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#social-current")).not.toBeEmpty()
  await seedSocialPet(page, "local", "3-001")
  const before = await readPet(page)
  const result = await page.evaluate(async () => {
    const petUrl = "/src/client/persistence/pet-store.ts"
    const socialUrl = "/src/client/persistence/social-store.ts"
    const offerUrl = "/src/domain/social/exchange.ts"
    const pet = await import(petUrl)
    const social = await import(socialUrl)
    const { exchangeOffer } = await import(offerUrl)
    const codes = await Promise.all([pet.getDeviceCode(), pet.getDeviceCode(), pet.getDeviceCode()])
    const code = "Y8KC4TNB7RWA2VDF"
    await social.saveAlias("Local")
    await social.updateSocial((s: import("../../src/domain/social/model.ts").SocialState) => {
      s.friends[code] = { code, profile: { alias: "Remote", revision: 1, nodeId: "4-001" }, confirmed: true }
    })
    const local = await pet.readLocalState()
    const offer = exchangeOffer(local, "principal", false)
    const remote = {
      ...offer,
      partner: {
        ...offer.partner,
        partnerId: "remote",
        currentNodeId: "4-001",
        events: [{ currentNodeId: "4-001", createdAt: local.createdAt }],
      },
    }
    await social.receiveSocial(
      code,
      { alias: "Remote", revision: 1, nodeId: "4-001" },
      { version: 1, id: "trade-atomic", event: { kind: "trade-offer", offer: remote } },
    )
    await social.prepareTrade({
      id: "trade-atomic",
      code,
      coordinator: false,
      local: offer,
      remote,
      phase: "prepared",
      played: false,
    })
    const prepared = await social.readSocial()
    const replacement = await pet.replaceLocalState({ ...local, partnerId: "overwritten" }).then(
      () => true,
      () => false,
    )
    const team = await pet.applyBrowserTeamCommand({
      kind: "place",
      slot: "principal",
      expectedRevision: 0,
      expectedPrincipalId: local.partnerId,
      expectedReserveId: null,
      partner: { currentNodeId: "0-001", gauge: 0, isTerminal: false, createdAt: new Date().toISOString() },
    })
    const changed = await pet
      .consumeFood(local.partnerId, () => true)
      .then(
        () => true,
        () => false,
      )
    return {
      codes,
      ready: Object.values(prepared.outbox).filter(
        (r: import("../../src/domain/social/model.ts").Outgoing) => r.event.kind === "trade-ready",
      ).length,
      replacement,
      team,
      changed,
    }
  })
  expect(new Set(result.codes).size).toBe(1)
  expect(result.ready).toBe(1)
  expect(result.replacement).toBe(false)
  expect(result.changed).toBe(false)
  expect(result.team.kind).toBe("rejected")
  await page.reload()
  await expect(page.locator("#social-current")).not.toBeEmpty()
  expect((await readPet(page)).partnerId).toBe(before.partnerId)
  expect((await readSocialState(page)).trades["trade-atomic"]?.phase).toBe("prepared")
  const after = await page.evaluate(async () => {
    const petUrl = "/src/client/persistence/pet-store.ts"
    const socialUrl = "/src/client/persistence/social-store.ts"
    const pet = await import(petUrl)
    const social = await import(socialUrl)
    const wrong = await social.abortTrade("trade-atomic", "K7MD9QXR4NWA6TBY")
    const aborted = await social.abortTrade("trade-atomic", "Y8KC4TNB7RWA2VDF")
    await social.saveAlias("Renamed")
    return { wrong, aborted, code: await pet.getDeviceCode() }
  })
  expect(after.wrong).toBe(false)
  expect(after.aborted).toBe(true)
  expect(after.code).toBe(result.codes[0])
})

test("durable receipt deduplication, cancellation and friendship scope reject late acceptance", async ({ page }) => {
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#social-current")).not.toBeEmpty()
  const result = await page.evaluate(async () => {
    const url = "/src/client/persistence/social-store.ts"
    const m = await import(url)
    const profile = { alias: "Remote", revision: 1, nodeId: "3-001" }
    const code = "Y8KC4TNB7RWA2VDF"
    await m.saveAlias("Local")
    const id = await m.queueSocial(code, { kind: "invite" }, "invite-original")
    const same = await m.queueSocial(code, { kind: "invite" }, "invite-repeated")
    await m.cancelInvitation(id)
    await m.receiveSocial(code, profile, {
      version: 1,
      id: "late-decision",
      event: { kind: "decision", requestId: id, accepted: true },
    })
    const state = await m.readSocial()
    await m.receiveSocial(code, profile, { version: 1, id: "incoming-original", event: { kind: "invite" } })
    await m.receiveSocial(code, profile, { version: 1, id: "incoming-original", event: { kind: "invite" } })
    const decision = await m.decideFriend("incoming-original", true)
    await m.receiveSocial(code, profile, {
      version: 1,
      id: "withdrawn",
      event: { kind: "withdraw", requestId: "incoming-original" },
    })
    await m.acknowledgeSocial(code, decision.id)
    const final = await m.readSocial()
    const invalid = await m
      .receiveSocial(code, profile, {
        version: 1,
        id: "incoming-original",
        event: { kind: "gift", day: new Date().toISOString().slice(0, 10) },
      })
      .then(
        () => false,
        () => true,
      )
    return {
      id,
      same,
      lateAccepted: Boolean(state.friends[code]),
      friendRemaining: Boolean(final.friends[code]),
      duplicateCount: Object.values(final.inbox).filter(
        (r: import("../../src/domain/social/model.ts").Receipt) => r.id === "incoming-original",
      ).length,
      invalid,
    }
  })
  expect(result.id).toBe(result.same)
  expect(result.lateAccepted).toBe(false)
  expect(result.friendRemaining).toBe(false)
  expect(result.duplicateCount).toBe(1)
  expect(result.invalid).toBe(true)
})
