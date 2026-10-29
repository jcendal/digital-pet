import { expect, test } from "@playwright/test"
import { chooseAlias, linkSocialPeers, readPet, seedSocialPet } from "./helpers/social-peers.ts"
import { themeContextOptions } from "./helpers/theme.ts"

test("Arena selection persists separately from the principal and battles reward the selected reserve", async ({
  browser,
}, info) => {
  test.setTimeout(90000)
  const contexts = await Promise.all([
    browser.newContext({ ...themeContextOptions, locale: "es-ES" }),
    browser.newContext({ ...themeContextOptions, locale: "es-ES" }),
  ])
  const alice = await contexts[0].newPage()
  const bob = await contexts[1].newPage()
  await linkSocialPeers([alice, bob])
  try {
    for (const page of [alice, bob]) {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto("http://127.0.0.1:4177")
      await expect(page.locator("#social-current")).not.toBeEmpty()
    }
    await seedSocialPet(alice, "alice", "3-001")
    await seedSocialPet(bob, "bob", "3-058")
    await alice.evaluate(async () => {
      const url = "/src/client/persistence/pet-store.ts"
      const store = await import(url)
      const pet = await store.readLocalState()
      await store.replaceLocalState({
        ...pet,
        reserve: { ...pet, partnerId: "alice-reserve", currentNodeId: "3-073", gauge: 100, pausedAt: Date.now() },
      })
      window.dispatchEvent(new Event("digital-pet:save-updated"))
    })
    await chooseAlias(alice, "Alice")
    await chooseAlias(bob, "Bob")
    await expect(alice.locator("#social-alias-form button")).toHaveCSS("justify-content", "center")
    await alice.locator("#battle-button").click()
    await alice.locator("#social-choose-team").click()
    await expect(alice.locator("#social-dialog")).toBeVisible()
    await expect(alice).toHaveURL(/#combat$/)
    await alice.screenshot({ path: info.outputPath("arena-chooser.png") })
    await alice.locator('[data-social-action="choose-fighter"][data-id="alice-reserve"]').click()
    await expect(alice.locator("#social-current")).toContainText("Tentomon")
    expect((await readPet(alice)).partnerId).toBe("alice")
    await alice.reload()
    await expect(alice.locator("#social-current")).toContainText("Tentomon")
    await alice.locator("#more-button").click()
    await alice.locator("#profile-button").click()
    await expect(alice.locator("#social-profile-companion")).toContainText("Agumon")
    await alice.locator("#battle-button").click()
    await bob.locator("#battle-button").click()
    await alice.locator("#social-code-battle summary").click()
    await expect(bob.locator("#battle-own-code")).toHaveText(/^\d{6}$/)
    const opponentCode = (await bob.locator("#battle-own-code").textContent()) ?? ""
    expect(opponentCode).toMatch(/^\d{6}$/)
    await alice.locator("#battle-target").fill(opponentCode)
    await alice.locator("#battle-request").click()
    await expect(bob.locator("#battle-incoming-text")).toContainText("Tentomon")
    await bob.locator("#battle-accept").click()
    const pending = () =>
      alice.evaluate(async () => {
        const url = "/src/client/persistence/pet-store.ts"
        return (await import(url)).readPendingBattle() as Promise<
          import("../../src/domain/battle/saved-battle.ts").PendingBattle | undefined
        >
      })
    await expect.poll(async () => (await pending())?.rewardTarget?.partnerId).toBe("alice-reserve")
    const battle = await pending()
    expect(battle?.challenger.nodeId).toBe("3-073")
    await expect.poll(pending, { timeout: 60000 }).toBeUndefined()
    const after = await readPet(alice)
    expect(after.partnerId).toBe("alice")
    expect(after.currentNodeId).toBe("3-001")
    expect(after.gauge).toBe(100)
    expect(after.reserve?.partnerId).toBe("alice-reserve")
    if (battle?.plan.outcome === battle?.localSide) expect(after.reserve?.gauge).toBeGreaterThan(100)
    else expect(after.reserve?.gauge).toBe(100)
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
