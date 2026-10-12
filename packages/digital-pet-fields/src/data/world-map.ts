/** Coordinates in the 160 × 176 LCD atlas; geography adapts File Island to our habitats. */
export const WORLD_MAP_SIZE = { width: 160, height: 176 } as const

/** Original zone markers; each opens the locations belonging to its habitat. */
export const WORLD_MAP_PLACES = [
  { locationId: "digital-city", x: 32, y: 40 },
  { locationId: "wasteland", x: 74, y: 26 },
  { locationId: "vamdemon-castle", x: 120, y: 40 },
  { locationId: "gear-savannah", x: 30, y: 75 },
  { locationId: "digital-forest", x: 76, y: 60 },
  { locationId: "upside-down-pyramid", x: 135, y: 82 },
  { locationId: "village-of-beginnings", x: 60, y: 96 },
  { locationId: "ancient-dino-region", x: 102, y: 103 },
  { locationId: "dragon-eye-lake", x: 34, y: 123 },
  { locationId: "tropical-jungle", x: 82, y: 140 },
  { locationId: "digital-ocean", x: 128, y: 144 },
] as const
