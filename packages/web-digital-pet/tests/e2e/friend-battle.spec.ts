import { expect, test } from "@playwright/test"
import { chooseAlias, linkSocialPeers, readSocialState, seedSocialPet } from "./helpers/social-peers.ts"

test("one friendship acceptance enables a friend battle with one recipient acceptance and sender cancellation", async ({
  browser,
}) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  const alice = await contexts[0]!.newPage(),
    bob = await contexts[1]!.newPage()
  const { accounts } = await linkSocialPeers([alice, bob])
  try {
    await Promise.all([alice, bob].map((page) => page.goto("http://127.0.0.1:4177")))
    await seedSocialPet(alice, "alice", "3-001")
    await seedSocialPet(bob, "bob", "4-001")
    await chooseAlias(alice, "Alice")
    await chooseAlias(bob, "Bob")
    await alice.goto(`http://127.0.0.1:4177/#invite?code=${accounts[1]!.profile.code}&alias=Bob`)
    await alice.locator('[data-social-action="invite"]').click()
    await bob.locator("#profile-friends").click()
    await bob.locator('[data-social-tab="activity"]').click()
    await bob.locator('[data-social-action="accept"]').click()
    for (const page of [alice, bob]) {
      await expect
        .poll(
          async () => Object.values((await readSocialState(page)).friends).filter((friend) => friend.confirmed).length,
        )
        .toBe(1)
      await expect(page.locator('[data-social-action="accept"]')).toHaveCount(0)
    }
    const challenge = async () => {
      await alice.locator("#battle-button").click()
      await alice.locator('[data-social-tab="friends"]').click()
      await expect(alice.locator('#social-friends [data-social-action="challenge"]')).toBeEnabled()
      await alice.locator('#social-friends [data-social-action="challenge"]').click()
      await alice.locator('[data-social-action="send-challenge"]').click()
      await expect(bob.locator("#battle-incoming")).toBeVisible()
      await expect(alice.locator("#battle-incoming")).toBeHidden()
    }
    await challenge()
    await alice.locator("#battle-dialog .dialog-close").click()
    await expect(bob.locator("#battle-incoming")).toBeHidden()
    await expect(bob.locator("#battle-status")).toContainText(/cancel|disconnect/i)
    if (await bob.locator("#battle-dialog").isVisible()) await bob.locator("#battle-dialog .dialog-close").click()
    await challenge()
    await bob.locator("#battle-accept").click()
    for (const page of [alice, bob]) {
      await expect(page.locator("#battle-status")).toContainText(/Battle started|wins|Draw/)
      await expect(page.locator("#battle-dialog")).toBeHidden()
      await expect(page.frameLocator('iframe[data-page="sidebar"]').locator("#phase")).toHaveText("BATTLE")
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
