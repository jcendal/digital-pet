import { expect } from "bun:test"
import Ajv from "ajv/dist/2020.js"
import addFormats from "ajv-formats"
import api from "../docs/openapi.json"
import socket from "../docs/websocket.schema.json"

// OpenAPI has document annotations beyond JSON Schema; validate its referenced schemas normally.
const ajv = new Ajv({ strict: false, allErrors: true })
addFormats(ajv)
ajv.addKeyword({
  keyword: "x-maxBytes",
  schemaType: "number",
  validate: (limit: number, value: unknown) => Buffer.byteLength(JSON.stringify(value)) <= limit,
})
ajv.addSchema(api, "https://contracts.digital-pet.test/openapi.json")
ajv.addSchema(socket, "https://contracts.digital-pet.test/websocket.schema.json")
export const clientMessage = ajv.compile({
  $ref: "https://contracts.digital-pet.test/websocket.schema.json#/$defs/ClientMessage",
})
export const serverMessage = ajv.compile({
  $ref: "https://contracts.digital-pet.test/websocket.schema.json#/$defs/ServerMessage",
})
export const tradeResult = ajv.compile({
  $ref: "https://contracts.digital-pet.test/openapi.json#/components/schemas/Trade",
})
export const assertClientMessage = (value: unknown) => {
  clientMessage(value)
  expect(clientMessage.errors).toBeNull()
}
export const assertServerMessage = (value: unknown) => {
  serverMessage(value)
  expect(serverMessage.errors).toBeNull()
}
