import type { Page } from "@playwright/test"

const openMore = async (page: Page) => {
  if (!(await page.locator("#more-menu").isVisible())) await page.locator("#more-button").click()
}

export const openOptions = async (page: Page) => {
  await openMore(page)
  await page.locator("#options-button").click()
}

export const openHistory = async (page: Page) => {
  if (!(await page.locator("#dex-view").isVisible())) await page.locator('a[data-page="dex"]').click()
  await page.locator("#dex-history-tab").click()
}
