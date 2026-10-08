import { expect, it } from "bun:test"
import { checkComputerSave } from "../src/computer-save.ts"

it("reconnects after an offline check instead of remembering the failure", async () => {
  let online = false
  const request = (async () => {
    if (!online) throw new TypeError("Offline")
    return Response.json({ mode: "sqlite" })
  }) as typeof fetch
  expect(await checkComputerSave(false, request)).toBeNull()
  online = true
  expect(await checkComputerSave(false, request)).toBe(true)
})

it("distinguishes static browser-only hosting from a disconnected computer", async () => {
  let requests = 0
  const request = (async () => {
    requests++
    return new Response("Not found", { status: 404 })
  }) as typeof fetch
  expect(await checkComputerSave(true, request)).toBe(false)
  expect(requests).toBe(0)
  expect(await checkComputerSave(false, request)).toBeNull()
  expect(await checkComputerSave(false, (async () => Response.json({ mode: "browser" })) as typeof fetch)).toBe(false)
})
