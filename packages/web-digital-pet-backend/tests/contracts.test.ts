import { expect, test } from "bun:test"
import { MAX_HTTP_BODY_BYTES, MAX_TRADE_OFFER_BYTES } from "@jcendal/digital-pet-online/contracts.ts"
import { parseSocialCommand, SOCIAL_COMMAND_TYPES } from "@jcendal/digital-pet-online/social-commands.ts"
import api from "../docs/openapi.json"
import socket from "../docs/websocket.schema.json"
import { assertClientMessage, assertServerMessage, clientMessage, serverMessage } from "./contract-validation.ts"

test("published contracts resolve all references and cover every social command", () => {
  const operationIds = new Set<string>()
  const documents: Record<string, unknown> = { "openapi.json": api, "websocket.schema.json": socket }
  const visit = (value: unknown, document: string): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child, document)
      return
    }
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      if (key === "operationId" && typeof child === "string") {
        expect(operationIds.has(child)).toBe(false)
        operationIds.add(child)
      }
      if (key === "$ref" && typeof child === "string") {
        const [file, pointer] = child.split("#")
        let target = documents[file?.replace(/^\.\//, "") || document]
        for (const part of (pointer ?? "").split("/").slice(1))
          target = (target as Record<string, unknown> | undefined)?.[part.replaceAll("~1", "/").replaceAll("~0", "~")]
        expect(target).toBeDefined()
      } else visit(child, document)
    }
  }
  for (const [name, document] of Object.entries(documents)) visit(document, name)
  expect(socket.$defs.SocialCommand.oneOf.map((command) => command.properties.type.const).sort()).toEqual(
    [...SOCIAL_COMMAND_TYPES].sort(),
  )
  expect(api.components.schemas.Offer["x-maxBytes"]).toBe(MAX_TRADE_OFFER_BYTES)
  expect(MAX_HTTP_BODY_BYTES).toBeGreaterThan(MAX_TRADE_OFFER_BYTES)
  expect(() => parseSocialCommand({ type: "unregistered.command", input: {} })).toThrow("invalid-command")
  expect(() => parseSocialCommand({ type: "trade.confirm", input: [] })).toThrow()
})

test("socket contracts validate complete requests, fragments and responses, and reject malformed envelopes", () => {
  const challenge = { action: "open", namespace: "battle", code: "", friend: "bob", requestId: "challenge" }
  assertClientMessage(challenge)
  expect(clientMessage({ ...challenge, namespace: "social" })).toBe(false)
  expect(clientMessage({ ...challenge, code: "ABCD1234" })).toBe(false)
  expect(clientMessage({ ...challenge, friend: "" })).toBe(false)
  const command = { type: "profile.rename", input: { alias: "Alice" } }
  const message = { action: "social", requestId: "request", accountId: "alice", responseChunks: true, command }
  assertClientMessage(message)
  expect(clientMessage({ ...message, command: { type: "profile.rename", input: {} } })).toBe(false)
  expect(clientMessage({ ...message, command: { type: "unknown", input: {} } })).toBe(false)
  expect(clientMessage({ ...message, requestId: "" })).toBe(false)
  const fragment = { index: 0, total: 2, data: '{"type":' }
  const frame = { action: "social", requestId: "request", accountId: "alice", responseChunks: true, fragment }
  assertClientMessage(frame)
  expect(clientMessage({ ...frame, responseChunks: false })).toBe(false)
  expect(clientMessage({ ...frame, fragment: { ...fragment, index: -1 } })).toBe(false)
  expect(clientMessage({ ...frame, fragment: { ...fragment, total: 0 } })).toBe(false)
  expect(clientMessage({ ...frame, fragment: { ...fragment, total: 17 } })).toBe(false)
  expect(clientMessage({ ...frame, command })).toBe(false)
  assertServerMessage({ kind: "response", requestId: "request", status: 200, body: { ok: true } })
  assertServerMessage({ kind: "response", requestId: "request", status: 401, body: { error: "unauthorized" } })
  const reply = { kind: "response-part", requestId: "request", status: 200, fragment }
  assertServerMessage(reply)
  expect(serverMessage({ ...reply, status: 999 })).toBe(false)
  expect(serverMessage({ ...reply, fragment: { ...fragment, data: 3 } })).toBe(false)
})
