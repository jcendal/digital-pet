// Loopback-only integration fixture. Never included in Lambda entrypoints or deployment assets.
import { createHash, randomBytes } from "node:crypto"
import { MAX_BACKUP_BYTES } from "@jcendal/digital-pet-online/contracts.ts"
import { parsePetTransfer } from "@jcendal/web-digital-pet/protocol/transfer"
import type { ServerWebSocket } from "bun"
import { Accounts } from "../src/accounts.ts"
import { AuthService, digest, SESSION_COOKIE, type Session } from "../src/auth.ts"
import { authHandler } from "../src/auth-http.ts"
import { BackupService } from "../src/backups.ts"
import type { HttpEvent } from "../src/http.ts"
import { Notifications } from "../src/notifications.ts"
import { RealtimeService, type SocketDelivery } from "../src/realtime.ts"
import { savesHandler } from "../src/saves-http.ts"
import { SocialService } from "../src/social.ts"
import { socialHandler } from "../src/social-http.ts"
import { socialSocket } from "../src/social-socket.ts"
import { socketAction } from "../src/socket-action.ts"
import { SocketRequests } from "../src/socket-requests.ts"
import { MemoryStore } from "../tests/memory-store.ts"

const store = new MemoryStore(),
  authStore = new MemoryStore()
const sockets = new Map<string, ServerWebSocket<{ id: string }>>()
const delivery: SocketDelivery = {
  connected: async (id) => sockets.has(id),
  send: async (id, value) => {
    const socket = sockets.get(id)
    if (!socket) return false
    socket.send(JSON.stringify(value))
    return true
  },
}
const realtime = new RealtimeService(authStore, store, delivery)
const notifications = new Notifications(store, realtime)
store.onPut = (key, revision) => {
  if (/^(relationships\/|profiles\/|battle-decisions\/|realtime\/subscribers\/)/.test(key))
    setTimeout(() => {
      void notifications.changed(key, revision)
    }, 20)
}
const auth = new AuthService(
  authStore,
  {
    authorize: () => {
      throw new Error("Use the test login endpoint")
    },
    exchange: async () => {
      throw new Error("No Google calls in tests")
    },
    refresh: async (token) => ({ subject: token, refreshToken: token, accessExpiresAt: Date.now() + 7_200_000 }),
    revoke: async () => {},
  },
  { seal: async (value) => value, open: async (value) => value },
)
const files = new Map<string, Uint8Array>()
const objects = new Map<string, string>()
const fileUrl = (key: string) => {
  const token = randomBytes(24).toString("hex")
  objects.set(token, key)
  return `http://127.0.0.1:4178/file/${token}`
}
const services = {
  origin: "http://127.0.0.1:4177",
  auth,
  realtime,
  requests: new SocketRequests(store),
  accounts: new Accounts(store),
  social: new SocialService(store),
  backups: new BackupService(
    store,
    {
      upload: async (key) => ({ url: fileUrl(key), fields: {} }),
      readStage: async (key) => {
        const bytes = files.get(key)
        if (!bytes) throw new Error("Missing upload")
        return bytes
      },
      publish: async (key, bytes) => {
        if (!files.has(key)) files.set(key, bytes)
      },
      published: async (key, checksum) => {
        const bytes = files.get(key)
        return !!bytes && createHash("sha256").update(bytes).digest("hex") === checksum
      },
      download: async (key) => fileUrl(key),
      delete: async (key) => {
        files.delete(key)
      },
    },
    (value) => {
      parsePetTransfer(value, MAX_BACKUP_BYTES)
    },
  ),
}
const authHttp = authHandler(services),
  socialHttp = socialHandler(services),
  savesHttp = savesHandler(services)
Bun.serve<{ id: string }>({
  hostname: "127.0.0.1",
  port: 4178,
  async fetch(request, server) {
    const url = new URL(request.url)
    if (url.pathname === "/health") return new Response("ok")
    if (url.pathname === "/test/login" && request.method === "POST") {
      const previous = request.headers.get("x-test-session")
      if (previous) await auth.logout(previous)
      const accountId = randomBytes(16).toString("hex"),
        handle = randomBytes(32).toString("base64url")
      const session: Session = {
        accountId,
        csrf: randomBytes(24).toString("hex"),
        accessExpiresAt: Date.now() + 7_200_000,
        expiresAt: Date.now() + 365 * 86_400_000,
        revoked: false,
        encryptedRefresh: accountId,
        claim: null,
      }
      await authStore.put(`sessions/${digest(handle)}`, session, null)
      return Response.json({ handle, accountId, profile: await services.accounts.ensure(accountId) })
    }
    if (url.pathname === "/socket") {
      const id = crypto.randomUUID()
      try {
        await realtime.connect(id, url.searchParams.get("ticket") ?? "")
      } catch {
        return new Response("Unauthorized", { status: 401 })
      }
      if (server.upgrade(request, { data: { id } })) return
      return new Response("Upgrade required", { status: 400 })
    }
    if (url.pathname.startsWith("/file/")) {
      const headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:4177",
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      }
      const key = objects.get(url.pathname.slice(6))
      if (!key) return new Response("Missing", { status: 404, headers })
      if (request.method === "POST") {
        const form = await request.formData(),
          file = form.get("file")
        if (!(file instanceof File) || file.size > MAX_BACKUP_BYTES)
          return new Response("Invalid", { status: 400, headers })
        files.set(key, new Uint8Array(await file.arrayBuffer()))
        return new Response(null, { status: 204, headers })
      }
      return new Response(files.has(key) ? new Uint8Array(files.get(key)!).buffer : null, {
        status: files.has(key) ? 200 : 404,
        headers,
      })
    }
    const handle = request.headers.get("x-test-session") ?? ""
    const event: HttpEvent = {
      rawPath: url.pathname,
      headers: Object.fromEntries(request.headers),
      cookies: [`${SESSION_COOKIE}=${handle}`],
      queryStringParameters: Object.fromEntries(url.searchParams),
      requestContext: { http: { method: request.method } },
    }
    if (request.method !== "GET") event.body = await request.text()
    if (!url.pathname.startsWith("/auth/")) {
      try {
        const session = await auth.session(handle)
        event.requestContext.authorizer = { lambda: { accountId: session.accountId, csrf: session.csrf } }
      } catch {
        return Response.json({ error: "unauthorized" }, { status: 401 })
      }
    }
    const result = await (url.pathname.startsWith("/auth/")
      ? authHttp
      : url.pathname.startsWith("/api/v1/me/backups")
        ? savesHttp
        : socialHttp)(event)
    return new Response(result.body, { status: result.statusCode, headers: result.headers })
  },
  websocket: {
    open: (socket) => {
      sockets.set(socket.data.id, socket)
    },
    message: async (socket, raw) => {
      try {
        if (JSON.parse(String(raw)).action === "social") {
          await socialSocket(services, delivery, socket.data.id, String(raw))
          return
        }
      } catch {
        /* Invalid frames are handled by the normal protocol parser. */
      }
      await socketAction(realtime, delivery, socket.data.id, String(raw))
    },
    close: async (socket) => {
      sockets.delete(socket.data.id)
      await realtime.disconnect(socket.data.id)
    },
  },
})
