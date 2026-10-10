export type FeedingPolicy = { readonly intervalMs: number; readonly experienceFraction: number }
export const FEEDING_POLICY: FeedingPolicy = Object.freeze({ intervalMs: 4 * 60 * 60 * 1000, experienceFraction: 0.25 })
export type FoodState = { readonly kind: "scheduled"; readonly availableAt: number } | { readonly kind: "available" }

export const scheduleFood = (now: number, policy = FEEDING_POLICY): FoodState => ({
  kind: "scheduled",
  availableAt: now + policy.intervalMs,
})

/** Available food has no clock. Missed intervals never accumulate more food. */
export const advanceFood = (
  food: FoodState | undefined,
  isEgg: boolean,
  now: number,
  policy = FEEDING_POLICY,
): FoodState | undefined => {
  if (isEgg) return undefined
  if (!food) return scheduleFood(now, policy)
  return food.kind === "scheduled" && now >= food.availableAt ? { kind: "available" } : food
}

export const feedingExperience = (gauge: number, threshold: number, policy = FEEDING_POLICY): number =>
  Math.min(threshold, gauge + Math.ceil(threshold * policy.experienceFraction))
