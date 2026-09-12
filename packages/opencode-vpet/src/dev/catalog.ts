export const OPENCODE_DEV_ACTIONS = [
  { id: "feed", title: "VPet Dev Feed", slashName: "vpet-dev-feed" },
  { id: "activity", title: "VPet Dev Activity", slashName: "vpet-dev-activity" },
  { id: "evolution_reveal", title: "VPet Dev Evolution Reveal", slashName: "vpet-dev-evolution-reveal" },
  { id: "evolution_battle", title: "VPet Dev Evolution Battle", slashName: "vpet-dev-evolution-battle" },
  { id: "defeat", title: "VPet Dev Defeat (via battle)", slashName: "vpet-dev-defeat" },
] as const

export type OpencodeDevActionId = (typeof OPENCODE_DEV_ACTIONS)[number]["id"]
