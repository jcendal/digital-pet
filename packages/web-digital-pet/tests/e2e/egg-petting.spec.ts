import { expect, test } from "@playwright/test"

test("egg clicks sparkle, earn 1% once, persist offline, and stop at hatching", async ({ page, context }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/")
  const sidebar = page.frameLocator('iframe[data-page="sidebar"]')
  const button = sidebar.locator("#pet-egg")
  await expect(button).toBeEnabled()
  await expect(sidebar.locator("#percent")).toHaveText("0%")
  const bounds = await button.boundingBox()
  expect(bounds?.width).toBeGreaterThanOrEqual(44)
  expect(bounds?.height).toBeGreaterThanOrEqual(44)
  await button.click()
  await expect(sidebar.locator("#percent")).toHaveText("1%")
  await expect(sidebar.locator(".egg-pet-star")).toHaveCount(5)
  await page.screenshot({ path: testInfo.outputPath("pet-egg-320.png") })
  await button.focus()
  await button.press("Space")
  await expect(sidebar.locator("#percent")).toHaveText("2%")
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      )
  })
  await context.setOffline(true)
  await page.reload()
  await expect(sidebar.locator("#percent")).toHaveText("2%")
  await button.click()
  await expect(sidebar.locator("#percent")).toHaveText("3%")
  await button.evaluate(() => {
    const bridge = (window as Window & { digitalPetBridge: { postMessage: (message: unknown) => void } })
      .digitalPetBridge
    const original = bridge.postMessage
    bridge.postMessage = (message: unknown) => {
      original(message)
      original(message)
      bridge.postMessage = original
    }
  })
  await button.click()
  await expect(sidebar.locator("#percent")).toHaveText("4%")
  await page.reload()
  await expect(sidebar.locator("#percent")).toHaveText("4%")
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("web-digital-pet", 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("pet", "readwrite")
      const store = transaction.objectStore("pet")
      const request = store.get("current")
      request.onsuccess = () => store.put({ ...request.result, gauge: 4_950_000, lastTickAt: Date.now() }, "current")
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await page.reload()
  await expect(sidebar.locator("#percent")).toHaveText("99%")
  await button.click()
  await expect(button).toBeHidden()
  await expect(sidebar.locator("#phase")).toHaveText("ACTIVE", { timeout: 20_000 })
  await expect(sidebar.locator("#percent")).toHaveText("0%")
  await expect(sidebar.locator("#stage")).not.toHaveText("Egg")
  await page.reload()
  await expect(button).toBeHidden()
  await expect(sidebar.locator("#percent")).toHaveText("0%")
  expect(errors).toEqual([])
})
