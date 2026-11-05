import type { ObjectStore, Stored } from "../src/store.ts"

export class MemoryStore implements ObjectStore {
  private readonly objects = new Map<string, Stored<unknown>>()
  writes = 0
  failAt = Number.POSITIVE_INFINITY
  onPut?: (key: string, revision: string) => void

  async get<T>(key: string): Promise<Stored<T> | undefined> {
    return structuredClone(this.objects.get(key)) as Stored<T> | undefined
  }

  async put<T>(key: string, value: T, expected: string | null): Promise<boolean> {
    if (++this.writes === this.failAt) throw new Error("Injected storage failure")
    const current = this.objects.get(key)
    if ((current?.revision ?? null) !== expected) return false
    this.objects.set(key, { value: structuredClone(value), revision: String(this.writes) })
    this.onPut?.(key, String(this.writes))
    return true
  }
}
