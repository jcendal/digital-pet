import { randomBytes, randomUUID } from "node:crypto"
import { OnlineError, type SessionView } from "@jcendal/digital-pet-online/contracts.ts"
import { digest } from "./identity.ts"
import { readSession, sessionView } from "./sessions.ts"
import { change, type ObjectStore } from "./store.ts"

export { LOGIN_COOKIE, SESSION_COOKIE } from "./sessions.ts"

const random = () => randomBytes(32).toString("base64url")

export { digest } from "./identity.ts"
export type Tokens = { subject: string; refreshToken: string; accessExpiresAt: number }
export interface IdentityProvider {
  authorize(provider: "Google", state: string, nonce: string, verifier: string): string
  exchange(code: string, nonce: string, verifier: string): Promise<Tokens>
  refresh(token: string): Promise<Tokens>
  revoke(token: string): Promise<void>
}
export interface Cipher {
  seal(value: string, context: string): Promise<string>
  open(value: string, context: string): Promise<string>
}
type Login = { proof: string; nonce: string; verifier: string; expiresAt: number; used: boolean }
export type Session = {
  accountId: string
  csrf: string
  accessExpiresAt: number
  expiresAt: number
  revoked: boolean
  encryptedRefresh: string
  claim: { id: string; until: number } | null
}

export class AuthService {
  constructor(
    private readonly store: ObjectStore,
    private readonly provider: IdentityProvider,
    private readonly cipher: Cipher,
    private readonly now: () => number = Date.now,
    private readonly lifetime = 365 * 24 * 60 * 60 * 1000,
  ) {}

  async login(provider: "Google") {
    const state = random(),
      proof = random(),
      nonce = random(),
      verifier = random()
    const value: Login = { proof: digest(proof), nonce, verifier, expiresAt: this.now() + 10 * 60 * 1000, used: false }
    if (!(await this.store.put(`oauth/${digest(state)}`, value, null))) throw new OnlineError("login-retry", 409)
    return { proof, url: this.provider.authorize(provider, state, nonce, verifier) }
  }

  async callback(state: string, code: string, proof: string): Promise<{ handle: string; session: SessionView }> {
    if (!state || !code || !proof || [state, code, proof].some((item) => item.length > 4096))
      throw new OnlineError("invalid-login", 401)
    const key = `oauth/${digest(state)}`
    const found = await this.store.get<Login>(key)
    if (!found || found.value.used || found.value.expiresAt <= this.now() || found.value.proof !== digest(proof))
      throw new OnlineError("invalid-login", 401)
    if (!(await this.store.put(key, { ...found.value, used: true }, found.revision)))
      throw new OnlineError("invalid-login", 401)
    const tokens = await this.provider.exchange(code, found.value.nonce, found.value.verifier)
    const handle = random(),
      sessionKey = digest(handle)
    const value: Session = {
      accountId: tokens.subject,
      csrf: random(),
      accessExpiresAt: tokens.accessExpiresAt,
      expiresAt: this.now() + this.lifetime,
      revoked: false,
      encryptedRefresh: await this.cipher.seal(tokens.refreshToken, sessionKey),
      claim: null,
    }
    if (!(await this.store.put(`sessions/${sessionKey}`, value, null))) throw new OnlineError("login-retry", 409)
    return { handle, session: sessionView(value) }
  }

  session(handle: string, requireAccess = true): Promise<SessionView> {
    return readSession(this.store, handle, requireAccess, this.now)
  }

  async refresh(handle: string): Promise<SessionView> {
    await this.session(handle, false)
    const context = digest(handle),
      key = `sessions/${context}`
    const found = await this.store.get<Session>(key)
    if (!found || found.value.revoked || found.value.expiresAt <= this.now()) throw new OnlineError("unauthorized", 401)
    if (found.value.accessExpiresAt > this.now() + 60_000) return sessionView(found.value)
    if (found.value.claim && found.value.claim.until > this.now()) throw new OnlineError("refresh-in-progress", 409)
    const claim = { id: randomUUID(), until: this.now() + 30_000 }
    if (!(await this.store.put(key, { ...found.value, claim }, found.revision)))
      throw new OnlineError("refresh-in-progress", 409)
    const tokens = await this.provider.refresh(await this.cipher.open(found.value.encryptedRefresh, context))
    if (tokens.subject !== found.value.accountId) throw new OnlineError("identity-changed", 401)
    const encryptedRefresh = await this.cipher.seal(tokens.refreshToken, context)
    const latest = await this.store.get<Session>(key)
    if (!latest || latest.value.revoked || latest.value.expiresAt <= this.now() || latest.value.claim?.id !== claim.id)
      throw new OnlineError("unauthorized", 401)
    const next: Session = { ...latest.value, encryptedRefresh, accessExpiresAt: tokens.accessExpiresAt, claim: null }
    if (!(await this.store.put(key, next, latest.revision))) throw new OnlineError("session-changed", 409)
    return sessionView(next)
  }

  async logout(handle: string): Promise<void> {
    const context = digest(handle),
      key = `sessions/${context}`
    const found = await this.store.get<Session>(key)
    if (!found) return
    await change<Session, void>(
      this.store,
      key,
      () => found.value,
      (value) => {
        value.revoked = true
        value.claim = null
      },
    )
    // App revocation is already durable even if Cognito is temporarily unavailable.
    try {
      await this.provider.revoke(await this.cipher.open(found.value.encryptedRefresh, context))
    } catch {
      /* Subsequent requests remain denied. */
    }
  }
}
