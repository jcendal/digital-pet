import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import { createPresignedPost } from "@aws-sdk/s3-presigned-post"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { MAX_BACKUP_BYTES, OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import type { BackupFiles } from "../backups.ts"

export class S3Backups implements BackupFiles {
  constructor(
    private readonly bucket: string,
    private readonly client = new S3Client({}),
  ) {}

  upload(key: string, bytes: number) {
    return createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: `staging/${key}`,
      Expires: 300,
      Conditions: [
        ["content-length-range", bytes, bytes],
        ["eq", "$Content-Type", "application/json"],
      ],
      Fields: { "Content-Type": "application/json", success_action_status: "204" },
    })
  }

  async readStage(key: string): Promise<Uint8Array> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: `staging/${key}` }))
    if (!result.Body || !result.ContentLength || result.ContentLength > MAX_BACKUP_BYTES)
      throw new OnlineError("invalid-backup")
    return result.Body.transformToByteArray()
  }

  async publish(key: string, bytes: Uint8Array, checksum: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: `copies/${key}`,
          Body: bytes,
          IfNoneMatch: "*",
          ContentType: "application/json",
          CacheControl: "no-store",
          Metadata: { sha256: checksum },
        }),
      )
    } catch (error) {
      if (!(error instanceof S3ServiceException) || error.$metadata.httpStatusCode !== 412) throw error
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: `copies/${key}` }))
      if (result.Metadata?.sha256 !== checksum) throw new OnlineError("backup-conflict", 409)
    }
  }

  async published(key: string, checksum: string): Promise<boolean> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: `copies/${key}` }))
      if (result.Metadata?.sha256 !== checksum) throw new OnlineError("backup-conflict", 409)
      return true
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return false
      throw error
    }
  }

  download(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: `copies/${key}`,
        ResponseContentType: "application/json",
        ResponseContentDisposition: 'attachment; filename="digital-pet-backup.json"',
        ResponseCacheControl: "no-store",
      }),
      { expiresIn: 120 },
    )
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: `copies/${key}` }))
  }
}
