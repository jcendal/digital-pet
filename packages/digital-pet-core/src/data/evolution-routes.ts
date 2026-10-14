import type { EvolutionRoute } from "../domain/evolution-options.ts"
import reference from "./evolution-reference.json" with { type: "json" }

export const EVOLUTION_ROUTES = new Map<string, readonly EvolutionRoute[]>()
for (const [fromId, targetId, kind, careMask, sources] of reference.routes) {
  if (
    typeof fromId !== "string" ||
    typeof targetId !== "string" ||
    (kind !== "normal" && kind !== "jogress" && kind !== "special") ||
    typeof careMask !== "number" ||
    !Number.isInteger(careMask) ||
    careMask < 0 ||
    careMask > 15 ||
    !Array.isArray(sources) ||
    !sources.every((source) => typeof source === "string" && source in reference.sources)
  )
    throw new Error("Invalid referenced evolution route")
  EVOLUTION_ROUTES.set(
    fromId,
    Object.freeze([
      ...(EVOLUTION_ROUTES.get(fromId) ?? []),
      Object.freeze({ targetId, kind, careMask, sources: Object.freeze([...sources]) }),
    ]),
  )
}
