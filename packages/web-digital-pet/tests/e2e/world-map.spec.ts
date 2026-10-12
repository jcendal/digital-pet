import { expect, test } from "@playwright/test"

test("the LCD map travels to every destination and keeps the save offline", async ({ page, context }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.routeWebSocket("wss://0.peerjs.com/**", (socket) => socket.send(JSON.stringify({ type: "OPEN" })))
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  const petName = await pet.locator("#name").textContent()
  await page.locator("#map-button").click()
  const map = page.locator("#world-map-view")
  await expect(map).toBeVisible()
  await expect(page.locator("dialog[open]")).toHaveCount(0)
  await expect(page.locator(".web-view.active")).toHaveCount(0)
  await expect(map.locator("#map-location-name")).toHaveText("Dragon Eye Lake")
  const destinations = map.locator(".map-place")
  await expect(destinations).toHaveCount(11)
  await expect(map.locator(".map-landscape")).not.toHaveJSProperty("naturalWidth", 0)
  for (const [width, height] of [
    [320, 800],
    [390, 800],
    [430, 800],
    [1280, 900],
  ] as const) {
    await page.setViewportSize({ width, height })
    await expect(page.locator("#map-button")).toBeInViewport({ ratio: 1 })
    const screen = await map.locator(".screen").boundingBox()
    if (!screen) throw new Error("Map screen missing")
    for (const button of await destinations.all()) {
      const box = await button.boundingBox()
      if (!box) throw new Error("Destination missing")
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.x).toBeGreaterThanOrEqual(screen.x)
      expect(box.x + box.width).toBeLessThanOrEqual(screen.x + screen.width)
    }
    await page.screenshot({ path: testInfo.outputPath(`world-map-${width}.png`) })
  }
  await page.setViewportSize({ width: 390, height: 800 })
  for (const button of await destinations.all()) {
    const name = await button.getAttribute("aria-label")
    await expect(button).toBeEnabled()
    await button.click()
    await expect(button).toHaveAttribute("aria-pressed", "true")
    await expect(map.locator("#map-location-name")).toHaveText(name!)
    await expect(button).toBeEnabled()
  }
  await page.locator('[data-map-location="digital-city"]').click()
  await expect(page.locator('[data-map-location="digital-city"]')).toHaveAttribute("aria-pressed", "true")
  await expect(map.locator("#map-traveler")).toHaveClass(/walking/)
  await page.screenshot({ path: testInfo.outputPath("world-map-travel.png") })
  await expect(map.locator("#map-traveler")).not.toHaveClass(/walking/)
  await page.locator('a[data-page="sidebar"]').click()
  await expect(map).toBeHidden()
  await expect(pet.locator("#world-location")).toHaveText("Digital City →")
  await expect(pet.locator("#name")).toHaveText(petName!)
  await page.screenshot({ path: testInfo.outputPath("world-map-destination.png") })
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      )
  })
  await context.setOffline(true)
  await page.reload()
  await expect(pet.locator("#world-location")).toHaveText("Digital City →")
  await pet.locator("#world-location").click()
  await expect(map).toBeVisible()
  await page.locator('[data-map-location="tropical-jungle"]').click()
  await expect(map.locator("#map-location-name")).toHaveText("Tropical Jungle")
  await page.reload()
  await expect(pet.locator("#world-location")).toHaveText("Tropical Jungle →")
  expect(errors).toEqual([])
})

test("map destinations translate and keyboard travel respects reduced motion", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    locale: "es-ES",
    viewport: { width: 390, height: 800 },
    reducedMotion: "reduce",
  })
  const page = await context.newPage()
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toHaveText("")
  await page.getByRole("button", { name: "MAPA", exact: true }).click()
  await expect(page.locator("#map-location-name")).toHaveText("Lago Ojo de Dragón")
  const village = page.locator('[data-map-location="village-of-beginnings"]')
  await expect(village).toBeEnabled()
  await village.focus()
  await village.press("Enter")
  await expect(page.locator("#map-location-name")).toHaveText("Aldea del comienzo")
  await expect(page.locator("#map-traveler")).not.toHaveClass(/walking/)
  await page.screenshot({ path: testInfo.outputPath("world-map-spanish-keyboard.png") })
  await page.setViewportSize({ width: 844, height: 390 })
  for (const button of await page.locator(".map-place").all()) {
    await button.scrollIntoViewIfNeeded()
    const hit = await button.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest(".map-place") === element
    })
    expect(hit).toBe(true)
    await button.click()
    await expect(button).toHaveAttribute("aria-pressed", "true")
  }
  await page.screenshot({ path: testInfo.outputPath("world-map-landscape.png") })
  await context.close()
})

test("computer map preferences stay separate from the browser save and show boss victories", async ({
  page,
}, testInfo) => {
  await page.route("**/api/mode", (route) => route.fulfill({ json: { mode: "browser" } }))
  await page.goto("http://127.0.0.1:4176")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toHaveText("")
  await page.locator("#map-button").click()
  await page.locator('[data-map-location="digital-forest"]').click()
  await expect(page.locator("#map-location-name")).toHaveText("Digital Forest")
  await page.route("**/api/mode", (route) => route.fulfill({ json: { mode: "sqlite" } }))
  await page.route("**/api/world?**", (route) =>
    route.fulfill({
      json: {
        mode: "sqlite",
        registeredIds: [],
        residents: [],
        bossVictories: [{ regionId: "digital-ocean", nodeId: "6-095", defeatedAt: new Date().toISOString() }],
      },
    }),
  )
  await page.evaluate(() => {
    localStorage.setItem("digital-pet:preferred-source", "sqlite")
    localStorage.setItem(
      "digital-pet:computer-world",
      JSON.stringify({ regionId: "digital-ocean", locationId: "dragon-eye-lake" }),
    )
  })
  await page.reload()
  await page.locator("#map-button").click()
  await expect(page.locator("#map-location-name")).toHaveText("Dragon Eye Lake")
  await expect(page.locator('[data-map-location="digital-ocean"] .map-boss-star')).toBeVisible()
  await expect(page.locator('[data-map-location="dragon-eye-lake"] .map-boss-star')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("world-map-boss-star.png") })
  await page.locator('[data-map-location="digital-city"]').click()
  await expect(page.locator("#map-location-name")).toHaveText("Digital City")
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("digital-pet:computer-world")!))).toEqual({
    regionId: "digital-city",
    locationId: "digital-city",
  })
  await page.evaluate(() => localStorage.setItem("digital-pet:preferred-source", "browser"))
  await page.reload()
  await page.locator("#map-button").click()
  await expect(page.locator("#map-location-name")).toHaveText("Digital Forest")
})
