import { GetObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3"
import { jsonBytes, OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import type { ObjectStore, Stored } from "../store.ts"

export class S3Store implements ObjectStore {
  constructor(
    readonly bucket: string,
    readonly client = new S3Client({}),
  ) {}

  async get<T>(key: string): Promise<Stored<T> | undefined> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
      if (!result.Body || !result.ETag) throw new Error("Invalid S3 response")
      if ((result.ContentLength ?? 0) > 1024 * 1024) throw new Error("Oversized metadata")
      return { value: JSON.parse(await result.Body.transformToString()) as T, revision: result.ETag }
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return undefined
      throw error
    }
  }

  async put<T>(key: string, value: T, expected: string | null): Promise<boolean> {
    if (jsonBytes(value) > 1024 * 1024) throw new OnlineError("metadata-full", 413)
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: JSON.stringify(value),
          ContentType: "application/json",
          CacheControl: "no-store",
          ...(expected === null ? { IfNoneMatch: "*" } : { IfMatch: expected }),
        }),
      )
      return true
    } catch (error) {
      if (error instanceof S3ServiceException && [409, 412].includes(error.$metadata.httpStatusCode ?? 0)) return false
      throw error
    }
  }
}
