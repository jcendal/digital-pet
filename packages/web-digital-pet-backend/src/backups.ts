import { createHash } from "node:crypto"
import {
  type BackupSummary,
  boundedText,
  identifier,
  MAX_BACKUP_BYTES,
  OnlineError,
} from "@jcendal/digital-pet-online/contracts.ts"
import { change, type ObjectStore } from "./store.ts"

type Backup = BackupSummary & {
  checksum: string
  status: "uploading" | "finalizing" | "ready" | "deleting" | "deleted"
  expiresAt: number
  publishingUntil?: number
}
type Catalog = { copies: Backup[] }
export interface BackupFiles {
  upload(key: string, bytes: number): Promise<{ url: string; fields: Record<string, string> }>
  readStage(key: string): Promise<Uint8Array>
  publish(key: string, bytes: Uint8Array, checksum: string): Promise<void>
  published(key: string, checksum: string): Promise<boolean>
  download(key: string): Promise<string>
  delete(key: string): Promise<void>
}
const checksumOf = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
export class BackupService {
  constructor(
    private readonly store: ObjectStore,
    private readonly files: BackupFiles,
    private readonly validate: (value: unknown) => void,
    private readonly now: () => number = Date.now,
    private readonly limit = 5,
  ) {}

  private catalog(account: string): string {
    return `backups/${identifier(account)}/index`
  }
  private key(account: string, id: string): string {
    return `${identifier(account)}/${identifier(id)}.json`
  }

