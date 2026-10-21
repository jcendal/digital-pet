import type { DigimonNode } from "./digimon-node.ts"

export type EvolutionRoute = {
  readonly targetId: string
  readonly canonicalTargetId?: string
  readonly kind: "normal" | "jogress" | "special" | "unverified"
  readonly careMask: number
  readonly sources: readonly string[]
  readonly requirements?: readonly {
    readonly careMask: number
    readonly minVictories: number
    readonly maxVictories: number | null
  }[]
}

/** A care bit represents the number of unclean piles when the target is chosen. */
export const availableEvolutionTargets = (
  current: DigimonNode,
  uncleanPoops = 0,
  combatVictories = 0,
): readonly string[] => {
  if (!Number.isInteger(uncleanPoops) || uncleanPoops < 0 || uncleanPoops > 3)
    throw new Error("Evolution care must be an integer from 0 to 3")
  if (!Number.isSafeInteger(combatVictories) || combatVictories < 0) throw new Error("Invalid combat victories")
  if (!current.evolutionRoutes) return current.nextEvolutions
  return [
    ...new Set(
      current.evolutionRoutes
        .filter(
          (route) =>
            route.kind === "normal" &&
            (route.requirements
              ? route.requirements.some(
                  (rule) =>
                    (rule.careMask & (1 << uncleanPoops)) !== 0 &&
                    combatVictories >= rule.minVictories &&
                    (rule.maxVictories === null || combatVictories <= rule.maxVictories),
                )
              : (route.careMask & (1 << uncleanPoops)) !== 0),
        )
        .map((route) => route.canonicalTargetId ?? route.targetId),
    ),
  ]
}
