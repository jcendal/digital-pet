import { expect, test } from "@playwright/test"
import { chooseAlias, linkSocialPeers, readPet, readSocialState, seedSocialPet } from "./helpers/social-peers.ts"

test("real social storage and transport: invitation, friendship, renaming, ration and settled exchange", async ({
  browser,
}, info) => {
  test.setTimeout(120000)
  const a = await browser.newContext({
    locale: "es-ES",
    ...(process.env.PLAYWRIGHT_CAPTURE_EXCHANGE === "1"
      ? { recordVideo: { dir: info.outputPath("video"), size: { width: 390, height: 844 } } }
      : {}),
  })
  const b = await browser.newContext({ locale: "es-ES" })
  const alice = await a.newPage()
  const bob = await b.newPage()
  const errors: string[] = []
  for (const p of [alice, bob]) {
    p.on("pageerror", (e) => errors.push(e.message))
    await p.setViewportSize({ width: 390, height: 844 })
  }
  const network = await linkSocialPeers([alice, bob])
  try {
    await Promise.all([alice, bob].map((p) => p.goto("http://127.0.0.1:4177")))
    for (const p of [alice, bob]) await expect(p.locator("#social-current")).not.toBeEmpty()
    await seedSocialPet(alice, "alice", "3-001")
    await seedSocialPet(bob, "bob", "4-001")
    await chooseAlias(alice, "Alice")
    await chooseAlias(bob, "Bob")
    await expect.poll(async () => network.peers.size).toBe(6)
    const code = (await alice.locator("#social-profile .social-own-code").innerText()).replaceAll("-", "")
    const codeBob = (await bob.locator("#social-profile .social-own-code").innerText()).replaceAll("-", "")
    await bob.goto(`http://127.0.0.1:4177/#invite?code=${code}&alias=Alice`)
    await expect(bob.locator("#social-dialog")).toBeVisible()
    expect(Object.values((await readSocialState(bob)).outbox)).toHaveLength(0)
    await bob.locator('[data-social-action="invite"]').click()
    await alice.locator("#battle-button").click()
    await alice.locator('[data-social-tab="activity"]').click()
    await expect(alice.locator('[data-social-action="accept"]')).toBeVisible()
    await alice.locator('[data-social-action="accept"]').click()
    await expect
      .poll(async () => Object.values((await readSocialState(alice)).friends).filter((f) => f.confirmed).length)
      .toBe(1)
    await expect
      .poll(async () => Object.values((await readSocialState(bob)).friends).filter((f) => f.confirmed).length)
      .toBe(1)
    await chooseAlias(alice, "AliceNew")
    await expect(alice.locator("#social-profile .social-own-code")).toHaveText(code.match(/.{1,4}/g)?.join("-") ?? "")
    await expect.poll(async () => (await readSocialState(bob)).friends[code]?.profile.alias).toBe("AliceNew")
    await alice.screenshot({ path: info.outputPath("profile-design-aligned.png") })
    await alice.locator("#profile-friends").click()
    await alice.locator('[data-social-action="companion"]').click()
    await expect(alice.locator("#social-dialog-body")).toContainText("Bob")
    await alice.locator("#social-dialog .dialog-close").click()
    await alice.locator('[data-social-action="remove"]').click()
    await expect(alice.locator("#social-dialog-body")).toContainText("Bob")
    await alice.locator("#social-dialog .dialog-close").click()
    await alice.locator('#social-friends [data-social-action="challenge"]').click()
    await expect(alice.locator(".social-matchup .social-companion-card")).toHaveCount(2)
    expect(
      Object.values((await readSocialState(alice)).outbox).filter((r) => r.event.kind === "challenge"),
    ).toHaveLength(0)
    await alice.screenshot({ path: info.outputPath("challenge-preview.png") })
    await alice.locator("#social-dialog .dialog-close").click()
    await expect(alice.locator('[data-social-action="gift"]')).toBeEnabled()
    await alice.locator('[data-social-action="gift"]').click()
    await expect(alice.locator('[data-social-action="send-gift"]')).toContainText("Bob")
    await alice.screenshot({ path: info.outputPath("gift-design-aligned.png") })
    await alice.locator('[data-social-action="send-gift"]').click()
    await bob.locator('[data-social-tab="activity"]').click()
    await expect(bob.locator('[data-social-action="collect"]')).toBeVisible()
    await bob.locator('[data-social-action="collect"]').click()
    await expect.poll(async () => (await readPet(bob)).food?.kind).toBe("available")
    // Daily limit and receipt replay cannot award a second ration.
    const gift = Object.values((await readSocialState(bob)).inbox).find((r) => r.event.kind === "gift")
    expect(gift?.state).toBe("done")
    await expect(alice.locator('[data-social-action="gift"]')).toBeDisabled()
    await expect(alice.locator('[data-social-action="gift"]')).toContainText("Enviado")
    await alice.screenshot({ path: info.outputPath("friends-design-aligned.png") })
    await alice.locator('[data-social-action="exchange"]').click()
    await alice.locator('[data-social-action="review-selected"]').click()
    await expect(alice.locator("#social-dialog-body")).toContainText("confirmación final")
    await alice.locator('[data-social-action="offer-trade"]').click()
    await expect(bob.locator('[data-social-action="review-trade"]')).toBeVisible()
    await bob.locator('[data-social-action="review-trade"]').click()
    await bob.locator('[data-social-action="review-selected-incoming"]').click()
    await expect(bob.locator(".social-matchup .social-companion-card")).toHaveCount(2)
    await expect(bob.locator(".social-history-note")).toContainText("terminará")
    await expect(bob.locator("#social-playback")).not.toBeVisible()
    await bob.locator('[data-social-action="change-selection"]').click()
    await expect(bob.locator('input[name="social-offer-slot"]:checked')).toHaveValue("principal")
    await bob.locator('[data-social-action="review-selected-incoming"]').click()
    expect(
      await bob
        .locator(".social-dialog-actions button")
        .evaluateAll((buttons) => buttons.every((button) => button.scrollWidth <= button.clientWidth)),
    ).toBe(true)
    await bob.screenshot({ path: info.outputPath("exchange-review-design-aligned.png") })
    await bob.locator('[data-social-action="ready-trade"]').click()
    await expect(bob.locator('[data-social-group="trades"] [data-pending-trade]')).toHaveCount(1)
    await expect(bob.locator("#social-count")).toHaveText("1")
    // The receiver can cancel its preparation before the coordinator decides.
    await bob.locator('[data-social-action="abort-pending"]').click()
    await expect.poll(async () => Object.values((await readSocialState(bob)).trades)[0]?.phase).toBe("aborted")
    await expect(alice.locator('[data-social-action="confirm-review"]')).toHaveCount(0)
    await alice.locator('[data-social-tab="friends"]').click()
    await alice.locator('[data-social-action="exchange"]').click()
    await alice.locator('[data-social-action="review-selected"]').click()
    await expect(alice.locator("#social-dialog-body")).toContainText("confirmación final")
    await alice.locator('[data-social-action="offer-trade"]').click()
    await expect(bob.locator('[data-social-action="review-trade"]')).toBeVisible()
    await bob.locator('[data-social-action="review-trade"]').click()
    await bob.locator('[data-social-action="review-selected-incoming"]').click()
    await expect(bob.locator(".social-matchup .social-companion-card")).toHaveCount(2)
    await expect(bob.locator(".social-history-note")).toContainText("terminará")
    await expect(bob.locator("#social-playback")).not.toBeVisible()
    await bob.locator('[data-social-action="change-selection"]').click()
    await expect(bob.locator('input[name="social-offer-slot"]:checked')).toHaveValue("principal")
    await bob.locator('[data-social-action="review-selected-incoming"]').click()
    expect(
      await bob
        .locator(".social-dialog-actions button")
        .evaluateAll((buttons) => buttons.every((button) => button.scrollWidth <= button.clientWidth)),
    ).toBe(true)
    await bob.screenshot({ path: info.outputPath("exchange-review-design-aligned.png") })
    await bob.locator('[data-social-action="ready-trade"]').click()
    await expect(bob.locator('[data-social-group="trades"] [data-pending-trade]')).toHaveCount(1)
    await expect(bob.locator("#social-count")).toHaveText("1")
    await expect(alice.locator('[data-social-action="confirm-review"]')).toBeVisible()
    await alice.locator('[data-social-action="confirm-review"]').click()
    // Drop settlement to inspect persisted recovery before allowing delivery.
    network.dropWhen((e) => e.type === "data" && (e.data as { type?: string; stage?: string })?.stage === "commit")
    await alice.locator('[data-social-action="confirm-trade"]').click()
    await expect.poll(async () => Object.values((await readSocialState(alice)).trades)[0]?.phase).toBe("committed")
    expect(Object.values((await readSocialState(bob)).trades).filter((t) => t.phase === "prepared")).toHaveLength(1)
    await expect(alice.locator("#social-playback")).not.toBeVisible()
    await expect(bob.locator("#social-playback")).not.toBeVisible()
    await expect(alice.locator('[data-social-group="trades"] [data-pending-trade]')).toHaveCount(1)
    await expect(alice.locator("#social-count")).toHaveText("1")
    await alice.reload()
    network.dropWhen(() => false)
    for (const p of [alice, bob]) await expect(p.locator("#social-playback")).toBeVisible({ timeout: 25000 })
    const sceneBounds = await alice.locator("#social-playback").boundingBox()
    await alice.screenshot({ path: info.outputPath("exchange-start.png"), animations: "allow" })
    // Animation no longer requires a connection: prevent all subsequent peer traffic.
    network.dropWhen((e) => e.type !== "register")
    for (const p of [alice, bob]) await expect(p.locator("#social-exchange-result")).toBeVisible({ timeout: 15000 })
    const settledBounds = await alice.locator("#social-playback").boundingBox()
    expect(settledBounds?.height).toBe(sceneBounds?.height)
    expect(settledBounds?.y).toBe(sceneBounds?.y)
    const savedA = await readPet(alice)
    const savedB = await readPet(bob)
    expect(savedA.currentNodeId).toBe("4-001")
    expect(savedB.currentNodeId).toBe("3-001")
    expect(savedA.retiredPartners?.[0]?.partnerId).toBe("alice")
    expect(savedB.retiredPartners?.[0]?.partnerId).toBe("bob")
    expect(savedA.events).toHaveLength(1)
    expect(savedB.events).toHaveLength(1)
    expect(savedA.gauge).toBe(100)
    expect(savedB.gauge).toBe(100)
    for (const p of [alice, bob])
      await p.screenshot({ path: info.outputPath(p === alice ? "exchange-alice.png" : "exchange-bob.png") })
    const trade = Object.values((await readSocialState(alice)).trades)[0]
    expect(trade?.phase).toBe("resolved")
    // Replaying a commit is idempotent and cannot archive the received companion twice.
    await alice.evaluate(
      async ({ id, code }) => {
        const url = "/src/client/persistence/social-store.ts"
        await (await import(url)).commitTrade(id, code)
      },
      { id: trade?.id ?? "", code: codeBob },
    )
    expect((await readPet(alice)).retiredPartners).toHaveLength(1)
    await alice.locator("#social-exchange-done").click()
    await alice.locator('[data-social-tab="arena"]').click()
    await alice.screenshot({ path: info.outputPath("arena-design-aligned.png") })
    await alice.locator('[data-social-tab="activity"]').click()
    await alice.locator(".social-scroll").evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await alice.locator("#more-button").click()
    await alice.locator("#profile-button").click()
    await expect.poll(() => alice.locator(".social-scroll").evaluate((element) => element.scrollTop)).toBe(0)
    await expect(alice.locator("#social-profile-companion .social-portrait")).toBeInViewport()
    expect(errors).toEqual([])
  } finally {
    await a.close()
    await b.close()
  }
})

