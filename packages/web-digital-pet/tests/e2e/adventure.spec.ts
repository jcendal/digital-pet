import { expect, type Page, test } from "@playwright/test"
import { saveAdventure as save } from "./helpers/adventure.ts"

const saved = (page: Page) =>
  page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("web-digital-pet", 1)
      request.onsuccess = () => resolve(request.result)
    })
    const transaction = database.transaction("pet", "readonly")
    const store = transaction.objectStore("pet")
    const read = <T>(key: string) =>
      new Promise<T>((resolve) => {
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result)
      })
    const pet = await read<{ gauge: number; combatVictories?: number }>("current")
    const adventure = await read<{
      state: { elapsedMs: number; running: boolean; event?: { plan?: unknown }; collected: number; victories: number }
    }>("adventure")
    database.close()
    return { gauge: pet.gauge, combatVictories: pet.combatVictories ?? 0, adventure: adventure.state }
  })

test("adventure walks quickly, finds move past, collection earns once, and reload resumes paused", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 760 })
  await page.addInitScript(() => {
    Math.random = () => 0.9
  })
  await page.clock.install()
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  await save(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      )
  })
  await context.setOffline(true)
  await expect(pet.locator("#adventure-toggle")).toBeEnabled()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await pet.locator("#adventure-toggle").click()
  await expect(pet.locator(".pet-module")).toHaveClass(/adventuring/)
  const poses = new Set<string>()
  for (let index = 0; index < 4; index++) {
    await page.clock.runFor(250)
    await page.waitForTimeout(30)
    poses.add(await pet.locator("#artwork").innerHTML())
  }
  expect(poses.size).toBeGreaterThan(1)
  for (let index = 0; index < 62; index++) {
    await page.clock.runFor(1000)
    await page.waitForTimeout(20)
  }
  const loot = pet.locator("#adventure-loot")
  await expect(loot).toBeVisible()
  const before = await loot.boundingBox()
  await page.clock.runFor(1000)
  await expect.poll(async () => (await loot.boundingBox())?.x ?? Infinity).toBeLessThan(before?.x ?? 0)
  await page.screenshot({ path: testInfo.outputPath("adventure-320.png") })
  await loot.click()
  await expect.poll(async () => (await saved(page)).gauge).toBe(800_000)
  await expect(loot).toBeHidden()
  await pet.locator("#adventure-toggle").click()
  await expect(pet.locator(".pet-module")).not.toHaveClass(/adventuring/)
  const paused = await saved(page)
  await page.clock.fastForward(60_000)
  expect((await saved(page)).adventure.elapsedMs).toBe(paused.adventure.elapsedMs)
  await page.reload()
  await expect(pet.locator("#adventure-toggle")).toHaveAttribute("aria-label", "Continue")
  expect((await saved(page)).gauge).toBe(800_000)
  await pet.locator("#adventure-toggle").click()
  for (let index = 0; index < 63; index++) {
    await page.clock.runFor(1000)
    await page.waitForTimeout(20)
  }
  await expect(loot).toBeVisible()
  for (let index = 0; index < 9; index++) {
    await page.clock.runFor(1000)
    await page.waitForTimeout(20)
  }
  await expect(loot).toBeHidden()
  expect((await saved(page)).adventure.collected).toBe(1)
  expect((await saved(page)).gauge).toBe(800_000)
  expect(errors).toEqual([])
})

test("a saved adventure fight plays in the pet viewer and XP waits for the last animation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message))
  await page.addInitScript(() => {
    Math.random = () => 0.9
    // WebKit can replay initialization on the same window when restoring an iframe.
    if (Reflect.has(window, "battleTransitions")) return
    const transitions: { phase: string; caption: string }[] = []
    Object.defineProperty(window, "battleTransitions", { value: transitions })
    window.addEventListener("message", (event) => {
      if (event.data?.type !== "presentation-state" || event.data.state.phase === "battle") return
      queueMicrotask(() => {
        const artwork = document.getElementById("artwork")
        if (artwork)
          transitions.push({
            phase: event.data.state.phase,
            caption: artwork.textContent ?? "",
          })
      })
    })
  })
  await page.clock.install()
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  await save(page, true)
  await expect(pet.locator("#adventure-toggle")).toHaveAttribute("aria-label", "Continue")
  const original = (await saved(page)).adventure.event?.plan
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await pet.locator("#adventure-toggle").click()
  await expect(pet.locator(".pet-module")).toHaveClass(/battling/)
  expect((await saved(page)).gauge).toBe(0)
  await page.reload()
  await expect(pet.locator("#adventure-toggle")).toHaveAttribute("aria-label", "Continue")
  expect((await saved(page)).adventure.event?.plan).toEqual(original)
  await pet.locator("#adventure-toggle").click()
  for (let index = 0; index < 4; index++) {
    await page.clock.runFor(1000)
    await page.waitForTimeout(20)
  }
  await page.screenshot({ path: testInfo.outputPath("adventure-battle.png") })
  await page.setViewportSize({ width: 320, height: 844 })
  await page.screenshot({ path: testInfo.outputPath("adventure-battle-320.png") })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(pet.locator("#stage")).toHaveText("Betamon")
  expect((await saved(page)).gauge).toBe(0)
  for (let index = 0; index < 20; index++) {
    await page.clock.runFor(1000)
    await page.waitForTimeout(20)
  }
  await expect.poll(async () => (await saved(page)).gauge).toBe(2_000_000)
  expect((await saved(page)).adventure.victories).toBe(1)
  expect((await saved(page)).combatVictories).toBe(1)
  const transitions = await pet.locator("html").evaluate(() => Reflect.get(window, "battleTransitions"))
  await testInfo.attach("battle-end-transitions", {
    body: JSON.stringify(transitions, null, 2),
    contentType: "application/json",
  })
  expect(transitions.length).toBeGreaterThan(0)
  expect(transitions.filter((frame: { caption: string }) => frame.caption.trim())).toEqual([])
  await page.screenshot({ path: testInfo.outputPath("adventure-battle-finished.png") })
  await page.reload()
  await expect(pet.locator("#percent")).toHaveText("5%")
  expect((await saved(page)).gauge).toBe(2_000_000)
  expect((await saved(page)).combatVictories).toBe(1)
  expect(errors).toEqual([])
})

