import { expect, type Page, test } from "@playwright/test"

test.use({ locale: "es-ES" })

const saved = (page: Page) =>
  page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open("web-digital-pet", 1)
      open.onsuccess = () => resolve(open.result)
    })
    const state = await new Promise<Record<string, unknown>>((resolve) => {
      const read = database.transaction("pet").objectStore("pet").get("current")
      read.onsuccess = () => resolve(read.result)
    })
    database.close()
    return state
  })

const openDuel = async (page: Page, nodeId: string, victories: number, dirty: boolean) => {
  await page.addInitScript(() => {
    Math.random = () => 0
  })
  await page.routeWebSocket("wss://0.peerjs.com/**", (socket) => socket.send(JSON.stringify({ type: "OPEN" })))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toBeEmpty()
  await page.evaluate(
    async ({ nodeId, victories, dirty }) => {
      const database = await new Promise<IDBDatabase>((resolve) => {
        const open = indexedDB.open("web-digital-pet", 1)
        open.onsuccess = () => resolve(open.result)
      })
      const now = Date.now()
      await new Promise<void>((resolve) => {
        const transaction = database.transaction("pet", "readwrite")
        transaction.objectStore("pet").put(
          {
            partnerId: "duel-fixture",
            currentNodeId: nodeId,
            combatVictories: victories,
            createdAt: new Date(now).toISOString(),
            lastTickAt: now,
            gauge: 75_000_000,
            isTerminal: false,
            events: [{ currentNodeId: nodeId, createdAt: new Date(now).toISOString() }],
            hygiene: {
              poops: dirty ? [now - 3, now - 2, now - 1] : [],
              nextAt: dirty ? null : now + 3_600_000,
              happyUntil: 0,
            },
          },
          "current",
        )
        transaction.oncomplete = () => resolve()
      })
      database.close()
    },
    { nodeId, victories, dirty },
  )
  await page.reload()
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#phase")).toHaveText("COMBATE")
}

test("100% fights without a route, reports a winning no-evolution result and retains one victory after reload", async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await openDuel(page, "4-010", 0, true)
  const pending = await saved(page)
  expect((pending.pendingEvolution as { targetNodeId: string | null }).targetNodeId).toBeNull()
  const sidebar = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(sidebar.locator("#evolution-notice")).toHaveText("No hay evoluciones disponibles.", { timeout: 30_000 })
  await expect(sidebar.locator("#evolution-notice")).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: testInfo.outputPath("no-evolution-390.png") })
  await expect(sidebar.locator("#phase")).toHaveText("TRISTE", { timeout: 10_000 })
  const resolved = await saved(page)
  expect(resolved.currentNodeId).toBe("4-010")
  expect(resolved.gauge).toBe(0)
  expect(resolved.combatVictories).toBe(1)
  expect(resolved.pendingEvolution).toBeUndefined()
  await page.reload()
  await expect(sidebar.locator("#phase")).toHaveText("TRISTE")
  expect((await saved(page)).combatVictories).toBe(1)
  expect(errors).toEqual([])
})

test("the third win unlocks Meicoomon's evolution in that duel and the Dex shows its numeric requirement", async ({
  page,
}, testInfo) => {
  await openDuel(page, "4-077", 2, false)
  const sidebar = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(sidebar.locator("#name")).toHaveText(/Meicrackmon/i, { timeout: 30_000 })
  await expect(sidebar.locator("#phase")).toHaveText("EVOLUCIONADO")
  await expect(sidebar.locator("#phase")).toHaveText("ACTIVO", { timeout: 10_000 })
  await expect(sidebar.locator('#pet-indicators [data-indicator="victories"]')).toHaveText("0")
  const result = await saved(page)
  expect(result.currentNodeId).toBe("5-078")
  expect(result.combatVictories).toBe(0)
  expect(result.gauge).toBe(0)
  expect(result.events).toHaveLength(2)
  await page.goto("/dex?selected=4-077")
  const dex = page.frameLocator('iframe[data-page="dex"]')
  await expect(dex.locator(".detail-name h2")).toHaveText("Meicoomon")
  await dex.locator("#detail details summary").click()
  const requirement = dex.locator("#detail").getByRole("button", { name: /Meicrackmon/ })
  await expect(requirement.getByRole("img", { name: "Victorias de combate: 3+", exact: true })).toBeVisible()
  await expect(requirement.locator('[data-requirement="care"]')).toHaveCount(0)
  await requirement.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("victory-requirement-dex-390.png") })
})
