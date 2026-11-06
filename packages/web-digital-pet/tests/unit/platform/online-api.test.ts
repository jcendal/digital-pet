import { expect, spyOn, test } from "bun:test"
import { currentOnlineSession, loadOnlineSession, logoutOnline } from "../../../src/client/platform/online-api.ts"

test("logout uses CSRF without refreshing expired access and keeps failures retryable", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window")
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document")
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() })
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement: { dataset: { saveHost: "browser", onlineSocket: "wss://game.example/socket" } } },
  })
  const calls: string[] = []
  let logoutStatus = 503
  const fetch = spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input)
    calls.push(path)
    if (path === "/auth/session")
      return Response.json({
        accountId: "alice",
        csrf: "test-proof",
        accessExpiresAt: 1,
        expiresAt: Date.now() + 60000,
      })
    expect(path).toBe("/auth/logout")
    expect(init?.method).toBe("POST")
    expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("test-proof")
    return Response.json(logoutStatus === 200 ? { ok: true } : { error: "unavailable" }, { status: logoutStatus })
  })
  try {
    await loadOnlineSession()
    await expect(logoutOnline()).rejects.toThrow("unavailable")
    expect(currentOnlineSession()?.accountId).toBe("alice")
    for (const status of [200, 401]) {
      logoutStatus = status
      await logoutOnline()
      expect(currentOnlineSession()).toBeNull()
    }
    expect(calls).not.toContain("/auth/refresh")
  } finally {
    fetch.mockRestore()
    for (const [name, descriptor] of [
      ["window", windowDescriptor],
      ["document", documentDescriptor],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  }
})
