import { readFile } from "node:fs/promises"
import { expect, type Page, test } from "@playwright/test"
import { openOptions } from "./helpers/navigation.ts"

test.use({ locale: "es-ES" })

const state = (page: Page) =>
  page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("web-digital-pet", 1)
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const saved = await new Promise<Record<string, unknown>>((resolve) => {
      const read = database.transaction("pet").objectStore("pet").get("current")
      read.onsuccess = () => resolve(read.result)
    })
    database.close()
    return saved
  })

const openEggPicker = async (page: Page) => {
  await openOptions(page)
  await page.locator("#new-partner").click()
  await expect(page.locator("#egg-carousel")).toBeVisible()
}

const expectTeamActionsAtBottom = async (page: Page) => {
  const panel = await page.locator("#dex-team-panel").boundingBox()
  const actions = await page.locator(".team-actions").boundingBox()
  if (!panel || !actions) throw new Error("Missing team layout")
  expect(panel.y + panel.height - (actions.y + actions.height)).toBeLessThanOrEqual(10)
  expect(actions.y + actions.height).toBeLessThanOrEqual(panel.y + panel.height)
  await expect(page.locator("#team-switch")).toBeInViewport()
  await expect(page.locator(".team-actions .team-caption")).toBeInViewport()
}

test("new journey chooses an egg, keeps the principal and switches both ways", async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.routeWebSocket("wss://0.peerjs.com/**", (socket) => socket.send(JSON.stringify({ type: "OPEN" })))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toBeEmpty()
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open("web-digital-pet", 1)
      open.onsuccess = () => resolve(open.result)
    })
    await new Promise<void>((resolve) => {
      const transaction = database.transaction("pet", "readwrite")
      const store = transaction.objectStore("pet")
      const read = store.get("current")
      read.onsuccess = () =>
        store.put(
          {
            ...read.result,
            currentNodeId: "3-001",
            events: [{ currentNodeId: "3-001", createdAt: read.result.createdAt }],
          },
          "current",
        )
      transaction.oncomplete = () => resolve()
    })
    database.close()
    window.dispatchEvent(new Event("digital-pet:save-updated"))
  })
  const original = await state(page)
  await openOptions(page)
  await page.locator("#new-partner").click()
  await expect(page.locator("#options-dialog")).not.toBeVisible()
  await expect(page.locator("#egg-carousel")).toBeVisible()
  await expect(page.locator("#egg-slot")).toHaveValue("reserve")
  await expect(page.locator("#egg-create")).toBeEnabled()
  const starterArtwork = await page.locator("#egg-preview path").getAttribute("d")
  await page.locator("#egg-next").click()
  expect(await page.locator("#egg-preview path").getAttribute("d")).not.toBe(starterArtwork)
  await expect(page.locator("#egg-create")).toBeDisabled()
  await page.locator("#egg-close").click()
  expect((await state(page)).partnerId).toBe(original.partnerId)
  await page.locator("#dex-team-tab").click()
  await openEggPicker(page)
  await page.screenshot({ path: testInfo.outputPath("egg-carousel-390.png") })
  await page.locator("#egg-create").click()
  await expect(page.locator("#egg-carousel")).not.toBeVisible()
  await expect(page.locator("#team-switch")).toBeEnabled()
  const placed = await state(page)
  const reserve = placed.reserve as { partnerId: string; originEggId: string }
  expect(placed.partnerId).toBe(original.partnerId)
  expect(reserve.originEggId).toBe("starter")
  await expect(page.locator("[data-dex-page]")).toHaveText(["DEX", "EQUIPO", "HISTORIAL"])
  await expect(page.locator("#dex-eggs-tab, #dex-eggs-panel, #team-egg")).toHaveCount(0)
  await expect(page.locator("#team-switch")).toHaveText("Cambiar principal")
  await expect(page.locator("#team-switch .switch-symbol")).toBeVisible()
  await expect(page.locator("#team-status")).toBeEmpty()
  await expectTeamActionsAtBottom(page)
  await page.screenshot({ path: testInfo.outputPath("team-390.png") })
  await page.locator('[data-team-slot="principal"]').click()
  await expect(page.locator("#dex-dex-tab")).toHaveAttribute("aria-selected", "true")
  await expect(page.frameLocator('iframe[data-page="dex"]').locator(".detail-name h2")).toHaveText("Agumon")
  await page.locator("#dex-team-tab").click()
  await page.locator('[data-team-slot="reserve"]').click()
  await expect(page.frameLocator('iframe[data-page="dex"]').locator(".detail-name h2")).toHaveText(/Digi(egg|tama)/i)

  await page.locator('a[data-page="sidebar"]').click()
  const sidebar = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(sidebar.locator("#pet-switch")).toBeEnabled()
  const nameBox = await sidebar.locator("#name").boundingBox()
  const switchBox = await sidebar.locator("#pet-switch").boundingBox()
  if (!nameBox || !switchBox) throw new Error("Missing companion controls")
  expect(switchBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height)
  expect(switchBox.width).toBeGreaterThanOrEqual(44)
  expect(switchBox.height).toBeGreaterThanOrEqual(44)
  await expect(sidebar.locator("#pet-switch .switch-arrows")).toBeVisible()
  await expect(sidebar.locator(".pet-header #pet-switch")).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("companion-switch-390.png") })
  await sidebar.locator("#pet-switch").click()
  await expect.poll(async () => (await state(page)).partnerId).toBe(reserve.partnerId)
  await expect(sidebar.locator("#pet-switch")).toBeEnabled()
  await expect(sidebar.locator("#name")).toHaveText(/DIGI(EGG|TAMA)/i)
  await expect(sidebar.locator("#pet-indicators")).toBeHidden()
  await expect
    .poll(() =>
      sidebar.locator("#artwork").evaluate((svg) => {
        const node = svg as SVGGraphicsElement
        const bounds = node.getBBox()
        const matrix = node.getScreenCTM()
        return matrix ? bounds.width * matrix.a : 1000
      }),
    )
    .toBeLessThan(60)
  await expect(sidebar.locator("#pet-switch")).toHaveAccessibleName("Cambiar a Agumon")
  await page.screenshot({ path: testInfo.outputPath("companion-switch-face-390.png") })
  await sidebar.locator("#pet-switch").click()
  await expect.poll(async () => (await state(page)).partnerId).toBe(original.partnerId)
  await page.goto("/dex?tab=team")
  await expect(page.locator("#dex-team-tab")).toHaveAttribute("aria-selected", "true")
  await expect(page.locator("#team-switch")).toBeEnabled()
  await page.setViewportSize({ width: 320, height: 800 })
  await expectTeamActionsAtBottom(page)
  await page.screenshot({ path: testInfo.outputPath("team-320.png") })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1280, height: 900 })
  await expectTeamActionsAtBottom(page)
  await page.screenshot({ path: testInfo.outputPath("team-desktop.png") })
  expect(errors).toEqual([])
})

