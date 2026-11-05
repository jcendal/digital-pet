import { S3Store } from "../adapters/s3-store.ts"
import { GatewayDelivery } from "../adapters/socket-delivery.ts"
import { RealtimeService } from "../realtime.ts"
import { required } from "../runtime.ts"
export const origin = required("PUBLIC_ORIGIN")
export const dataBucket = required("DATA_BUCKET")
export const dataStore = new S3Store(dataBucket)
export const delivery = new GatewayDelivery(required("SOCKET_MANAGEMENT_URL"))
export const realtime = new RealtimeService(new S3Store(required("AUTH_BUCKET")), dataStore, delivery)
