import type { DigimonNode } from "./digimon-node.ts"

export type EvolutionRoute = {
  readonly targetId: string
  readonly kind: "normal" | "jogress" | "special" | "unverified"
  readonly careMask: number
  readonly sources: readonly string[]
}

/** A care bit represents the number of unclean piles when the target is chosen. */
export const availableEvolutionTargets = (current: DigimonNode, uncleanPoops = 0): readonly string[] => {
  if (!Number.isInteger(uncleanPoops) || uncleanPoops < 0 || uncleanPoops > 3)
    throw new Error("Evolution care must be an integer from 0 to 3")
  if (!current.evolutionRoutes) return current.nextEvolutions
  return current.evolutionRoutes
    .filter((route) => route.kind === "normal" && (route.careMask & (1 << uncleanPoops)) !== 0)
    .map((route) => route.targetId)
}
