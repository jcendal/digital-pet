import { expect, test } from "@playwright/test"

const ready = async (page: import("@playwright/test").Page) => {
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).not.toHaveText("")
}
const savedPartnerId = (page: import("@playwright/test").Page) =>
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
const controlled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      )
  })
}

test("static pages initialize shared clients, scenery, options and all panels without errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  await page.goto("/")
  await ready(page)
  const navigation = page.getByRole("navigation", { name: "Digital Pet" })
  await expect(navigation.locator("svg")).toHaveCount(5)
  await expect(page.locator("#options-dialog #battle-button")).toHaveCount(0)
  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 800 })
    const nav = await navigation.boundingBox()
    if (!nav) throw new Error("Missing navigation")
    for (const control of await navigation.locator("a, button").all()) {
      const box = await control.boundingBox()
      if (!box) throw new Error("Missing navigation control")
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.x).toBeGreaterThanOrEqual(nav.x)
      expect(box.x + box.width).toBeLessThanOrEqual(nav.x + nav.width)
    }
    await page.screenshot({ path: testInfo.outputPath(`navigation-${width}.png`) })
  }
  await navigation.getByRole("button", { name: "BATTLE", exact: true }).click()
  await expect(page.locator("#battle-dialog")).toBeVisible()
  await expect(page.locator("#options-dialog")).not.toBeVisible()
  await expect(page.locator("#battle-button")).toHaveAttribute("aria-expanded", "true")
  await page.locator("#battle-dialog .dialog-close").click()
  await expect(page.locator("#battle-button")).toHaveAttribute("aria-expanded", "false")
  await page.getByRole("button", { name: "OPTIONS", exact: true }).click()
  await expect(page.locator("#options-dialog")).toBeVisible()
  await page.locator("#world-button").click()
  await expect(page.locator(".region-card")).toHaveCount(10)
  await page.locator('[data-region="digital-ocean"]').click()
  await expect(page.locator("#world-preview-image")).toHaveJSProperty("complete", true)
  await expect(page.locator("#world-preview-image")).not.toHaveJSProperty("naturalWidth", 0)
  await page.locator("#world-dialog .dialog-close").click()
  await page.locator("#options-dialog .dialog-close").click()
  await page.getByRole("link", { name: "DEX", exact: true }).click()
  await expect(page.frameLocator('iframe[data-page="dex"]').locator("#entries")).not.toBeEmpty()
  await page.getByRole("link", { name: "HISTORY", exact: true }).click()
  await expect(page.frameLocator('iframe[data-page="history"]').locator("#generation-count")).not.toHaveText("00")
  expect(errors).toEqual([])
})

test("warm reloads reuse assets; offline routes and saves survive worker updates", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/")
  await ready(page)
  await controlled(page)
  const identity = await savedPartnerId(page)
  const name = await page.frameLocator('iframe[data-page="sidebar"]').locator("#name").textContent()
  await request.get("/__test?reset")
  await page.reload()
  await ready(page)
  const calls: string[] = await (await request.get("/__test")).json()
  expect(calls.filter((path) => path.startsWith("/assets/"))).toEqual([])
  await context.setOffline(true)
  await page.goto("/dex?selected=1-001")
  await expect(page.frameLocator('iframe[data-page="dex"]').locator("#entries")).not.toBeEmpty()
  await page.goto("/")
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).toHaveText(name!)
  await context.setOffline(false)
  await request.get("/__test?status=503")
  await page.reload()
  await ready(page)
  await request.get("/__test?status=404")
  expect(await page.evaluate(async () => (await fetch("/")).status)).toBe(404)
  await page.evaluate(async () => {
    await caches.open("web-digital-pet-legacy")
    await caches.open("another-app")
  })
  await request.get("/__test?reset&update")
  await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
  await expect
    .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting)))
    .toBe(true)
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).toHaveText(name!)
  expect(await page.evaluate(() => caches.keys())).toContain("web-digital-pet-legacy")
  await page.goto("about:blank")
  await page.goto("/")
  await controlled(page)
  await expect
    .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting)))
    .toBe(false)
  await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#name")).toHaveText(name!)
  expect(await savedPartnerId(page)).toBe(identity)
  const keys = await page.evaluate(() => caches.keys())
  expect(keys).not.toContain("web-digital-pet-legacy")
  expect(keys).toContain("another-app")
})

for (const [label, url] of [
  ["local server", "http://127.0.0.1:4176"],
  ["Vite development", "http://127.0.0.1:4177"],
]) {
  test(`${label} renders the app with working modules and excludes the service worker`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(url!)
    await ready(page)
    await page.getByRole("button", { name: "OPTIONS", exact: true }).click()
    await expect(page.locator("#options-dialog")).toBeVisible()
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
    expect(errors).toEqual([])
  })
}

test("private and explicit bypass requests reach the network; future assets work through the current worker", async ({
  page,
  request,
  context,
}) => {
  await page.goto("/")
  await controlled(page)
  await request.get("/__test?reset")
  const asset = await page.locator('script[type="module"][src]').getAttribute("src")
  await page.evaluate(async (url) => {
    await fetch("/api/probe", { cache: "no-store" })
    await fetch(url!, { cache: "no-store" })
    await fetch(url!, { headers: { Range: "bytes=0-10" } })
    await fetch("/assets/future-release.js")
  }, asset)
  await context.setOffline(true)
  expect(await page.evaluate(async () => (await fetch("/assets/future-release.js")).text())).toContain("version = 2")
  const calls: string[] = await (await request.get("/__test")).json()
  expect(calls).toContain("/api/probe")
  expect(calls.filter((path) => path === asset)).toHaveLength(2)
  expect(calls.filter((path) => path === "/assets/future-release.js")).toHaveLength(1)
})

test("failed worker installation preserves the active worker and browser save", async ({ page, request }) => {
  await page.goto("/")
  await ready(page)
  await controlled(page)
  const identity = await savedPartnerId(page)
  await request.get("/__test?fail-install")
  const failed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    const active = registration.active
    const failure = new Promise<boolean>((resolve) => {
      registration.addEventListener(
        "updatefound",
        () => {
          const worker = registration.installing!
          worker.addEventListener("statechange", () => {
            if (worker.state === "redundant") resolve(registration.active === active && !registration.waiting)
          })
        },
        { once: true },
      )
    })
    await registration.update()
    return failure
  })
  expect(failed).toBe(true)
  await page.reload()
  await ready(page)
  expect(await savedPartnerId(page)).toBe(identity)
  await request.get("/__test?update")
})
