import { CognitoProvider } from "../adapters/cognito.ts"
import { KmsCipher } from "../adapters/kms-cipher.ts"
import { S3Store } from "../adapters/s3-store.ts"
import { AuthService } from "../auth.ts"
import { required } from "../runtime.ts"
import { SocketTickets } from "../socket-tickets.ts"

const origin = required("PUBLIC_ORIGIN")
const store = new S3Store(required("AUTH_BUCKET"))
export const services = {
  origin,
  auth: new AuthService(
    store,
    new CognitoProvider({
      issuer: required("COGNITO_ISSUER"),
      domain: required("COGNITO_DOMAIN"),
      clientId: required("COGNITO_CLIENT_ID"),
      poolId: required("COGNITO_POOL_ID"),
      callback: `${origin}/auth/callback`,
    }),
    new KmsCipher(required("SESSION_KEY")),
  ),
  realtime: new SocketTickets(store),
}
