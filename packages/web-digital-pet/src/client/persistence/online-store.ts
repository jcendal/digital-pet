import type { Destination } from "@jcendal/digital-pet-online/contracts.ts"
import { accountConnection } from "../../domain/account/connection.ts"
import { emptySocial, type SocialState } from "../../domain/social/model.ts"
import { BATTLE_INTENT_KEY, completed, openDatabase, resultOf, TRADE_LOCK_KEY } from "./database.ts"

export type OnlineContext = Destination & { accountId: string | null }
export const ONLINE_CONTEXT_KEY = "online:context"
export { BATTLE_INTENT_KEY } from "./database.ts"
export const EFFECT_LOCK_KEY = "online:effect-lock"
export const sameContext = (a: OnlineContext, b: OnlineContext): boolean =>
  a.accountId === b.accountId && a.installationId === b.installationId && a.saveId === b.saveId
export const onlineTransaction = async <T>(run: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
  const db = await openDatabase()
  const tx = db.transaction("pet", "readwrite")
  const done = completed(tx)
  void done.catch(() => {})
  try {
    const result = await run(tx.objectStore("pet"))
    await done
    return result
  } catch (error) {
    try {
      tx.abort()
    } catch {}
    throw error
  } finally {
    db.close()
  }
}
export const readOnlineContext = (): Promise<OnlineContext> =>
  onlineTransaction(async (store) => {
    const old = await resultOf<OnlineContext | undefined>(store.get(ONLINE_CONTEXT_KEY))
    if (old) return old
    const value = { accountId: null, installationId: crypto.randomUUID(), saveId: crypto.randomUUID() }
    store.put(value, ONLINE_CONTEXT_KEY)
    return value
  })
export const assertContext = async (store: IDBObjectStore, expected: OnlineContext): Promise<void> => {
  const actual = await resultOf<OnlineContext | undefined>(store.get(ONLINE_CONTEXT_KEY))
  if (!actual || !sameContext(actual, expected)) throw new Error("online.saveChanged")
}
/** Automatic first sign-in requires empty social data; account changes require explicit confirmation. */
export const adoptAccount = async (
  accountId: string,
  options: { automatic?: boolean; expected?: OnlineContext } = {},
): Promise<boolean> =>
  onlineTransaction(async (store) => {
    const context = await resultOf<OnlineContext | undefined>(store.get(ONLINE_CONTEXT_KEY))
    if (!context) throw new Error("online.saveChanged")
    if (options.expected) await assertContext(store, options.expected)
    if (context.accountId === accountId) return true
    const social = await resultOf<SocialState | undefined>(store.get("social:v1"))
    if (options.automatic && accountConnection(context.accountId, accountId, social) === "confirm") return false
    if ((await resultOf(store.get(BATTLE_INTENT_KEY))) || (await resultOf(store.get("pending-battle"))))
      throw new Error("social.busy")
    if (
      (context.accountId || options.automatic) &&
      ((await resultOf(store.get(TRADE_LOCK_KEY))) || (await resultOf(store.get(EFFECT_LOCK_KEY))))
    )
      throw new Error("social.busy")
    if (social) store.put(social, `online:archived-social:${context.accountId ?? "legacy"}`)
    const next = emptySocial()
    if (social?.profile) next.profile = social.profile
    store.put(next, "social:v1")
    // Legacy prepared exchanges never had a cloud decision; archive and release them.
    if (!context.accountId) store.delete(TRADE_LOCK_KEY)
    store.put({ ...context, accountId, saveId: crypto.randomUUID() }, ONLINE_CONTEXT_KEY)
    return true
  })
export const rotateSaveIdentity = async (store: IDBObjectStore): Promise<void> => {
  if ((await resultOf(store.get(BATTLE_INTENT_KEY))) || (await resultOf(store.get(EFFECT_LOCK_KEY))))
    throw new Error("social.busy")
  const context = await resultOf<OnlineContext | undefined>(store.get(ONLINE_CONTEXT_KEY))
  if (context) store.put({ ...context, saveId: crypto.randomUUID() }, ONLINE_CONTEXT_KEY)
}
export const onlineReceiptKey = (context: OnlineContext, kind: string, id: string): string =>
  `online:receipt:${context.accountId}:${context.installationId}:${context.saveId}:${kind}:${id}`
