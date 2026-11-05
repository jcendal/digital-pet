import { expect, type Page } from "@playwright/test"
/** Real HTTP handlers, CAS storage and WebSocket relay with local test adapters. */
export const linkSocialPeers = async (pages: Page[], adopt = true, injectSocketFailures = false) => {
  const failures = new Map<Page, RegExp>()
  const failed = new Map<Page, () => void>()
  const accounts: Array<{ accountId: string; profile: { code: string }; handle: string }> = []
  for (const page of pages) {
    if (process.env.PLAYWRIGHT_WEBKIT !== "1")
      await page.context().grantPermissions(["local-network-access"], { origin: "http://127.0.0.1:4177" })
    const result = await page.request.post("http://127.0.0.1:4178/test/login")
    const account = await result.json()
    accounts.push(account)
    if (injectSocketFailures)
      await page.routeWebSocket("ws://127.0.0.1:4178/socket*", (client) => {
        const server = client.connectToServer()
        const lost = new Set<string>()
        client.onMessage((raw) => {
          const message = JSON.parse(String(raw))
          if (message.action === "social" && message.command.type === "trade.confirm") {
            const input = message.command.input
            const path = `/api/v1/relationships/${input.relationship}/trades/${input.operation}/confirm`
            if (failures.get(page)?.test(path)) {
              failures.delete(page)
              lost.add(message.requestId)
            }
          }
          server.send(raw)
        })
        server.onMessage((raw) => {
          const message = JSON.parse(String(raw))
          if (message.kind === "response" && lost.delete(message.requestId)) {
            client.send(JSON.stringify({ ...message, status: 503, body: { error: "temporarily-unavailable" } }))
            failed.get(page)?.()
            failed.delete(page)
          } else client.send(raw)
        })
      })
    await page.route(/\/(auth|api\/v1)\//, async (route) => {
      const request = route.request(),
        url = new URL(request.url())
      const response = await route.fetch({
        url: `http://127.0.0.1:4178${url.pathname}${url.search}`,
        headers: { ...request.headers(), "x-test-session": account.handle },
      })
      const failure = failures.get(page)
      if (failure?.test(url.pathname)) {
        failures.delete(page)
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "temporarily-unavailable" }),
        })
        failed.get(page)?.()
        failed.delete(page)
        return
      }
      await route.fulfill({ response })
    })
    await page.route("http://127.0.0.1:4177/", async (route) => {
      const response = await route.fetch()
      const body = (await response.text())
        .replace(
          "<html ",
          '<html data-online-socket="ws://127.0.0.1:4178/socket" data-backup-origin="http://127.0.0.1:4178" ',
        )
        .replace('data-save-host="local"', 'data-save-host="browser"')
        .replace("connect-src ", "connect-src ws://127.0.0.1:4178 http://127.0.0.1:4178 ")
      await route.fulfill({ response, body })
    })
    if (adopt)
      await page.addInitScript(
        async ({ accountId }) => {
          if (location.protocol !== "http:") return
          localStorage.setItem("online:migration-dismissed", "1")
          await new Promise<void>((resolve, reject) => {
            const open = indexedDB.open("web-digital-pet", 2)
            open.onupgradeneeded = () => {
              if (!open.result.objectStoreNames.contains("pet")) open.result.createObjectStore("pet")
            }
            open.onsuccess = () => {
              const db = open.result,
                tx = db.transaction("pet", "readwrite"),
                store = tx.objectStore("pet")
              const found = store.get("online:context")
              found.onsuccess = () => {
                if (!found.result)
                  store.put(
                    { accountId, installationId: crypto.randomUUID(), saveId: crypto.randomUUID() },
                    "online:context",
                  )
              }
              tx.oncomplete = () => {
                db.close()
                resolve()
              }
              tx.onerror = () => reject(tx.error)
            }
          })
        },
        { accountId: account.accountId },
      )
  }
  return {
    accounts,
    loseResponseOnce: (page: Page, pattern: RegExp) => {
      failures.set(page, pattern)
      return new Promise<void>((resolve) => failed.set(page, resolve))
    },
  }
}
export const readSocialState = (page: Page) =>
  page.evaluate(async () => {
    const url = "/src/client/persistence/social-store.ts"
    return (await import(url)).readSocial() as Promise<import("../../../src/domain/social/model.ts").SocialState>
  })
export const readPet = (page: Page) =>
  page.evaluate(async () => {
    const url = "/src/client/persistence/pet-store.ts"
    return (await import(url)).peekLocalState() as Promise<import("../../../src/domain/pet/progress.ts").LocalPetState>
  })
export const seedSocialPet = (page: Page, id: string, node: string, historyLength = 1) =>
  page.evaluate(
    async ({ id, node, historyLength }) => {
      const now = Date.now()
      const createdAt = new Date(now).toISOString()
      const url = "/src/client/persistence/pet-store.ts"
      await (await import(url)).replaceLocalState({
        partnerId: id,
        currentNodeId: node,
        createdAt,
        lastTickAt: now,
        gauge: 100,
        isTerminal: false,
        events: Array.from({ length: historyLength }, () => ({ currentNodeId: node, createdAt })),
        food: { kind: "scheduled", availableAt: now + 600000 },
      })
      window.dispatchEvent(new Event("digital-pet:save-updated"))
    },
    { id, node, historyLength },
  )
export const chooseAlias = async (page: Page, alias: string) => {
  await expect(page.locator("#social-current")).not.toBeEmpty()
  await page.locator("#more-button").click()
  await page.locator("#profile-button").click()
  await page.locator("#social-alias").fill(alias)
  await page.locator('#social-alias-form button[type="submit"]').click()
}
