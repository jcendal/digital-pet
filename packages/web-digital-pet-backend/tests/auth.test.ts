import { expect, test } from "bun:test"
import { CognitoProvider } from "../src/adapters/cognito.ts"
import { AuthService, type IdentityProvider, type Tokens } from "../src/auth.ts"
import { authHandler } from "../src/auth-http.ts"
import { cookie, type HttpEvent, operationId, requireMutation } from "../src/http.ts"
import { RealtimeService } from "../src/realtime.ts"
import { MemoryStore } from "./memory-store.ts"

const setup = () => {
  let now = Date.now()
  let state = ""
  const provider: IdentityProvider = {
    authorize: (_provider, value) => {
      state = value
      return "https://identity.example/authorize"
    },
    exchange: async () => ({ subject: "account", refreshToken: "secret", accessExpiresAt: now + 7_200_000 }),
    refresh: async () => ({ subject: "account", refreshToken: "rotated-secret", accessExpiresAt: now + 7_200_000 }),
    revoke: async () => {},
  }
  const store = new MemoryStore()
  const auth = new AuthService(
    store,
    provider,
    { seal: async (v, c) => `${c}:${v}`, open: async (v, c) => v.slice(c.length + 1) },
    () => now,
  )
  const login = async () => {
    const started = await auth.login("Google")
    return auth.callback(state, "code", started.proof)
  }
  return {
    store,
    auth,
    provider,
    login,
    state: () => state,
    advance: (ms: number) => {
      now += ms
    },
  }
}

test("OAuth callback requires the same browser and state can only be consumed once", async () => {
  const { auth, state } = setup()
  const started = await auth.login("Google")
  await expect(auth.callback(state(), "code", "wrong-browser")).rejects.toThrow("invalid-login")
  const result = await auth.callback(state(), "code", started.proof)
  expect(result.session.accountId).toBe("account")
  expect(JSON.stringify(result)).not.toContain("secret")
  await expect(auth.callback(state(), "code", started.proof)).rejects.toThrow("invalid-login")
})

test("Google is the only login provider and only identity scopes are requested", async () => {
  const provider = new CognitoProvider({
    issuer: "https://issuer.example",
    domain: "https://login.example",
    clientId: "client",
    poolId: "pool",
    callback: "https://game.example/auth/callback",
  })
  const url = new URL(provider.authorize("Google", "state", "nonce", "verifier"))
  expect(url.searchParams.get("identity_provider")).toBe("Google")
  expect(url.searchParams.get("scope")).toBe("openid email")
  expect(url.searchParams.get("code_challenge_method")).toBe("S256")
  const { auth } = setup()
  const handler = authHandler({
    origin: "https://game.example",
    auth,
    realtime: new RealtimeService(new MemoryStore(), new MemoryStore(), { send: async () => true }),
  })
  const event: HttpEvent = { rawPath: "/auth/login", headers: {}, requestContext: { http: { method: "GET" } } }
  expect((await handler(event)).statusCode).toBe(302)
  expect((await handler({ ...event, queryStringParameters: { provider: "SignInWithApple" } })).statusCode).toBe(400)
})

test("two-hour access expires while the long session can refresh without extending its absolute lifetime", async () => {
  const { auth, login, advance } = setup()
  const { handle, session } = await login()
  advance(7_200_001)
  await expect(auth.session(handle)).rejects.toThrow("refresh-required")
  expect((await auth.session(handle, false)).accountId).toBe("account")
  expect((await auth.refresh(handle)).expiresAt).toBe(session.expiresAt)
  expect((await auth.session(handle)).accessExpiresAt).toBeGreaterThan(session.accessExpiresAt)
  advance(366 * 86_400_000)
  await expect(auth.refresh(handle)).rejects.toThrow("unauthorized")
})

test("concurrent refresh is serialized and cannot resurrect a logged-out session", async () => {
  const { auth, login, provider, advance } = setup()
  const { handle } = await login()
  advance(7_200_001)
  let finish: (tokens: Tokens) => void = () => {
    throw new Error("Not started")
  }
  let entered: () => void = () => {}
  const started = new Promise<void>((resolve) => {
    entered = resolve
  })
  provider.refresh = () =>
    new Promise((resolve) => {
      finish = resolve
      entered()
    })
  const refreshing = auth.refresh(handle)
  await started
  await expect(auth.refresh(handle)).rejects.toThrow("refresh-in-progress")
  await auth.logout(handle)
  finish({ subject: "account", refreshToken: "new-secret", accessExpiresAt: Date.now() + 99_000_000 })
  await expect(refreshing).rejects.toThrow("unauthorized")
  await expect(auth.session(handle, false)).rejects.toThrow("unauthorized")
})

test("local revocation survives a provider outage", async () => {
  const { auth, login, provider } = setup()
  const { handle } = await login()
  provider.revoke = async () => {
    throw new Error("Unavailable")
  }
  await auth.logout(handle)
  await expect(auth.session(handle, false)).rejects.toThrow("unauthorized")
})

test("mutation requires exact origin AND CSRF; duplicate cookies fail closed; stale operation IDs cannot replay", () => {
  const event: HttpEvent = {
    rawPath: "/",
    headers: { origin: "https://game.example", "x-csrf-token": "token" },
    requestContext: { http: { method: "POST" } },
  }
  expect(() => requireMutation(event, "https://game.example", "token")).not.toThrow()
  expect(() => requireMutation(event, "https://attacker.example", "token")).toThrow("forbidden")
  expect(() => requireMutation(event, "https://game.example", "other")).toThrow("forbidden")
  expect(cookie({ ...event, cookies: ["session=a", "session=b"] }, "session")).toBe("")
  const id = `${Date.now()}-00000000-0000-4000-8000-000000000000`
  expect(operationId(id)).toBe(id)
  expect(() => operationId(id, Date.now() + 15 * 86_400_000)).toThrow("operation-expired")
})

test("a failed refresh publication can retry after the claim expires within the provider grace window", async () => {
  const { auth, login, provider, advance, store } = setup()
  const { handle } = await login()
  advance(7_200_001)
  const tokens: string[] = []
  provider.refresh = async (token) => {
    tokens.push(token)
    return { subject: "account", refreshToken: "rotated", accessExpiresAt: Date.now() + 99_000_000 }
  }
  store.failAt = store.writes + 2
  await expect(auth.refresh(handle)).rejects.toThrow("Injected storage failure")
  await expect(auth.refresh(handle)).rejects.toThrow("refresh-in-progress")
  advance(30_001)
  await auth.refresh(handle)
  expect(tokens).toEqual(["secret", "secret"])
  expect((await auth.session(handle)).accountId).toBe("account")
})
