import { expect, test } from "@playwright/test"
import { openOptions } from "./helpers/navigation.ts"
import { linkSocialPeers } from "./helpers/social-peers.ts"

for (const failure of ["lost-open", "temporary-open", "stalled-relay"] as const) {
  test(`pairing handles ${failure} with a stable operation and bounded traffic`, async ({ browser }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()])
    const alice = await contexts[0]!.newPage(),
      bob = await contexts[1]!.newPage()
    await linkSocialPeers([alice, bob])
    let injected = false,
      sockets = 0,
      relays = 0
    const requests: string[] = []
    await alice.routeWebSocket("ws://127.0.0.1:4178/socket*", (client) => {
      sockets++
      const server = client.connectToServer()
      client.onMessage((raw) => {
        const value = JSON.parse(String(raw))
        if (value.action === "open") {
          requests.push(value.requestId)
          if (failure === "temporary-open" && !injected) {
            injected = true
            client.send(
              JSON.stringify({
                kind: "error",
                action: "open",
                requestId: value.requestId,
                error: "temporarily-unavailable",
                retryable: true,
              }),
            )
            return
          }
        }
        if (value.action === "relay") {
          relays++
          if (failure === "stalled-relay") {
            injected = true
            client.send(
              JSON.stringify({
                kind: "error",
                action: "relay",
                channel: value.frame.channel,
                error: "peer-offline",
                retryable: true,
              }),
            )
            return
          }
        }
        server.send(raw)
      })
      server.onMessage((raw) => {
        const value = JSON.parse(String(raw))
        if (value.kind === "opened" && failure === "lost-open" && !injected) {
          injected = true
          client.close()
          return
        }
        client.send(raw)
      })
    })
    try {
      for (const page of [alice, bob]) {
        await page.goto("http://127.0.0.1:4177")
        await openOptions(page)
        await page.locator("#pair-button").click()
        await expect(page.locator("#pair-own-code")).toHaveText(/^[A-HJ-NP-Z2-9-]{19}$/)
      }
      await alice.clock.install()
      const code = (await bob.locator("#pair-own-code").innerText()).replaceAll("-", "")
      await alice.locator("#pair-target").fill(code)
      await alice.locator("#pair-request").click()
      await expect.poll(() => injected).toBe(true)
      if (failure === "stalled-relay") {
        await alice.clock.runFor(33_000)
        await expect(alice.locator("#pair-request")).toBeEnabled()
        await alice.waitForTimeout(100)
        const stopped = relays
        await alice.clock.runFor(30_000)
        expect(relays).toBe(stopped)
        expect(relays).toBeLessThanOrEqual(12)
      } else {
        await alice.clock.runFor(4500)
        await expect(bob.locator("#pair-incoming")).toBeVisible()
        expect(requests.length).toBeGreaterThanOrEqual(2)
        expect(new Set(requests).size).toBe(1)
        if (failure === "lost-open") expect(sockets).toBe(2)
      }
    } finally {
      await Promise.all(contexts.map((context) => context.close()))
    }
  })
}

test("three lost registration replies replace the socket and recover without reloading", async ({ page }) => {
  await linkSocialPeers([page])
  let dropped = 0,
    connections = 0
  await page.routeWebSocket("ws://127.0.0.1:4178/socket*", (client) => {
    connections++
    const server = client.connectToServer()
    server.onMessage((raw) => {
      const value = JSON.parse(String(raw))
      if (value.kind === "registered" && value.namespace === "battle" && dropped < 3) {
        dropped++
        return
      }
      client.send(raw)
    })
  })
  await page.clock.install()
  await page.goto("http://127.0.0.1:4177")
  await expect.poll(() => dropped).toBe(1)
  for (const count of [2, 3]) {
    await page.clock.runFor(3000)
    await expect.poll(() => dropped).toBe(count)
  }
  await page.clock.runFor(4500)
  await expect.poll(() => connections).toBe(2)
  await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
  await page.clock.runFor(30_000)
  expect(connections).toBe(2)
})

test("a terminal relay error releases the pairing UI and stops retransmission", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  const alice = await contexts[0]!.newPage(),
    bob = await contexts[1]!.newPage()
  await linkSocialPeers([alice, bob])
  let relayCount = 0
  await alice.routeWebSocket("ws://127.0.0.1:4178/socket*", (client) => {
    const server = client.connectToServer()
    client.onMessage((raw) => {
      const value = JSON.parse(String(raw))
      if (value.action === "relay") {
        relayCount++
        client.send(
          JSON.stringify({
            kind: "error",
            action: "relay",
            channel: value.frame.channel,
            error: "room-expired",
            retryable: false,
          }),
        )
      } else server.send(raw)
    })
  })
  try {
    for (const page of [alice, bob]) {
      await page.goto("http://127.0.0.1:4177")
      await openOptions(page)
      await page.locator("#pair-button").click()
      await expect(page.locator("#pair-own-code")).toHaveText(/^[A-HJ-NP-Z2-9-]{19}$/)
    }
    const code = (await bob.locator("#pair-own-code").innerText()).replaceAll("-", "")
    await alice.locator("#pair-target").fill(code)
    await alice.locator("#pair-request").click()
    await expect.poll(() => relayCount).toBeGreaterThan(0)
    await expect(alice.locator("#pair-request")).toBeEnabled()
    await alice.waitForTimeout(200)
    const failedCount = relayCount
    await alice.clock.install()
    await alice.clock.runFor(12_000)
    expect(relayCount).toBe(failedCount)
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
