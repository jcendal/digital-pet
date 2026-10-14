import { ADVENTURE_POLICY, type AdventureState } from "@jcendal/digital-pet-core/domain/adventure.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/domain/digimon-node.ts"
import type { AdventureView } from "./webview-messages.ts"

export const adventureView = (
  available: boolean,
  state: AdventureState | undefined,
  catalog: DigimonCatalog,
  readyAt = 0,
): AdventureView => {
  const timing = { readyAt, lootLifetimeMs: ADVENTURE_POLICY.lootLifetimeMs }
  if (!state) return { available, ...timing }
  const { event, victories: _victories, ...travel } = state
  return {
    available,
    ...timing,
    state: {
      ...travel,
      ...(event
        ? {
            event:
              event.kind === "loot"
                ? event
                : event.kind === "offer"
                  ? { kind: "offer", id: event.id, opponentName: catalog.byId.get(event.opponentNodeId)?.nameEn ?? "" }
                  : {
                      kind: "battle",
                      id: event.id,
                      difficult: event.difficult,
                      boss: event.rank === "boss",
                      opponentName: catalog.byId.get(event.opponentNodeId)?.nameEn ?? "",
                    },
          }
        : {}),
    },
  }
}
