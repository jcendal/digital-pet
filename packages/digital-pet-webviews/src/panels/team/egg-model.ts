import { digitamaArtworkForOrigin } from "@jcendal/digital-pet-animation/render/digitama-artwork.ts"
import { EGG_FAMILIES } from "@jcendal/digital-pet-core/data/egg-families.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { getRegion } from "@jcendal/digital-pet-fields/application/world.ts"
import { REGIONAL_EGG_DISCOVERIES } from "@jcendal/digital-pet-fields/data/egg-discoveries.ts"
import { IntlModule } from "../../i18n.ts"
import { artworkToCenteredPixelArt } from "../../shared/pixel-artwork.ts"

export const buildEggCollectionModel = (unlockedIds: readonly string[]) => {
  const art = MONSTER_FRAME_CATALOG.get("egg", "walk_1")
  const pixel = artworkToCenteredPixelArt(art?.content ?? "")
  return EGG_FAMILIES.map((family) => {
    const region = getRegion(
      REGIONAL_EGG_DISCOVERIES.find((discovery) => discovery.familyId === family.id)?.regionId ??
        "village-of-beginnings",
    )
    const egg = digitamaArtworkForOrigin(family.id)
    return {
      id: family.id,
      name: IntlModule.translate("eggs.regionalName", { region: region.name }),
      hint: IntlModule.translate(family.id === "starter" ? "eggs.starterHint" : "eggs.regionalHint", {
        region: region.name,
      }),
      unlocked: unlockedIds.includes(family.id),
      artwork: egg?.path ?? pixel.path,
      viewBox: egg ? "-8 -8 32 32" : pixel.viewBox,
    }
  })
}