test("a disabled Adventure countdown persists on reload and becomes available after two hours", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5
  })
  await page.clock.install()
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  await save(page)
  await expect(pet.locator(".arena #adventure-toggle")).toHaveAttribute("aria-label", "Adventure")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath("adventure-ready.png") })
  await pet.locator("#adventure-toggle").click()
  await expect(pet.locator(".pet-module")).toHaveClass(/adventuring/)
  await page.mouse.move(0, 0)
  await page.screenshot({ path: testInfo.outputPath("adventure-running.png") })
  await pet.locator("#adventure-toggle").click()
  await expect(pet.locator("#adventure-toggle")).toHaveAttribute("aria-label", "Continue")
  await page.mouse.move(0, 0)
  await page.screenshot({ path: testInfo.outputPath("adventure-paused.png") })
  await pet.locator("#adventure-toggle").click()
  await expect(pet.locator(".pet-module")).toHaveClass(/adventuring/)
  await pet.locator("#adventure-stop").click()
  await expect(pet.locator("#adventure-toggle")).toBeVisible()
  await expect(pet.locator("#adventure-toggle")).toBeDisabled()
  await expect(pet.locator("#adventure-toggle")).toHaveText("2:00")
  await expect(pet.locator("#adventure-toggle")).toHaveCSS("opacity", "1")
  await page.reload()
  await expect(pet.locator("#adventure-controls")).toHaveCount(0)
  await expect(pet.locator("#adventure-toggle")).toBeDisabled()
  await expect(pet.locator("#adventure-toggle")).toHaveText("2:00")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath("adventure-countdown.png") })
  await page.setViewportSize({ width: 320, height: 760 })
  await page.screenshot({ path: testInfo.outputPath("adventure-countdown-320.png") })
  await page.clock.fastForward(2 * 3600_000 - 60_000)
  await expect(pet.locator("#adventure-toggle")).toBeDisabled()
  await expect(pet.locator("#adventure-toggle")).toHaveText("0:01")
  await page.clock.fastForward(60_000)
  await expect(pet.locator("#adventure-toggle")).toBeVisible()
  await expect(pet.locator("#adventure-toggle")).toBeEnabled()
  await expect(pet.locator("#adventure-toggle")).toHaveText("Adventure")
  await pet.locator("#adventure-toggle").click()
  await expect(pet.locator(".pet-module")).toHaveClass(/adventuring/)
})

test.describe("battle intro artwork", () => {
  test.use({ locale: "es-ES" })

  test("Spanish battles show the English pixel BATTLE banner at narrow and wide sizes", async ({ page }, testInfo) => {
    await page.clock.install()
    await page.goto("/")
    const pet = page.frameLocator('iframe[data-page="sidebar"]')
    await expect(pet.locator("#name")).not.toHaveText("")
    await save(page, true)
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    await pet.locator("#adventure-toggle").click()
    await expect(pet.locator(".pet-module")).toHaveClass(/battle-intro/)
    await expect(pet.locator("#artwork")).toHaveAttribute("viewBox", / 12$/)
    expect(await pet.locator("#artwork rect").count()).toBeGreaterThan(100)
    await expect(pet.locator("#artwork")).not.toContainText("COMBATE")
    for (const width of [320, 390, 1024]) {
      await page.setViewportSize({ width, height: 844 })
      await page.screenshot({ path: testInfo.outputPath(`battle-intro-${width}.png`) })
    }
  })
})