test("offline invitation retains one retryable request after reload and validates codes", async ({ page }) => {
  await page.goto("http://127.0.0.1:4177")
  await expect(page.locator("#social-current")).not.toBeEmpty()
  await chooseAlias(page, "Player")
  await page.goto("http://127.0.0.1:4177/#invite?code=Y8KC4TNB7RWA2VDF&alias=Noa")
  await page.locator('[data-social-action="invite"]').click()
  await expect(page.locator('[data-social-action="retry"]')).toBeVisible({ timeout: 20000 })
  const before = Object.values((await readSocialState(page)).outbox)
  await expect(page.locator(".social-item .social-hint")).toHaveCount(0)
  await page.reload()
  await expect(page.locator('[data-social-action="retry"]')).toBeVisible()
  expect(Object.values((await readSocialState(page)).outbox).map((r) => r.id)).toEqual(before.map((r) => r.id))
  await page.locator('[data-social-action="retry"]').click()
  expect(Object.values((await readSocialState(page)).outbox)).toHaveLength(1)
})

test("inline friend lookup verifies the connected identity before sending a request", async ({ browser }, info) => {
  const a = await browser.newContext({ locale: "es-ES", viewport: { width: 320, height: 740 } })
  const b = await browser.newContext({ locale: "es-ES" })
  const alice = await a.newPage()
  const bob = await b.newPage()
  await linkSocialPeers([alice, bob])
  try {
    for (const page of [alice, bob]) {
      await page.goto("http://127.0.0.1:4177")
      await expect(page.locator("#social-current")).not.toBeEmpty()
    }
    await chooseAlias(alice, "Alice")
    await chooseAlias(bob, "Bob")
    const code = await bob.locator("#social-profile .social-own-code").innerText()
    await alice.locator("#profile-friends").click()
    await alice.locator("#social-add").click()
    await expect(alice.locator("#social-add-form")).toBeVisible()
    await expect(alice.locator("#social-dialog")).not.toBeVisible()
    const inputBounds = await alice.locator("#social-target").boundingBox()
    const buttonBounds = await alice.locator("#social-connect").boundingBox()
    expect(inputBounds?.width).toBeGreaterThan(buttonBounds?.width ?? 0)
    await alice.locator("#social-target").fill(code)
    await alice.screenshot({ path: info.outputPath("inline-friend-form-320.png") })
    expect(
      await alice.locator(".social-scroll").evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true)
    await alice.locator("#social-connect").click()
    await expect(alice.locator("#social-dialog-body")).toContainText("Bob")
    await expect(alice.locator("#social-dialog-body")).toContainText(code)
    expect(Object.values((await readSocialState(alice)).outbox)).toHaveLength(0)
    await alice.locator('[data-social-action="invite"]').click()
    await expect(alice.locator("#social-activity")).toBeVisible()
    await bob.locator("#battle-button").click()
    await bob.locator('[data-social-tab="activity"]').click()
    await expect(bob.locator('[data-social-action="accept"]')).toBeVisible()
  } finally {
    await a.close()
    await b.close()
  }
})
