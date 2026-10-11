import { expect, test } from "@playwright/test"

test("the local cosmetic endpoint rejects foreign origins and keeps other routes read-only", async ({ request }) => {
  for (const [path, origin, status] of [
    ["/api/pet", "https://other.example", 403],
    ["/api/pet", undefined, 403],
    ["/api/sidebar", "http://127.0.0.1:4176", 405],
    ["/api/pet", "http://127.0.0.1:4176", 200],
  ] as const) {
    const response = await request.post(`http://127.0.0.1:4176${path}`, {
      headers: origin ? { Origin: origin } : {},
    })
    expect(response.status()).toBe(status)
  }
})

test("petting shows hearts awake, bolts after sleeping, and works offline without XP", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 760 })
  await page.clock.install()
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
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
          partnerId: "affection-test",
          currentNodeId: "3-001",
          createdAt,
          lastTickAt: now,
          gauge: 0,
          isTerminal: false,
          events: [{ currentNodeId: "3-001", createdAt }],
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
  const button = pet.locator("#pet-partner")
  await expect(button).toBeEnabled()
  await expect(pet.locator("#pet-egg")).toBeHidden()
  const bounds = await button.boundingBox()
  expect(bounds?.width).toBeGreaterThanOrEqual(44)
  expect(bounds?.height).toBeGreaterThanOrEqual(44)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000))
  await button.click()
  await expect(button).toHaveCSS("outline-style", "none")
  await expect(pet.locator(".pet-happy")).toHaveCount(5)
  await expect(pet.locator("#percent")).toHaveText("0%")
  await expect(pet.locator(".egg-pet-reward")).toHaveCount(0)
  await pet.locator(".pet-happy").evaluateAll((nodes) => {
    for (const node of nodes) {
      for (const animation of node.getAnimations()) {
        animation.pause()
        animation.currentTime = 200
      }
    }
  })
  await page.screenshot({ path: testInfo.outputPath("pet-hearts-320.png") })
  const heartBounds = await pet.locator(".pet-happy").first().boundingBox()
  expect((heartBounds?.x ?? 0) + (heartBounds?.width ?? 0)).toBeLessThan(bounds?.x ?? 0)
  const heartOpacity = await pet
    .locator(".pet-happy")
    .first()
    .evaluate((node) => getComputedStyle(node).opacity)
  expect(Number(heartOpacity)).toBeGreaterThan(0.5)
  await page.clock.fastForward(301_000)
  await context.setOffline(true)
  await button.focus()
  await button.press("Space")
  await expect(pet.locator(".pet-angry")).toHaveCount(5)
  await expect(pet.locator(".pet-happy")).toHaveCount(0)
  await expect(pet.locator("#percent")).toHaveText("0%")
  await pet.locator(".pet-angry").evaluateAll((nodes) => {
    for (const node of nodes) {
      for (const animation of node.getAnimations()) {
        animation.pause()
        animation.currentTime = 200
      }
    }
  })
  await page.screenshot({ path: testInfo.outputPath("pet-bolts-320.png") })
  await page.clock.runFor(1_600)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await button.click()
  await expect(pet.locator(".pet-happy")).toHaveCount(5)
  await expect(pet.locator(".pet-happy").first()).toHaveCSS("animation-name", "none")
  await page.clock.runFor(200)
  await expect(pet.locator(".pet-reaction-icon")).toHaveCount(0)
  await page.reload()
  await expect(pet.locator("#percent")).toHaveText("0%")
  expect(errors).toEqual([])
})
