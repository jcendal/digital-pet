import { expect, test } from "@playwright/test"

test("browser piles persist offline, show sadness, and cleaning grants one 5% reward", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/")
  const sidebar = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(sidebar.locator("#name")).not.toHaveText("")
  await page.evaluate(async () => {
    const now = Date.now()
    const createdAt = new Date(now).toISOString()
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("web-digital-pet", 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("pet", "readwrite")
      transaction.objectStore("pet").put(
        {
          partnerId: "hygiene-test",
          currentNodeId: "3-001",
          createdAt,
          lastTickAt: now,
          gauge: 0,
          isTerminal: false,
          food: { kind: "available" },
          events: [{ currentNodeId: "3-001", createdAt }],
          hygiene: { poops: [], nextAt: now - 24 * 3_600_000, happyUntil: 0 },
        },
        "current",
      )
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      )
  })
  await page.reload()
  await expect(sidebar.locator(".pet-poop")).toHaveCount(3)
  await expect(sidebar.locator(".poop-fly")).toHaveCount(6)
  const fly = sidebar.locator(".poop-fly").first()
  await expect(fly).toHaveCSS("animation-name", "poop-fly-one")
  await expect(fly).toHaveCSS("animation-timing-function", "steps(1)")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(fly).toHaveCSS("animation-name", "none")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect(sidebar.locator("#phase")).toHaveText("SAD")
  await expect(sidebar.locator(".pet-food")).toBeVisible()
  const buttons = await sidebar.locator(".pet-poop").evaluateAll((nodes) =>
    nodes.map((node) => {
      const bounds = node.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    }),
  )
  expect(buttons.every((bounds) => bounds.width >= 44 && bounds.height >= 44)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("poops-320.png") })
  await context.setOffline(true)
  await page.reload()
  await expect(sidebar.locator(".pet-poop")).toHaveCount(3)
  await sidebar.locator(".pet-poop").first().click()
  await expect(sidebar.locator(".pet-poop")).toHaveCount(2)
  await expect(sidebar.locator("#phase")).toHaveText("HAPPY")
  await expect(sidebar.locator("#percent")).toHaveText("5%")
  await expect(sidebar.locator("#phase")).toHaveText("SAD", { timeout: 6_000 })
  await page.reload()
  await expect(sidebar.locator(".pet-poop")).toHaveCount(2)
  await expect(sidebar.locator("#percent")).toHaveText("5%")
  await sidebar.locator(".pet-poop").first().click()
  await expect(sidebar.locator(".pet-poop")).toHaveCount(1)
  await expect(sidebar.locator("#percent")).toHaveText("10%")
  await expect(sidebar.locator("#phase")).toHaveText("HAPPY")
  await expect(sidebar.locator("#phase")).toHaveText("ACTIVE", { timeout: 6_000 })
  expect(errors).toEqual([])
})
