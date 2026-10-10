import type { Partner, PartnerProgression } from "../../domain/partner.ts"

export type EggPettingSnapshot = {
  readonly partner: Partner
  readonly frozen: boolean
  readonly isSetOverride: boolean
}

export type EggPettingStore = {
  /** Read, reward and record one interaction atomically; repeated IDs cannot earn twice. */
  updateEgg: (
    partnerId: string,
    interactionId: string,
    createdAt: string,
    change: (snapshot: EggPettingSnapshot) => PartnerProgression | undefined,
  ) => boolean
}
