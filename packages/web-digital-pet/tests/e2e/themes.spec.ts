import { expect, type Page, test } from "@playwright/test"
import { openOptions } from "./helpers/navigation.ts"

const setTheme = async (page: Page, theme: "lcd" | "color") => {
  await openOptions(page)
  await page.locator("#theme-select").selectOption(theme)
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme)
  await page.locator("#options-dialog .dialog-close").click()
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("html")).toHaveAttribute("data-theme", theme)
}

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
