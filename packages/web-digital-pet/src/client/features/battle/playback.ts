import { runEvolutionBattleAnimation } from "@jcendal/digital-pet-animation/sequences/evolution-battle-artwork.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { battlePlanForOpponent } from "@jcendal/digital-pet-core/domain/peer-combat.ts"
import { battleNode } from "../../../domain/battle/protocol.ts"
import type { PendingBattle } from "../../../domain/battle/saved-battle.ts"
import { checkpointBattle, finishPendingBattle } from "../../persistence/pet-store.ts"

type PlaybackActions = {
  readonly checkpoint: () => Promise<void>
  readonly artwork: (text: string) => void
  readonly score: (text: string) => void
}

/** Playback consumes the saved attacks only. It never negotiates or awards experience. */
export const playSavedBattle = async (battle: PendingBattle, actions: PlaybackActions): Promise<string> => {
  const plan = battle.localSide === "player" ? battle.plan : battlePlanForOpponent(battle.plan)
  const local = battleNode((battle.localSide === "player" ? battle.challenger : battle.receiver).nodeId)
  const remote = battleNode((battle.localSide === "player" ? battle.receiver : battle.challenger).nodeId)
  await actions.checkpoint()
  await runEvolutionBattleAnimation(
    MONSTER_FRAME_CATALOG,
    local.sprite,
    remote.sprite,
    40,
    plan,
    async (artwork, hud) => {
      await actions.checkpoint()
      actions.artwork(artwork)
      if (hud) actions.score(`${local.nameEn} ${hud.playerHits} — ${hud.opponentHits} ${remote.nameEn}`)
    },
    {
      completedShots: battle.completedShots,
      onShotComplete: async (completedShots) => {
        await actions.checkpoint()
        if (!(await checkpointBattle(battle.battleId, completedShots)))
          throw new Error("The saved battle is no longer pending")
      },
    },
  )
  await actions.checkpoint()
  if (!(await finishPendingBattle(battle.battleId))) throw new Error("The saved battle is no longer pending")
  if (plan.outcome === "draw") return "Draw! No experience awarded."
  const winner = plan.outcome === "player" ? local : remote
  const reward = battle.rewarded
    ? " · +20% EXPERIENCE"
    : plan.outcome === "player"
      ? " · No experience added: this companion is at a final stage or its save changed."
      : ""
  return `${plan.outcome === "player" ? "You win" : "You lose"}! ${winner.nameEn} wins.${reward}`
}
