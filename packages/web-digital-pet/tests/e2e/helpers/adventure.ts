import type { Page } from "@playwright/test"

export const saveAdventure = async (page: Page, battle = false) => {
  await page.evaluate(async (battle) => {
    const now = Date.now()
    const createdAt = new Date(now).toISOString()
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("web-digital-pet", 1)
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve) => {
      const transaction = database.transaction("pet", "readwrite")
      const store = transaction.objectStore("pet")
      store.put(
        {
          partnerId: "adventure-pet",
          currentNodeId: "3-001",
          createdAt,
          lastTickAt: now,
          gauge: 0,
          isTerminal: false,
          events: [{ currentNodeId: "3-001", createdAt }],
        },
        "current",
      )
      if (battle) store.put(now + 5 * 3600_000, "adventure-ready-at")
      else store.delete("adventure-ready-at")
      if (battle)
        store.put(
          {
            partnerId: "adventure-pet",
            state: {
              id: "saved-trip",
              nodeId: "3-001",
              regionId: "digital-ocean",
              running: false,
              elapsedMs: 6000,
              lastTickAt: now,
              nextEventAt: 21000,
              sequence: 1,
              collected: 0,
              victories: 0,
              status: "travel",
              event: {
                kind: "battle",
                id: 1,
                opponentNodeId: "3-007",
                difficult: false,
                completedShots: 0,
                plan: { outcome: "player", shots: [1, 2, 3].map(() => ({ shooter: "player", hit: true })) },
              },
            },
          },
          "adventure",
        )
      else store.delete("adventure")
      transaction.oncomplete = () => resolve()
    })
    database.close()
  }, battle)
  await page.reload()
}
