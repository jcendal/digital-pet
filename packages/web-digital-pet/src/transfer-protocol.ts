import type { ExperienceLevel, LocalArchivedPartner, LocalPetState } from "./local-progress.ts"

export const TRANSFER_VERSION = 1
export const MAX_TRANSFER_BYTES = 64 * 1024

export type PetTransfer = { readonly version: 1; readonly state: LocalPetState }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const validDate = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 32 && Number.isFinite(Date.parse(value))

const validNodeId = (value: unknown): value is string => typeof value === "string" && /^[0-7]-\d{3}$/.test(value)

const parseEvents = (value: unknown): LocalPetState["events"] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 256)
    throw new Error("The received save contains an invalid history")
  let previousTime = 0
  return value.map((event) => {
    if (!isRecord(event) || !validNodeId(event.currentNodeId) || !validDate(event.createdAt))
      throw new Error("The received save contains an invalid history")
    const timestamp = Date.parse(event.createdAt)
    if (timestamp < previousTime) throw new Error("The received save has an unordered history")
    previousTime = timestamp
    return { currentNodeId: event.currentNodeId, createdAt: event.createdAt }
  })
}

export const parsePetTransfer = (input: unknown): PetTransfer => {
  if (!isRecord(input) || input.version !== TRANSFER_VERSION || !isRecord(input.state))
    throw new Error("Unsupported save format")
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > MAX_TRANSFER_BYTES)
    throw new Error("The received save is too large")

  const state = input.state
  if (
    typeof state.partnerId !== "string" ||
    state.partnerId.length < 1 ||
    state.partnerId.length > 100 ||
    !validDate(state.createdAt) ||
    !validNodeId(state.currentNodeId) ||
    typeof state.gauge !== "number" ||
    !Number.isSafeInteger(state.gauge) ||
    state.gauge < 0 ||
    state.gauge > 300_000_000 ||
    typeof state.isTerminal !== "boolean" ||
    typeof state.lastTickAt !== "number" ||
    !Number.isSafeInteger(state.lastTickAt) ||
    state.lastTickAt < 0 ||
    state.lastTickAt > Date.now() + 24 * 60 * 60 * 1000 ||
    !Array.isArray(state.events) ||
    state.events.length < 1 ||
    state.events.length > 256
  )
    throw new Error("The received save contains invalid partner data")

  const events = parseEvents(state.events)
  if (events.at(-1)?.currentNodeId !== state.currentNodeId)
    throw new Error("The received save does not match its history")

  if (
    state.experienceLevel !== undefined &&
    state.experienceLevel !== "low" &&
    state.experienceLevel !== "normal" &&
    state.experienceLevel !== "high"
  )
    throw new Error("The received save has an invalid experience setting")
  let retiredPartners: LocalArchivedPartner[] | undefined
  if (state.retiredPartners !== undefined) {
    if (!Array.isArray(state.retiredPartners) || state.retiredPartners.length > 128)
      throw new Error("The received save has an invalid archive")
    retiredPartners = state.retiredPartners.map((partner) => {
      if (
        !isRecord(partner) ||
        typeof partner.partnerId !== "string" ||
        partner.partnerId.length < 1 ||
        partner.partnerId.length > 100 ||
        !validDate(partner.createdAt) ||
        !validDate(partner.retiredAt) ||
        Date.parse(partner.retiredAt) < Date.parse(partner.createdAt)
      )
        throw new Error("The received save has an invalid archived partner")
      return {
        partnerId: partner.partnerId,
        createdAt: partner.createdAt,
        retiredAt: partner.retiredAt,
        events: parseEvents(partner.events),
      }
    })
  }

  return {
    version: TRANSFER_VERSION,
    state: {
      partnerId: state.partnerId as string,
      createdAt: state.createdAt as string,
      currentNodeId: state.currentNodeId as string,
      gauge: state.gauge as number,
      isTerminal: state.isTerminal as boolean,
      lastTickAt: state.lastTickAt as number,
      events,
      ...(state.experienceLevel !== undefined ? { experienceLevel: state.experienceLevel as ExperienceLevel } : {}),
      ...(retiredPartners !== undefined ? { retiredPartners } : {}),
    },
  }
}
