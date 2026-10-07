import { resolveWorldVisit, isWorldVisit } from "@jcendal/digital-pet-fields/application/world.ts"
import type { WorldVisit, WorldVisitStore } from "@jcendal/digital-pet-fields/domain/world.ts"
import { readLocalState, setWorldVisit } from "./browser-store.ts"
import type { SaveSource } from "./browser-source.ts"

export const COMPUTER_WORLD_KEY = "digital-pet:computer-world"

/** Computer travel is a web preference. Browser travel belongs to the transferable save. */
export const worldStoreFor = (source: SaveSource): WorldVisitStore => ({
  async load() {
    if (source === "browser") return resolveWorldVisit((await readLocalState()).worldVisit)
    try {
      return resolveWorldVisit(JSON.parse(localStorage.getItem(COMPUTER_WORLD_KEY) ?? "null"))
    } catch {
      return resolveWorldVisit(null)
    }
  },
  async save(visit: WorldVisit) {
    if (!isWorldVisit(visit)) throw new Error("Unknown destination")
    if (source === "browser") await setWorldVisit(visit)
    else localStorage.setItem(COMPUTER_WORLD_KEY, JSON.stringify(resolveWorldVisit(visit)))
  },
})
