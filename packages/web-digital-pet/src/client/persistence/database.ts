import { IntlModule } from "../../shared/i18n.ts"

const DB_NAME = "web-digital-pet"
const STORE_NAME = "pet"
export const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(IntlModule.translate("petStore.browserPetStorageIsBlocked")))
  })

export const completed = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () =>
      reject(transaction.error ?? new Error(IntlModule.translate("petStore.browserPetStorageWasInterrupted")))
  })

export const resultOf = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

export const BATTLE_INTENT_KEY = "online:battle-intent"
export const TRADE_LOCK_KEY = "social:trade-lock"
export const localMutationLocked = async (store: IDBObjectStore): Promise<boolean> =>
  Boolean((await resultOf(store.get(TRADE_LOCK_KEY))) || (await resultOf(store.get(BATTLE_INTENT_KEY))))
export const assertNoExchange = async (store: IDBObjectStore, allowBattleIntent = false): Promise<void> => {
  if (
    (await resultOf(store.get(TRADE_LOCK_KEY))) ||
    (!allowBattleIntent && (await resultOf(store.get(BATTLE_INTENT_KEY))))
  )
    throw new Error(IntlModule.translate("social.busy"))
}
