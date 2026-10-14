import type { AdventureState } from "../../domain/adventure.ts"
import type { BossVictory } from "../../domain/boss-victory.ts"
import type { StageThresholds } from "../../domain/evolution.ts"
import type { HygieneState } from "../../domain/hygiene.ts"
import type { Partner, PartnerProgression } from "../../domain/partner.ts"
import type { SpawnPartnerInput } from "../models/spawn-partner.ts"

export type AdventureSnapshot = {
  readonly partner: Partner
  readonly adventure?: AdventureState | undefined
  readonly readyAt: number
  readonly blocked: boolean
  readonly thresholds: StageThresholds
  readonly regionId: string
  readonly hygiene?: HygieneState | undefined
}
export type AdventureMutation = {
  readonly adventure: AdventureState
  readonly bossVictory?: BossVictory
  readonly readyAt?: number
  readonly replacement?: SpawnPartnerInput
  readonly progression?: PartnerProgression
  readonly rewardId?: string
}
export type AdventureStore = {
  nextReadyAt(): Promise<number> | number
  /** Adventure/checkpoint and experience must commit together, even with concurrent clicks or multiple views. */
  updateAdventure(
    change: (snapshot: AdventureSnapshot) => AdventureMutation | undefined,
  ): Promise<AdventureState | undefined> | AdventureState | undefined
}
