export const INVITATION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000
export const MAX_BACKUP_BYTES = 4 * 1024 * 1024
export const MAX_TRADE_OFFER_BYTES = 32 * 1024
export const MAX_HTTP_BODY_BYTES = 40 * 1024
export const MAX_FRAME_BYTES = 24 * 1024
export const MAX_PENDING_MESSAGES = 128

export class OnlineError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code)
  }
}

export const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OnlineError("invalid-request")
  return value as Record<string, unknown>
}

export const identifier = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new OnlineError("invalid-id")
  return value
}

export const boundedText = (value: unknown, limit: number): string => {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new OnlineError("invalid-text")
  return value
}

export const jsonBytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength

export type Destination = { installationId: string; saveId: string }
export const destinationOf = (value: unknown): Destination => {
  const data = record(value)
  return { installationId: identifier(data.installationId), saveId: identifier(data.saveId) }
}
export const sameDestination = (left: Destination, right: Destination): boolean =>
  left.installationId === right.installationId && left.saveId === right.saveId

export type BackupSummary = { id: string; createdAt: number; bytes: number; label: string }
export type SessionView = { accountId: string; csrf: string; accessExpiresAt: number; expiresAt: number }

export type WireFrame =
  | { version: 1; channel: string; kind: "data"; sequence: number; payload: unknown }
  | { version: 1; channel: string; kind: "ack"; sequence: number }

export const parseFrame = (value: unknown): WireFrame => {
  if (jsonBytes(value) > MAX_FRAME_BYTES) throw new OnlineError("frame-too-large", 413)
  const data = record(value)
  const channel = identifier(data.channel)
  if (
    data.version !== 1 ||
    (data.kind !== "data" && data.kind !== "ack") ||
    typeof data.sequence !== "number" ||
    !Number.isSafeInteger(data.sequence) ||
    data.sequence < 1
  )
    throw new OnlineError("invalid-frame")
  if (data.kind === "ack") return { version: 1, channel, kind: "ack", sequence: data.sequence }
  if (!("payload" in data)) throw new OnlineError("invalid-frame")
  return { version: 1, channel, kind: "data", sequence: data.sequence, payload: data.payload }
}
