const HOUR = 60 * 60 * 1000
export const HYGIENE_INTERVALS_MS = [2 * HOUR, 8 * HOUR, 16 * HOUR] as const
export const CLEANING_EXPERIENCE_FRACTION = 0.05
export const CLEANING_HAPPY_MS = 3_000

export type PetMood = "neutral" | "sad" | "happy"
export type HygieneState = {
  readonly poops: readonly number[]
  readonly nextAt: number | null
  readonly happyUntil: number
}
export type HygieneView = {
  readonly partnerId: string
  readonly poops: readonly number[]
  readonly mood: PetMood
  readonly canClean: boolean
}

export const createHygiene = (now: number): HygieneState => ({
  poops: [],
  nextAt: now + HYGIENE_INTERVALS_MS[0],
  happyUntil: 0,
})

export const advanceHygiene = (
  state: HygieneState | undefined,
  isEgg: boolean,
  now: number,
): HygieneState | undefined => {
  if (isEgg) return undefined
  if (!state) return createHygiene(now)
  let nextAt = state.nextAt
  if (nextAt === null || now < nextAt) return state
  const poops = [...state.poops]
  while (nextAt !== null && now >= nextAt && poops.length < HYGIENE_INTERVALS_MS.length) {
    poops.push(nextAt)
    const interval = HYGIENE_INTERVALS_MS[poops.length]
    nextAt = interval === undefined ? null : nextAt + interval
  }
  return { ...state, poops, nextAt }
}

/** The timestamp identifies one pile, so stale/double clicks cannot clean it twice. */
export const cleanHygiene = (state: HygieneState, poopId: number, now: number): HygieneState => {
  if (!state.poops.includes(poopId)) return state
  const poops = state.poops.filter((id) => id !== poopId)
  return {
    poops,
    nextAt: now + (HYGIENE_INTERVALS_MS[poops.length] ?? HYGIENE_INTERVALS_MS[0]),
    happyUntil: now + CLEANING_HAPPY_MS,
  }
}

export const hygieneMood = (state: HygieneState | undefined, now: number): PetMood =>
  state && now < state.happyUntil ? "happy" : (state?.poops.length ?? 0) >= 2 ? "sad" : "neutral"

export const cleaningExperience = (gauge: number, threshold: number): number =>
  Math.min(threshold, gauge + Math.ceil(threshold * CLEANING_EXPERIENCE_FRACTION))

export const parseHygiene = (value: unknown): HygieneState => {
  if (typeof value !== "object" || value === null) throw new Error("Invalid hygiene state")
  const state = value as { poops?: unknown; nextAt?: unknown; happyUntil?: unknown }
  const time = (input: unknown): input is number =>
    typeof input === "number" && Number.isSafeInteger(input) && input >= 0
  if (!Array.isArray(state.poops)) throw new Error("Invalid hygiene state")
  const poops: unknown[] = state.poops
  if (
    !poops.every(time) ||
    state.poops.length > 3 ||
    new Set(state.poops).size !== state.poops.length ||
    !time(state.happyUntil) ||
    (state.poops.length === 3 ? state.nextAt !== null : !time(state.nextAt)) ||
    poops.some((id, index) => index > 0 && Number(id) <= Number(poops[index - 1]))
  )
    throw new Error("Invalid hygiene state")
  return { poops: [...state.poops], nextAt: state.nextAt as number | null, happyUntil: state.happyUntil }
}
