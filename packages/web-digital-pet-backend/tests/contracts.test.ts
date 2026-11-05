import { expect, test } from "bun:test"
import { MAX_HTTP_BODY_BYTES, MAX_TRADE_OFFER_BYTES } from "@jcendal/digital-pet-online/contracts.ts"
import { parseSocialCommand, SOCIAL_COMMAND_TYPES } from "@jcendal/digital-pet-online/social-commands.ts"
import api from "../docs/openapi.json"
import socket from "../docs/websocket.schema.json"

test("published contracts resolve all references and cover every social command", () => {
  const documents: Record<string, unknown> = { "openapi.json": api, "websocket.schema.json": socket }
  const visit = (value: unknown, document: string): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child, document)
      return
    }
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
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
