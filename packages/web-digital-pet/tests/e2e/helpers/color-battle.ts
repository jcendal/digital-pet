import { defaultBattleScene } from "@jcendal/digital-pet-animation/sequences/evolution-battle-artwork.ts"
import { colorArtworkScene } from "@jcendal/digital-pet-animation/themes/color-scene.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { visualScenePaths } from "@jcendal/digital-pet-webviews/shared/visual-scene.ts"

/** Deterministic frames from the same scene data used by live battle playback. */
export const colorBattleFrames = ["4-070", "4-046", "4-002", "3-001"].flatMap((id) => {
  const node = DIGIMON_CATALOG.byId.get(id)
  if (!node) throw new Error(`Missing review monster ${id}`)
  return (["player", "opponent"] as const).flatMap((shooter) =>
    (["launch", "flight", "contact", "hit", "miss", "pause"] as const).map((phase) => {
      const snapshot = {
        kind: "battle" as const,
        player: node.sprite,
        opponent: node.sprite,
        width: 60,
        scene: defaultBattleScene({
          shooter: phase === "pause" ? null : shooter,
          progress: phase === "launch" ? 0 : phase === "flight" ? 0.5 : 1,
          lastResult: phase === "hit" || phase === "miss" ? phase : null,
          playerPose: phase === "hit" && shooter === "opponent" ? "injured" : "attack",
          opponentPose: phase === "hit" && shooter === "player" ? "injured" : "attack",
        }),
      }
      return {
        id,
        name: node.nameEn,
        shooter,
        phase,
        snapshot,
        expected: visualScenePaths(colorArtworkScene(snapshot, [id])),
      }
    }),
  )
})
