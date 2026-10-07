import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import type { ResolvedDigitalPetSettings } from "@jcendal/digital-pet-core/config/types.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { DIGIMON_STAGES } from "@jcendal/digital-pet-core/domain/stage.ts"
import { getStageLabel } from "@jcendal/digital-pet-core/data/stages.ts"
import { buildDexViewModel } from "@jcendal/digital-pet-core/view-models/dex-view-model.ts"

import { artworkToPixelPath } from "../../shared/pixel-artwork.ts"

export type DexEntry = {
  readonly id: string
  readonly name: string
  readonly alternateName: string
  readonly stage: string
  readonly stageNumber: number
  readonly discovered: boolean
  readonly artwork: string
  readonly previousIds: readonly string[]
  readonly nextIds: readonly string[]
  readonly firstSeen: string | null
  readonly generations: number
  readonly url: string
}

export type DexPanelModel = {
  readonly entries: readonly DexEntry[]
  readonly stages: readonly { readonly value: number; readonly label: string }[]
  readonly discovered: number
  readonly status: "available" | "empty" | "unavailable"
  readonly message: string
}

export const buildDexPanelModel = (
  archive: DigitalPetArchiveResult,
  catalog: DigimonCatalog,
  settings: ResolvedDigitalPetSettings,
): DexPanelModel => {
  // Keep the full catalog browsable before the first partner is hatched or when storage is unavailable.
  const view = buildDexViewModel(
    archive.kind === "available" ? archive : { kind: "available", partners: [] },
    catalog,
    settings,
  )
  if (view.kind !== "available") throw new Error("Expected a complete Dex catalog")
  const previousIds = new Map<string, string[]>()
  for (const node of catalog.nodes) {
    for (const nextId of node.nextEvolutions) {
      const ids = previousIds.get(nextId) ?? []
      ids.push(node.id)
      previousIds.set(nextId, ids)
    }
  }
  const sightings = new Map<string, { firstSeen: string; partners: Set<string> }>()
  if (archive.kind === "available") {
    for (const partner of archive.partners) {
      for (const event of partner.events) {
        const seen = sightings.get(event.currentNodeId) ?? { firstSeen: event.createdAt, partners: new Set<string>() }
        if (event.createdAt < seen.firstSeen) seen.firstSeen = event.createdAt
        seen.partners.add(partner.partnerId)
        sightings.set(event.currentNodeId, seen)
      }
    }
  }
  return {
    status: archive.kind,
    message:
      archive.kind === "unavailable"
        ? archive.message
        : archive.kind === "empty"
          ? "Your archive is empty. Hatch a partner and evolve to register Digimon."
          : "Discoveries are shared with your OpenCode partner archive.",
    discovered: view.rows.filter((row) => row.discovered).length,
    stages: DIGIMON_STAGES.map((value) => ({
      value,
      label: getStageLabel(value, settings.stageLabels[settings.language]),
    })),
    entries: view.rows.map((row) => {
      const node = catalog.byId.get(row.id)
      if (node === undefined) throw new Error(`Missing Dex catalog entry: ${row.id}`)
      const seen = sightings.get(node.id)
      const frame = row.discovered ? MONSTER_FRAME_CATALOG.get(node.sprite, "walk_1") : undefined
      return {
        id: node.id,
        name: row.discovered ? row.name : "Unknown Digimon",
        alternateName: row.discovered ? (settings.language === "en" ? node.nameJp : node.nameEn) : "",
        stage: row.stage,
        stageNumber: node.stage,
        discovered: row.discovered,
        artwork: frame === undefined ? "" : artworkToPixelPath(frame.content),
        previousIds: row.discovered ? (previousIds.get(node.id) ?? []) : [],
        nextIds: row.discovered ? node.nextEvolutions : [],
        firstSeen: seen?.firstSeen ?? null,
        generations: seen?.partners.size ?? 0,
        url: row.discovered ? node.url : "",
      }
    }),
  }
}
