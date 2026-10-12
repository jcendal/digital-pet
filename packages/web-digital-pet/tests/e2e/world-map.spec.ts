import { expect, type Page, test } from "@playwright/test"
import { openOptions } from "./helpers/navigation.ts"

const travel = async (page: Page, locationId: string, zoneId = locationId) => {
  await page.locator(`[data-map-zone="${zoneId}"]`).click()
  await expect(page.locator("#map-location-picker")).toBeVisible()
  await page.locator(`#map-location-picker [data-map-location="${locationId}"]`).click()
  await expect(page.locator("#map-location-picker")).toBeHidden()
  await expect(page.locator(`[data-map-location="${locationId}"]`)).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("#world-map-view")).toHaveAttribute("aria-busy", "false")
}

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
  await expect(destinations).toHaveCount(10)
  await expect(page.locator('[data-map-zone="digital-ocean"]')).toHaveAttribute("aria-pressed", "true")
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
      expect(
        await button.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return (
            document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest(".map-place") ===
            element
          )
        }),
      ).toBe(true)
    }
    if (width === 390) {
      await destinations.first().hover()
      await destinations.first().focus()
    }
    await page.screenshot({ path: testInfo.outputPath(`world-map-${width}.png`) })
  }
  await page.setViewportSize({ width: 390, height: 800 })
  const visited = new Set<string>()
  for (const zone of await destinations.all()) {
    const previousName = await map.locator("#map-location-name").textContent()
    await zone.click()
    await expect(page.locator("#map-location-picker")).toBeVisible()
    await expect(map.locator("#map-location-name")).toHaveText(previousName!)
    const options = page.locator(".map-location-option:not([hidden])")
    await expect(options).toHaveCount(2)
    const choices = await options.evaluateAll((elements) =>
      elements.map((element) => ({ id: (element as HTMLElement).dataset.mapLocation!, name: element.textContent! })),
    )
    await page.locator("#map-picker-close").click()
    const zoneId = await zone.getAttribute("data-map-zone")
    for (const choice of choices) {
      await travel(page, choice.id, zoneId!)
      await expect(map.locator("#map-location-name")).toHaveText(choice.name)
      visited.add(choice.id)
    }
  }
  expect(visited.size).toBe(20)
  await travel(page, "digital-city")
  await expect(page.locator('[data-map-zone="digital-city"]')).toHaveAttribute("aria-pressed", "true")
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
  await travel(page, "tropical-jungle")
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
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  await expect(pet.locator("#world-location")).toHaveText("Lago Ojo de Dragón →")
  await page.screenshot({ path: testInfo.outputPath("dragon-eye-lake-spanish.png") })
  await page.getByRole("button", { name: "MAPA", exact: true }).click()
  await expect(page.locator("#map-location-name")).toHaveText("Lago Ojo de Dragón")
  await travel(page, "digital-ocean")
  await expect(page.locator("#map-location-name")).toHaveText("Playa Coela")
  await page.screenshot({ path: testInfo.outputPath("coela-beach-map.png") })
  await page.locator('a[data-page="sidebar"]').click()
  await expect(pet.locator("#world-location")).toHaveText("Playa Coela →")
  await expect(pet.locator(".world-scenery-track img").first()).toHaveAttribute("src", /\/beach(?:-[^/]+)?\.svg$/)
  await expect(pet.locator(".world-scenery-track img").first()).not.toHaveJSProperty("naturalWidth", 0)
  await page.screenshot({ path: testInfo.outputPath("coela-beach-390.png") })
  await page.setViewportSize({ width: 320, height: 800 })
  await page.screenshot({ path: testInfo.outputPath("coela-beach-320.png") })
  await page.setViewportSize({ width: 390, height: 800 })
  await page.reload()
  await expect(pet.locator("#world-location")).toHaveText("Playa Coela →")
  await page.getByRole("button", { name: "MAPA", exact: true }).click()
  const village = page.locator('[data-map-zone="village-of-beginnings"]')
  await expect(village).toBeEnabled()
  await village.focus()
  await village.press("Enter")
  await expect(page.locator("#map-location-picker")).toBeVisible()
  await expect(page.locator("#map-location-name")).toHaveText("Playa Coela")
  const sanctuary = page.locator('[data-map-location="ice-sanctuary"]')
  await sanctuary.focus()
  await sanctuary.press("Enter")
  await expect(page.locator("#map-location-picker")).toBeHidden()
  await expect(page.locator("#map-location-name")).toHaveText("Santuario de Hielo")
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
    await expect(button).toHaveAttribute("aria-expanded", "true")
    await page.locator("#map-picker-close").click()
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
  await travel(page, "digital-forest")
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
  await expect(page.locator('[data-map-zone="digital-ocean"] .map-boss-star')).toBeVisible()
  await expect(page.locator(".map-boss-star:visible")).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath("world-map-boss-star.png") })
  await travel(page, "digital-city")
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

