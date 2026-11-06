import { expect, test } from "@playwright/test"
import { chooseAlias, linkSocialPeers, readPet } from "./helpers/social-peers.ts"

test("a lost-device delivery is explicit, recoverable after reload, and does not replace this game's companion", async ({
  page,
}) => {
  const { accounts } = await linkSocialPeers([page])
  const alice = accounts[0]
  if (!alice) throw new Error("Missing test account")
  const bob = await (await page.request.post("http://127.0.0.1:4178/test/login")).json()
  const client = async (account: { handle: string; accountId: string }) => {
    const session = await (
      await page.request.get("http://127.0.0.1:4178/auth/session", { headers: { "x-test-session": account.handle } })
    ).json()
    return async (path: string, data: unknown) => {
      const result = await page.request.post(`http://127.0.0.1:4178/api/v1${path}`, {
        headers: {
          "x-test-session": account.handle,
          "X-Account-Id": account.accountId,
          "X-CSRF-Token": session.csrf,
          Origin: "http://127.0.0.1:4177",
        },
        data,
      })
      expect(result.ok()).toBe(true)
      return result.json()
    }
  }
  const a = await client(alice),
    b = await client(bob)
  await page.goto("http://127.0.0.1:4177")
  await chooseAlias(page, "Aki")
  const before = await readPet(page)
  const invitation = `${Date.now()}-${crypto.randomUUID()}`,
    trade = `${Date.now()}-${crypto.randomUUID()}`
  const pair = await a("/invitations", { id: invitation, code: bob.profile.code })
  const base = `/relationships/${pair.id}`
  await b(`${base}/invitations/${invitation}/decision`, { decision: "accepted" })
  const destination = { installationId: "lost-device", saveId: "lost-save" }
  const now = Date.now(),
    createdAt = new Date(now).toISOString()
  const offer = {
    slot: "principal",
    revision: 0,
    partner: {
      partnerId: "old-partner",
      currentNodeId: "3-001",
      createdAt,
      lastTickAt: now,
      gauge: 100,
      isTerminal: false,
      events: [{ currentNodeId: "3-001", createdAt }],
    },
  }
  for (const send of [a, b]) await send(`${base}/trades`, { id: trade, generation: 1, destination, offer })
  for (const send of [a, b]) await send(`${base}/trades/${trade}/confirm`, { destination })
  await b(`${base}/trades/${trade}/applied`, { destination })
  await page.goto("http://127.0.0.1:4177/#activity")
  await expect(page.locator('[data-social-action="recover-trade"]')).toBeVisible()
  await expect(page.locator("#social-count")).toHaveText("1")
  await page.reload()
  await page.locator('[data-social-action="recover-trade"]').click()
  await expect(page.locator("#social-dialog")).toContainText("original device")
  await page.locator('[data-social-action="close"]').click()
  await expect(page.locator('[data-social-action="recover-trade"]')).toBeVisible()
  await page.locator('[data-social-action="recover-trade"]').click()
  await page.locator('[data-social-action="release-trade"]').click()
  await expect(page.locator('[data-social-action="recover-trade"]')).toHaveCount(0)
  await expect(page.locator("#social-count")).toHaveText("0")
  expect((await readPet(page))?.partnerId).toBe(before?.partnerId)
})
