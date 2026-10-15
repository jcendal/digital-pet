import type { EvolutionRoute } from "../domain/evolution-options.ts"
import reference from "./evolution-reference.json" with { type: "json" }

export const EVOLUTION_ROUTES = new Map<string, readonly EvolutionRoute[]>()
for (const [fromId, targetId, kind, careMask, sources] of reference.routes) {
  if (
    typeof fromId !== "string" ||
    typeof targetId !== "string" ||
    (kind !== "normal" && kind !== "jogress" && kind !== "special" && kind !== "unverified") ||
    typeof careMask !== "number" ||
    !Number.isInteger(careMask) ||
    careMask < 0 ||
    careMask > 15 ||
    !Array.isArray(sources) ||
    !sources.every((source) => typeof source === "string" && source in reference.sources)
  )
    throw new Error("Invalid referenced evolution route")
  const groups = (reference.requirements as Record<string, readonly (readonly (number | null)[])[]>)[
    `${fromId}:${targetId}`
  ]
  const conditions = groups?.map(([mask, min, max]) => {
    if (
      mask === null ||
      mask === undefined ||
      !Number.isInteger(mask) ||
      mask < 1 ||
      mask > 15 ||
      min === null ||
      min === undefined ||
      !Number.isSafeInteger(min) ||
      min < 0 ||
      (max !== null && (max === undefined || !Number.isSafeInteger(max) || max < min))
    )
      throw new Error("Invalid victory condition")
    return Object.freeze({ careMask: mask, minVictories: min, maxVictories: max ?? null })
  })
  EVOLUTION_ROUTES.set(
    fromId,
    Object.freeze([
      ...(EVOLUTION_ROUTES.get(fromId) ?? []),
      Object.freeze({
        targetId,
        kind,
        careMask,
        sources: Object.freeze([...sources]),
        ...(conditions ? { requirements: Object.freeze(conditions) } : {}),
      }),
    ]),
  )
}
