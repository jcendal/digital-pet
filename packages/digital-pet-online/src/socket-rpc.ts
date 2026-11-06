import { jsonBytes, MAX_FRAME_BYTES, OnlineError, record } from "./contracts.ts"

export const MAX_SOCKET_REQUEST_BYTES = 48 * 1024
export const MAX_SOCKET_RESPONSE_BYTES = 5 * 1024 * 1024
export type SocketPart = { index: number; total: number; data: string }

/** Leave room for the envelope, including JSON escaping of each string fragment. */
export const socketParts = (value: unknown, maximum: number): SocketPart[] => {
  const source = JSON.stringify(value)
  if (jsonBytes(value) > maximum) throw new OnlineError("message-too-large", 413)
  const chunks: string[] = []
  for (let offset = 0; offset < source.length; ) {
    let size = Math.min(20 * 1024, source.length - offset)
    while (jsonBytes(source.slice(offset, offset + size)) > MAX_FRAME_BYTES - 1024) size = Math.floor(size / 2)
    const last = source.charCodeAt(offset + size - 1)
    if (last >= 0xd800 && last <= 0xdbff) size--
    chunks.push(source.slice(offset, offset + size))
    offset += size
  }
  return chunks.map((data, index) => ({ index, total: chunks.length, data }))
}

export const parseSocketPart = (input: unknown, maximumParts: number): SocketPart => {
  const part = record(input)
  if (
    !Number.isInteger(part.index) ||
    !Number.isInteger(part.total) ||
    Number(part.index) < 0 ||
    Number(part.index) >= Number(part.total) ||
    Number(part.total) > maximumParts ||
    typeof part.data !== "string" ||
    jsonBytes(part.data) > MAX_FRAME_BYTES - 1024
  )
    throw new OnlineError("invalid-fragment")
  return part as SocketPart
}

/** Bounded assembly also accepts out-of-order and identical duplicate deliveries. */
export class SocketAssembly {
  private parts = new Map<number, string>()
  private total?: number
  private bytes = 0
  constructor(private readonly maximum = MAX_SOCKET_RESPONSE_BYTES) {}
  add(input: unknown): string | undefined {
    const part = parseSocketPart(input, 1024)
    if (this.total !== undefined && this.total !== part.total) throw new OnlineError("invalid-fragment")
    this.total = part.total
    const previous = this.parts.get(part.index)
    if (previous !== undefined && previous !== part.data) throw new OnlineError("invalid-fragment")
    if (previous === undefined) {
      this.bytes += new TextEncoder().encode(part.data).byteLength
      if (this.bytes > this.maximum) throw new OnlineError("message-too-large", 413)
      this.parts.set(part.index, part.data)
    }
    if (this.parts.size === this.total)
      return Array.from({ length: this.total }, (_, index) => this.parts.get(index)!).join("")
  }
}
