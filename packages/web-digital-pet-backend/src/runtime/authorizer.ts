import { S3Store } from "../adapters/s3-store.ts"
import { required } from "../runtime.ts"
import { readSession } from "../sessions.ts"

const store = new S3Store(required("AUTH_BUCKET"))
export const authorize = (handle: string) => readSession(store, handle)