test("ten distinct regional eggs unlock individually and a discovered origin survives creation and reload", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toBeEmpty()
  await openEggPicker(page)
  const artworks = new Set<string>()
  const names = new Set<string>()
  for (let index = 0; index < 10; index++) {
    const name = await page.locator("#egg-name").textContent()
    const art = await page.locator("#egg-preview path").getAttribute("d")
    if (!name || !art) throw new Error("Missing regional egg")
    names.add(name)
    artworks.add(art)
    await expect(page.locator("#egg-create")).toBeEnabled({ enabled: index === 0 })
    await page.locator("#egg-next").click()
  }
  expect(names.size).toBe(10)
  expect(artworks.size).toBe(10)
  await expect(page.locator("#egg-name")).toHaveText(/Comienzo/i)
  await page.locator("#egg-close").click()
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open("web-digital-pet", 1)
      open.onsuccess = () => resolve(open.result)
    })
    await new Promise<void>((resolve) => {
      const transaction = database.transaction("pet", "readwrite")
      const store = transaction.objectStore("pet")
      const read = store.get("current")
      read.onsuccess = () =>
        store.put(
          {
            ...read.result,
            bossVictories: [{ regionId: "digital-city", nodeId: "legacy-boss", defeatedAt: new Date().toISOString() }],
          },
          "current",
        )
      transaction.oncomplete = () => resolve()
    })
    database.close()
    window.dispatchEvent(new Event("digital-pet:save-updated"))
  })
  await openEggPicker(page)
  for (let index = 0; index < 4; index++) await page.locator("#egg-next").click()
  await expect(page.locator("#egg-name")).toHaveText(/Ciudad/i)
  await expect(page.locator("#egg-create")).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath("regional-machine-egg-390.png") })
  await page.locator("#egg-create").click()
  await expect(page.locator("#egg-carousel")).not.toBeVisible()
  expect(((await state(page)).reserve as { originEggId: string }).originEggId).toBe("machine")
  await page.reload()
  await expect(page.locator("#team-switch")).toBeEnabled()
  expect(((await state(page)).reserve as { originEggId: string }).originEggId).toBe("machine")
})

test("stale commands and locked eggs cannot overwrite a team", async ({ page }) => {
  await page.goto("/dex?tab=team")
  await expect(page.locator('[data-team-slot="principal"]')).toBeVisible()
  const original = await state(page)
  const expected = { expectedRevision: 0, expectedPrincipalId: original.partnerId, expectedReserveId: null }
  await page.evaluate((detail) => window.dispatchEvent(new CustomEvent("digital-pet:team-action", { detail })), {
    ...expected,
    kind: "create-egg",
    slot: "reserve",
    familyId: "forest",
  })
  await expect(page.locator("#team-status")).toContainText("no está disponible")
  expect((await state(page)).reserve).toBeUndefined()
  await openEggPicker(page)
  await page.locator("#egg-create").click()
  await expect(page.locator("#team-switch")).toBeEnabled()
  const placed = await state(page)
  await page.evaluate((detail) => window.dispatchEvent(new CustomEvent("digital-pet:team-action", { detail })), {
    ...expected,
    kind: "switch",
  })
  await expect(page.locator("#team-status")).toContainText("ha cambiado")
  expect((await state(page)).partnerId).toBe(placed.partnerId)
  expect((await state(page)).teamRevision).toBe(placed.teamRevision)
})

