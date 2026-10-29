import { readFile } from "node:fs/promises"
import type { Page } from "@playwright/test"
export type PeerMessage = {
  type: string
  id: string
  target: string
  peer: string
  connectionId: string
  data: unknown
}
export const linkSocialPeers = async (pages: Page[]) => {
  const mock = await readFile(new URL("../peerjs.browser.js", import.meta.url), "utf8")
  const peers = new Map<string, Page>()
  const connections = new Map<string, Page[]>()
  let drop: (event: PeerMessage, sender: Page) => boolean = () => false
  for (const page of pages) {
    page.on("request", (request) => {
      if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return
      for (const [id, owner] of peers) if (owner === page) peers.delete(id)
      for (const [connectionId, owners] of connections) {
        if (!owners.includes(page)) continue
        connections.delete(connectionId)
        const other = owners.find((owner) => owner !== page)
        if (other && !other.isClosed())
          void other
            .evaluate((id) => {
              ;(window as unknown as { testPeerEvent: (event: unknown) => void }).testPeerEvent({
                type: "close",
                connectionId: id,
              })
            }, connectionId)
            .catch(() => {})
      }
    })
    await page.route("**/node_modules/.vite/deps/peerjs.js*", (route) =>
      route.fulfill({ contentType: "text/javascript", body: mock }),
    )
    await page.exposeBinding("testPeerSend", async ({ page: sender }, event: PeerMessage) => {
      if (drop(event, sender)) return false
      if (event.type === "register") {
        peers.set(event.id, sender)
        return true
      }
      if (event.type === "connect") {
        const destination = peers.get(event.target)
        if (!destination || destination.isClosed()) return false
        connections.set(event.connectionId, [sender, destination])
        await destination.evaluate(
          (e) => {
            ;(window as unknown as { testPeerEvent: (x: unknown) => void }).testPeerEvent(e)
          },
          { ...event, type: "incoming" },
        )
        return true
      }
      const destination = connections.get(event.connectionId)?.find((p) => p !== sender)
      if (destination && !destination.isClosed())
        await destination
          .evaluate((e) => {
            ;(window as unknown as { testPeerEvent: (x: unknown) => void }).testPeerEvent(e)
          }, event)
          .catch(() => {})
      return true
    })
  }
  return {
    peers,
    dropWhen: (predicate: typeof drop) => {
      drop = predicate
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
export const seedSocialPet = (page: Page, id: string, node: string) =>
  page.evaluate(
    async ({ id, node }) => {
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
        events: [{ currentNodeId: node, createdAt }],
        food: { kind: "scheduled", availableAt: now + 60000 },
      })
      window.dispatchEvent(new Event("digital-pet:save-updated"))
    },
    { id, node },
  )
export const chooseAlias = async (page: Page, alias: string) => {
  await page.locator("#more-button").click()
  await page.locator("#profile-button").click()
  await page.locator("#social-alias").fill(alias)
  await page.locator('#social-alias-form button[type="submit"]').click()
}
