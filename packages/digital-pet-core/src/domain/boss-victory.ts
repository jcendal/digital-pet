/** Trainer-wide achievements survive companion replacement. They do not register ownership in the Dex. */
export type BossVictory = {
  readonly regionId: string
  readonly nodeId: string
  readonly defeatedAt: string
}
