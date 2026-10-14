import type { HygieneState } from "./hygiene.ts"

/** Preserve pile identities and remaining care time; resting never creates new piles. */
export const resumePartnerHygiene = (state: HygieneState, pausedAt: number, now: number): HygieneState => ({
  ...state,
  nextAt: state.nextAt === null ? null : now + Math.max(0, state.nextAt - pausedAt),
  happyUntil: state.happyUntil <= pausedAt ? 0 : now + state.happyUntil - pausedAt,
})
