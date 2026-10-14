import { expect, test } from "@playwright/test"

test.use({ locale: "es-ES" })

test("Dex separates special evolution routes and displays unclean-pile requirements", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toBeEmpty()
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
          partnerId: "care-preview",
          currentNodeId: "4-046",
          createdAt,
          lastTickAt: now,
          gauge: 0,
          isTerminal: false,
          events: ["4-046", "5-139", "5-104", "1-002", "2-013"].map((currentNodeId) => ({ currentNodeId, createdAt })),
        },
        "current",
      )
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await page.goto("/dex?selected=4-046")
  const dex = page.frameLocator('iframe[data-page="dex"]')
  await expect(dex.locator(".detail-name h2")).toHaveText("Garurumon")
  await dex.locator("#detail details summary").click()
  const normal = dex.locator(".routes").filter({ has: dex.locator(".route-label", { hasText: /^Evoluciona a$/i }) })
  const special = dex.locator(".routes").filter({ hasText: "Evoluciones especiales" })
  await expect(normal.getByRole("button", { name: /WereGarurumon/ })).toContainText("Cacas sin limpiar: 0/1/2")
  await expect(normal.getByRole("button", { name: /Orochimon/ })).toHaveCount(0)
  await expect(special.getByRole("button", { name: /Orochimon/ })).toBeVisible()
  await expect(special).toContainText("bloqueadas")
  const wereGarurumon = normal.getByRole("button", { name: /WereGarurumon/ })
  await wereGarurumon.scrollIntoViewIfNeeded()
  expect(await wereGarurumon.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("evolution-care-dex.png") })
  await special.getByRole("button", { name: /Orochimon/ }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("evolution-special-dex.png") })
})

test("unrestricted evolution routes omit care text", async ({ page }) => {
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toBeEmpty()
  await page.goto("/dex?selected=0-001")
  const dex = page.frameLocator('iframe[data-page="dex"]')
  await expect(dex.locator(".detail-name h2")).not.toBeEmpty()
  await dex.locator("#detail details summary").click()
  await expect(
    dex.locator(".routes").filter({ has: dex.locator(".route-label", { hasText: /^Evoluciona a$/i }) }),
  ).not.toContainText("Cacas sin limpiar")
})
