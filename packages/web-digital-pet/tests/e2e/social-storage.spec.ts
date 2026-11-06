import { expect, test } from "@playwright/test"
import { readPet, readSocialState, seedSocialPet } from "./helpers/social-peers.ts"

test("an account-bound exchange preserves its lock across reload until the canonical cancellation arrives", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#social-current")).not.toBeEmpty()
  await seedSocialPet(page, "local", "3-001")
  const before = await readPet(page)
  const prepared = await page.evaluate(async () => {
    const petUrl = "/src/client/persistence/pet-store.ts"
    const socialUrl = "/src/client/persistence/social-store.ts"
    const contextUrl = "/src/client/persistence/online-store.ts"
    const canonicalUrl = "/src/client/persistence/online-social-store.ts"
    const offerUrl = "/src/domain/social/exchange.ts"
    const pet = await import(petUrl)
    const social = await import(socialUrl)
    const { readOnlineContext, adoptAccount } = await import(contextUrl)
    const { mergeOnlineRelationship } = await import(canonicalUrl)
    const { exchangeOffer } = await import(offerUrl)
    await readOnlineContext()
    await adoptAccount("alice")
    const context = await readOnlineContext()
    const profile = {
      id: "bob",
      code: "Y8KC4TNB7RWA2VDF",
      alias: "Remote",
      revision: 1,
      nodeId: "4-001",
      seenAt: Date.now(),
    }
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
    const pair = {
      members: ["alice", "bob"],
      generation: 1,
      active: true,
      invitations: [],
      gifts: [],
      trades: [
        {
          id: "trade-atomic",
          generation: 1,
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
          state: "pending",
          confirmed: [],
          sides: {
            bob: { destination: { installationId: "bob-device", saveId: "bob-save" }, offer: remote, applied: false },
          },
        },
      ],
    }
    await mergeOnlineRelationship(context, "pair", pair, profile)
    const trade = {
      id: "trade-atomic",
      code: profile.code,
      coordinator: false,
      local: offer,
      remote,
      phase: "prepared",
      played: false,
    }
    await social.prepareTrade(trade, context)
    await social.prepareTrade(trade, context)
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
    const staleContext = await social.prepareTrade(trade, { ...context, saveId: "another-save" }).then(
      () => "unexpected success",
      (error: Error) => error.message,
    )
    return { context, pair, profile, replacement, team, changed, staleContext }
  })
  expect(prepared.replacement).toBe(false)
  expect(prepared.changed).toBe(false)
  expect(prepared.team.kind).toBe("rejected")
  expect(prepared.staleContext).toBe("online.saveChanged")
  expect(Object.keys((await readSocialState(page)).outbox)).toHaveLength(0)
  await page.reload()
  await expect(page.locator("#social-current")).not.toBeEmpty()
  expect((await readPet(page)).partnerId).toBe(before.partnerId)
  expect((await readSocialState(page)).trades["trade-atomic"]?.phase).toBe("prepared")
  const after = await page.evaluate(async ({ context, pair, profile }) => {
    const contextUrl = "/src/client/persistence/online-store.ts"
    const canonicalUrl = "/src/client/persistence/online-social-store.ts"
    const petUrl = "/src/client/persistence/pet-store.ts"
    const { readOnlineContext } = await import(contextUrl)
    const { mergeOnlineRelationship } = await import(canonicalUrl)
    const pet = await import(petUrl)
    // A second view is still prevented from replacing the save after reload.
    const local = await pet.readLocalState()
    const blocked = await pet.replaceLocalState({ ...local, gauge: 123 }).then(
      () => false,
      () => true,
    )
    await mergeOnlineRelationship(
      context,
      "pair",
      {
        ...pair,
        active: false,
        trades: pair.trades.map((trade) => ({ ...trade, state: "canceled" })),
      },
      profile,
    )
    await pet.replaceLocalState({ ...local, gauge: 123 })
    return { blocked, context: await readOnlineContext() }
  }, prepared)
  expect(after.blocked).toBe(true)
  expect(after.context.accountId).toBe(prepared.context.accountId)
  expect(after.context.installationId).toBe(prepared.context.installationId)
  expect((await readSocialState(page)).trades["trade-atomic"]?.phase).toBe("aborted")
  expect((await readSocialState(page)).friends[prepared.profile.code]).toBeUndefined()
  expect((await readPet(page)).gauge).toBe(123)
})

test("canonical gift receipts survive reload without applying twice and reject another save context", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#social-current")).not.toBeEmpty()
  await seedSocialPet(page, "recipient", "3-001")
  const fixture = await page.evaluate(async () => {
    const contextUrl = "/src/client/persistence/online-store.ts"
    const canonicalUrl = "/src/client/persistence/online-social-store.ts"
    const { readOnlineContext, adoptAccount } = await import(contextUrl)
    const { mergeOnlineRelationship } = await import(canonicalUrl)
    await readOnlineContext()
    await adoptAccount("alice")
    const context = await readOnlineContext()
    const profile = {
      id: "bob",
      code: "Y8KC4TNB7RWA2VDF",
      alias: "Remote",
      revision: 1,
      nodeId: "4-001",
      seenAt: Date.now(),
    }
    const pair = {
      members: ["alice", "bob"],
      generation: 1,
      active: true,
      invitations: [],
      trades: [],
      gifts: [
        {
          id: "gift",
          sender: "bob",
          recipient: "alice",
          day: new Date().toISOString().slice(0, 10),
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
          state: "claimed",
          destination: context,
          applied: false,
        },
      ],
    }
    const acks = await mergeOnlineRelationship(context, "pair", pair, profile)
    return { context, profile, pair, acks }
  })
  expect(fixture.acks).toEqual([{ kind: "gifts", id: "gift", pair: "pair" }])
  expect((await readPet(page)).food?.kind).toBe("available")
  await page.reload()
  await expect(page.locator("#social-current")).not.toBeEmpty()
  const result = await page.evaluate(async ({ context, profile, pair }) => {
    const canonicalUrl = "/src/client/persistence/online-social-store.ts"
    const petUrl = "/src/client/persistence/pet-store.ts"
    const { mergeOnlineRelationship } = await import(canonicalUrl)
    const pet = await import(petUrl)
    const local = await pet.readLocalState()
    await pet.consumeFood(local.partnerId, () => true)
    const acks = await mergeOnlineRelationship(context, "pair", pair, profile)
    const stale = await mergeOnlineRelationship({ ...context, saveId: "another-save" }, "pair", pair, profile).then(
      () => "unexpected success",
      (error: Error) => error.message,
    )
    return { acks, stale }
  }, fixture)
  expect(result.acks).toEqual(fixture.acks)
  expect(result.stale).toBe("online.saveChanged")
  expect((await readPet(page)).food?.kind).toBe("scheduled")
  expect((await readSocialState(page)).log.filter((entry) => entry.kind === "giftCollected")).toHaveLength(1)
})
