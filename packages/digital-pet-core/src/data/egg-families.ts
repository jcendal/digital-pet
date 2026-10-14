import type { DigimonNode } from "../domain/digimon-node.ts"

/** Authored game origins; saved catalog IDs remain the existing generic Digitama. */
export const EGG_FAMILIES = Object.freeze([
  { id: "starter", digitamaDesign: "Digitama 10", hatchIds: ["1-002"] },
  { id: "savannah", digitamaDesign: "Digitama 1", hatchIds: ["1-018"] },
  { id: "aquatic", digitamaDesign: "Digitama 4", hatchIds: ["1-016"] },
  { id: "forest", digitamaDesign: "Digitama 14", hatchIds: ["1-024"] },
  { id: "machine", digitamaDesign: "Digitama 20", hatchIds: ["1-004"] },
  { id: "dragon", digitamaDesign: "Digitama 8", hatchIds: ["1-015"] },
  { id: "jungle", digitamaDesign: "Digitama 43", hatchIds: ["1-014"] },
  { id: "nightmare", digitamaDesign: "Digitama 21", hatchIds: ["1-012"] },
  { id: "dark", digitamaDesign: "Digitama 9", hatchIds: ["1-009"] },
  { id: "mystery", digitamaDesign: "Digitama 23", hatchIds: ["1-011"] },
] as const)

export const isEggFamilyId = (id: unknown): id is (typeof EGG_FAMILIES)[number]["id"] =>
  EGG_FAMILIES.some((family) => family.id === id)

/** Legacy eggs without origin keep their original choices; new origins constrain hatching. */
export const eggNodeForOrigin = (node: DigimonNode, origin: string | undefined): DigimonNode => {
  const family = EGG_FAMILIES.find((family) => family.id === origin)
  if (node.stage !== 0 || !family) return node
  const { evolutionRoutes: _routes, ...egg } = node
  return { ...egg, nextEvolutions: family.hatchIds }
}
