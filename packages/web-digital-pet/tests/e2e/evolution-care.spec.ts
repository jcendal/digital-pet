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
  await expect(
    normal
      .getByRole("button", { name: /WereGarurumon/ })
      .getByRole("img", { name: "Cacas sin limpiar: 0/1/2", exact: true }),
  ).toBeVisible()
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
  await expect(dex.locator('[data-requirement="care"]')).toHaveCount(0)
})

test("Lopmon's Dex route leads to Turuiemon and exposes Antylamon's actual requirements", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toBeEmpty()
  await page.evaluate(async () => {
    const createdAt = new Date().toISOString()
    const database = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open("web-digital-pet", 1)
      open.onsuccess = () => resolve(open.result)
    })
    await new Promise<void>((resolve) => {
      const transaction = database.transaction("pet", "readwrite")
      transaction.objectStore("pet").put(
        {
          partnerId: "lopmon-routes",
          currentNodeId: "3-047",
          createdAt,
          lastTickAt: Date.now(),
          gauge: 0,
          isTerminal: false,
          events: ["3-047", "4-131", "5-006"].map((currentNodeId) => ({ currentNodeId, createdAt })),
        },
        "current",
      )
      transaction.oncomplete = () => resolve()
    })
    database.close()
  })
  await page.goto("/dex?selected=3-047")
  const dex = page.frameLocator('iframe[data-page="dex"]')
  await expect(dex.locator(".detail-name h2")).toHaveText("Lopmon")
  await dex.locator("#detail details summary").click()
  const normal = dex.locator(".routes").filter({ has: dex.locator(".route-label", { hasText: /^Evoluciona a$/i }) })
  await expect(normal.getByRole("button", { name: /Turuiemon/ })).toBeVisible()
  await expect(normal.locator('[data-requirement="care"]')).toHaveCount(0)
  await normal.getByRole("button", { name: /Turuiemon/ }).click()
  await expect(dex.locator(".detail-name h2")).toHaveText("Turuiemon")
  await expect(dex.locator("#detail details")).toHaveAttribute("open", "")
  const antylamon = normal.getByRole("button", { name: /Antylamon|Andiramon/ })
  await expect(antylamon.getByRole("img", { name: "Cacas sin limpiar: 0/1/2", exact: true })).toBeVisible()
  await expect(antylamon.getByRole("img", { name: "Victorias de combate: 3+", exact: true })).toBeVisible()
  await expect(antylamon.locator('[data-requirement="victories"]')).toHaveText("3+")
  await antylamon.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("care-and-combat-indicators-390.png") })
  await page.setViewportSize({ width: 320, height: 700 })
  expect(await antylamon.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("care-and-combat-indicators-320.png") })
})
