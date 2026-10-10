import { readFile } from "node:fs/promises"
import { devices, expect, test } from "@playwright/test"

test.describe("iOS presentation", () => {
  test.use({ userAgent: devices["iPhone 13"].userAgent, locale: "es-ES" })

  test("Safari hides unsupported installation and battle controls have room in portrait and landscape", async ({
    page,
  }, testInfo) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await expect(page.locator("#install-banner")).toBeHidden()
    await page.locator("#options-button").click()
    await expect(page.locator("#options-dialog")).toBeVisible()
    await expect(page.locator("#install-section")).toBeHidden()
    await expect(page.locator("#install-instructions")).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath("ios-installation.png") })
    await page.locator("#options-dialog .dialog-close").click()
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(viewport)
      await page.locator("#battle-button").click()
      await expect(page.locator("#battle-target")).toBeVisible()
      const bounds = await page.locator("#battle-dialog").boundingBox()
      const body = await page.locator("#battle-dialog .dialog-body").boundingBox()
      expect(bounds?.height).toBeGreaterThan(viewport.height * 0.65)
      expect(body?.height).toBeGreaterThan(140)
      expect(bounds?.y).toBeGreaterThanOrEqual(0)
      expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(viewport.height)
      await page.evaluate(() => {
        document.getElementById("battle-incoming")!.hidden = false
      })
      await page.locator("#battle-accept").scrollIntoViewIfNeeded()
      await expect(page.locator("#battle-accept")).toBeInViewport()
      await expect(page.locator("#battle-decline")).toBeInViewport()
      await page.screenshot({ path: testInfo.outputPath(`battle-${viewport.width}.png`) })
      await page.locator("#battle-dialog .dialog-close").click()
    }
    expect(errors).toEqual([])
  })

  test("an installed iOS app does not ask to install again", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true })
    })
    await page.goto("/")
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true }))
    })
    await expect(page.locator("#install-banner")).toBeHidden()
    await page.locator("#options-button").click()
    await expect(page.locator("#install-section")).toBeHidden()
  })
})

test("restoring a cached page and a signaling failure recover both transports", async ({ page }) => {
  const mock = await readFile(new URL("./peerjs.browser.js", import.meta.url), "utf8")
  const registrations: string[] = []
  await page.route("**/node_modules/.vite/deps/peerjs.js*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: mock }),
  )
  await page.exposeBinding("testPeerSend", (_source, event: { type: string; id: string }) => {
    if (event.type === "register") registrations.push(event.id)
    if (event.type === "connect") return false
  })
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
  await expect.poll(() => registrations.length).toBe(2)
  const device = registrations.find((id) => !id.includes("battle"))
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }))
  })
  await expect(page.locator("#battle-request")).toBeDisabled()
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))
  })
  await expect.poll(() => registrations.length).toBe(4)
  await expect(page.locator("#battle-request")).toBeEnabled()
  await expect(page.locator("#pair-request")).toBeEnabled()
  expect(registrations.filter((id) => id === device)).toHaveLength(2)
  await page.clock.install()
  await page.locator("#battle-button").click()
  const own = await page.locator("#battle-own-code").textContent()
  await page.locator("#battle-target").fill(own === "000001" ? "000002" : "000001")
  await page.locator("#battle-request").click()
  await expect(page.locator("#battle-status")).toHaveText("Contacting the other player…")
  await page.clock.runFor(20_000)
  await expect(page.locator("#battle-status")).toContainText("Could not reach the other player")
  await expect(page.locator("#battle-request")).toBeEnabled()
  await page.locator("#battle-dialog .dialog-close").click()
  const battle = registrations.filter((id) => id.includes("battle")).at(-1)
  await page.evaluate((peer) => {
    const mock = window as unknown as { testPeerEvent: (value: unknown) => void }
    mock.testPeerEvent({ type: "peer-failed", peer })
  }, battle)
  await expect(page.locator("#battle-request")).toBeDisabled()
  await page.clock.runFor(4_999)
  expect(registrations).toHaveLength(4)
  await page.clock.runFor(1)
  await expect.poll(() => registrations.length).toBe(5)
  await expect(page.locator("#battle-request")).toBeEnabled()
  const active = registrations.at(-1)
  await page.evaluate((peer) => {
    const mock = window as unknown as { testPeerEvent: (value: unknown) => void }
    mock.testPeerEvent({ type: "peer-failed", peer })
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }))
  }, active)
  await page.clock.runFor(30_000)
  expect(registrations).toHaveLength(5)
})

test.describe("native installation prompt", () => {
  test.use({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36" })
  test("install uses the browser prompt and disappears after accepting", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("#install-banner")).toBeHidden()
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true })
      Object.assign(event, {
        prompt: () => {
          document.documentElement.dataset.installRequested = "true"
          return Promise.resolve()
        },
        userChoice: Promise.resolve({ outcome: "accepted" }),
      })
      window.dispatchEvent(event)
    })
    await expect(page.locator("#install-banner")).toBeVisible()
    await page.locator("#options-button").click()
    await expect(page.locator("#install-section > *")).toHaveCount(1)
    await expect(page.locator("#install-app")).toHaveText("Install app")
    await page.locator("#options-dialog .dialog-close").click()
    await page.locator("#install-open").click()
    await expect(page.locator("html")).toHaveAttribute("data-install-requested", "true")
    await expect(page.locator("#install-banner")).toBeHidden()
    await expect(page.locator("#install-section")).toBeHidden()
  })

  test("dismissing the banner keeps installation available in Options", async ({ page }) => {
    await page.goto("/")
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true })
      Object.assign(event, {
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      })
      window.dispatchEvent(event)
    })
    await expect(page.locator("#install-banner")).toBeVisible()
    await page.locator("#install-dismiss").click()
    await expect(page.locator("#install-banner")).toBeHidden()
    await page.locator("#options-button").click()
    await expect(page.locator("#install-app")).toBeVisible()
    await page.locator("#install-app").click()
    await expect(page.locator("#install-section")).toBeHidden()
    await expect(page.locator("#options-status")).toBeEmpty()
  })

  for (const failure of ["throw", "reject"] as const) {
    test(`a ${failure} from the installation prompt shows an error and does not reuse it`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.goto("/")
      await page.evaluate((mode) => {
        const event = new Event("beforeinstallprompt", { cancelable: true })
        Object.assign(event, {
          prompt: () => {
            if (mode === "throw") throw new Error("Prompt unavailable")
            return Promise.reject(new Error("Prompt unavailable"))
          },
          userChoice: Promise.resolve({ outcome: "dismissed" }),
        })
        window.dispatchEvent(event)
      }, failure)
      await page.locator("#install-open").click()
      await expect(page.locator("#options-dialog")).toBeVisible()
      await expect(page.locator("#options-status")).toHaveText("Could not open installation. Try again.")
      await expect(page.locator("#install-banner")).toBeHidden()
      await expect(page.locator("#install-section")).toBeHidden()
      expect(errors).toEqual([])
    })
  }
})
