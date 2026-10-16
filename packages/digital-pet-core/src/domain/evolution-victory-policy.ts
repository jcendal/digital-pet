/** Authored game pacing; original device requirements remain in the reference snapshot. */
const VICTORY_MINIMUMS: ReadonlyMap<number, number> = new Map([
  [0, 0],
  [12, 3],
  [24, 5],
  [50, 7],
  [200, 10],
])

/** Adapt imported minimums once, before the shared rules reach gameplay or the Dex. */
export const adaptEvolutionVictoryMinimum = (minimum: number): number => VICTORY_MINIMUMS.get(minimum) ?? minimum
