import { expect, test } from "@playwright/test"
import { chooseAlias, linkSocialPeers, readPet, readSocialState, seedSocialPet } from "./helpers/social-peers.ts"

test("mail survives both players closing; friendship removal cancels a pending gift", async ({ browser }) => {
  test.setTimeout(90000)
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  const alice = await contexts[0]!.newPage(),
    bob = await contexts[1]!.newPage()
  const { accounts } = await linkSocialPeers([alice, bob])
  let inboxResponses = 0
  alice.on("websocket", (socket) => {
    const pending = new Set<string>()
    socket.on("framesent", (frame) => {
      const message = JSON.parse(String(frame.payload))
      if (message.command?.type === "inbox.read") pending.add(message.requestId)
    })
    socket.on("framereceived", (frame) => {
      const message = JSON.parse(String(frame.payload))
      if (message.kind === "response" && pending.delete(message.requestId)) inboxResponses++
    })
  })
  try {
    await alice.goto("http://127.0.0.1:4177")
    await chooseAlias(alice, "Alice")
    // Bob has an account but has never opened the game.
    const invitation = await alice.evaluate(async (code) => {
      const path = "/src/client/platform/online-api.ts",
        { api, newOperationId } = await import(path)
      return api("/api/v1/invitations", "POST", { id: newOperationId(), code })
    }, accounts[1]!.profile.code)
    expect(invitation).toBeTruthy()
    await alice.goto("about:blank")
    await bob.goto("http://127.0.0.1:4177")
    await seedSocialPet(bob, "recipient", "3-058")
    await chooseAlias(bob, "Bob")
    await bob.locator("#profile-friends").click()
    await bob.locator('[data-social-tab="activity"]').click()
    await expect(bob.locator('[data-social-action="accept"]')).toBeVisible()
    await bob.locator('[data-social-action="accept"]').click()
    await expect.poll(async () => Object.keys((await readSocialState(bob)).friends).length).toBe(1)
    await bob.goto("about:blank")
    await alice.goto("http://127.0.0.1:4177")
    await seedSocialPet(alice, "sender", "3-001")
    await alice.locator("#battle-button").click()
    await alice.locator('[data-social-tab="friends"]').click()
    await expect(alice.locator('[data-social-action="gift"]')).toBeEnabled()
    // A duplicate push arriving between pointer down/up must not swallow the click.
    await alice.locator('[data-social-action="gift"]').hover()
    await alice.mouse.down()
    const before = inboxResponses
    await alice.evaluate(() => window.dispatchEvent(new Event("digital-pet:online-social")))
    await expect.poll(() => inboxResponses).toBeGreaterThan(before)
    await alice.waitForTimeout(100)
    await alice.mouse.up()
    await expect(alice.locator("#social-dialog")).toBeVisible()
    await alice.locator('[data-social-action="send-gift"]').click()
    await expect(alice.locator("#social-dialog")).toBeHidden()
    await expect
      .poll(async () =>
        Object.values((await readSocialState(alice)).outbox).some(
          (item) => item.event.kind === "gift" && item.delivery === "delivered",
        ),
      )
      .toBe(true)
    await alice.goto("about:blank")
    await bob.goto("http://127.0.0.1:4177")
    await bob.locator("#battle-button").click()
    await bob.locator('[data-social-tab="activity"]').click()
    await expect(bob.locator('[data-social-action="collect"]')).toBeVisible()
    // A second device removes the relationship while the gift is still unclaimed.
    const result = await bob.evaluate(async () => {
      const path = "/src/client/platform/online-api.ts",
        { api } = await import(path)
      const inbox = await api("/api/v1/me/inbox")
      const entry = inbox.relationships[0],
        gift = entry.value.gifts[0]
      await api(`/api/v1/relationships/${entry.id}`, "DELETE", { generation: entry.value.generation })
      const { onlineContext } = await import(path)
      try {
        await api(`/api/v1/relationships/${entry.id}/gifts/${gift.id}/claim`, "POST", {
          generation: entry.value.generation,
          destination: await onlineContext(),
        })
        return "unexpected-claim"
      } catch (error) {
        return error instanceof Error ? error.message : "error"
      }
    })
    expect(result).not.toBe("unexpected-claim")
    await bob.reload()
    await expect.poll(async () => Object.keys((await readSocialState(bob)).friends).length).toBe(0)
    expect((await readPet(bob)).food?.kind).toBe("scheduled")
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