test("recruitment survives reload and adopts a new generation without losing history, Dex or cooldown", async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 760 })
  await page.addInitScript(() => {
    Math.random = () => 0
  })
  await page.clock.install()
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  await save(page, true)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await pet.locator("#adventure-toggle").click()
  await expect(pet.locator(".pet-module")).toHaveClass(/battling/)
  for (let index = 0; index < 24; index++) {
    await page.clock.runFor(1000)
    await page.waitForTimeout(20)
  }
  await expect(pet.locator("#adventure-offer")).toBeVisible()
  await expect(pet.locator("#adventure-offer-title")).toContainText("Betamon")
  expect((await saved(page)).gauge).toBe(2_000_000)
  await page.reload()
  await expect(pet.locator("#adventure-offer")).toBeVisible()
  await expect(pet.locator("#adventure-toggle")).toBeHidden()
  await page.screenshot({ path: testInfo.outputPath("adventure-companion-offer.png") })
  await pet.locator("#adventure-accept").click()
  await expect(pet.locator("#name")).toHaveText("Betamon")
  await expect(pet.locator("#adventure-offer")).toBeHidden()
  await expect(pet.locator("#adventure-toggle")).toBeVisible()
  await expect(pet.locator("#adventure-toggle")).toBeDisabled()
  const result = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("web-digital-pet", 1)
      request.onsuccess = () => resolve(request.result)
    })
    const store = database.transaction("pet", "readonly").objectStore("pet")
    const request = store.get("current")
    const state = await new Promise<{
      currentNodeId: string
      gauge: number
      events: { currentNodeId: string }[]
      retiredPartners: { partnerId: string; events: { currentNodeId: string }[] }[]
      food?: unknown
      hygiene?: unknown
      pendingEvolution?: unknown
      combatVictories?: number
    }>((resolve) => {
      request.onsuccess = () => resolve(request.result)
    })
    const readyRequest = store.get("adventure-ready-at")
    const readyAt = await new Promise<number>((resolve) => {
      readyRequest.onsuccess = () => resolve(readyRequest.result)
    })
    database.close()
    return { state, readyAt, now: Date.now() }
  })
  expect(result.state.currentNodeId).toBe("3-007")
  expect(result.state.gauge).toBe(0)
  expect(result.state.combatVictories).toBe(0)
  expect(result.state.events.map((event) => event.currentNodeId)).toEqual(["3-007"])
  expect(result.state.retiredPartners.map((partner) => partner.partnerId)).toEqual(["adventure-pet"])
  expect(result.state.retiredPartners[0]?.events.map((event) => event.currentNodeId)).toEqual(["3-001"])
  expect(result.state.pendingEvolution).toBeUndefined()
  expect(result.readyAt).toBeGreaterThan(result.now)
  await page.reload()
  await expect(pet.locator("#name")).toHaveText("Betamon")
  await expect(pet.locator("#adventure-offer")).toBeHidden()
  expect(errors).toEqual([])
})

test("a boss reveals itself in the viewer, awards 50% after combat and leaves a persistent map star", async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    Math.random = () => 0.9
  })
  await page.clock.install()
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  await save(page, true)
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("web-digital-pet", 1)
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve) => {
      const transaction = database.transaction("pet", "readwrite")
      const store = transaction.objectStore("pet")
      const request = store.get("adventure")
      request.onsuccess = () => {
        const saved = request.result
        saved.state.event.opponentNodeId = "6-095"
        saved.state.event.rank = "boss"
        saved.state.event.difficult = true
        store.put(saved, "adventure")
      }
      transaction.oncomplete = () => resolve()
    })
    database.close()
  })
  await page.reload()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await expect(pet.locator("#adventure-toggle")).toHaveAttribute("aria-label", "Continue")
  await pet.locator("#adventure-toggle").click()
  await expect(pet.locator("#boss-intro")).toBeVisible()
  await expect(pet.locator("#boss-intro-name")).toHaveText("MetalSeadramon")
  expect((await saved(page)).gauge).toBe(0)
  await page.screenshot({ path: testInfo.outputPath("adventure-boss-intro.png") })
  for (let index = 0; index < 28; index++) {
    await page.clock.runFor(1000)
    await page.waitForTimeout(20)
  }
  await expect.poll(async () => (await saved(page)).gauge).toBe(20_000_000)
  await expect(pet.locator("#boss-intro")).toBeHidden()
  await expect(pet.locator("#percent")).toHaveText("50%")
  await pet.locator("#adventure-stop").click()
  await pet.locator("#world-location").click()
  const star = page.locator('[data-map-zone="digital-ocean"] .map-boss-star')
  await expect(star).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("adventure-boss-map.png") })
  await page.locator("#map-regions-tab").click()
  await page.locator('[data-region="digital-ocean"]').click()
  await expect(page.locator(".world-bosses .world-boss-star")).toHaveCount(1)
  await page.reload()
  await expect(pet.locator("#percent")).toHaveText("50%")
  await pet.locator("#world-location").click()
  await expect(star).toBeVisible()
  expect((await saved(page)).gauge).toBe(20_000_000)
  expect(errors).toEqual([])
})
