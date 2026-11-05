import { MAX_BACKUP_BYTES } from "@jcendal/digital-pet-online/contracts.ts"
import { parsePetTransfer } from "@jcendal/web-digital-pet/protocol/transfer"
import { S3Backups } from "../adapters/s3-backups.ts"
import { S3Store } from "../adapters/s3-store.ts"
import { BackupService } from "../backups.ts"
import { required } from "../runtime.ts"
export const services = {
  origin: required("PUBLIC_ORIGIN"),
  backups: new BackupService(
    new S3Store(required("DATA_BUCKET")),
    new S3Backups(required("BACKUP_BUCKET")),
    (value) => {
      parsePetTransfer(value, MAX_BACKUP_BYTES)
    },
  ),
}
