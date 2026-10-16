import { NEUTRAL_COMBAT_STATS } from "../domain/combat.ts"
import type { DigimonCatalog, DigimonNode } from "../domain/digimon-node.ts"
import type { EvolutionRoute } from "../domain/evolution-options.ts"
import { isDigimonStage } from "../domain/stage.ts"
import corrections from "./catalog-corrections.json" with { type: "json" }
import { COMBAT_STATS } from "./combat-stats.ts"
import { EVOLUTION_ROUTES } from "./evolution-routes.ts"
import { REVIEWED_DIGIMON_DATA } from "./reviewed-digimon-data.ts"

export type { DigimonCatalog, DigimonNode } from "../domain/digimon-node.ts"

export type RawDigimonNode = {
  readonly id: string
  readonly name_en: string
  readonly name_jp: string
  readonly next_evolutions: readonly string[]
  readonly sprite: string
  readonly stage: number
  readonly url: string
}

const parseNode = (input: RawDigimonNode): DigimonNode => {
  if (!isDigimonStage(input.stage)) throw new Error(`Invalid stage ${input.stage} for ${input.id}`)

  return Object.freeze({
    id: input.id,
    nameEn: input.name_en,
    nameJp: input.name_jp,
    nextEvolutions: Object.freeze([...input.next_evolutions]),
    sprite: input.sprite,
    stage: input.stage,
    url: input.url,
    combatStats: COMBAT_STATS.get(input.id) ?? NEUTRAL_COMBAT_STATS,
  })
}

export const parseDigimonCatalog = (input: readonly RawDigimonNode[]): DigimonCatalog => {
  const nodes = input.map(parseNode)
  const byId = new Map<string, DigimonNode>()

  for (const node of nodes) {
    if (byId.has(node.id)) throw new Error(`Duplicate digimon id ${node.id}`)
    byId.set(node.id, node)
  }

  for (const node of nodes) {
    for (const targetId of node.nextEvolutions) {
      if (!byId.has(targetId)) throw new Error(`Invalid next_evolutions reference ${targetId} from ${node.id}`)
    }
  }

  return Object.freeze({ nodes: Object.freeze(nodes), byId })
}

// Retain historical connections for pending saves, while only referenced normal
// routes can be chosen for new experience evolutions.
const referencedData = REVIEWED_DIGIMON_DATA.map((node) => ({
  ...node,
  next_evolutions: [
    ...new Set([...node.next_evolutions, ...(EVOLUTION_ROUTES.get(node.id) ?? []).map((route) => route.targetId)]),
  ],
}))
const baseCatalog = parseDigimonCatalog(referencedData)
const nodes = baseCatalog.nodes.map((node) => {
  const referenced = (EVOLUTION_ROUTES.get(node.id) ?? []).map((route) => {
    const canonicalTargetId = (corrections.canonicalIds as Readonly<Record<string, string>>)[route.targetId]
    return canonicalTargetId ? Object.freeze({ ...route, canonicalTargetId }) : route
  })
  const known = new Set(referenced.map((route) => route.targetId))
  const legacy: EvolutionRoute[] = node.nextEvolutions
    .filter((id) => !known.has(id))
    .map((targetId) => ({
      targetId,
      kind: node.stage === 0 ? "normal" : "unverified",
      careMask: node.stage === 0 ? 15 : 0,
      sources: [],
    }))
  return Object.freeze({ ...node, evolutionRoutes: Object.freeze([...referenced, ...legacy]) })
})
export const DIGIMON_CATALOG: DigimonCatalog = Object.freeze({
  nodes: Object.freeze(nodes),
  byId: new Map(nodes.map((node) => [node.id, node])),
})

export const loadDigimonCatalog = async (): Promise<DigimonCatalog> => DIGIMON_CATALOG
