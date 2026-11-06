import { OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import { MAX_SOCKET_REQUEST_BYTES, parseSocketPart, SocketAssembly } from "@jcendal/digital-pet-online/socket-rpc.ts"
import { digest } from "./auth.ts"
import { change, type ObjectStore } from "./store.ts"

type Pending = { expiresAt: number; total: number; parts: Record<string, string>; consumed: boolean }

/** Fragments can reach different Lambda instances. S3 CAS admits the completed command once. */
export class SocketRequests {
  constructor(
    private readonly store: ObjectStore,
    private readonly clock = Date.now,
  ) {}
  async accept(connection: string, request: string, input: unknown): Promise<unknown | undefined> {
    const part = parseSocketPart(input, 16)
    return change<Pending, unknown | undefined>(
      this.store,
      `realtime/requests/${digest(connection)}/${request}`,
      () => ({ expiresAt: this.clock() + 60_000, total: part.total, parts: {}, consumed: false }),
      (value) => {
        if (value.expiresAt <= this.clock()) throw new OnlineError("request-expired", 410)
        if (value.consumed) return undefined
        if (value.total !== part.total) throw new OnlineError("invalid-fragment")
        const previous = value.parts[String(part.index)]
        if (previous !== undefined && previous !== part.data) throw new OnlineError("invalid-fragment")
        value.parts[String(part.index)] = part.data
        const assembly = new SocketAssembly(MAX_SOCKET_REQUEST_BYTES)
        let source: string | undefined
        for (const [index, data] of Object.entries(value.parts))
          source = assembly.add({ index: Number(index), total: value.total, data })
        if (source === undefined) return undefined
        const command: unknown = JSON.parse(source)
        value.consumed = true
        value.parts = {}
        return command
      },
    )
  }
}
