import { expect, type Page, test } from "@playwright/test"

test.use({ locale: "es-ES" })

const saved = (page: Page) =>
  page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open("web-digital-pet", 1)
      open.onsuccess = () => resolve(open.result)
    })
    const store = database.transaction("pet").objectStore("pet")
    const read = <T>(key: string) =>
      new Promise<T>((resolve) => {
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result)
      })
    const state = await read<{
      partnerId: string
      adventureReadyAt: number
      food: { kind: string; availableAt?: number }
      hygiene: { poops: number[]; nextAt: number }
      reserve: { partnerId: string; adventureReadyAt: number }
    }>("current")
    const legacy = await read<number | undefined>("adventure-ready-at")
    database.close()
    return { state, legacy }
  })

test("adventure waits advance in reserve while apples and piles pause through switches and reload", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const now = Date.parse("2026-10-15T00:00:00Z")
  const minute = 60_000
  await page.clock.setFixedTime(now)
  await page.routeWebSocket("wss://0.peerjs.com/**", (socket) => socket.send(JSON.stringify({ type: "OPEN" })))
  await page.goto("/")
  const sidebar = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(sidebar.locator("#name")).not.toBeEmpty()
  await page.evaluate(
    async ({ now, minute }) => {
      const database = await new Promise<IDBDatabase>((resolve) => {
        const open = indexedDB.open("web-digital-pet", 1)
        open.onsuccess = () => resolve(open.result)
      })
      const partner = (partnerId: string, currentNodeId: string) => ({
        partnerId,
        currentNodeId,
        createdAt: new Date(now).toISOString(),
        lastTickAt: now,
        gauge: 0,
        isTerminal: false,
        events: [{ currentNodeId, createdAt: new Date(now).toISOString() }],
      })
      await new Promise<void>((resolve) => {
        const transaction = database.transaction("pet", "readwrite")
        const store = transaction.objectStore("pet")
        store.put(
          {
            ...partner("principal", "3-001"),
            food: { kind: "available" },
            hygiene: { poops: [now - 1], nextAt: now + 180 * minute, happyUntil: 0 },
            reserve: {
              ...partner("reserve", "3-022"),
              pausedAt: now,
              adventureReadyAt: 0,
              food: { kind: "scheduled", availableAt: now + 20 * minute },
              hygiene: { poops: [now - 3, now - 2], nextAt: now + 40 * minute, happyUntil: 0 },
            },
          },
          "current",
        )
        store.put(now + 40 * minute, "adventure-ready-at")
        store.delete("adventure")
        transaction.oncomplete = () => resolve()
      })
      database.close()
    },
    { now, minute },
  )
  await page.reload()
  await expect(sidebar.locator("#adventure-toggle")).toBeDisabled()
  await expect(sidebar.locator("#pet-poops button")).toHaveCount(1)
  await expect(sidebar.locator(".pet-food")).toBeVisible()
  expect((await saved(page)).state.adventureReadyAt).toBe(now + 40 * minute)
  expect((await saved(page)).legacy).toBeUndefined()

  await page.clock.setFixedTime(now + 10 * minute)
  await sidebar.locator("#pet-switch").click()
  await expect.poll(async () => (await saved(page)).state.partnerId).toBe("reserve")
  await expect(sidebar.locator("#adventure-toggle")).toBeEnabled()
  await expect(sidebar.locator("#pet-poops button")).toHaveCount(2)
  await expect(sidebar.locator(".pet-food")).toBeHidden()
  expect((await saved(page)).state.adventureReadyAt).toBe(0)
  expect((await saved(page)).state.food.availableAt).toBe(now + 30 * minute)
  expect((await saved(page)).state.hygiene.nextAt).toBe(now + 50 * minute)
  await sidebar.locator("#adventure-toggle").click()
  await expect(sidebar.locator(".pet-module")).toHaveClass(/adventuring/)
  await sidebar.locator("#adventure-toggle").click()
  await expect(sidebar.locator(".pet-module")).not.toHaveClass(/adventuring/)
  expect((await saved(page)).state.adventureReadyAt).toBe(now + 130 * minute)

  await page.clock.setFixedTime(now + 20 * minute)
  await sidebar.locator("#pet-switch").click()
  await expect.poll(async () => (await saved(page)).state.partnerId).toBe("principal")
  await expect(sidebar.locator("#adventure-toggle")).toBeDisabled()
  await expect(sidebar.locator("#pet-poops button")).toHaveCount(1)
  await expect(sidebar.locator(".pet-food")).toBeVisible()
  expect((await saved(page)).state.adventureReadyAt).toBe(now + 40 * minute)
  expect((await saved(page)).state.reserve.adventureReadyAt).toBe(now + 130 * minute)
  await page.reload()
  await expect(sidebar.locator("#adventure-toggle")).toBeDisabled()
  expect((await saved(page)).state.adventureReadyAt).toBe(now + 40 * minute)
  expect((await saved(page)).state.reserve.adventureReadyAt).toBe(now + 130 * minute)

  await page.clock.setFixedTime(now + 45 * minute)
  await expect(sidebar.locator("#adventure-toggle")).toBeEnabled()
  await sidebar.locator("#pet-switch").click()
  await expect.poll(async () => (await saved(page)).state.partnerId).toBe("reserve")
  expect((await saved(page)).state.adventureReadyAt).toBe(now + 130 * minute)
  expect((await saved(page)).state.food.availableAt).toBe(now + 55 * minute)
  expect((await saved(page)).state.hygiene.nextAt).toBe(now + 75 * minute)
  await expect(sidebar.locator("#pet-poops button")).toHaveCount(2)
  await expect(sidebar.locator(".pet-food")).toBeHidden()
  await sidebar.locator("#pet-switch").click()
  await expect.poll(async () => (await saved(page)).state.partnerId).toBe("principal")
  await expect(sidebar.locator("#adventure-toggle")).toBeEnabled()
  await expect(sidebar.locator("#pet-poops button")).toHaveCount(1)
  await expect(sidebar.locator(".pet-food")).toBeVisible()
  expect(errors).toEqual([])
})
