import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import type { BattlePlan } from "@jcendal/digital-pet-core/domain/combat.ts"
import { planSeededCombat } from "@jcendal/digital-pet-core/domain/peer-combat.ts"

export type Fighter = { readonly partnerId: string; readonly nodeId: string }
export const battleNode = (nodeId: string) => {
  const node = DIGIMON_CATALOG.byId.get(nodeId)
  if (!node || node.stage === 0) throw new Error("A battle needs a hatched Digimon from the catalogue")
  return node
}
export type BattleMessage =
  | { type: "request" | "accept"; version: 1; battleId: string; fighter: Fighter; commitment: string }
  | { type: "reveal"; version: 1; battleId: string; secret: string }
  | { type: "ready"; version: 1; battleId: string; digest: string }
  | { type: "cancel"; version: 1; battleId: string }

const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const id = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value)
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const parseFighter = (value: unknown): Fighter => {
  if (
    !record(value) ||
    typeof value.partnerId !== "string" ||
    value.partnerId.length < 1 ||
    value.partnerId.length > 100 ||
    typeof value.nodeId !== "string" ||
    !DIGIMON_CATALOG.byId.get(value.nodeId)?.stage
  )
    throw new Error("A battle needs a hatched Digimon from the catalogue")
  return { partnerId: value.partnerId, nodeId: value.nodeId }
}

export const parseBattleMessage = (value: unknown): BattleMessage => {
  if (!record(value) || JSON.stringify(value).length > 2048 || value.version !== 1 || !id(value.battleId))
    throw new Error("Unsupported battle message")
  const common = { version: 1 as const, battleId: value.battleId }
  if ((value.type === "request" || value.type === "accept") && hex(value.commitment))
    return { ...common, type: value.type, fighter: parseFighter(value.fighter), commitment: value.commitment }
  if (value.type === "reveal" && hex(value.secret)) return { ...common, type: value.type, secret: value.secret }
  if (value.type === "ready" && hex(value.digest)) return { ...common, type: value.type, digest: value.digest }
  if (value.type === "cancel") return { ...common, type: value.type }
  throw new Error("Invalid battle message")
}

type Dependencies = {
  readonly hash: (text: string) => Promise<string>
  readonly send: (message: BattleMessage) => void
  readonly requested: (fighter: Fighter) => void
  readonly agreed: (
    battleId: string,
    challenger: Fighter,
    receiver: Fighter,
    plan: BattlePlan,
    seed: string,
  ) => Promise<void>
}

/** Serialize calls. Both sides commit their randomness before either reveals it. */
export class BattleNegotiation {
  private phase: "idle" | "waiting" | "requested" | "committed" | "planned" | "agreed" | "closed" = "idle"
  private battleId = ""
  private own: Fighter | undefined
  private remote: Fighter | undefined
  private remoteCommitment = ""
  private digest = ""
  private plan: BattlePlan | undefined
  private seed = ""

  constructor(
    readonly challenger: boolean,
    private readonly secret: string,
    private readonly dependencies: Dependencies,
  ) {
    if (!hex(secret)) throw new Error("Invalid battle randomness")
  }

  private commitment(fighter: Fighter, secret: string, challenger: boolean): Promise<string> {
    return this.dependencies.hash(JSON.stringify([1, this.battleId, challenger, fighter, secret]))
  }

  async start(battleId: string, fighter: Fighter): Promise<void> {
    if (!this.challenger || this.phase !== "idle" || !id(battleId)) throw new Error("Battle already started")
    this.battleId = battleId
    this.own = parseFighter(fighter)
    const commitment = await this.commitment(this.own, this.secret, true)
    this.phase = "waiting"
    this.dependencies.send({ type: "request", version: 1, battleId, fighter: this.own, commitment })
  }

  async accept(fighter: Fighter): Promise<void> {
    if (this.challenger || this.phase !== "requested") throw new Error("No battle to accept")
    this.own = parseFighter(fighter)
    const commitment = await this.commitment(this.own, this.secret, false)
    this.phase = "committed"
    this.dependencies.send({ type: "accept", version: 1, battleId: this.battleId, fighter: this.own, commitment })
  }

  cancel(): void {
    if (this.battleId && this.phase !== "closed" && this.phase !== "agreed")
      this.dependencies.send({ type: "cancel", version: 1, battleId: this.battleId })
    this.phase = "closed"
  }

  async receive(input: unknown): Promise<void> {
    if (this.phase === "closed" || this.phase === "agreed") return
    const message = parseBattleMessage(input)
    if (message.type === "request" && !this.challenger && this.phase === "idle") {
      this.battleId = message.battleId
      this.remote = message.fighter
      this.remoteCommitment = message.commitment
      this.phase = "requested"
      this.dependencies.requested(message.fighter)
      return
    }
    if (message.battleId !== this.battleId) throw new Error("Wrong battle session")
    if (message.type === "cancel") throw new Error("The battle request was cancelled")
    if (message.type === "accept" && this.challenger && this.phase === "waiting") {
      this.remote = message.fighter
      this.remoteCommitment = message.commitment
      this.phase = "committed"
      this.dependencies.send({ type: "reveal", version: 1, battleId: this.battleId, secret: this.secret })
      return
    }
    if (message.type === "reveal" && this.phase === "committed" && this.own && this.remote) {
      if ((await this.commitment(this.remote, message.secret, !this.challenger)) !== this.remoteCommitment)
        throw new Error("The other player changed their battle randomness")
      const challenger = this.challenger ? this.own : this.remote
      const receiver = this.challenger ? this.remote : this.own
      const seed = await this.dependencies.hash(
        JSON.stringify([
          1,
          this.battleId,
          challenger,
          receiver,
          this.challenger ? this.secret : message.secret,
          this.challenger ? message.secret : this.secret,
        ]),
      )
      this.plan = planSeededCombat(
        battleNode(challenger.nodeId).combatStats,
        battleNode(receiver.nodeId).combatStats,
        seed,
      )
      this.seed = seed
      this.digest = await this.dependencies.hash(JSON.stringify([1, this.battleId, challenger, receiver, this.plan]))
      this.phase = "planned"
      if (!this.challenger)
        this.dependencies.send({ type: "reveal", version: 1, battleId: this.battleId, secret: this.secret })
      this.dependencies.send({ type: "ready", version: 1, battleId: this.battleId, digest: this.digest })
      return
    }
    if (message.type === "ready" && this.phase === "planned" && this.own && this.remote && this.plan) {
      if (message.digest !== this.digest) throw new Error("Battle results do not match. Update both apps and retry.")
      this.phase = "agreed"
      await this.dependencies.agreed(
        this.battleId,
        this.challenger ? this.own : this.remote,
        this.challenger ? this.remote : this.own,
        this.plan,
        this.seed,
      )
      return
    }
    throw new Error("Unexpected battle message")
  }
}
