import { expect, test } from "@playwright/test"
import { openOptions } from "./helpers/navigation.ts"
import { chooseAlias, linkSocialPeers } from "./helpers/social-peers.ts"

test("an idle signed-in game sends no HTTP polls or socket heartbeats and all features share one connection", async ({
  page,
}) => {
  await linkSocialPeers([page])
  const requests: string[] = [],
    frames: string[] = []
  let liveSockets = 0
  page.on("request", (request) => {
    if (/\/(auth|api\/v1)\//.test(request.url()))
      requests.push(`${request.method()} ${new URL(request.url()).pathname}`)
  })
  page.on("websocket", (socket) => {
    if (!socket.url().includes(":4178/socket")) return
    liveSockets++
    socket.on("close", () => liveSockets--)
    socket.on("framesent", (frame) => frames.push(String(frame.payload)))
  })
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
  await chooseAlias(page, "QuietPlayer")
  await expect.poll(() => liveSockets).toBe(1)
  await page.waitForTimeout(500)
  expect(frames.some((frame) => JSON.parse(frame).action === "social")).toBe(true)
  expect(requests.filter((request) => request.includes("/api/v1/"))).toEqual([])
  await page.clock.install()
  requests.length = 0
  frames.length = 0
  await page.clock.runFor(120_000)
  await page.waitForTimeout(200)
  expect(requests).toEqual([])
  expect(frames).toEqual([])
  await openOptions(page)
  await page.locator("#pair-button").click()
  await expect(page.locator("#pair-request")).toBeEnabled()
  await expect.poll(() => liveSockets).toBe(1)
  await page.locator("#pair-dialog .dialog-close").click()
  await expect.poll(() => liveSockets).toBe(1)
})

test("a signed-out game does not repeatedly ask for a session", async ({ page }) => {
  await linkSocialPeers([page], false)
  await page.route("**/auth/session", (route) => route.fulfill({ status: 401, json: { error: "unauthorized" } }))
  const requests: string[] = []
  page.on("request", (request) => {
    if (/\/(auth|api\/v1)\//.test(request.url())) requests.push(request.url())
  })
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#online-migration")).toBeVisible()
  await page.waitForTimeout(300)
  await page.clock.install()
  requests.length = 0
  await page.clock.runFor(120_000)
  expect(requests).toEqual([])
  await page.locator("#online-later").click()
  await page.locator("#battle-button").click()
  await expect(page.locator("#social-network-status")).not.toContainText("another tab")
  await expect(page.locator("#social-network-status")).toContainText("Connect your account")
})

test("notifications during a slow inbox read coalesce instead of queueing one sync per event", async ({ page }) => {
  await linkSocialPeers([page])
  let reads = 0
  let holding = false
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.routeWebSocket("ws://127.0.0.1:4178/socket*", (client) => {
    const server = client.connectToServer()
    let blocked: string | undefined
    client.onMessage((raw) => {
      const message = JSON.parse(String(raw))
      if (holding && message.command?.type === "inbox.read" && ++reads === 1) blocked = message.requestId
      server.send(raw)
    })
    server.onMessage(async (raw) => {
      const message = JSON.parse(String(raw))
      if (blocked && message.requestId === blocked) await held
      client.send(raw)
    })
  })
  await page.goto("http://127.0.0.1:4177")
  await chooseAlias(page, "BatchPlayer")
  await page.waitForTimeout(500)
  holding = true
  await page.evaluate(() => window.dispatchEvent(new Event("digital-pet:online-social")))
  await expect.poll(() => reads).toBe(1)
  await page.evaluate(() => {
    for (let index = 0; index < 25; index++) window.dispatchEvent(new Event("digital-pet:online-social"))
  })
  await page.waitForTimeout(100)
  release()
  await expect.poll(() => reads).toBe(2)
  await page.waitForTimeout(200)
  expect(reads).toBe(2)
})

test("a tab waiting for the shared connection lock does not request tickets and recovers after release", async ({
  page,
}) => {
  const holder = await page.context().newPage()
  await holder.goto("http://127.0.0.1:4177")
  await holder.evaluate(() => {
    return new Promise<void>((resolve) => {
      void navigator.locks.request("digital-pet:online-wire", async () => {
        const held = new Promise<void>((release) =>
          window.addEventListener("release-test-lock", () => release(), { once: true }),
        )
        resolve()
        await held
      })
    })
  })
  try {
    await linkSocialPeers([page])
    let tickets = 0
    page.on("request", (request) => {
      if (request.url().endsWith("/auth/ticket")) tickets++
    })
    await page.goto("http://127.0.0.1:4177")
    await page.bringToFront()
    await page.waitForTimeout(1500)
    expect(tickets).toBe(0)
    await page.locator("#battle-button").click()
    await expect(page.locator("#social-network-status")).toContainText("another tab")
    await holder.evaluate(() => window.dispatchEvent(new Event("release-test-lock")))
    await page.bringToFront()
    await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
    expect(tickets).toBe(1)
    const locks = await page.evaluate(() => navigator.locks.query())
    expect(locks.held?.filter((lock) => lock.name === "digital-pet:online-wire")).toHaveLength(1)
    expect(locks.held?.some((lock) => lock.name?.includes("social-endpoint"))).toBe(false)
    await chooseAlias(page, "WaitingPlayer")
  } finally {
    await holder.close()
  }
})

test("the access expiry deadline renews the session and shared socket once", async ({ page }) => {
  const { accounts } = await linkSocialPeers([page])
  let refreshes = 0
  let sockets = 0
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/refresh")) refreshes++
  })
  page.on("websocket", (socket) => {
    if (socket.url().includes(":4178/socket")) sockets++
  })
  await page.clock.install()
  const deadline = Date.now() + 70_000
  await page.route("**/auth/session", async (route) => {
    const response = await page.request.get("http://127.0.0.1:4178/auth/session", {
      headers: { "x-test-session": accounts[0]!.handle },
    })
    const value = await response.json()
    await route.fulfill({ json: refreshes ? value : { ...value, accessExpiresAt: deadline } })
  })
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
  expect(sockets).toBe(1)
  await page.clock.runFor(15_000)
  await expect.poll(() => refreshes).toBe(1)
  await expect.poll(() => sockets).toBe(2)
  await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
  await page.clock.runFor(60_000)
  expect(refreshes).toBe(1)
  expect(sockets).toBe(2)
})

test("an unexpected socket close reconnects with a fresh ticket and one replacement connection", async ({ page }) => {
  await linkSocialPeers([page])
  let connections = 0
  let tickets = 0
  let disconnect: (() => void) | undefined
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/ticket")) tickets++
  })
  await page.routeWebSocket("ws://127.0.0.1:4178/socket*", (client) => {
    connections++
    const server = client.connectToServer()
    disconnect = () => {
      server.close()
      client.close({ code: 1012, reason: "Test service restart" })
    }
  })
  await page.goto("http://127.0.0.1:4177")
  await chooseAlias(page, "ReconnectPlayer")
  await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
  expect(connections).toBe(1)
  disconnect?.()
  await expect.poll(() => connections).toBe(2)
  await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
  expect(tickets).toBe(2)
  await page.waitForTimeout(500)
  expect(connections).toBe(2)
})
