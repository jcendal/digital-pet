import { expect, test } from "@playwright/test"

test("battle completion rewards once, rejects early completion and preserves legacy awards", async ({ page }) => {
  await page.goto("http://127.0.0.1:4177/view/sidebar")
  await expect(page.locator("#name")).not.toHaveText("")
  const result = await page.evaluate(async () => {
    const url = "/src/client/persistence/pet-store.ts"
    const store = await import(url)
    const now = Date.now()
    const createdAt = new Date(now).toISOString()
    const state = {
      partnerId: "reward-test",
      currentNodeId: "3-001",
      gauge: 0,
      isTerminal: false,
      createdAt,
      lastTickAt: now,
      events: [{ currentNodeId: "3-001", createdAt }],
    }
    const battle = {
      version: 1,
      battleId: crypto.randomUUID(),
      seed: "a".repeat(64),
      challenger: { partnerId: state.partnerId, nodeId: state.currentNodeId },
      receiver: { partnerId: "opponent", nodeId: "4-001" },
      localSide: "player",
      plan: {
        outcome: "player",
        shots: [
          { shooter: "player", hit: true },
          { shooter: "opponent", hit: false },
          { shooter: "player", hit: true },
          { shooter: "opponent", hit: false },
          { shooter: "player", hit: true },
        ],
      },
    }
    await store.replaceLocalState(state)
    await Promise.all([store.settleBattle(battle, state), store.settleBattle(battle, state)])
    const before = (await store.peekLocalState()).gauge
    let premature = false
    try {
      await store.finishPendingBattle(battle.battleId)
    } catch {
      premature = true
    }
    const afterEarly = (await store.peekLocalState()).gauge
    await store.checkpointBattle(battle.battleId, battle.plan.shots.length)
    const completions = await Promise.all([
      store.finishPendingBattle(battle.battleId),
      store.finishPendingBattle(battle.battleId),
    ])
    const after = (await store.peekLocalState()).gauge
    const replay = await store.settleBattle(battle, state)
    const afterReplay = (await store.peekLocalState()).gauge

    // A result saved by the old release already awarded XP before playback.
    const legacyId = crypto.randomUUID()
    const legacy = {
      ...battle,
      battleId: legacyId,
      completedShots: battle.plan.shots.length,
      rewarded: true,
      agreedAt: now,
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("web-digital-pet", 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("pet", "readwrite")
      transaction.objectStore("pet").put(legacy, "pending-battle")
      transaction.objectStore("pet").put({ won: true, settledAt: now }, `battle:${legacyId}`)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    const legacyFinished = await store.finishPendingBattle(legacyId)
    const afterLegacy = (await store.peekLocalState()).gauge

    // A companion replaced after agreement must never receive the old companion's reward.
    const stale = { ...battle, battleId: crypto.randomUUID() }
    await store.settleBattle(stale, state)
    await store.replaceLocalState({ ...state, partnerId: "replacement" })
    await store.checkpointBattle(stale.battleId, stale.plan.shots.length)
    const staleFinished = await store.finishPendingBattle(stale.battleId)
    const afterReplacement = (await store.peekLocalState()).gauge
    return {
      before,
      premature,
      afterEarly,
      completions,
      after,
      replay,
      afterReplay,
      legacyFinished,
      afterLegacy,
      staleFinished,
      afterReplacement,
    }
  })
  expect(result.before).toBe(0)
  expect(result.premature).toBe(true)
  expect(result.afterEarly).toBe(0)
  expect(result.completions.filter(Boolean)).toEqual([{ rewarded: true }])
  expect(result.after).toBe(8_000_000)
  expect(result.replay).toBeUndefined()
  expect(result.afterReplay).toBe(result.after)
  expect(result.legacyFinished).toEqual({ rewarded: true })
  expect(result.afterLegacy).toBe(result.after)
  expect(result.staleFinished).toEqual({ rewarded: false })
  expect(result.afterReplacement).toBe(0)
})
