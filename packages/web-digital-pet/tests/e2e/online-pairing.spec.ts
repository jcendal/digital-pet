import { expect, test } from "@playwright/test"
import { openOptions } from "./helpers/navigation.ts"
import { linkSocialPeers, readPet, seedSocialPet } from "./helpers/social-peers.ts"

test("AWS channels transfer a multi-frame save only after consent and keep the previous local game", async ({
  browser,
}) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  const alice = await contexts[0]!.newPage(),
    bob = await contexts[1]!.newPage()
  const errors: string[] = []
  for (const page of [alice, bob]) page.on("pageerror", (error) => errors.push(error.message))
  await linkSocialPeers([alice, bob])
  try {
    await Promise.all([alice.goto("http://127.0.0.1:4177"), bob.goto("http://127.0.0.1:4177")])
    await seedSocialPet(alice, "sender", "3-001")
    await seedSocialPet(bob, "receiver", "3-058")
    const bytes = await alice.evaluate(async () => {
      const path = "/src/client/persistence/pet-store.ts",
        store = await import(path),
        pet = await store.readLocalState()
      const events = Array.from({ length: 256 }, () => ({ currentNodeId: "3-001", createdAt: pet.createdAt }))
      const retiredPartners = ["old-a", "old-b"].map((partnerId) => ({
        partnerId,
        createdAt: pet.createdAt,
        retiredAt: pet.createdAt,
        events,
      }))
      await store.replaceLocalState({ ...pet, retiredPartners })
      return JSON.stringify(await store.readLocalState()).length
    })
    expect(bytes).toBeGreaterThan(24 * 1024)
    for (const page of [alice, bob]) {
      await openOptions(page)
      await page.locator("#pair-button").click()
    }
    await expect(alice.locator("#pair-own-code")).toHaveText(/^[A-HJ-NP-Z2-9-]{19}$/)
    const code = (await alice.locator("#pair-own-code").innerText()).replaceAll("-", "")
    await bob.locator("#pair-target").fill(code)
    await bob.locator("#pair-request").click()
    await expect(alice.locator("#pair-incoming")).toBeVisible()
    expect((await readPet(bob)).partnerId).toBe("receiver")
    await alice.locator("#pair-send").click()
    await expect(bob.locator("#pair-preview")).toBeVisible()
    expect((await readPet(bob)).partnerId).toBe("receiver")
    await bob.locator("#pair-import").click()
    await expect.poll(async () => (await readPet(bob)).partnerId).toBe("sender")
    expect((await readPet(bob)).retiredPartners).toHaveLength(2)
    expect(
      await bob.evaluate(async () => {
        const path = "/src/client/persistence/pet-store.ts"
        return (await import(path)).hasPreviousSave()
      }),
    ).toBe(true)
    expect(errors).toEqual([])
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
