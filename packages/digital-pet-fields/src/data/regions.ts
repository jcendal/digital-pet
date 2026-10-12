import type { Region, WorldLocation } from "../domain/world.ts"
import { IntlModule } from "../i18n.ts"
import { HABITATS } from "./habitats.ts"

export const REGIONS: readonly Region[] = Object.freeze(
  [
    {
      id: "gear-savannah",
      get name() {
        return IntlModule.translate("regions.gearSavannah")
      },
      fieldId: "nature-spirits",
      defaultLocationId: "gear-savannah",
      get description() {
        return IntlModule.translate("regions.openGrasslandsRockyPathsAndTheDistantTurning")
      },
    },
    {
      // Keep the saved destination ID when replacing Digital Ocean with Coela Beach.
      id: "digital-ocean",
      get name() {
        return IntlModule.translate("regions.coelaBeach")
      },
      fieldId: "deep-savers",
      defaultLocationId: "digital-ocean",
      get description() {
        return IntlModule.translate("regions.coelaBeachDescription")
      },
    },
    {
      id: "wasteland",
      get name() {
        return IntlModule.translate("regions.wasteland")
      },
      fieldId: "nightmare-soldiers",
      defaultLocationId: "wasteland",
      get description() {
        return IntlModule.translate("regions.aSilentWastelandOfSpiralMountainWhereShadows")
      },
    },
    {
      id: "digital-forest",
      get name() {
        return IntlModule.translate("regions.digitalForest")
      },
      fieldId: "wind-guardians",
      defaultLocationId: "digital-forest",
      get description() {
        return IntlModule.translate("regions.theCanopyOfSpiralMountainOpensIntoA")
      },
    },
    {
      id: "digital-city",
      get name() {
        return IntlModule.translate("regions.digitalCity")
      },
      fieldId: "metal-empire",
      defaultLocationId: "digital-city",
      get description() {
        return IntlModule.translate("regions.metalTowersRestlessMachinesAndTheHumOf")
      },
    },
    {
      id: "village-of-beginnings",
      get name() {
        return IntlModule.translate("regions.villageOfBeginnings")
      },
      fieldId: "virus-busters",
      defaultLocationId: "village-of-beginnings",
      get description() {
        return IntlModule.translate("regions.aPeacefulHomeForFreshEggsWatchedOver")
      },
    },
    {
      id: "ancient-dino-region",
      get name() {
        return IntlModule.translate("regions.ancientDinoRegion")
      },
      fieldId: "dragons-roar",
      defaultLocationId: "ancient-dino-region",
      get description() {
        return IntlModule.translate("regions.ancientCliffsAndVolcanicRidgesEchoWithThe")
      },
    },
    {
      id: "tropical-jungle",
      get name() {
        return IntlModule.translate("regions.tropicalJungle")
      },
      fieldId: "jungle-troopers",
      defaultLocationId: "tropical-jungle",
      get description() {
        return IntlModule.translate("regions.aDenseJungleOfGiantLeavesTwistingRoots")
      },
    },
    {
      id: "vamdemon-castle",
      get name() {
        return IntlModule.translate("regions.vamdemonCastle")
      },
      fieldId: "dark-area",
      defaultLocationId: "vamdemon-castle",
      get description() {
        return IntlModule.translate("regions.gothicTowersRiseAboveADarkCourtyardTheir")
      },
    },
    {
      id: "upside-down-pyramid",
      get name() {
        return IntlModule.translate("regions.upsideDownPyramid")
      },
      fieldId: "unknown",
      defaultLocationId: "upside-down-pyramid",
      get description() {
        return IntlModule.translate("regions.anInvertedPyramidWhereTheLandscapeFollowsIts")
      },
    },
  ].map((region) =>
    Object.freeze({
      ...region,
      get name() {
        return region.name
      },
      get description() {
        return region.description
      },
      residentIds: Object.freeze([...HABITATS[region.fieldId as keyof typeof HABITATS]]),
    }),
  ) as Region[],
)

