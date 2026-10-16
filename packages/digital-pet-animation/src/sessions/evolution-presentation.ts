import type { MonsterFrameCatalog } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { type BattleOutcome, planCombat } from "@jcendal/digital-pet-core/domain/combat.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/domain/digimon-node.ts"
import { assertEvolutionBranch, isEvolutionBattleOpponent } from "@jcendal/digital-pet-core/domain/evolution-battle.ts"
import { IntlModule } from "../i18n.ts"
import { renderPositionedArtwork } from "../render/positioned-artwork.ts"
import { runDefeatAnimation } from "../sequences/defeat-artwork.ts"
import { type BattleFrameListener, runEvolutionBattleAnimation } from "../sequences/evolution-battle-artwork.ts"
import { sleep } from "../utils/sleep.ts"
import { runEvolutionRevealSession } from "./evolution-reveal-session.ts"
import type { PresentationStateListener } from "./presentation-state.ts"

export type EvolutionPresentationDependencies = {
  readonly digimonCatalog: DigimonCatalog
  readonly frameCatalog: MonsterFrameCatalog
  readonly onArtwork: BattleFrameListener
  readonly onState?: PresentationStateListener
  readonly random?: () => number
  readonly resolveTarget?: (outcome: BattleOutcome) => Promise<string | null | undefined>
}

/** Hosts resolve the committed outcome after combat and before the optional reveal. */
export const presentEvolution = async (
  fromNodeId: string,
  targetNodeId: string | null,
  opponentNodeId: string | null,
  width: number,
  dependencies: EvolutionPresentationDependencies,
): Promise<BattleOutcome> => {
  const player = dependencies.digimonCatalog.byId.get(fromNodeId)
  if (!player || (targetNodeId !== null && !dependencies.digimonCatalog.byId.has(targetNodeId)))
    throw new Error(IntlModule.translate("evolutionPresentation.unknownEvolutionParticipant"))
  if (targetNodeId !== null) assertEvolutionBranch(player, targetNodeId)
  let outcome: BattleOutcome = "player"
  if (opponentNodeId !== null) {
    const opponent = dependencies.digimonCatalog.byId.get(opponentNodeId)
    if (!opponent || !isEvolutionBattleOpponent(player, opponent))
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

  const resolvedTarget = dependencies.resolveTarget ? await dependencies.resolveTarget(outcome) : targetNodeId
  if (resolvedTarget === undefined) return outcome
  if (outcome === "player") {
    if (resolvedTarget) {
      assertEvolutionBranch(player, resolvedTarget)
      await runEvolutionRevealSession({ fromNodeId, toNodeId: resolvedTarget }, width, dependencies)
    } else {
      const frame = dependencies.frameCatalog.get(player.sprite, "walk_1")
      if (frame) await dependencies.onArtwork(renderPositionedArtwork({ kind: "frame", frame }, width))
      await dependencies.onState?.({ phase: "no_evolution", fromNodeId })
      await sleep(2500)
    }
  } else if (outcome === "opponent") {
    await dependencies.onState?.({ phase: "defeated", fromNodeId })
    await runDefeatAnimation(dependencies.frameCatalog, player.sprite, width, dependencies.onArtwork)
  } else await dependencies.onState?.({ phase: "draw", fromNodeId })
  return outcome
}
