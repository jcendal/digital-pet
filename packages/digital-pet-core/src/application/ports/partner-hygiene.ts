import type { HygieneState } from "../../domain/hygiene.ts"
import type { Partner, PartnerProgression } from "../../domain/partner.ts"

export type PartnerHygiene = { readonly partnerId: string; readonly hygiene: HygieneState }
export type HygieneSnapshot = {
  readonly partner: Partner
  readonly hygiene?: HygieneState
  readonly frozen: boolean
  readonly isSetOverride: boolean
}
export type HygieneMutation = {
  readonly hygiene: HygieneState
  readonly progression?: PartnerProgression
  readonly cleaned?: { readonly poopId: number; readonly createdAt: string }
}
export type PartnerHygieneStore = {
  /** Inspect and update the active partner atomically, including the cleaning reward. */
  updateHygiene: (change: (snapshot: HygieneSnapshot) => HygieneMutation | undefined) => PartnerHygiene | undefined
}
