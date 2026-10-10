import { expect, test } from "@playwright/test"

test("eating preserves the pet's vertical position and scale through the entire animation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/")
  const sidebar = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(sidebar.locator("#name")).not.toHaveText("")
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("web-digital-pet", 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const now = Date.now()
      const createdAt = new Date(now).toISOString()
      const transaction = database.transaction("pet", "readwrite")
      transaction.objectStore("pet").put(
        {
          partnerId: "feeding-test",
          currentNodeId: "3-001",
          gauge: 0,
          isTerminal: false,
          createdAt,
          lastTickAt: now,
          events: [{ currentNodeId: "3-001", createdAt }],
          food: { kind: "available" },
        },
        "current",
      )
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await page.reload()
  await expect(sidebar.locator(".pet-food")).toBeVisible()
  const position = () =>
    sidebar.locator("#artwork").evaluate((node) => {
      const svg = node as SVGSVGElement
      const matrix = svg.getScreenCTM()
      const rect = svg.getBoundingClientRect()
      return {
        top: rect.top,
        height: rect.height,
        origin: matrix?.f,
        scale: matrix?.d,
        baseline: matrix ? matrix.f + 16 * matrix.d : null,
      }
    })
  const before = await position()
  await sidebar.locator(".pet-food").click()
  await expect(sidebar.locator("#phase")).toHaveText("FEEDING")
  expect(await position()).toEqual(before)
  await page.screenshot({ path: testInfo.outputPath("eating-320.png") })
  await expect(sidebar.locator("#phase")).toHaveText("ACTIVE", { timeout: 6_000 })
  expect(await position()).toEqual(before)
  await expect(sidebar.locator("#percent")).toHaveText("10%")
  await expect(sidebar.locator(".pet-food")).toBeHidden()
})
