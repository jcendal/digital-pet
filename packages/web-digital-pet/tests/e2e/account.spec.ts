import { expect, test } from "@playwright/test"
import { openOptions } from "./helpers/navigation.ts"
import { linkSocialPeers, readPet, seedSocialPet } from "./helpers/social-peers.ts"

test("adoption preserves the existing local game, uploads only on request and restores with a previous copy", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await linkSocialPeers([page], false)
  await page.addInitScript(() => {
    if (window.top !== window || sessionStorage.getItem("legacy-seeded")) return
    sessionStorage.setItem("legacy-seeded", "1")
    const open = indexedDB.open("web-digital-pet", 1)
    open.onupgradeneeded = () => open.result.createObjectStore("pet")
    open.onsuccess = () => {
      const db = open.result,
        tx = db.transaction("pet", "readwrite"),
        now = Date.now(),
        createdAt = new Date(now).toISOString()
      tx.objectStore("pet").put(
        {
          partnerId: "legacy-pet",
          currentNodeId: "3-001",
          createdAt,
          lastTickAt: now,
          gauge: 100,
          isTerminal: false,
          events: [{ currentNodeId: "3-001", createdAt }],
        },
        "current",
      )
      tx.oncomplete = () => db.close()
    }
  })
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#online-adopt")).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const open = indexedDB.open("web-digital-pet", 1)
          open.onerror = () => resolve(open.error?.name ?? "")
          open.onsuccess = () => {
            open.result.close()
            resolve("unexpected-old-writer")
          }
        }),
    ),
  ).toBe("VersionError")
  await page.locator("#online-adopt").click()
  await expect(page.locator("#online-adopt")).toBeHidden()
  expect((await readPet(page)).partnerId).toBe("legacy-pet")
  await page.locator("#online-list").click()
  await expect(page.locator("#online-backups")).toContainText(/no backups/i)
  await page.locator("#online-save").click()
  await expect(page.locator(".online-backup-row")).toHaveCount(1)
  await page.locator(".online-backup-row").scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("account-backups-mobile.png") })
  await seedSocialPet(page, "new-local-pet", "4-001")
  await page.locator(".online-backup-row button").first().click()
  await expect(page.locator("#online-preview")).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("account-restore-mobile.png") })
  expect((await readPet(page)).partnerId).toBe("new-local-pet")
  await page.locator("#online-restore").click()
  await expect.poll(async () => (await readPet(page)).partnerId).toBe("legacy-pet")
  expect(
    await page.evaluate(async () => {
      const path = "/src/client/persistence/pet-store.ts"
      return (await import(path)).hasPreviousSave()
    }),
  ).toBe(true)
  await page.reload()
  await openOptions(page)
  await page.locator("#online-list").click()
  await expect(page.locator(".online-backup-row")).toHaveCount(1)
  await page.locator(".online-backup-row button").last().click()
  await expect(page.locator("#online-status")).toBeEmpty()
  await expect(page.locator(".online-backup-row")).toHaveCount(1)
  await page.locator(".online-backup-row button").first().click()
  await expect(page.locator(".online-backup-row")).toHaveCount(0)
  expect((await readPet(page)).partnerId).toBe("legacy-pet")
  expect(errors).toEqual([])
})

test("wrong-account and cross-origin mutations cannot modify cloud data", async ({ page }) => {
  await linkSocialPeers([page])
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
  const statuses = await page.evaluate(async () => {
    const session = await (await fetch("/auth/session")).json()
    const wrongAccount = await fetch("/api/v1/me/profile", { headers: { "X-Account-Id": "someone-else" } })
    const noCsrf = await fetch("/api/v1/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Account-Id": session.accountId },
      body: JSON.stringify({ alias: "Forged" }),
    })
    return [wrongAccount.status, noCsrf.status]
  })
  expect(statuses).toEqual([409, 403])
})

test("an old backup preview cannot overwrite the game after switching accounts", async ({ page }) => {
  await linkSocialPeers([page])
  await page.goto("http://127.0.0.1:4177")
  await seedSocialPet(page, "saved-a", "3-001")
  await openOptions(page)
  await page.locator("#online-save").click()
  await expect(page.locator(".online-backup-row")).toHaveCount(1)
  await page.locator(".online-backup-row button").first().click()
  await expect(page.locator("#online-preview")).toBeVisible()
  await seedSocialPet(page, "current-b", "4-001")
  await linkSocialPeers([page], false)
  await page.evaluate(async () => {
    const path = "/src/client/platform/online-api.ts"
    const { api } = await import(path)
    try {
      await api("/api/v1/me/profile")
      throw new Error("The stale account must be rejected")
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "unauthorized") throw error
    }
  })
  await expect(page.locator("#online-adopt")).toBeVisible()
  await page.locator("#online-adopt").click()
  await expect(page.locator("#online-adopt")).toBeHidden()
  await page.locator("#online-restore").click()
  await expect(page.locator("#online-status")).toContainText("changed")
  expect((await readPet(page)).partnerId).toBe("current-b")
})

test("Google welcome fits narrow screens and dismissing it keeps the local game", async ({ page }, testInfo) => {
  await linkSocialPeers([page], false)
  await page.route("**/auth/session", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthorized"}' }),
  )
  await page.goto("http://127.0.0.1:4177")
  const dialog = page.locator("#online-migration")
  await expect(dialog).toBeVisible()
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    const login = dialog.locator(".google-action")
    await login.scrollIntoViewIfNeeded()
    const box = await login.boundingBox()
    if (!box) throw new Error("Missing Google action")
    expect(box.height).toBeGreaterThanOrEqual(48)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`google-welcome-${width}.png`) })
  }
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  const before = (await readPet(page)).partnerId
  await page.reload()
  await openOptions(page)
  await expect(dialog).toBeHidden()
  await expect(page.locator("#save-source-section")).toBeHidden()
  await expect(page.locator("#online-copies")).toBeHidden()
  await expect(page.locator("#online-save")).toBeDisabled()
  await expect(page.locator("#backup-download")).toBeEnabled()
  expect((await readPet(page)).partnerId).toBe(before)
})

test("hosted web keeps backups usable with an obsolete computer-save preference", async ({ page }) => {
  await linkSocialPeers([page])
  await page.addInitScript(() => localStorage.setItem("digital-pet:preferred-source", "sqlite"))
  await page.goto("http://127.0.0.1:4177")
  await openOptions(page)
  await expect(page.locator("#save-source-section")).toBeHidden()
  await expect(page.locator("#online-save")).toBeEnabled()
  await page.locator("#online-save").click()
  await expect(page.locator(".online-backup-row")).toHaveCount(1)
  await expect(page.locator("#online-status")).toContainText("saved to your account")
})
