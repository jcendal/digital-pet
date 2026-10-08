import { expect, test } from "bun:test"
import { advanceFood, feedingExperience, FEEDING_POLICY, scheduleFood } from "../src/domain/feeding.ts"

test("food appears after four hours; available food has no date and cannot accumulate", () => {
  const scheduled = scheduleFood(1000)
  expect(scheduled).toEqual({ kind: "scheduled", availableAt: 1000 + FEEDING_POLICY.intervalMs })
  expect(advanceFood(scheduled, false, 1000 + FEEDING_POLICY.intervalMs - 1)).toBe(scheduled)
  const available = advanceFood(scheduled, false, 1000 + FEEDING_POLICY.intervalMs)
  expect(available).toEqual({ kind: "available" })
  expect(advanceFood(available, false, 1000 + 100 * FEEDING_POLICY.intervalMs)).toBe(available)
  expect(advanceFood(available, true, 1000)).toBeUndefined()
  expect(advanceFood(undefined, true, 1000)).toBeUndefined()
  expect(feedingExperience(20, 100)).toBe(45)
  expect(feedingExperience(90, 100)).toBe(100)
})