test("an active adventure rejects an otherwise current switch command", async ({ page }) => {
  await page.goto("/dex?tab=team")
  await expect(page.locator('[data-team-slot="principal"]')).toBeVisible()
  await openEggPicker(page)
  await page.locator("#egg-create").click()
  await expect(page.locator("#team-switch")).toBeEnabled()
  const placed = await state(page)
  await page.evaluate(async () => {
    const open = indexedDB.open("web-digital-pet", 1)
    await new Promise<void>((resolve) => {
      open.onsuccess = () => {
        const database = open.result
        const transaction = database.transaction("pet", "readwrite")
        const store = transaction.objectStore("pet")
        const read = store.get("current")
        read.onsuccess = () =>
          store.put(
            {
              partnerId: read.result.partnerId,
              state: {
                id: "busy-trip",
                nodeId: read.result.currentNodeId,
                regionId: "digital-ocean",
                running: true,
                elapsedMs: 0,
                lastTickAt: Date.now(),
                nextEventAt: 60000,
                sequence: 0,
                collected: 0,
                victories: 0,
                status: "travel",
              },
            },
            "adventure",
          )
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
      }
    })
  })
  await page.locator("#team-switch").click()
  await expect(page.locator("#team-status")).toContainText("Termina")
  expect((await state(page)).partnerId).toBe(placed.partnerId)
  expect((await state(page)).teamRevision).toBe(placed.teamRevision)
})

test("regions show increasing difficulty and the corresponding real boss tiers", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toBeEmpty()
  await page.locator("#map-button").click()
  await page.locator("#map-regions-tab").click()
  await expect(page.locator(".region-difficulty")).toHaveText([
    "Fácil",
    "Fácil",
    "Fácil",
    "Media",
    "Media",
    "Media",
    "Media",
    "Difícil",
    "Difícil",
    "Difícil",
  ])
  await page.screenshot({ path: testInfo.outputPath("regions-difficulty-390.png") })
  await page.locator('[data-region="village-of-beginnings"]').click()
  await expect(page.locator(".world-bosses .resident-row small")).toHaveText(["Perfecto", "Supremo"])
  await page.screenshot({ path: testInfo.outputPath("regions-navigation-390.png") })
  await page.locator(".world-next").click()
  await expect(page.locator(".region-title")).toHaveText("Sabana Orientación")
  await page.locator("[data-world-back]").click()
  await page.locator('[data-region="village-of-beginnings"]').click()
  await page.locator(".world-bosses").scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("bosses-easy-390.png") })
  await page.locator("[data-world-back]").click()
  await page.locator('[data-region="wasteland"]').click()
  await expect(page.locator(".world-bosses .resident-row small")).toHaveText(["Supremo II", "Supremo II"])
  await page.locator(".world-bosses").scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("bosses-hard-390.png") })
})

test("backup v4 exports both companions and restores them on another device", async ({ page, browser }) => {
  await page.goto("/dex?tab=team")
  await expect(page.locator('[data-team-slot="principal"]')).toBeVisible()
  await openEggPicker(page)
  await page.locator("#egg-create").click()
  await expect(page.locator("#team-switch")).toBeEnabled()
  const team = await state(page)
  await openOptions(page)
  const downloadReady = page.waitForEvent("download")
  await page.locator("#backup-download").click()
  const download = await downloadReady
  const path = await download.path()
  if (!path) throw new Error("Missing backup")
  const exported = JSON.parse(await readFile(path, "utf8"))
  expect(exported.version).toBe(4)
  expect(exported.state.partnerId).toBe(team.partnerId)
  expect(exported.state.reserve.partnerId).toBe((team.reserve as { partnerId: string }).partnerId)
  const context = await browser.newContext({ locale: "es-ES" })
  try {
    const receiver = await context.newPage()
    await receiver.goto("/")
    await expect(receiver.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toBeEmpty()
    const previous = await state(receiver)
    await openOptions(receiver)
    await receiver.locator("#backup-file").setInputFiles(path)
    await expect(receiver.locator("#backup-confirm")).toBeVisible()
    await receiver.locator("#backup-accept").click()
    await expect(receiver.locator("#backup-confirm")).not.toBeVisible()
    const imported = await state(receiver)
    expect(imported.partnerId).toBe(team.partnerId)
    expect((imported.reserve as { partnerId: string }).partnerId).toBe(
      (team.reserve as { partnerId: string }).partnerId,
    )
    await expect(receiver.locator("#backup-restore")).toBeVisible()
    await receiver.locator("#backup-restore").click()
    await expect.poll(async () => (await state(receiver)).partnerId).toBe(previous.partnerId)
    expect((await state(receiver)).reserve).toBeUndefined()
  } finally {
    await context.close()
  }
})
