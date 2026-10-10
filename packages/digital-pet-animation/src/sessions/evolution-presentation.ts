import type { MonsterFrameCatalog } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { type BattleOutcome, planCombat } from "@jcendal/digital-pet-core/domain/combat.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/domain/digimon-node.ts"
import { assertEvolutionBranch } from "@jcendal/digital-pet-core/domain/evolution-battle.ts"
import { IntlModule } from "../i18n.ts"
import { runDefeatAnimation } from "../sequences/defeat-artwork.ts"
import { type BattleFrameListener, runEvolutionBattleAnimation } from "../sequences/evolution-battle-artwork.ts"
import { runEvolutionRevealSession } from "./evolution-reveal-session.ts"
import type { PresentationStateListener } from "./presentation-state.ts"

export type EvolutionPresentationDependencies = {
  readonly digimonCatalog: DigimonCatalog
  readonly frameCatalog: MonsterFrameCatalog
  readonly onArtwork: BattleFrameListener
  readonly onState?: PresentationStateListener
  readonly random?: () => number
}

/** Presentation has no storage dependency; each host commits the result after it completes. */
export const presentEvolution = async (
  fromNodeId: string,
  targetNodeId: string,
  opponentNodeId: string | null,
  width: number,
  dependencies: EvolutionPresentationDependencies,
): Promise<BattleOutcome> => {
  const player = dependencies.digimonCatalog.byId.get(fromNodeId)
  if (!player || !dependencies.digimonCatalog.byId.has(targetNodeId))
    throw new Error(IntlModule.translate("evolutionPresentation.unknownEvolutionParticipant"))
  assertEvolutionBranch(player, targetNodeId)
  let outcome: BattleOutcome = "player"
  if (opponentNodeId !== null) {
    const opponent = dependencies.digimonCatalog.byId.get(opponentNodeId)
    if (!opponent || opponent.stage !== player.stage)
      throw new Error(IntlModule.translate("evolutionPresentation.invalidEvolutionOpponent"))
    const plan = planCombat(player.combatStats, opponent.combatStats, dependencies.random)
    outcome = plan.outcome
    await dependencies.onState?.({ phase: "battle", fromNodeId, opponentNodeId })
    await runEvolutionBattleAnimation(
      dependencies.frameCatalog,
      player.sprite,
      opponent.sprite,
      width,
      plan,
      dependencies.onArtwork,
    )
  } else if (player.stage !== 0)
    throw new Error(IntlModule.translate("evolutionPresentation.onlyAnEggCanEvolveWithoutABattle"))

  if (outcome === "player") {
    await runEvolutionRevealSession({ fromNodeId, toNodeId: targetNodeId }, width, dependencies)
  } else if (outcome === "opponent") {
    await dependencies.onState?.({ phase: "defeated", fromNodeId })
    await runDefeatAnimation(dependencies.frameCatalog, player.sprite, width, dependencies.onArtwork)
  } else await dependencies.onState?.({ phase: "draw", fromNodeId })
  return outcome
}
