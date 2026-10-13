import { expect, test } from "@playwright/test"

test.use({ locale: "es-ES" })

test("owned companions include past generations, filters survive refreshing, and long labels stay in their space", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toHaveText("")
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
          partnerId: "current",
          currentNodeId: "3-001",
          createdAt,
          lastTickAt: now,
          gauge: 0,
          isTerminal: false,
          events: [{ currentNodeId: "3-001", createdAt }],
          retiredPartners: [
            {
              partnerId: "previous",
              createdAt,
              retiredAt: createdAt,
              events: [
                { currentNodeId: "1-001", createdAt },
                { currentNodeId: "2-001", createdAt },
              ],
            },
          ],
        },
        "current",
      )
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await page.reload()
  await page.locator('.web-nav a[data-page="dex"]').click()
  const dex = page.frameLocator('iframe[data-page="dex"]')
  await dex.locator("#filters summary").click()
  await expect(dex.locator('#discovery option[value="registered"]')).toHaveText("Solo los que has tenido")
  await dex.locator("#discovery").selectOption("registered")
  await expect(dex.locator(".entry")).toHaveCount(3)
  expect(
    await dex.locator(".entry").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.id)),
  ).toEqual(["1-001", "2-001", "3-001"])
  await dex.locator("#stage").selectOption("3")
  await expect(dex.locator(".entry")).toHaveCount(1)
  await dex.locator("#search").fill("no matching companion")
  await expect(dex.locator("#no-results")).toBeVisible()
  await dex.locator("#search").fill("")
  await expect(dex.locator(".entry")).toHaveCount(1)
  for (const selector of [".entry-name", ".detail-name h2"]) {
    const text = dex.locator(selector).first()
    await text.evaluate((node) => {
      node.textContent = "Nombre de Digimon extremadamente largo para comprobar el espacio disponible"
    })
    await expect(text).toHaveCSS("text-overflow", "ellipsis")
    await expect(text).toHaveCSS("white-space", "nowrap")
    expect(await text.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true)
  }
  for (const selector of [".masthead h1", ".footer > span:first-child"]) {
    const text = page.locator(`#dex-view ${selector}`).first()
    await text.evaluate((node) => {
      node.textContent = "Nombre de Digimon extremadamente largo para comprobar el espacio disponible"
    })
    await expect(text).toHaveCSS("text-overflow", "ellipsis")
    await expect(text).toHaveCSS("white-space", "nowrap")
    expect(await text.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath("dex-owned-320.png") })
  expect(await dex.locator("body").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
  await dex.locator("#refresh").click()
  await expect(dex.locator(".entry-name")).toHaveText("Agumon")
  await expect(dex.locator("#discovery")).toHaveValue("registered")
  await expect(dex.locator("#stage")).toHaveValue("3")
  await expect(dex.locator(".entry")).toHaveCount(1)
})