  async create(account: string, id: string, bytes: number, checksum: string, label: string) {
    identifier(id)
    boundedText(label, 80)
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_BACKUP_BYTES || !/^[a-f0-9]{64}$/.test(checksum))
      throw new OnlineError("invalid-backup")
    const now = this.now()
    const backup = await change<Catalog, Backup>(
      this.store,
      this.catalog(account),
      () => ({ copies: [] }),
      (catalog) => {
        const prior = catalog.copies.find((copy) => copy.id === id)
        if (prior) {
          if (prior.checksum !== checksum || prior.bytes !== bytes || prior.label !== label)
            throw new OnlineError("operation-conflict", 409)
          if (prior.status === "deleted" || prior.status === "deleting") throw new OnlineError("upload-expired", 409)
          prior.expiresAt = now + 15 * 60 * 1000
          return prior
        }
        catalog.copies = catalog.copies.filter(
          (copy) => copy.status !== "deleted" || copy.createdAt > now - 28 * 86_400_000,
        )
        if (catalog.copies.filter((copy) => copy.status !== "deleted").length >= this.limit)
          throw new OnlineError("backup-limit", 429)
        if (catalog.copies.length >= 256) throw new OnlineError("backup-rate-limit", 429)
        const created: Backup = {
          id,
          createdAt: now,
          bytes,
          checksum,
          label,
          status: "uploading",
          expiresAt: now + 15 * 60 * 1000,
        }
        catalog.copies.push(created)
        return created
      },
    )
    if (backup.status === "ready") return { backup, upload: null }
    return { backup, upload: await this.files.upload(this.key(account, id), bytes) }
  }

  private async owned(account: string, id: string): Promise<Backup> {
    identifier(id)
    const catalog = await this.store.get<Catalog>(this.catalog(account))
    const backup = catalog?.value.copies.find((copy) => copy.id === id)
    if (!backup) throw new OnlineError("backup-not-found", 404)
    return backup
  }

  async complete(account: string, id: string): Promise<BackupSummary> {
    let backup = await this.owned(account, id)
    if (backup.status === "ready") return this.summary(backup)
    if (backup.status !== "uploading" && backup.status !== "finalizing") throw new OnlineError("upload-expired", 409)
    const key = this.key(account, id)
    if ((backup.publishingUntil ?? 0) > this.now()) throw new OnlineError("upload-in-progress", 409)
    let bytes: Uint8Array | undefined
    if (backup.status !== "finalizing" || !(await this.files.published(key, backup.checksum))) {
      bytes = await this.files.readStage(key)
      if (bytes.byteLength !== backup.bytes || checksumOf(bytes) !== backup.checksum)
        throw new OnlineError("backup-checksum", 409)
      try {
        this.validate(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
      } catch {
        throw new OnlineError("invalid-backup")
      }
    }
    // Pin the catalog entry before publishing. It must survive URL expiry or a crash.
    backup = await change<Catalog, Backup>(
      this.store,
      this.catalog(account),
      () => ({ copies: [] }),
      (catalog) => {
        const current = catalog.copies.find((copy) => copy.id === id)
        if (!current || !["uploading", "finalizing", "ready"].includes(current.status))
          throw new OnlineError("upload-canceled", 409)
        if ((current.publishingUntil ?? 0) > this.now()) throw new OnlineError("upload-in-progress", 409)
        if (current.status === "uploading" && current.expiresAt <= this.now())
          throw new OnlineError("upload-expired", 409)
        if (current.status !== "ready") {
          current.status = "finalizing"
          // Must exceed the maximum Lambda invocation duration (30 seconds in the stack).
          current.publishingUntil = this.now() + 120_000
        }
        return current
      },
    )
    if (backup.status === "ready") return this.summary(backup)
    // Copy the validated bytes, never a mutable staging URL or an unpinned latest object.
    if (bytes) await this.files.publish(key, bytes, backup.checksum)
    return change<Catalog, BackupSummary>(
      this.store,
      this.catalog(account),
      () => ({ copies: [] }),
      (catalog) => {
        const current = catalog.copies.find((copy) => copy.id === id)
        if (!current || current.status === "deleting" || current.status === "deleted")
          throw new OnlineError("upload-canceled", 409)
        current.status = "ready"
        delete current.publishingUntil
        return this.summary(current)
      },
    )
  }

  private summary(copy: Backup): BackupSummary {
    return { id: copy.id, createdAt: copy.createdAt, bytes: copy.bytes, label: copy.label }
  }

  async list(account: string): Promise<BackupSummary[]> {
    const catalog = await this.store.get<Catalog>(this.catalog(account))
    // A caller returning after a failed delete repairs that operation without a worker.
    for (const copy of catalog?.value.copies ?? []) if (copy.status === "deleting") await this.remove(account, copy.id)
    for (const copy of catalog?.value.copies ?? []) {
      if (
        copy.status === "finalizing" &&
        (copy.publishingUntil ?? 0) <= this.now() &&
        (await this.files.published(this.key(account, copy.id), copy.checksum))
      )
        await this.complete(account, copy.id)
    }
    const latest = await this.store.get<Catalog>(this.catalog(account))
    return (latest?.value.copies ?? []).filter((copy) => copy.status === "ready").map((copy) => this.summary(copy))
  }

  async pending(account: string) {
    const catalog = await this.store.get<Catalog>(this.catalog(account))
    return (catalog?.value.copies ?? []).filter((copy) => copy.status === "uploading" || copy.status === "finalizing")
  }

  async download(account: string, id: string): Promise<string> {
    const copy = await this.owned(account, id)
    if (copy.status !== "ready") throw new OnlineError("backup-not-ready", 409)
    return this.files.download(this.key(account, id))
  }

  async remove(account: string, id: string): Promise<void> {
    await this.owned(account, id)
    await change<Catalog, void>(
      this.store,
      this.catalog(account),
      () => ({ copies: [] }),
      (catalog) => {
        const copy = catalog.copies.find((item) => item.id === id)
        if (!copy) throw new OnlineError("backup-not-found", 404)
        // Do not race publication of a live upload into an inaccessible permanent object.
        if ((copy.publishingUntil ?? 0) > this.now() || (copy.status === "uploading" && copy.expiresAt > this.now()))
          throw new OnlineError("upload-in-progress", 409)
        if (copy.status !== "deleted") copy.status = "deleting"
      },
    )
    await this.files.delete(this.key(account, id))
    await change<Catalog, void>(
      this.store,
      this.catalog(account),
      () => ({ copies: [] }),
      (catalog) => {
        const copy = catalog.copies.find((item) => item.id === id)
        if (copy) copy.status = "deleted"
      },
    )
  }
}
