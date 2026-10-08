export const FEEDING_POLICY = Object.freeze({ intervalMs: 4 * 60 * 60 * 1000, experienceFraction: 0.25 })
export type FoodState = { readonly kind: "scheduled"; readonly availableAt: number } | { readonly kind: "available" }

export const scheduleFood = (now: number): FoodState => ({
  kind: "scheduled",
  availableAt: now + FEEDING_POLICY.intervalMs,
})

/** Available food has no clock. Missed intervals never accumulate more food. */
export const advanceFood = (food: FoodState | undefined, isEgg: boolean, now: number): FoodState | undefined => {
  if (isEgg) return undefined
  if (!food) return scheduleFood(now)
  return food.kind === "scheduled" && now >= food.availableAt ? { kind: "available" } : food
}

export const feedingExperience = (gauge: number, threshold: number): number =>
  Math.min(threshold, gauge + Math.ceil(threshold * FEEDING_POLICY.experienceFraction))
