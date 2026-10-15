import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { eggNodeForOrigin, isEggFamilyId } from "@jcendal/digital-pet-core/data/egg-families.ts"
import { adventureBusy, parseAdventure } from "@jcendal/digital-pet-core/domain/adventure.ts"
import type { BossVictory } from "@jcendal/digital-pet-core/domain/boss-victory.ts"
import type { FoodState } from "@jcendal/digital-pet-core/domain/feeding.ts"
import { parseHygiene } from "@jcendal/digital-pet-core/domain/hygiene.ts"
import { isWorldVisit } from "@jcendal/digital-pet-fields/application/world.ts"
import { isRegionalBossId } from "@jcendal/digital-pet-fields/data/bosses.ts"
import { IntlModule } from "../../shared/i18n.ts"
import type { ExperienceLevel, LocalArchivedPartner, LocalPetState, LocalReservePartner } from "../pet/progress.ts"
import { partnerState } from "../pet/team.ts"

export const TRANSFER_VERSION = 4
export const MAX_TRANSFER_BYTES = 64 * 1024
export const MAX_BACKUP_BYTES = 4 * 1024 * 1024

export type PetTransfer = { readonly version: 4; readonly state: LocalPetState }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const validDate = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 32 && Number.isFinite(Date.parse(value))

const validNodeId = (value: unknown): value is string => typeof value === "string" && /^[0-7]-\d{3}$/.test(value)

const parseEvents = (value: unknown): LocalPetState["events"] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 256)
    throw new Error(IntlModule.translate("protocol.theReceivedSaveContainsAnInvalidHistory"))
  let previousTime = 0
  return value.map((event) => {
    if (!isRecord(event) || !validNodeId(event.currentNodeId) || !validDate(event.createdAt))
      throw new Error(IntlModule.translate("protocol.theReceivedSaveContainsAnInvalidHistory"))
    const timestamp = Date.parse(event.createdAt)
    if (timestamp < previousTime) throw new Error(IntlModule.translate("protocol.theReceivedSaveHasAnUnorderedHistory"))
    previousTime = timestamp
    return { currentNodeId: event.currentNodeId, createdAt: event.createdAt }
  })
}