test("new habitat destinations load their scenery and preserve travel offline", async ({ page, context }, testInfo) => {
  await page.routeWebSocket("wss://0.peerjs.com/**", (socket) => socket.send(JSON.stringify({ type: "OPEN" })))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  const petName = await pet.locator("#name").textContent()
  for (const [id, name, scene, zoneId] of [
    ["geko-swamp", "Geko Swamp", "swamp", "gear-savannah"],
    ["overdell-cemetery", "Overdell Cemetery", "cemetery", "wasteland"],
    ["mount-panorama", "Mount Panorama", "panorama", "digital-forest"],
    ["factorial-town", "Factorial Town", "factory", "digital-city"],
    ["ice-sanctuary", "Ice Sanctuary", "ice", "village-of-beginnings"],
    ["great-canyon", "Great Canyon", "canyon", "ancient-dino-region"],
    ["mangrove-region", "Mangrove Region", "mangrove", "tropical-jungle"],
    ["dark-terminal", "Dark Terminal", "terminal", "vamdemon-castle"],
    ["toy-mansion", "Toy Mansion", "toys", "upside-down-pyramid"],
  ] as const) {
    await page.locator("#map-button").click()
    await travel(page, id, zoneId)
    await expect(page.locator("#map-location-name")).toHaveText(name)
    await page.locator('a[data-page="sidebar"]').click()
    await expect(pet.locator("#world-location")).toHaveText(`${name} →`)
    await expect(pet.locator("#name")).toHaveText(petName!)
    const scenery = pet.locator(".world-scenery-track img").first()
    await expect(scenery).toHaveAttribute("src", new RegExp(`/${scene}(?:-[^/]+)?\\.svg$`))
    await expect(scenery).not.toHaveJSProperty("naturalWidth", 0)
    await page.screenshot({ path: testInfo.outputPath(`${id}-390.png`) })
  }
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      )
  })
  await context.setOffline(true)
  await page.reload()
  await expect(pet.locator("#world-location")).toHaveText("Toy Mansion →")
  await expect(pet.locator("#name")).toHaveText(petName!)
  await page.locator("#map-button").click()
  await travel(page, "ice-sanctuary", "village-of-beginnings")
  await page.locator('a[data-page="sidebar"]').click()
  await page.reload()
  await expect(pet.locator("#world-location")).toHaveText("Ice Sanctuary →")
  await expect(pet.locator(".world-scenery-track img").first()).not.toHaveJSProperty("naturalWidth", 0)
})

test("zone dropdowns fit mobile screens and dismiss without changing the saved destination", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({ locale: "es-ES", viewport: { width: 320, height: 800 } })
  const page = await context.newPage()
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  await page.locator("#map-button").click()
  const picker = page.locator("#map-location-picker")
  const zones = page.locator("[data-map-zone]")
  for (const zone of await zones.all()) {
    await zone.click()
    await expect(picker).toBeVisible()
    await expect(picker.locator(".map-location-option:not([hidden])")).toHaveCount(2)
    for (const preview of await picker.locator(".map-location-option:not([hidden]) img").all())
      await expect(preview).not.toHaveJSProperty("naturalWidth", 0)
    const box = await picker.boundingBox()
    const bounds = await page.locator(".map-viewport").boundingBox()
    if (!box || !bounds) throw new Error("Map picker missing")
    expect(box.x).toBeGreaterThanOrEqual(bounds.x)
    expect(box.y).toBeGreaterThanOrEqual(bounds.y)
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width)
    expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height)
    await page.keyboard.press("Escape")
    await expect(picker).toBeHidden()
    await expect(zone).toBeFocused()
    await expect(page.locator("#map-location-name")).toHaveText("Lago Ojo de Dragón")
  }
  await page.locator('[data-map-zone="gear-savannah"]').click()
  await page.screenshot({ path: testInfo.outputPath("map-dropdown-320.png") })
  await page.locator("#map-location-name").click()
  await expect(picker).toBeHidden()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(pet.locator("#world-location")).toHaveText("Lago Ojo de Dragón →")
  await page.locator("#map-button").click()
  await page.locator('[data-map-zone="digital-ocean"]').click()
  await page.screenshot({ path: testInfo.outputPath("map-dropdown-390.png") })
  await page.locator('[data-map-location="digital-ocean"]').click()
  await expect(page.locator("#map-location-name")).toHaveText("Playa Coela")
  await page.locator('[data-map-zone="gear-savannah"]').click()
  await page.locator('a[data-page="sidebar"]').click()
  await expect(picker).toBeHidden()
  await expect(pet.locator("#world-location")).toHaveText("Playa Coela →")
  await page.reload()
  await expect(pet.locator("#world-location")).toHaveText("Playa Coela →")
  await page.locator("#map-button").click()
  await expect(picker).toBeHidden()
  await context.close()
})

