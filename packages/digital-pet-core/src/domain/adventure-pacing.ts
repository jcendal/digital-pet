export type AdventureEncounterKind = "fragment" | "food" | "battle"

export const ADVENTURE_PACING = Object.freeze({
  quietMinMs: 45_000,
  quietMaxMs: 65_000,
  cooldownMinMs: 4 * 60 * 60 * 1000,
  cooldownMaxMs: 6 * 60 * 60 * 1000,
})

const between = (min: number, max: number, random: () => number): number =>
  Math.round(min + Math.max(0, Math.min(1, random())) * (max - min))

export const adventureQuietTime = (random: () => number): number =>
  between(ADVENTURE_PACING.quietMinMs, ADVENTURE_PACING.quietMaxMs, random)
export const adventureCooldown = (random: () => number): number =>
  between(ADVENTURE_PACING.cooldownMinMs, ADVENTURE_PACING.cooldownMaxMs, random)

/** Draw without replacement: every five encounters contain two fragments, one meal and two battles. */
export const drawAdventureEncounter = (remaining: readonly AdventureEncounterKind[], random: () => number) => {
  const bag: AdventureEncounterKind[] = remaining.length
    ? [...remaining]
    : ["battle", "battle", "food", "fragment", "fragment"]
  const index = Math.max(0, Math.min(bag.length - 1, Math.floor(random() * bag.length)))
  const kind = bag.splice(index, 1)[0]!
  return { kind, remaining: bag }
}
