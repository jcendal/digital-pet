import { expect, type Page, test } from "@playwright/test"
import { openOptions } from "./helpers/navigation.ts"

const setTheme = async (page: Page, theme: "lcd" | "color") => {
  await openOptions(page)
  await page.locator("#theme-select").selectOption(theme)
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme)
  await page.locator("#options-dialog .dialog-close").click()
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("html")).toHaveAttribute("data-theme", theme)
}

const seed = async (page: Page) => {
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
      const store = transaction.objectStore("pet")
      const request = store.get("current")
      request.onsuccess = () =>
        store.put(
          {
            ...request.result,
            partnerId: "theme-review",
            currentNodeId: "3-001",
            createdAt,
            lastTickAt: now,
            gauge: 100,
            isTerminal: false,
            events: ["0-001", "1-001", "2-001", "3-001", "4-054", "5-086"].map((currentNodeId) => ({
              currentNodeId,
              createdAt,
            })),
            food: { kind: "scheduled", availableAt: now + 600000 },
            reserve: {
              partnerId: "theme-reserve",
              currentNodeId: "4-054",
              createdAt,
              lastTickAt: now,
              gauge: 0,
              isTerminal: false,
              events: [{ currentNodeId: "4-054", createdAt }],
            },
          },
          "current",
        )
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await page.reload()
}

test("LCD and Color compare the same interfaces and all twenty scenery destinations", async ({ page }, info) => {
  test.setTimeout(180000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.routeWebSocket("wss://0.peerjs.com/**", (socket) => socket.send(JSON.stringify({ type: "OPEN" })))
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toBeEmpty()
  await seed(page)
  for (const theme of ["lcd", "color"] as const) {
    await page.locator('a[data-page="sidebar"]').click()
    await setTheme(page, theme)
    await page.locator("#map-button").click()
    await page.locator("#map-atlas-tab").click()
    await page.locator('[data-map-zone="digital-ocean"]').click()
    await page.locator('#map-location-picker [data-map-location="dragon-eye-lake"]').click()
    await expect(page.locator("#world-map-view")).toHaveAttribute("aria-busy", "false")
    await page.locator('a[data-page="sidebar"]').click()
    await expect(pet.locator("#world-location")).toHaveText("Dragon Eye Lake →")
    const capture = async (name: string) => {
      await page.screenshot({ path: info.outputPath(`${name}--${theme}.png`) })
    }
    if (theme === "color") await expect(pet.locator('#artwork path[fill^="#"]')).not.toHaveCount(0)
    else await expect(pet.locator("#artwork rect")).not.toHaveCount(0)
    await capture("01-partner")
    await openOptions(page)
    await capture("02-options")
    await page.locator("#backup-download").scrollIntoViewIfNeeded()
    await capture("03-options-backup")
    await page.locator("#pair-button").click()
    await capture("04-pairing")
    await page.locator("dialog[open] .dialog-close").last().click()
    if (await page.locator("#options-dialog").isVisible()) await page.locator("#options-dialog .dialog-close").click()
    await openOptions(page)
    await page.locator("#new-partner").click()
    await capture("05-egg")
    await page.locator("#egg-next").click()
    await capture("06-locked-egg")
    await page.locator("#egg-close").click()
    await page.locator('a[data-page="dex"]').click()
    const dex = page.frameLocator('iframe[data-page="dex"]')
    await expect(dex.locator(".detail-name h2")).not.toBeEmpty()
    if ((await dex.locator("#filters").getAttribute("open")) !== null) await dex.locator("#filters summary").click()
    await capture("07-dex")
    await dex.locator("#filters summary").click()
    await capture("08-dex-filters")
    await page.locator("#dex-team-tab").click()
    await expect(page.locator("[data-team-slot]")).toHaveCount(2)
    if (theme === "color") await expect(page.locator("[data-team-slot] svg[data-color-ready]")).toHaveCount(2)
    await capture("09-team")
    await page.locator("#dex-history-tab").click()
    await expect(page.frameLocator('iframe[data-page="history"]').locator("#generation-count")).toHaveText("02")
    await capture("10-history")
    await page.locator("#battle-button").click()
    if (theme === "color") await expect(page.locator("#social-current svg")).toHaveAttribute("data-color-ready", "true")
    await capture("11-arena")
    await page.locator('[data-social-tab="friends"]').click()
    await capture("12-friends")
    await page.locator('[data-social-tab="activity"]').click()
    await capture("13-activity")
    await page.locator("#more-button").click()
    await page.locator("#profile-button").click()
    await capture("14-profile")
    await page.locator("#map-button").click()
    await page.locator("#map-atlas-tab").click()
    await capture("15-map")
    await page.locator("#map-regions-tab").click()
    await expect(page.locator(".region-card")).toHaveCount(10)
    await capture("16-regions")
    const regions = await page
      .locator(".region-card")
      .evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.region!))
    for (const [i, region] of regions.entries()) {
      await page.locator(`.region-card[data-region="${region}"]`).click()
      await expect(page.locator(".world-locations button")).toHaveCount(2)
      await capture(`region-${String(i + 1).padStart(2, "0")}`)
      const locations = await page
        .locator(".world-locations button")
        .evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.location!))
      for (const id of locations) {
        const destination = page.locator(`.world-locations [data-location="${id}"]`)
        const locationName = await destination.textContent()
        await destination.click()
        await page.locator("#world-travel").click()
        await expect(page.locator("#world-map-view")).toBeHidden()
        await expect(page.locator('iframe[data-page="sidebar"]')).toBeVisible()
        await expect(pet.locator("#world-location")).toHaveText(`${locationName?.trim()} →`)
        await expect(pet.locator(".world-scenery img").first()).not.toHaveJSProperty("naturalWidth", 0)
        await capture(`scene-${id}`)
        await page.locator("#map-button").click()
      }
      await page.locator("[data-world-back]").click()
    }
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: width === 320 ? 800 : 900 })
      await page.locator('a[data-page="sidebar"]').click()
      await capture(`partner-${width}`)
    }
    await page.setViewportSize({ width: 390, height: 844 })
  }
  expect(errors).toEqual([])
})

test("theme switches persist offline and do not change the companion or restart its presentation", async ({
  page,
  context,
}) => {
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toBeEmpty()
  await setTheme(page, "lcd")
  const name = (await pet.locator("#name").textContent())!
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      )
  })
  await context.setOffline(true)
  await setTheme(page, "color")
  await expect(pet.locator('#artwork path[fill^="#"]')).not.toHaveCount(0)
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "color")
  await expect(pet.locator("#name")).toHaveText(name)
  await setTheme(page, "lcd")
  await expect(pet.locator("#artwork rect")).not.toHaveCount(0)
  await expect(pet.locator("#name")).toHaveText(name)
  await context.setOffline(false)
})