export const parsePetTransfer = (input: unknown, maxBytes = MAX_TRANSFER_BYTES): PetTransfer => {
  if (
    !isRecord(input) ||
    (input.version !== 1 && input.version !== 2 && input.version !== 3 && input.version !== TRANSFER_VERSION) ||
    !isRecord(input.state)
  )
    throw new Error(IntlModule.translate("protocol.unsupportedSaveFormat"))
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > maxBytes)
    throw new Error(IntlModule.translate("protocol.theReceivedSaveIsTooLarge"))

  const state = input.state
  if (
    state.adventureReadyAt !== undefined &&
    (typeof state.adventureReadyAt !== "number" ||
      !Number.isSafeInteger(state.adventureReadyAt) ||
      state.adventureReadyAt < 0 ||
      state.adventureReadyAt > Date.now() + 24 * 60 * 60 * 1000)
  )
    throw new Error(IntlModule.translate("protocol.theReceivedSaveContainsInvalidPartnerData"))
  if (
    state.combatVictories !== undefined &&
    (!Number.isSafeInteger(state.combatVictories) ||
      typeof state.combatVictories !== "number" ||
      state.combatVictories < 0 ||
      state.combatVictories > 1_000_000)
  )
    throw new Error(IntlModule.translate("protocol.theReceivedSaveContainsInvalidPartnerData"))
  if (state.originEggId !== undefined && !isEggFamilyId(state.originEggId))
    throw new Error(IntlModule.translate("protocol.theReceivedSaveContainsInvalidPartnerData"))
  if (input.version === 1 && state.reserve !== undefined)
    throw new Error(IntlModule.translate("protocol.unsupportedSaveFormat"))
  if (
    typeof state.partnerId !== "string" ||
    state.partnerId.length < 1 ||
    state.partnerId.length > 100 ||
    !validDate(state.createdAt) ||
    !validNodeId(state.currentNodeId) ||
    !DIGIMON_CATALOG.byId.has(state.currentNodeId) ||
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
    throw new Error(IntlModule.translate("protocol.theReceivedSaveContainsInvalidPartnerData"))

  const events = parseEvents(state.events)
  if (events.at(-1)?.currentNodeId !== state.currentNodeId)
    throw new Error(IntlModule.translate("protocol.theReceivedSaveDoesNotMatchItsHistory"))

  if (
    state.experienceLevel !== undefined &&
    state.experienceLevel !== "low" &&
    state.experienceLevel !== "normal" &&
    state.experienceLevel !== "high"
  )
    throw new Error(IntlModule.translate("protocol.theReceivedSaveHasAnInvalidExperienceSetting"))
  if (state.worldVisit !== undefined && !isWorldVisit(state.worldVisit))
    throw new Error(IntlModule.translate("protocol.theReceivedSaveHasAnInvalidDestination"))
  let bossVictories: BossVictory[] | undefined
  if (state.bossVictories !== undefined) {
    if (!Array.isArray(state.bossVictories) || state.bossVictories.length > 64)
      throw new Error(IntlModule.translate("protocol.invalidBossVictories"))
    const seen = new Set<string>()
    bossVictories = state.bossVictories.map((victory) => {
      if (
        !isRecord(victory) ||
        typeof victory.regionId !== "string" ||
        !validNodeId(victory.nodeId) ||
        !isRegionalBossId(victory.regionId, victory.nodeId) ||
        !validDate(victory.defeatedAt)
      )
        throw new Error(IntlModule.translate("protocol.invalidBossVictories"))
      const key = `${victory.regionId}:${victory.nodeId}`
      if (seen.has(key)) throw new Error(IntlModule.translate("protocol.invalidBossVictories"))
      seen.add(key)
      return { regionId: victory.regionId, nodeId: victory.nodeId, defeatedAt: victory.defeatedAt }
    })
  }
  let pendingEvolution: LocalPetState["pendingEvolution"]
  if (state.pendingEvolution !== undefined) {
    const pending = state.pendingEvolution
    const node = DIGIMON_CATALOG.byId.get(state.currentNodeId)
    const current = node
      ? eggNodeForOrigin(node, typeof state.originEggId === "string" ? state.originEggId : undefined)
      : undefined
    if (
      !isRecord(pending) ||
      !current ||
      (pending.targetNodeId !== null &&
        (!validNodeId(pending.targetNodeId) || !current.nextEvolutions.includes(pending.targetNodeId))) ||
      typeof pending.readyAt !== "number" ||
      !Number.isSafeInteger(pending.readyAt) ||
      pending.readyAt < 0 ||
      pending.readyAt > Date.now() + 24 * 60 * 60 * 1000 ||
      state.isTerminal ||
      (current.stage === 0
        ? pending.opponentNodeId !== null || pending.targetNodeId === null
        : !validNodeId(pending.opponentNodeId) ||
          DIGIMON_CATALOG.byId.get(pending.opponentNodeId)?.stage !== current.stage)
    )
      throw new Error(IntlModule.translate("protocol.theReceivedSaveHasAnInvalidPendingEvolution"))
    pendingEvolution = {
      targetNodeId: pending.targetNodeId as string | null,
      opponentNodeId: pending.opponentNodeId as string | null,
      readyAt: pending.readyAt,
    }
  }
  let retiredPartners: LocalArchivedPartner[] | undefined
  let food: FoodState | undefined
  if (state.food !== undefined) {
    const value = state.food
    if (!isRecord(value) || DIGIMON_CATALOG.byId.get(state.currentNodeId)?.stage === 0)
      throw new Error(IntlModule.translate("protocol.theReceivedSaveHasInvalidFood"))
    if (value.kind === "available" && value.availableAt === undefined) food = { kind: "available" }
    else if (
      value.kind === "scheduled" &&
      typeof value.availableAt === "number" &&
      Number.isSafeInteger(value.availableAt) &&
      value.availableAt >= 0 &&
      value.availableAt <= Date.now() + 24 * 60 * 60 * 1000
    )
      food = { kind: "scheduled", availableAt: value.availableAt }
    else throw new Error(IntlModule.translate("protocol.theReceivedSaveHasInvalidFood"))
  }
  if (state.retiredPartners !== undefined) {
    if (!Array.isArray(state.retiredPartners) || state.retiredPartners.length > 128)
      throw new Error(IntlModule.translate("protocol.theReceivedSaveHasAnInvalidArchive"))
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
        throw new Error(IntlModule.translate("protocol.theReceivedSaveHasAnInvalidArchivedPartner"))
      return {
        partnerId: partner.partnerId,
        createdAt: partner.createdAt,
        retiredAt: partner.retiredAt,
        events: parseEvents(partner.events),
      }
    })
  }

  let reserve: LocalReservePartner | undefined
  if (
    state.teamRevision !== undefined &&
    (typeof state.teamRevision !== "number" || !Number.isSafeInteger(state.teamRevision) || state.teamRevision < 0)
  )
    throw new Error(IntlModule.translate("protocol.theReceivedSaveContainsInvalidPartnerData"))
  if (state.reserve !== undefined) {
    const value = state.reserve
    if (
      !isRecord(value) ||
      [
        "reserve",
        "retiredPartners",
        "bossVictories",
        "worldVisit",
        "experienceLevel",
        "teamRevision",
        "pendingEvolution",
      ].some((key) => value[key] !== undefined) ||
      typeof value.pausedAt !== "number" ||
      !Number.isSafeInteger(value.pausedAt) ||
      value.pausedAt < 0 ||
      value.pausedAt > Date.now() + 24 * 60 * 60 * 1000
    )
      throw new Error(IntlModule.translate("protocol.theReceivedSaveContainsInvalidPartnerData"))
    const parsed = parsePetTransfer({ version: 2, state: value }, maxBytes).state
    if (
      parsed.partnerId === state.partnerId ||
      parsed.lastTickAt > value.pausedAt ||
      Date.parse(parsed.createdAt) > value.pausedAt
    )
      throw new Error(IntlModule.translate("protocol.theReceivedSaveContainsInvalidPartnerData"))
    const adventure = value.adventure === undefined ? undefined : parseAdventure(value.adventure)
    if (
      value.adventure !== undefined &&
      (!adventure || adventureBusy(adventure) || adventure.nodeId !== parsed.currentNodeId)
    )
      throw new Error(IntlModule.translate("protocol.theReceivedSaveContainsInvalidPartnerData"))
    reserve = { ...partnerState(parsed), pausedAt: value.pausedAt, ...(adventure ? { adventure } : {}) }
  }
  const liveIds = new Set([state.partnerId, ...(reserve ? [reserve.partnerId] : [])])
  for (const retired of retiredPartners ?? []) {
    if (liveIds.has(retired.partnerId))
      throw new Error(IntlModule.translate("protocol.theReceivedSaveHasAnInvalidArchive"))
    liveIds.add(retired.partnerId)
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
      ...(state.combatVictories !== undefined ? { combatVictories: state.combatVictories as number } : {}),
      ...(state.adventureReadyAt !== undefined ? { adventureReadyAt: state.adventureReadyAt as number } : {}),
      ...(isEggFamilyId(state.originEggId) ? { originEggId: state.originEggId } : {}),
      ...(bossVictories ? { bossVictories } : {}),
      ...(pendingEvolution ? { pendingEvolution } : {}),
      ...(food ? { food } : {}),
      ...(state.hygiene !== undefined ? { hygiene: parseHygiene(state.hygiene) } : {}),
      ...(isWorldVisit(state.worldVisit)
        ? { worldVisit: { regionId: state.worldVisit.regionId, locationId: state.worldVisit.locationId } }
        : {}),
      ...(state.experienceLevel !== undefined ? { experienceLevel: state.experienceLevel as ExperienceLevel } : {}),
      ...(retiredPartners !== undefined ? { retiredPartners } : {}),
      ...(reserve ? { reserve } : {}),
      ...(state.teamRevision !== undefined ? { teamRevision: state.teamRevision as number } : {}),
    },
  }
}