test("Map and Regions share the visor and region travel persists offline", async ({ page, context }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  const name = await pet.locator("#name").textContent()
  await openOptions(page)
  await expect(page.locator("#world-button, #world-dialog")).toHaveCount(0)
  await expect(page.locator("#language-select")).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("options-without-world-390.png") })
  await page.locator("#options-dialog .dialog-close").click()
  await page.locator("#map-button").click()
  const atlasTab = page.getByRole("tab", { name: "MAP", exact: true })
  const regionsTab = page.getByRole("tab", { name: "REGIONS", exact: true })
  const atlas = page.locator("#map-atlas-panel")
  const regions = page.locator("#world-regions")
  await expect(atlasTab).toHaveAttribute("aria-selected", "true")
  await expect(regions).toBeHidden()
  await page.locator('[data-map-zone="digital-city"]').click()
  await expect(page.locator("#map-location-picker")).toBeVisible()
  await atlasTab.focus()
  await atlasTab.press("ArrowRight")
  await expect(regionsTab).toBeFocused()
  await expect(regionsTab).toHaveAttribute("aria-selected", "true")
  await expect(atlasTab).toHaveAttribute("tabindex", "-1")
  await expect(atlas).toBeHidden()
  await expect(page.locator("#map-location-picker")).toBeHidden()
  await expect(regions.locator(".region-card")).toHaveCount(10)
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 })
    const overflow = await regions.evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(overflow).toBe(false)
    await page.screenshot({ path: testInfo.outputPath(`regions-overview-${width}.png`) })
  }
  await page.locator('[data-region="digital-city"]').click()
  await expect(regions.locator(".region-title")).toHaveText("Digital City")
  await expect(regions.locator(".world-locations button")).toHaveCount(2)
  await expect(regions.locator(".world-bosses .resident-row")).toHaveCount(2)
  await expect(regions.locator("#world-preview-image")).not.toHaveJSProperty("naturalWidth", 0)
  await page.screenshot({ path: testInfo.outputPath("regions-detail-390.png") })
  await page.setViewportSize({ width: 320, height: 800 })
  await page.screenshot({ path: testInfo.outputPath("regions-detail-320.png") })
  await regionsTab.focus()
  await regionsTab.press("Home")
  await expect(atlasTab).toBeFocused()
  await expect(atlas).toBeVisible()
  await expect(regions).toBeHidden()
  await expect(page.locator("#map-location-name")).toHaveText("Dragon Eye Lake")
  await regionsTab.click()
  await expect(regions.locator(".region-title")).toHaveText("Digital City")
  await page.locator("[data-world-back]").click()
  await expect(regions.locator(".region-card")).toHaveCount(10)
  await expect(page.locator("#world-map-view")).toHaveAttribute("aria-busy", "false")
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      )
  })
  await context.setOffline(true)
  await page.locator('[data-region="digital-city"]').click()
  await regions.locator('[data-location="factorial-town"]').click()
  await expect(page.locator("#world-preview-image")).toHaveAttribute("src", /\/factory(?:-[^/]+)?\.svg$/)
  await page.locator("#world-travel").click()
  await expect(page.locator("#world-map-view")).toBeHidden()
  await expect(pet.locator("#world-location")).toHaveText("Factorial Town →")
  await expect(pet.locator("#name")).toHaveText(name!)
  await page.reload()
  await expect(pet.locator("#world-location")).toHaveText("Factorial Town →")
  await page.locator("#map-button").click()
  await expect(atlasTab).toHaveAttribute("aria-selected", "true")
  await expect(page.locator("#map-location-name")).toHaveText("Factorial Town")
  expect(errors).toEqual([])
})
