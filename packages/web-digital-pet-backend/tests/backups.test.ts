import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { type BackupFiles, BackupService } from "../src/backups.ts"
import { MemoryStore } from "./memory-store.ts"

const setup = (limit = 5) => {
  let now = Date.now()
  const store = new MemoryStore()
  const stage = new Map<string, Uint8Array>()
  const published = new Map<string, { bytes: Uint8Array; checksum: string }>()
  const files: BackupFiles = {
    upload: async (key) => ({ url: key, fields: {} }),
    readStage: async (key) => {
      const bytes = stage.get(key)
      if (!bytes) throw new Error("Missing stage")
      return bytes
    },
    publish: async (key, bytes, checksum) => {
      published.set(key, { bytes: bytes.slice(), checksum })
    },
    published: async (key, checksum) => published.get(key)?.checksum === checksum,
    download: async (key) => `https://private.example/${key}`,
    delete: async (key) => {
      published.delete(key)
    },
  }
  const service = new BackupService(
    store,
    files,
    (value) => {
      if (!value || typeof value !== "object" || !("version" in value)) throw new Error("Invalid save")
    },
    () => now,
    limit,
  )
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 4, state: {} }))
  const checksum = createHash("sha256").update(bytes).digest("hex")
  const reserve = async (id = "copy") => {
    const result = await service.create("alice", id, bytes.length, checksum, "Manual backup")
    stage.set(`alice/${id}.json`, bytes)
    return result
  }
  return {
    service,
    store,
    files,
    stage,
    published,
    reserve,
    bytes,
    checksum,
    advance: (ms: number) => {
      now += ms
    },
  }
}

test("backup ownership, checksum and concurrent reservation quota are enforced", async () => {
  const { service, reserve, stage } = setup(1)
  const result = await Promise.allSettled([reserve("one"), reserve("two")])
  expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(1)
  const id = result[0]?.status === "fulfilled" ? "one" : "two"
  await expect(service.complete("bob", id)).rejects.toThrow("backup-not-found")
  stage.set(`alice/${id}.json`, new TextEncoder().encode("tampered"))
  await expect(service.complete("alice", id)).rejects.toThrow("backup-checksum")
})

test("a published copy remains discoverable after catalog failure, stage deletion and upload expiration", async () => {
  const { service, reserve, store, stage, advance } = setup()
  await reserve()
  store.failAt = store.writes + 2 // finalizing is durable, publication succeeds, catalog ready fails
  await expect(service.complete("alice", "copy")).rejects.toThrow("Injected")
  store.failAt = Infinity
  stage.clear()
  advance(2 * 86_400_000)
  expect(await service.list("alice")).toHaveLength(1)
  expect((await service.complete("alice", "copy")).id).toBe("copy")
})

test("an interrupted publication can reupload identical data without consuming another quota slot", async () => {
  const { service, reserve, files, stage, advance } = setup(1)
  await reserve()
  const publish = files.publish
  files.publish = async () => {
    throw new Error("Unavailable")
  }
  await expect(service.complete("alice", "copy")).rejects.toThrow("Unavailable")
  stage.clear()
  advance(2 * 86_400_000)
  expect(await service.pending("alice")).toHaveLength(1)
  await reserve()
  files.publish = publish
  expect((await service.complete("alice", "copy")).id).toBe("copy")
})

test("validated bytes are immutable and a failed deletion is repaired on the next listing", async () => {
  const { service, reserve, stage, published, bytes, files } = setup()
  await reserve()
  await service.complete("alice", "copy")
  stage.set("alice/copy.json", new Uint8Array([0]))
  expect(published.get("alice/copy.json")?.bytes).toEqual(bytes)
  const remove = files.delete
  files.delete = async () => {
    throw new Error("Unavailable")
  }
  await expect(service.remove("alice", "copy")).rejects.toThrow("Unavailable")
  await expect(service.download("alice", "copy")).rejects.toThrow("backup-not-ready")
  files.delete = remove
  expect(await service.list("alice")).toHaveLength(0)
  expect(published.size).toBe(0)
})

test("a second finalizer and deletion cannot race a live publisher", async () => {
  const { service, reserve, files } = setup()
  await reserve()
  const publish = files.publish
  let release: () => void = () => {}
  let entered: () => void = () => {}
  const started = new Promise<void>((resolve) => {
    entered = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  files.publish = async (...args) => {
    entered()
    await gate
    await publish(...args)
  }
  const first = service.complete("alice", "copy")
  await started
  await expect(service.complete("alice", "copy")).rejects.toThrow("upload-in-progress")
  await expect(service.remove("alice", "copy")).rejects.toThrow("upload-in-progress")
  release()
  await first
  await service.remove("alice", "copy")
  expect(await service.list("alice")).toEqual([])
})
