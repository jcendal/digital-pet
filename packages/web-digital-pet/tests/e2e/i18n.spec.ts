import { catalogs as fields } from "@jcendal/digital-pet-fields/i18n"
import { LANGUAGE_PREFERENCE_KEY } from "@jcendal/digital-pet-intl"
import { catalogs as webviews } from "@jcendal/digital-pet-webviews/i18n"
import { expect, test } from "@playwright/test"
import { catalogs as web } from "../../src/shared/i18n.ts"

const savedIdentity = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open("web-digital-pet", 1)
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const request = database.transaction("pet").objectStore("pet").get("current")
          request.onsuccess = () => {
            database.close()
            resolve(request.result.partnerId)
          }
          request.onerror = () => {
            database.close()
            reject(request.error)
          }
        }
      }),
  )

for (const [browserLocale, locale] of [
  ["es-ES", "es"],
  ["gl-ES", "gl"],
  ["ko-KR", "ko"],
  ["fr-FR", "en"],
] as const) {
  test(`browser ${browserLocale} selects ${locale} across shell and panels`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ locale: browserLocale, viewport: { width: 320, height: 800 } })
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("/")
    await expect(page.locator("html")).toHaveAttribute("lang", locale)
    await expect(page.locator("#options-button")).toHaveAccessibleName(web[locale]["navigationMarkup.options"])
    const partner = page.frameLocator('iframe[data-page="sidebar"]')
    await expect(partner.locator("#name")).not.toHaveText("")
    await expect(partner.locator("html")).toHaveAttribute("lang", locale)
    await expect(partner.locator("#progress-label")).toHaveText(webviews[locale]["sidebarClient.nextCheck"])
    await expect(partner.locator("#world-location")).toHaveText(`${fields[locale]["regions.dragonEyeLake"]} →`)
    expect(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_PREFERENCE_KEY)).toBeNull()
    await page.locator("#options-button").click()
    await expect(page.locator("#language-select")).toHaveValue(locale)
    await expect(page.locator("#language-select option")).toHaveCount(4)
    await page.screenshot({ path: testInfo.outputPath(`options-${locale}.png`) })
    await page.locator("#world-button").click()
    await expect(page.locator(".region-card")).toHaveCount(10)
    await expect(page.locator('[data-region="digital-ocean"] strong')).toHaveText(
      fields[locale]["regions.digitalOcean"],
    )
    await page.locator('[data-region="digital-ocean"]').click()
    await expect(page.locator(".region-title")).toHaveText(fields[locale]["regions.digitalOcean"])
    await page.locator("#world-dialog .dialog-close").click()
    await page.locator("#options-dialog .dialog-close").click()
    await page.locator('a[data-page="dex"]').click()
    const dex = page.frameLocator('iframe[data-page="dex"]')
    await expect(dex.locator("#entries")).not.toBeEmpty()
    await expect(dex.locator("html")).toHaveAttribute("lang", locale)
    await expect(dex.locator("#search")).toHaveAttribute("placeholder", webviews[locale]["dexRender.nameOrCatalogId"])
    await page.locator('a[data-page="history"]').click()
    const history = page.frameLocator('iframe[data-page="history"]')
    await expect(history.locator("#generation-count")).not.toHaveText("00")
    await expect(history.locator("#status option[value=all]")).toHaveText(
      webviews[locale]["historyRender.allGenerations"],
    )
    expect(errors).toEqual([])
    await context.close()
  })
}

test("explicit language overrides the browser and survives offline reloads without changing the save", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "es-ES" })
  // Initialize once: subsequent changes must come from the selector, not this script.
  await context.addInitScript((key) => {
    if (!localStorage.getItem("i18n-test-initialized")) {
      localStorage.setItem(key, "en")
      localStorage.setItem("i18n-test-initialized", "yes")
    }
  }, LANGUAGE_PREFERENCE_KEY)
  const page = await context.newPage()
  await page.goto("/")
  const partner = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(partner.locator("#name")).not.toHaveText("")
  const name = await partner.locator("#name").textContent()
  const identity = await savedIdentity(page)
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      )
  })
  await context.setOffline(true)
  await page.locator("#options-button").click()
  await page.locator("#language-select").selectOption("gl")
  await expect(page.locator("html")).toHaveAttribute("lang", "gl")
  await expect(partner.locator("html")).toHaveAttribute("lang", "gl")
  await expect(partner.locator("#name")).toHaveText(name!)
  expect(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_PREFERENCE_KEY)).toBe("gl")
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("lang", "gl")
  await expect(partner.locator("#progress-label")).toHaveText(webviews.gl["sidebarClient.nextCheck"])
  expect(await savedIdentity(page)).toBe(identity)
  await context.close()
})
