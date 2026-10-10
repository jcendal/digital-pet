import { readFile } from "node:fs/promises"
import { expect, type Page, test } from "@playwright/test"

test("two isolated browser saves decline, accept, agree on a winner and persist only one reward", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000)
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  const pages = await Promise.all(contexts.map((context) => context.newPage()))
  const [alice, bob] = pages
  if (!alice || !bob) throw new Error("Missing test pages")
  const peers = new Map<string, Page>()
  const connections = new Map<string, Page[]>()
  const errors: string[] = []
  const mock = await readFile(new URL("./peerjs.browser.js", import.meta.url), "utf8")
  type Message = { type: string; id: string; target: string; peer: string; connectionId: string; data: unknown }
  const deliver = (page: Page, event: unknown) =>
    page.evaluate((value) => {
      const target = window as unknown as { testPeerEvent: (input: unknown) => void }
      target.testPeerEvent(value)
    }, event)
  try {
    for (const page of pages) {
      await page.setViewportSize({ width: 320, height: 760 })
      page.on("pageerror", (error) => errors.push(error.message))
      await page.route("**/node_modules/.vite/deps/peerjs.js*", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: mock,
        }),
      )
      await page.exposeBinding("testPeerSend", async ({ page: sender }, event: Message) => {
        if (event.type === "register") {
          peers.set(event.id, sender)
          return
        }
        if (event.type === "connect") {
          const destination = peers.get(event.target)
          if (!destination) throw new Error("Missing destination")
          connections.set(event.connectionId, [sender, destination])
          await deliver(destination, { ...event, type: "incoming" })
          return
        }
        const destination = connections.get(event.connectionId)?.find((candidate) => candidate !== sender)
        if (destination && !destination.isClosed()) await deliver(destination, event)
      })
    }
    await Promise.all(pages.map((page) => page.goto("http://127.0.0.1:4177")))
    for (const [page, nodeId, partnerId] of [
      [alice, "3-001", "alice"],
      [bob, "4-001", "bob"],
    ] as const) {
      await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
      await page.evaluate(
        async ({ nodeId, partnerId }) => {
          const now = Date.now()
          const createdAt = new Date(now).toISOString()
          await new Promise<void>((resolve, reject) => {
            const open = indexedDB.open("web-digital-pet", 1)
            open.onsuccess = () => {
              const database = open.result
              const transaction = database.transaction("pet", "readwrite")
              transaction.objectStore("pet").put(
                {
                  partnerId,
                  currentNodeId: nodeId,
                  createdAt,
                  lastTickAt: now,
                  gauge: 0,
                  isTerminal: false,
                  events: [{ currentNodeId: nodeId, createdAt }],
                },
                "current",
              )
              transaction.oncomplete = () => {
                database.close()
                resolve()
              }
              transaction.onerror = () => reject(transaction.error)
            }
            open.onerror = () => reject(open.error)
          })
        },
        { nodeId, partnerId },
      )
      if (page === alice) await page.locator('a[data-page="dex"]').click()
      await page.locator("#battle-button").click()
    }
    const code = await bob.locator("#battle-own-code").textContent()
    if (!code) throw new Error("No battle code")
    await alice.locator("#battle-target").fill(code)
    await alice.locator("#battle-request").click()
    await expect(bob.locator("#battle-incoming")).toBeVisible()
    await bob.locator("#battle-decline").click()
    await expect(alice.locator("#battle-status")).toContainText(/cancelled|disconnected/)
    await bob.locator("#battle-dialog .dialog-close").click()
    await bob.locator("#options-button").click()
    await expect(bob.locator("#options-dialog")).toBeVisible()
    await alice.locator("#battle-request").click()
    await expect(bob.locator("#battle-incoming")).toBeVisible()
    await bob.locator("#battle-accept").click()
    await expect(alice.locator("#battle-status")).toContainText(/Battle started|wins|Draw/)
    await expect(bob.locator("#battle-status")).toContainText(/Battle started|wins|Draw/)
    for (const page of pages) {
      await expect(page.locator("#battle-dialog")).not.toBeVisible()
      await expect(page.locator("dialog[open]")).toHaveCount(0)
      await expect(page.locator('iframe[data-page="sidebar"]')).toHaveClass(/active/)
      const pet = page.frameLocator('iframe[data-page="sidebar"]')
      await expect(pet.locator("#phase")).toHaveText("BATTLE")
      await expect(pet.locator("#artwork rect").first()).toBeVisible()
      await expect(pet.locator("#battle-scores")).toBeVisible()
      await expect(pet.locator("#name")).toHaveText(page === alice ? "Agumon" : "Agnimon")
      await expect(pet.locator("#stage")).toHaveText(page === alice ? "Agunimon" : "Agumon")
      await expect(page.locator("#battle-artwork")).toHaveCount(0)
      await page.screenshot({
        path: testInfo.outputPath(page === alice ? "alice-battle-320.png" : "bob-battle-320.png"),
      })
    }
    const readSave = (page: Page) =>
      page.evaluate(
        () =>
          new Promise<{
            gauge: number
            receipt: { won: boolean }
            battleId: string
          }>((resolve, reject) => {
            const open = indexedDB.open("web-digital-pet", 1)
            open.onsuccess = () => {
              const database = open.result
              const transaction = database.transaction("pet")
              const store = transaction.objectStore("pet")
              const keys = store.getAllKeys()
              const state = store.get("current")
              const values = store.getAll()
              transaction.oncomplete = () => {
                database.close()
                const index = keys.result.findIndex((key) => String(key).startsWith("battle:"))
                resolve({
                  gauge: state.result.gauge,
                  receipt: values.result[index],
                  battleId: String(keys.result[index]).slice(7),
                })
              }
              transaction.onerror = () => reject(transaction.error)
            }
            open.onerror = () => reject(open.error)
          }),
      )
    const first = await Promise.all(pages.map(readSave))
    expect(first[0]?.battleId).toBe(first[1]?.battleId)
    expect(first.filter((save) => save.receipt.won).length).toBeLessThanOrEqual(1)
    expect(first[0]?.gauge).toBe(first[0]?.receipt.won ? 8_000_000 : 0)
    expect(first[1]?.gauge).toBe(first[1]?.receipt.won ? 15_000_000 : 0)
    // Retry the persisted receipt concurrently through the actual browser storage adapter.
    for (const page of pages) {
      await page.evaluate(async () => {
        const url = "/src/client/persistence/pet-store.ts"
        const store = await import(url)
        const state = await store.peekLocalState()
        const pending = await store.readPendingBattle()
        await Promise.all([store.settleBattle(pending, state), store.settleBattle(pending, state)])
      })
    }
    expect(await Promise.all(pages.map(readSave))).toEqual(first)
    // An actual completed attack is checkpointed before a reload.
    const pendingFor = (page: Page) =>
      page.evaluate(async () => {
        const url = "/src/client/persistence/pet-store.ts"
        return (await import(url)).readPendingBattle()
      })
    for (const page of pages)
      await expect
        .poll(async () => (await pendingFor(page))?.completedShots ?? 0, { timeout: 20_000 })
        .toBeGreaterThan(0)
    // Navigating away pauses the pet's playback without reopening or cancelling the panel.
    await Promise.all(pages.map((page) => page.locator('a[data-page="history"]').click()))
    const paused = await Promise.all(pages.map(pendingFor))
    expect(paused[0]?.seed).toBe(paused[1]?.seed)
    expect(paused[0]?.plan).toEqual(paused[1]?.plan)
    await Promise.all(pages.map((page) => page.reload()))
    for (const page of pages) {
      await expect(page.locator("#battle-dialog")).not.toBeVisible()
      await expect(page.locator('iframe[data-page="sidebar"]')).toHaveClass(/active/)
      await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#phase")).toHaveText("BATTLE")
    }
    for (const [index, page] of pages.entries()) {
      const recovered = await pendingFor(page)
      expect(recovered?.seed).toBe(paused[index]?.seed)
      expect(recovered?.plan).toEqual(paused[index]?.plan)
      expect(recovered?.completedShots).toBeGreaterThanOrEqual(paused[index]?.completedShots ?? 0)
    }
    // The agreed animation finishes with network access disabled, without another prize.
    await Promise.all(contexts.map((context) => context.setOffline(true)))
    for (const page of pages)
      await expect(page.locator("#battle-status")).toContainText(/wins|Draw/, { timeout: 60_000 })
    for (const page of pages) expect(await pendingFor(page)).toBeUndefined()
    for (const page of pages) {
      await expect(page.locator("#battle-dialog")).not.toBeVisible()
      await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#phase")).toHaveText("ACTIVE")
      await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#battle-scores")).toBeHidden()
    }
    expect(await Promise.all(pages.map(readSave))).toEqual(first)
    expect(errors).toEqual([])
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
