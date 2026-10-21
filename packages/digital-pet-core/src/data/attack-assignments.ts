import reference from "./attack-assignments.json"

export type AttackAssignment = {
  readonly speciesId: string
  readonly module: string
  readonly set: string
  readonly index: number
  readonly device: string
  readonly target: string
  readonly evidence: string
  readonly source: string
}

/** Device-specific, reviewed assignments; absence deliberately keeps the legacy projectile. */
export const ATTACK_ASSIGNMENTS: ReadonlyMap<string, AttackAssignment> = new Map(Object.entries(reference.assignments))
