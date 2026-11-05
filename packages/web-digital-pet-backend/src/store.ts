import { OnlineError } from "@jcendal/digital-pet-online/contracts.ts"

export type Stored<T> = { value: T; revision: string }
export interface ObjectStore {
  get<T>(key: string): Promise<Stored<T> | undefined>
  put<T>(key: string, value: T, expected: string | null): Promise<boolean>
}

/** A transform must be pure: it can run again after a concurrent write. */
export async function change<T, R>(
  store: ObjectStore,
  key: string,
  initial: () => T,
  transform: (value: T) => R,
): Promise<R> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const old = await store.get<T>(key)
    const value = old ? structuredClone(old.value) : initial()
    const result = transform(value)
    // Idempotent retries and reads must not publish another object-created event.
    if (old && JSON.stringify(value) === JSON.stringify(old.value)) return result
    if (await store.put(key, value, old?.revision ?? null)) return result
  }
  throw new OnlineError("concurrent-update", 409)
}
