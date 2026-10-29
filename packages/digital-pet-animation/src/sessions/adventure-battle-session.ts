import type { MonsterFrameCatalog } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import type { AdventureState } from "@jcendal/digital-pet-core/domain/adventure.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/domain/digimon-node.ts"
import { runAdventureBossIntro } from "../sequences/adventure-boss-intro.ts"
import { type BattleFrameListener, runEvolutionBattleAnimation } from "../sequences/evolution-battle-artwork.ts"
import type { PresentationStateListener } from "./presentation-state.ts"

class AdventureInterrupted extends Error {}

/** A saved plan/checkpoint is replayed by either host. Reward only after the outcome animation finishes. */
export const runAdventureBattleSession = async (
  adventure: AdventureState,
  width: number,
  ports: {
    readonly frames: MonsterFrameCatalog
    readonly catalog: DigimonCatalog
    readonly active: () => boolean
    readonly onState: PresentationStateListener
    readonly onFrame: BattleFrameListener
    readonly checkpoint: (eventId: number, completedShots: number) => Promise<boolean>
    readonly finish: (eventId: number) => Promise<void>
  },
): Promise<boolean> => {
  const event = adventure.event
  if (event?.kind !== "battle") return false
  const player = ports.catalog.byId.get(adventure.nodeId)
  const opponent = ports.catalog.byId.get(event.opponentNodeId)
  if (!player || !opponent) return false
  const checkActive = () => {
    if (!ports.active()) throw new AdventureInterrupted()
  }
  try {
    checkActive()
    if (event.rank === "boss" && event.completedShots === 0) {
      await ports.onState({ phase: "battle", fromNodeId: player.id, opponentNodeId: opponent.id, bossIntro: true })
      await runAdventureBossIntro(ports.frames, opponent.sprite, width, async (artwork, hud, visual) => {
        checkActive()
        await ports.onFrame(artwork, hud, visual)
      })
      checkActive()
    }
    await ports.onState({ phase: "battle", fromNodeId: player.id, opponentNodeId: opponent.id })
    await runEvolutionBattleAnimation(
      ports.frames,
      player.sprite,
      opponent.sprite,
      width,
      event.plan,
      async (artwork, hud, visual) => {
        checkActive()
        await ports.onFrame(artwork, hud, visual)
      },
      {
        completedShots: event.completedShots,
        onShotComplete: async (completedShots) => {
          checkActive()
          if (!(await ports.checkpoint(event.id, completedShots))) throw new AdventureInterrupted()
        },
      },
    )
    checkActive()
    await ports.finish(event.id)
    return true
  } catch (error) {
    if (!(error instanceof AdventureInterrupted)) throw error
    return false
  }
}
