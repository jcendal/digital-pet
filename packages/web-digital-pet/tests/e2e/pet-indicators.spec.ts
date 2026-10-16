import { expect, test } from "@playwright/test"

test.use({ locale: "es-ES" })

test("pet indicators follow the principal through cleaning, switching and reload", async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.routeWebSocket("wss://0.peerjs.com/**", (socket) => socket.send(JSON.stringify({ type: "OPEN" })))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  const sidebar = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(sidebar.locator("#name")).not.toBeEmpty()
  await page.evaluate(async () => {
    const now = Date.now()
    const createdAt = new Date(now).toISOString()
    const partner = (partnerId: string, currentNodeId: string, combatVictories: number, poops: number[]) => ({
      partnerId,
      currentNodeId,
      combatVictories,
      createdAt,
      lastTickAt: now,
      gauge: 0,
      isTerminal: false,
      events: [{ currentNodeId, createdAt }],
      hygiene: { poops, nextAt: poops.length === 3 ? null : now + 3_600_000, happyUntil: 0 },
    })
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("web-digital-pet", 1)
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve) => {
      const transaction = database.transaction("pet", "readwrite")
      transaction.objectStore("pet").put(
        {
          ...partner("indicator-principal", "3-001", 4, [now - 1]),
          teamRevision: 1,
          reserve: { ...partner("indicator-reserve", "4-131", 2, [now - 3, now - 2, now - 1]), pausedAt: now },
        },
        "current",
      )
      transaction.oncomplete = () => resolve()
    })
    database.close()
  })
  await page.reload()
  const indicators = sidebar.locator("#pet-indicators")
  const care = indicators.locator('[data-indicator="care"]')
  const victories = indicators.locator('[data-indicator="victories"]')
  await expect(care).toHaveAccessibleName("Cacas sin limpiar: 1")
  await expect(victories).toHaveAccessibleName("Victorias de combate en esta forma: 4")
  await expect(care).toHaveText("1")
  await expect(victories).toHaveText("4")
  await expect(indicators).toBeVisible()
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 760 },
  ]) {
    await page.setViewportSize(viewport)
    const bounds = await indicators.boundingBox()
    const gauge = await sidebar.locator("#gauge").boundingBox()
    const meter = await sidebar.locator("#meter").boundingBox()
    const progress = await sidebar.locator(".progress").boundingBox()
    if (!bounds || !gauge || !meter || !progress) throw new Error("Missing pet progress")
    expect(bounds.x).toBeGreaterThan(gauge.x + gauge.width)
    expect(Math.abs(bounds.y + bounds.height / 2 - (gauge.y + gauge.height / 2))).toBeLessThan(1)
    expect(bounds.y).toBeGreaterThanOrEqual(meter.y + meter.height)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(progress.x + progress.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(progress.y + progress.height)
    expect(await indicators.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`pet-indicators-${viewport.width}.png`) })
  }
  await sidebar.locator(".pet-poop").click()
  await expect(care).toHaveText("0")
  await expect(victories).toHaveText("4")
  await sidebar.locator("#pet-switch").click()
  await expect(sidebar.locator("#name")).toHaveText("Turuiemon")
  await expect(care).toHaveText("3")
  await expect(victories).toHaveText("2")
  await page.reload()
  await expect(care).toHaveText("3")
  await expect(victories).toHaveText("2")
  await sidebar.locator("#pet-switch").click()
  await expect(sidebar.locator("#name")).toHaveText("Agumon")
  await expect(care).toHaveText("0")
  await expect(victories).toHaveText("4")
  expect(errors).toEqual([])
})
