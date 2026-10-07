import type { Field } from "../domain/world.ts"

export const FIELDS: readonly Field[] = Object.freeze([
  {
    id: "nature-spirits",
    name: "Nature Spirits",
    code: "NSp",
    description: "Wild beasts, insects, minerals, and primitive creatures.",
  },
  {
    id: "deep-savers",
    name: "Deep Savers",
    code: "DS",
    description: "Aquatic creatures of the oceans, depths, and ice.",
  },
  {
    id: "nightmare-soldiers",
    name: "Nightmare Soldiers",
    code: "NSo",
    description: "Ghosts, demons, undead creatures, and dark magic.",
  },
  {
    id: "wind-guardians",
    name: "Wind Guardians",
    code: "WG",
    description: "Birds and forest creatures of the woodland and sky.",
  },
  {
    id: "metal-empire",
    name: "Metal Empire",
    code: "ME",
    description: "Machines, cyborgs, factories, and industrial cities.",
  },
  {
    id: "virus-busters",
    name: "Virus Busters",
    code: "VB",
    description: "Sacred guardians and heroes who fight evil.",
  },
  {
    id: "dragons-roar",
    name: "Dragon's Roar",
    code: "DR",
    description: "Dragons, dinosaurs, and reptiles of the ancient world.",
  },
  {
    id: "jungle-troopers",
    name: "Jungle Troopers",
    code: "JT",
    description: "Plants, insects, and protectors of the jungle.",
  },
  { id: "dark-area", name: "Dark Area", code: "DA", description: "Demonic creatures dwelling in the darkest places." },
  {
    id: "unknown",
    name: "Unknown",
    code: "UK",
    description: "Mutants, anomalies, and creatures that defy classification.",
  },
])

// Future fields, intentionally outside the active catalog:
// Saiyu Warriors → Eastern Desert – Server Continent
// Toho Braves → Tonosama Gekomon's Castle
// Celestial Walker → Infinity Mountain
// Astral Sentinel → Vademon's Den
