import { devices, expect, test, type WebSocketRoute } from "@playwright/test"
import { openOptions } from "./helpers/navigation.ts"
import { linkSocialPeers } from "./helpers/social-peers.ts"

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
    await openOptions(page)
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
      if ((await page.locator("#social-code-battle").getAttribute("open")) === null)
        await page.locator("#social-code-battle summary").click()
      await expect(page.locator("#battle-target")).toBeVisible()
      const bounds = await page.locator("#social-view").boundingBox()
      const body = await page.locator(".social-scroll").boundingBox()
      expect(bounds?.height).toBeGreaterThan(viewport.height * 0.65)
      expect(body?.height).toBeGreaterThan(100)
      expect(bounds?.y).toBeGreaterThanOrEqual(0)
      expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(viewport.height)
      await page.evaluate(() => {
        document.getElementById("battle-incoming")!.hidden = false
        ;(document.getElementById("battle-dialog") as HTMLDialogElement).showModal()
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
    await openOptions(page)
    await expect(page.locator("#install-section")).toBeHidden()
  })
})

test("restoring a cached page and a socket failure recover both authenticated transports", async ({ page }) => {
  await linkSocialPeers([page])
  const sockets: Array<{ client: WebSocketRoute; server: WebSocketRoute }> = []
  await page.routeWebSocket("ws://127.0.0.1:4178/socket*", (client) => {
    sockets.push({ client, server: client.connectToServer() })
  })
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
  await expect.poll(() => sockets.length).toBe(1)
  const battle = await page.locator("#battle-own-code").textContent()
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }))
  })
  await expect(page.locator("#battle-request")).toBeDisabled()
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))
  })
  await expect.poll(() => sockets.length).toBe(2)
  await expect(page.locator("#battle-own-code")).toHaveText(battle!)
  await expect(page.locator("#battle-request")).toBeEnabled()
  await expect(page.locator("#pair-request")).toBeEnabled()
  for (const socket of sockets.slice(-1)) {
    await socket.client.close({ code: 1012, reason: "test restart" })
    await socket.server.close()
  }
  await expect.poll(() => sockets.length).toBe(3)
  await expect(page.locator("#battle-own-code")).toHaveText(battle!)
  await expect(page.locator("#battle-request")).toBeEnabled()
  await expect(page.locator("#pair-request")).toBeEnabled()
  await page.locator("#battle-button").click()
  await page.locator("#social-code-battle summary").click()
  await page.locator("#battle-target").fill(battle === "000001" ? "000002" : "000001")
  await page.locator("#battle-request").click()
  await expect(page.locator("#battle-status")).toContainText("Could not reach the other player")
  await expect(page.locator("#battle-request")).toBeEnabled()
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
    await openOptions(page)
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
    await openOptions(page)
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
