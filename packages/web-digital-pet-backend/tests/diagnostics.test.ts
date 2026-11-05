import { expect, spyOn, test } from "bun:test"
import { OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import { reportFailure } from "../src/diagnostics.ts"
import { privateHandler } from "../src/http.ts"

test("unexpected failures are correlated without exposing errors, credentials or client identifiers", async () => {
  const log = spyOn(console, "error").mockImplementation(() => {})
  try {
    const failure = Object.assign(new Error("secret-token and private save payload"), {
      $metadata: { httpStatusCode: 503 },
    })
    reportFailure("socket-action", failure, {
      requestId: "gateway-123",
      connectionId: "private-connection",
      commandId: "private-command",
    })
    const raw = String(log.mock.calls[0]?.[0])
    expect(JSON.parse(raw)).toMatchObject({
      event: "backend-failure",
      requestId: "gateway-123",
      dependencyStatus: 503,
      status: 500,
    })
    for (const secret of ["secret-token", "private save", "private-connection", "private-command", "stack"])
      expect(raw).not.toContain(secret)
    reportFailure("http-request", new OnlineError("forbidden", 403))
    expect(log).toHaveBeenCalledTimes(1)
    const result = await privateHandler(async () => {
      throw failure
    })({
      rawPath: "/api/v1/me",
      headers: {},
      requestContext: { requestId: "gateway-456", http: { method: "GET" } },
    })
    expect(result).toMatchObject({ statusCode: 500, body: JSON.stringify({ error: "temporarily-unavailable" }) })
    expect(JSON.parse(String(log.mock.calls[1]?.[0]))).toMatchObject({
      requestId: "gateway-456",
      operation: "http-request",
    })
  } finally {
    log.mockRestore()
  }
})
