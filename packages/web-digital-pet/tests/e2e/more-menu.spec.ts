import { expect, test } from "@playwright/test"
import { openHistory, openOptions } from "./helpers/navigation.ts"

test.use({ locale: "es-ES" })

test("More opens Options and closes on selection, outside taps and Escape", async ({ page }, testInfo) => {
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toHaveText("")
  const more = page.locator("#more-button")
  const menu = page.locator("#more-menu")
  const navigation = page.locator(".web-nav")
  await expect(more).toHaveAccessibleName("More")
  await expect(navigation.locator("a:visible, button:visible")).toHaveCount(5)
  await expect(page.locator("#options-button")).not.toBeVisible()
  await expect(menu.locator("a, button")).toHaveCount(2)

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await page.screenshot({ path: testInfo.outputPath(`more-closed-${width}.png`) })
    await more.click()
    await expect(more).toHaveAttribute("aria-expanded", "true")
    await expect(menu).toBeVisible()
    const box = await menu.boundingBox()
    if (!box) throw new Error("Missing More dropdown")
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(box.height).toBeLessThan(120)
    for (const item of await menu.locator("a, button").all()) {
      const itemBox = await item.boundingBox()
      if (!itemBox) throw new Error("Missing dropdown item")
      expect(itemBox.height).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: testInfo.outputPath(`more-open-${width}.png`) })
    await more.click()
    await expect(menu).not.toBeVisible()
  }

  await openOptions(page)
  await expect(page.locator("#options-dialog")).toBeVisible()
  await expect(menu).not.toBeVisible()
  await page.locator("#options-dialog .dialog-close").click()
  await expect(more).toBeFocused()
  await openHistory(page)
  await expect(page.locator('iframe[data-page="history"]')).toHaveClass(/active/)
  await expect(menu).not.toBeVisible()
  await expect(page.locator('a[data-page="dex"]')).toHaveAttribute("aria-current", "page")
  await expect(more).not.toHaveAttribute("aria-current", "page")
  await page.screenshot({ path: testInfo.outputPath("dex-history.png") })

  await more.click()
  await page.locator("#map-button").click()
  await expect(menu).not.toBeVisible()
  await expect(page.locator("#world-map-view")).toBeVisible()
  await expect(more).not.toHaveAttribute("aria-current", "page")
  await more.click()
  await page.locator("#world-map-view .map-heading").click()
  await expect(menu).not.toBeVisible()

  await more.focus()
  await more.press("Enter")
  await expect(page.locator("#profile-button")).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(menu).not.toBeVisible()
  await expect(more).toBeFocused()
  await expect(more).toHaveAttribute("aria-expanded", "false")

  await page.locator('a[data-page="sidebar"]').click()
  await more.click()
  await page.frameLocator('iframe[data-page="sidebar"]').locator("#name").click()
  await expect(menu).not.toBeVisible()
})
