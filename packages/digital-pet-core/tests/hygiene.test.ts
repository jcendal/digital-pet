import { expect, test } from "bun:test"
import { advanceHygiene, cleanHygiene, cleaningExperience, hygieneMood, parseHygiene } from "../src/domain/hygiene.ts"

const HOUR = 3_600_000
test("piles arrive at 2, 10 and 26 hours, including while closed, and stop at three", () => {
  const start = advanceHygiene(undefined, false, 0)
  expect(advanceHygiene(undefined, true, 100 * HOUR)).toBeUndefined()
  expect(advanceHygiene(start, false, 2 * HOUR - 1)?.poops).toEqual([])
  expect(advanceHygiene(start, false, 2 * HOUR)?.poops).toEqual([2 * HOUR])
  expect(advanceHygiene(start, false, 10 * HOUR)?.poops).toEqual([2 * HOUR, 10 * HOUR])
  const full = advanceHygiene(start, false, 26 * HOUR)
  expect(full?.poops).toEqual([2 * HOUR, 10 * HOUR, 26 * HOUR])
  expect(full?.nextAt).toBeNull()
  expect(advanceHygiene(full, false, 500 * HOUR)).toBe(full)
})

test("cleaning is happy briefly, resumes the remaining-count schedule and cannot repeat a pile", () => {
  const full = advanceHygiene(advanceHygiene(undefined, false, 0), false, 26 * HOUR)
  if (!full) throw new Error("Missing hygiene")
  expect(hygieneMood(full, 26 * HOUR)).toBe("sad")
  const cleaned = cleanHygiene(full, 2 * HOUR, 27 * HOUR)
  expect(cleaned.nextAt).toBe(43 * HOUR)
  expect(hygieneMood(cleaned, 27 * HOUR)).toBe("happy")
  expect(hygieneMood(cleaned, 27 * HOUR + 3_000)).toBe("sad")
  expect(cleanHygiene(cleaned, 2 * HOUR, 28 * HOUR)).toBe(cleaned)
  const one = cleanHygiene(cleaned, 10 * HOUR, 28 * HOUR)
  expect(one.nextAt).toBe(36 * HOUR)
  expect(hygieneMood(one, 29 * HOUR)).toBe("neutral")
  const empty = cleanHygiene(one, 26 * HOUR, 29 * HOUR)
  expect(empty.nextAt).toBe(31 * HOUR)
  expect(cleaningExperience(30, 100)).toBe(35)
  expect(cleaningExperience(99, 100)).toBe(100)
  expect(parseHygiene(JSON.parse(JSON.stringify(cleaned)))).toEqual(cleaned)
})

test("invalid or duplicate piles cannot enter a save", () => {
  for (const poops of [[1, 1], [-1], ["1"], [1, 2, 3, 4], [2, 1]])
    expect(() => parseHygiene({ poops, nextAt: 100, happyUntil: 0 })).toThrow()
  expect(() => parseHygiene({ poops: [], nextAt: null, happyUntil: 0 })).toThrow()
})