export const LOCATIONS: readonly WorldLocation[] = Object.freeze(
  [
    {
      id: "gear-savannah",
      get name() {
        return IntlModule.translate("regions.gearSavannah")
      },
      regionId: "gear-savannah",
      scene: "savannah",
      backgroundFile: "gear-savannah.png",
      atmosphere: ["#53624b", "#b2a26c"],
    },
    {
      id: "geko-swamp",
      get name() {
        return IntlModule.translate("regions.gekoSwamp")
      },
      regionId: "gear-savannah",
      scene: "swamp",
      backgroundFile: "geko-swamp.png",
      atmosphere: ["#354c36", "#728756"],
    },
    {
      id: "digital-ocean",
      get name() {
        return IntlModule.translate("regions.coelaBeach")
      },
      regionId: "digital-ocean",
      scene: "beach",
      backgroundFile: "coela-beach.png",
      atmosphere: ["#21445b", "#48a8ac"],
    },
    {
      id: "dragon-eye-lake",
      get name() {
        return IntlModule.translate("regions.dragonEyeLake")
      },
      regionId: "digital-ocean",
      scene: "lake",
      backgroundFile: "dragon-eye-lake.png",
      atmosphere: ["#21445b", "#48a8ac"],
    },
    {
      id: "wasteland",
      get name() {
        return IntlModule.translate("regions.wasteland")
      },
      regionId: "wasteland",
      scene: "wasteland",
      backgroundFile: "wasteland.png",
      atmosphere: ["#242437", "#5c526c"],
    },
    {
      id: "overdell-cemetery",
      get name() {
        return IntlModule.translate("regions.overdellCemetery")
      },
      regionId: "wasteland",
      scene: "cemetery",
      backgroundFile: "overdell-cemetery.png",
      atmosphere: ["#323344", "#69705d"],
    },
    {
      id: "digital-forest",
      get name() {
        return IntlModule.translate("regions.digitalForest")
      },
      regionId: "digital-forest",
      scene: "forest",
      backgroundFile: "digital-forest.png",
      atmosphere: ["#203f3e", "#639169"],
    },
    {
      id: "mount-panorama",
      get name() {
        return IntlModule.translate("regions.mountPanorama")
      },
      regionId: "digital-forest",
      scene: "panorama",
      backgroundFile: "mount-panorama.png",
      atmosphere: ["#4c6257", "#a0b485"],
    },
    {
      id: "digital-city",
      get name() {
        return IntlModule.translate("regions.digitalCity")
      },
      regionId: "digital-city",
      scene: "city",
      backgroundFile: "digital-city.png",
      atmosphere: ["#283742", "#718592"],
    },
    {
      id: "factorial-town",
      get name() {
        return IntlModule.translate("regions.factorialTown")
      },
      regionId: "digital-city",
      scene: "factory",
      backgroundFile: "factorial-town.png",
      atmosphere: ["#38434b", "#7e8a80"],
    },
    {
      id: "village-of-beginnings",
      get name() {
        return IntlModule.translate("regions.villageOfBeginnings")
      },
      regionId: "village-of-beginnings",
      scene: "village",
      backgroundFile: "village-of-beginnings.png",
      atmosphere: ["#60847a", "#c4b982"],
    },
    {
      id: "ice-sanctuary",
      get name() {
        return IntlModule.translate("regions.iceSanctuary")
      },
      regionId: "village-of-beginnings",
      scene: "ice",
      backgroundFile: "ice-sanctuary.png",
      atmosphere: ["#54727e", "#c2d5d4"],
    },
    {
      id: "ancient-dino-region",
      get name() {
        return IntlModule.translate("regions.ancientDinoRegion")
      },
      regionId: "ancient-dino-region",
      scene: "dino",
      backgroundFile: "ancient-dino-region.png",
      atmosphere: ["#59392d", "#af7847"],
    },
    {
      id: "great-canyon",
      get name() {
        return IntlModule.translate("regions.greatCanyon")
      },
      regionId: "ancient-dino-region",
      scene: "canyon",
      backgroundFile: "great-canyon.png",
      atmosphere: ["#654c3d", "#b99265"],
    },
    {
      id: "tropical-jungle",
      get name() {
        return IntlModule.translate("regions.tropicalJungle")
      },
      regionId: "tropical-jungle",
      scene: "jungle",
      backgroundFile: "tropical-jungle.png",
      atmosphere: ["#183c31", "#609541"],
    },
    {
      id: "mangrove-region",
      get name() {
        return IntlModule.translate("regions.mangroveRegion")
      },
      regionId: "tropical-jungle",
      scene: "mangrove",
      backgroundFile: "mangrove-region.png",
      atmosphere: ["#244e43", "#70956b"],
    },
    {
      id: "vamdemon-castle",
      get name() {
        return IntlModule.translate("regions.vamdemonCastle")
      },
      regionId: "vamdemon-castle",
      scene: "castle",
      backgroundFile: "vamdemon-castle.png",
      atmosphere: ["#211d35", "#57446a"],
    },
    {
      id: "dark-terminal",
      get name() {
        return IntlModule.translate("regions.darkTerminal")
      },
      regionId: "vamdemon-castle",
      scene: "terminal",
      backgroundFile: "dark-terminal.png",
      atmosphere: ["#252634", "#626074"],
    },
    {
      id: "upside-down-pyramid",
      get name() {
        return IntlModule.translate("regions.upsideDownPyramid")
      },
      regionId: "upside-down-pyramid",
      scene: "pyramid",
      backgroundFile: "upside-down-pyramid.png",
      atmosphere: ["#413457", "#ae8761"],
    },
    {
      id: "toy-mansion",
      get name() {
        return IntlModule.translate("regions.toyMansion")
      },
      regionId: "upside-down-pyramid",
      scene: "toys",
      backgroundFile: "toy-mansion.png",
      atmosphere: ["#686146", "#b7a97c"],
    },
  ].map((location) =>
    Object.freeze({
      ...location,
      get name() {
        return location.name
      },
      atmosphere: Object.freeze(location.atmosphere),
    }),
  ) as WorldLocation[],
)
