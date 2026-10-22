import {
  prepareExchangeArtwork,
  renderExchangeScene,
} from "@jcendal/digital-pet-animation/sequences/partner-exchange.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { getStageKey } from "@jcendal/digital-pet-core/data/stages.ts"
import { adventureBusy } from "@jcendal/digital-pet-core/domain/adventure.ts"
import { IntlModule as CoreIntl } from "@jcendal/digital-pet-core/i18n"
import { companionPortrait } from "@jcendal/digital-pet-webviews/shared/companion-portrait.ts"
import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import { exchangeArtwork, exchangePixelPath } from "@jcendal/digital-pet-webviews/shared/exchange-artwork.ts"
import { arenaEligible } from "../../../domain/battle/arena.ts"
import { socialActivity } from "../../../domain/social/activity.ts"
import { exchangeOffer } from "../../../domain/social/exchange.ts"
import {
  displayCode,
  normalizeCode,
  type Offer,
  pendingTrade,
  type Receipt,
  type SocialState,
  type Trade,
  validAlias,
  validCode,
} from "../../../domain/social/model.ts"
import { IntlModule } from "../../../shared/i18n.ts"
import { readArenaFighter, selectArenaFighter } from "../../persistence/arena-store.ts"
import { readAdventureState, readLocalState, readPendingBattle } from "../../persistence/pet-store.ts"
import {
  abortTrade,
  cancelInvitation,
  collectGift,
  readSocial,
  removeFriend,
  saveAlias,
  updateSocial,
} from "../../persistence/social-store.ts"
import { browserSaveSelected, refreshBrowserViews } from "../../platform/save-source.ts"
import type { BrowserPairingControls } from "../pairing/controller.ts"
import { SocialSession } from "./session.ts"

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const t = (key: string, args?: Record<string, string>) => IntlModule.translate(`social.${key}`, args)
const h = (key: string) => escapeHtml(t(key))
const action = (name: string, label: string, id = "", primary = false) =>
  `<button type="button" data-social-action="${name}" data-id="${escapeHtml(id)}" class="${primary ? "primary-action" : ""}">${h(label)}</button>`
const name = (id: string | null) => escapeHtml(DIGIMON_CATALOG.byId.get(id ?? "")?.nameEn ?? t("player"))
const stage = (id: string | null) => {
  const node = DIGIMON_CATALOG.byId.get(id ?? "")
  return node ? escapeHtml(CoreIntl.translate(`stages.${getStageKey(node.stage)}`)) : ""
}
const companionCard = (nodeId: string | null, label: string) =>
  `<div class="social-companion-card"><span class="social-eyebrow">${escapeHtml(label)}</span>${companionPortrait(nodeId)}<h3>${name(nodeId)}</h3><span class="social-eyebrow">${stage(nodeId)}</span></div>`
const matchup = (local: string | null, remote: string | null, trade = false) =>
  `<div class="social-matchup">${companionCard(local, t(trade ? "yourOffer" : "yourCompanion"))}<span class="social-matchup-direction" aria-hidden="true">${trade ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 5h12l-3-3m5 9H3l3 3"/></svg>' : "VS"}</span>${companionCard(remote, t(trade ? "theirOffer" : "theirCompanion"))}</div>`
const foodArtwork = `<svg class="social-food-art" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M7 1h2v4H7zM10 1h3v1h-1v1H9V2h1zM3 4h3v1h4V4h3v1h1v2h1v5h-1v2h-2v1H9v-1H7v1H4v-1H2v-2H1V7h1V5h1z"/><path fill="var(--lcd)" d="M3 6h3v1h4V6h3v1h1v5h-1v1h-2v1H9v-1H7v1H5v-1H3v-1H2V7h1z"/><path fill="currentColor" d="M4 8h1v3H4zM5 7h2v1H5zM11 11h2v1h-2z"/></svg>`
const person = (alias: string, _nodeId: string | null, code: string) =>
  `<div class="social-dialog-person"><h3>${escapeHtml(alias)}</h3><p class="social-code">${displayCode(code)}</p></div>`
const navigate = (view: string) =>
  window.dispatchEvent(new CustomEvent("digital-pet:navigate", { detail: `/#${view}` }))

export const initBrowserSocial = async (otherBusy: () => boolean): Promise<BrowserPairingControls> => {
  let state: SocialState = await readSocial()
  let activeTrade: Trade | undefined
  let dialogOffers: { slot: Offer["slot"]; offer: Offer }[] = []
  let reviewedOffer: { code: string; incomingId: string | undefined; offer: Offer } | undefined
  let rendering = false
  let queued = false
  let invitation: { code: string; alias: string } | undefined
  let dialogRevision = 0
  let running = false
  let animation: number | undefined
  let noticeTimer: number | undefined
  const dialog = el<HTMLDialogElement>("social-dialog")
  const playback = el<HTMLDialogElement>("social-playback")
  const note = (message: string) => {
    window.clearTimeout(noticeTimer)
    el("social-status").textContent = message
    if (message)
      noticeTimer = window.setTimeout(() => {
        el("social-status").textContent = ""
      }, 4500)
  }
  const error = (value: unknown) => {
    const key = value instanceof Error ? value.message : "social.invalid"
    const message = key.startsWith("social.") ? IntlModule.translate(key) : t("invalid")
    note(message)
    el("social-add-status").textContent = message
    if (dialog.open) el("social-dialog-status").textContent = message
  }
  const engine = new SocialSession(
    () => {
      void render().catch(error)
    },
    error,
    otherBusy,
  )
  const modal = (title: string, body: string, context = "") => {
    dialogRevision++
    el("social-dialog-title").textContent = title
    el("social-dialog-body").innerHTML = body
    el("social-dialog-status").textContent = ""
    el("social-dialog-context").textContent = context
    el("social-dialog-context").hidden = !context
    dialog.scrollTop = 0
    if (!dialog.open) dialog.showModal()
  }
  const run = (task: () => Promise<void>) => {
    if (running) return
    running = true
    void task()
      .catch(error)
      .finally(() => {
        running = false
        void render().catch(error)
      })
  }
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      note(t("copied"))
    } catch {
      note(t("copyFailed"))
    }
  }
  const ensureProfile = () => {
    if (state.profile) return true
    navigate("profile")
    note(t("chooseAlias"))
    return false
  }
  const openInvite = (code: string, alias: string) => {
    invitation = { code, alias }
    modal(
      t("invitedBy", { alias: alias || t("player") }),
      `<div class="social-invitation-hero">${companionPortrait(null)}<h3>${escapeHtml(alias || t("player"))}</h3><p class="social-code">${displayCode(code)}</p></div><p class="social-hint">${h("inviteHint")}</p><div class="social-dialog-actions">${code === engine.code ? `<p>${h("self")}</p>` : action("invite", "tryRequest", code, true)}${action("close", "later")}</div>`,
      t("inviteContext"),
    )
  }
  const invite = async (code: string) => {
    if (!ensureProfile()) {
      dialog.close()
      return
    }
    if (!validCode(code)) throw new Error("social.invalid")
    if (code === engine.code) throw new Error("social.self")
    await engine.sendEvent(code, { kind: "invite" }, invitation?.code === code ? invitation.alias : undefined)
    dialog.close()
    invitation = undefined
    navigate("activity")
  }
  const activityItem = (r: Receipt, outgoing = false) => {
    const out = state.outbox[r.id]
    const delivery = out?.delivery
    const label = outgoing
      ? delivery === "delivered"
        ? "delivered"
        : delivery === "sending"
          ? "connecting"
          : "unavailable"
      : "received"
    const minutes = Math.max(0, Math.floor((Date.now() - r.createdAt) / 60000))
    const relative = new Intl.RelativeTimeFormat(IntlModule.locale, { numeric: "auto" }).format(
      minutes < 60 ? -minutes : minutes < 1440 ? -Math.floor(minutes / 60) : -Math.floor(minutes / 1440),
      minutes < 60 ? "minute" : minutes < 1440 ? "hour" : "day",
    )
    const title =
      !outgoing && r.event.kind === "gift"
        ? t("giftFrom", { alias: r.profile.alias })
        : !outgoing && r.event.kind === "trade-offer"
          ? t("proposalFrom", { alias: r.profile.alias })
          : r.profile.alias
    let body = `<span class="social-eyebrow" role="status">${h(label)}${outgoing ? "" : ` · ${escapeHtml(relative)}`}</span><h3>${escapeHtml(title)}</h3>`
    let buttons = ""
    if (r.event.kind === "invite") {
      body += `<p class="social-code">${displayCode(r.code)}</p>`
      if (outgoing) {
        if (delivery === "delivered") body += `<p class="social-hint">${h("deliveredHint")}</p>`
        if (delivery === "sending") body += `<p class="social-hint">${h("connectingHint")}</p>`
        buttons =
          (delivery === "unavailable" ? action("retry", "retry", r.id, true) : "") +
          action("cancel-outgoing", "cancel", r.id)
      } else {
        body += `<p class="social-hint">${h("receivedHint")}</p>`
        buttons = action("accept", "accept", r.id, true) + action("decline", "decline", r.id)
      }
    } else if (r.event.kind === "gift") {
      body += `<p>${h("ration")}</p><p class="social-hint">${h(outgoing ? "connectionHint" : "giftReceived")}</p>`
      buttons = outgoing ? action("retry", "retry", r.id) : action("collect", "collect", r.id)
    } else if (r.event.kind === "challenge")
      buttons = action("accept-challenge", "challenge", r.id, true) + action("dismiss", "decline", r.id)
    else if (r.event.kind === "trade-offer") {
      body += `<p class="social-hint">${escapeHtml(t(outgoing ? "offeredCompanion" : "tradeReceived", { name: DIGIMON_CATALOG.byId.get(r.event.offer.partner.currentNodeId)?.nameEn ?? t("yourCompanion") }))}</p>`
      buttons = outgoing
        ? action("cancel-trade", "cancel", r.id)
        : action("review-trade", "review", r.id, true) + action("decline-trade", "decline", r.id)
    } else if (r.event.kind === "trade-ready")
      buttons = action("confirm-review", "review", r.id, true) + action("decline-ready", "decline", r.id)
    else if (r.event.kind === "decision") body += `<p class="social-hint">${h("waiting")}</p>`
    return `<article class="social-item" data-receipt="${r.id}">${body}<div class="social-actions">${buttons}</div></article>`
  }
  const render = async (): Promise<void> => {
    if (rendering) {
      queued = true
      return
    }
    rendering = true
    try {
      state = await readSocial()
      activeTrade = pendingTrade(state)
      for (const out of Array.from(document.querySelectorAll<HTMLElement>(".social-own-code")))
        out.textContent = displayCode(engine.code)
      const field = el<HTMLInputElement>("social-alias")
      if (document.activeElement !== field) field.value = state.profile?.alias ?? ""
      const friends = Object.values(state.friends)
      const pet = await readLocalState()
      const fighter = await readArenaFighter(pet)
      const online = engine.online
      const usable = browserSaveSelected() && Boolean(state.profile) && !activeTrade && !otherBusy()
      const node = DIGIMON_CATALOG.byId.get(fighter.currentNodeId)
      const fighterPartner = pet.reserve?.partnerId === fighter.partnerId ? pet.reserve : pet
      const battleReady =
        usable && arenaEligible(fighterPartner) && engine.ready && !engine.otherTab && !engine.conflict
      el("social-arena-status").textContent =
        `■ ${t(!state.profile ? "chooseAlias" : !browserSaveSelected() ? "browserOnly" : battleReady ? "online" : !node?.stage ? "hatchFirst" : activeTrade || otherBusy() ? "occupied" : "offline")}`
      el("social-current").innerHTML =
        `${companionPortrait(fighter.currentNodeId)}<h3>${name(fighter.currentNodeId)}</h3><span class="social-eyebrow">${stage(fighter.currentNodeId)} · ${h("arenaFighter")}</span>`
      el("social-profile-companion").innerHTML =
        `${companionPortrait(pet.currentNodeId)}<span class="social-eyebrow">${h("yourCompanion")} · ${name(pet.currentNodeId)}</span>`
      el("social-own-alias").textContent = state.profile?.alias ?? t("player")
      el("social-friend-count").textContent = String(friends.length).padStart(2, "0")
      el("social-friend-list").innerHTML = friends.length
        ? friends
            .map((f) => {
              const available = online.has(f.code) && f.confirmed && usable
              const gifted = state.giftDays[f.code] === new Date().toISOString().slice(0, 10)
              return `<article class="social-friend"><div class="social-row"><div class="social-person"><button class="social-avatar-button" type="button" data-social-action="companion" data-id="${f.code}" aria-label="${escapeHtml(t("inspectCompanion", { alias: f.profile.alias }))}">${companionPortrait(f.profile.nodeId)}</button><div><h3>${escapeHtml(f.profile.alias)}</h3><p class="social-code">${displayCode(f.code)}</p></div></div><button class="social-remove" type="button" data-social-action="remove" data-id="${f.code}" aria-label="${escapeHtml(t("removeAlias", { alias: f.profile.alias }))}">×</button></div><div class="social-presence"><span>${online.has(f.code) ? "■" : "□"} ${h(online.has(f.code) ? "online" : "offline")}</span><span>${name(f.profile.nodeId)} · ${stage(f.profile.nodeId)}</span></div><div class="social-actions">${["challenge", "gift", "exchange"].map((k) => `<button type="button" class="${k === "challenge" ? "primary-action" : ""}" data-social-action="${k}" data-id="${f.code}" ${!available || (k === "challenge" && !battleReady) || (k === "gift" && gifted) ? "disabled" : ""}>${h(k === "gift" && gifted ? "sent" : k)}${k === "gift" && gifted ? " ✓" : ""}</button>`).join("")}</div></article>`
            })
            .join("")
        : `<p class="social-hint">${h("noFriends")}</p>`
      const onlineFriends = friends.filter((f) => online.has(f.code) && f.confirmed)
      el("social-arena-friends").innerHTML =
        `<div class="social-heading"><h2>${h("challengeFriend")}</h2><span class="social-eyebrow">${escapeHtml(t("onlineCount", { count: String(onlineFriends.length) }))}</span></div>` +
        (onlineFriends.length
          ? onlineFriends
              .map(
                (f) =>
                  `<div class="social-arena-friend social-row"><div><h3>${escapeHtml(f.profile.alias)}</h3><span class="social-eyebrow">${name(f.profile.arenaNodeId ?? f.profile.nodeId)} · ${stage(f.profile.arenaNodeId ?? f.profile.nodeId)}</span></div><button type="button" class="primary-action social-small-button" data-social-action="challenge" data-id="${f.code}" ${battleReady ? "" : "disabled"}>${h("challenge")}</button></div>`,
              )
              .join("")
          : `<p class="social-hint">${h("noOnlineFriends")}</p>`)
      const { incoming, outgoing, count } = socialActivity(state)
      const groups = [
        { key: "requests", kinds: ["invite", "decision"] },
        { key: "gifts", kinds: ["gift"] },
        { key: "trades", kinds: ["trade-offer", "trade-ready"] },
        { key: "challenges", kinds: ["challenge"] },
      ]
      el("social-inbox").innerHTML = groups
        .map((g) => {
          const ins = incoming.filter((r) => g.kinds.includes(r.event.kind))
          const outs = outgoing.filter((r) => g.kinds.includes(r.event.kind))
          const trade = g.key === "trades" ? activeTrade : undefined
          const groupCount = ins.length + outs.length + (trade ? 1 : 0)
          const recovery = trade
            ? `<article class="social-item" data-pending-trade="${escapeHtml(trade.id)}"><h3>${escapeHtml(t("proposalFrom", { alias: state.friends[trade.code]?.profile.alias ?? t("player") }))}</h3><p class="social-hint">${h(online.has(trade.code) ? "waitingTrade" : "reconnectTrade")}</p><div class="social-actions">${action("reconnect", "retry", trade.code)}${!trade.coordinator && trade.phase === "prepared" ? action("abort-pending", "cancel", trade.id) : ""}</div></article>`
            : ""
          return `<section class="social-group" data-social-group="${g.key}"><div class="social-heading"><h3>${h(g.key)}</h3><span class="social-eyebrow">${String(groupCount).padStart(2, "0")}</span></div>${ins.map((r) => activityItem(r)).join("")}${outs.map((r) => activityItem(r, true)).join("")}${recovery}${groupCount ? "" : `<p class="social-hint">${h(`empty${g.key[0]?.toUpperCase()}${g.key.slice(1)}`)}</p>`}</section>`
        })
        .join("")
      el("social-count").textContent = String(count)
      el("social-total").textContent = t("pendingTotal", { count: String(count).padStart(2, "0") })
      for (const button of Array.from(dialog.querySelectorAll<HTMLButtonElement>("[data-requires-online]"))) {
        button.disabled = !online.has(button.dataset.requiresOnline ?? "")
        if (button.dataset.onlineLabel)
          button.textContent = t(button.disabled ? "waitingConnection" : button.dataset.onlineLabel)
      }
      const waiting = dialog.querySelector<HTMLElement>(".social-review-availability")
      if (waiting) waiting.hidden = online.has(waiting.dataset.code ?? "")
      el("social-log").innerHTML =
        state.log
          .map(
            (row) =>
              `<div class="social-log-row">${h(row.kind)}<span class="social-eyebrow">${escapeHtml(row.alias)} · ${new Date(row.at).toLocaleTimeString(IntlModule.locale, { hour: "2-digit", minute: "2-digit" })}</span></div>`,
          )
          .join("") || `<p class="social-hint">${h("noLog")}</p>`
      const networkStatus = el("social-network-status")
      networkStatus.hidden = !engine.otherTab && !engine.conflict
      networkStatus.textContent = engine.otherTab ? t("anotherTab") : engine.conflict ? t("codeConflict") : ""
      if (!browserSaveSelected()) note(t("browserOnly"))
      else if (el("social-status").textContent === t("browserOnly")) note("")
      const unplayed = Object.values(state.trades).find((trade) => trade.phase === "resolved" && !trade.played)
      if (unplayed && !playback.open && browserSaveSelected()) play(unplayed)
    } finally {
      rendering = false
      if (queued) {
        queued = false
        void render().catch(error)
      }
    }
  }
  const play = (trade: Trade) => {
    for (const open of Array.from(document.querySelectorAll<HTMLDialogElement>(".web-dialog[open]"))) open.close()
    const local = DIGIMON_CATALOG.byId.get(trade.local.partner.currentNodeId)
    const remote = DIGIMON_CATALOG.byId.get(trade.remote.partner.currentNodeId)
    const art = prepareExchangeArtwork(MONSTER_FRAME_CATALOG, local?.sprite ?? "", remote?.sprite ?? "")
    const friend = state.friends[trade.code]?.profile.alias ?? t("player")
    el("social-playback-title").textContent = t("exchangeTitle")
    el("social-exchange-scene").innerHTML =
      `<div class="social-exchange-participants"><div><span class="social-eyebrow">${h("yourOffer")}</span><strong>${name(trade.local.partner.currentNodeId)}</strong><span class="social-eyebrow">${escapeHtml(state.profile?.alias ?? t("player"))}</span></div><svg class="social-exchange-direction" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 5h12l-3-3m5 9H3l3 3"/></svg><div><span class="social-eyebrow">${h("theirOffer")}</span><strong>${name(trade.remote.partner.currentNodeId)}</strong><span class="social-eyebrow">${escapeHtml(friend)}</span></div></div>${exchangeArtwork}<div class="social-exchange-welcome" aria-hidden="true"><h3>${escapeHtml(t("welcome", { name: remote?.nameEn ?? t("yourCompanion") }))}</h3><p>${escapeHtml(t("receivedFrom", { alias: friend }))}</p></div>`
    const result = el("social-exchange-result")
    result.hidden = true
    el("social-exchange-scene").dataset.revealed = "false"
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    let elapsed = 0
    let previous = performance.now()
    let lastPhase = ""
    const draw = () => {
      const frame = renderExchangeScene(art, elapsed, reduced)
      const scene = el("social-exchange-scene")
      scene.dataset.phase = frame.phase
      scene.dataset.revealed = String(frame.revealed)
      scene.querySelector(".social-exchange-welcome")?.setAttribute("aria-hidden", String(!frame.revealed))
      for (const layer of ["outgoing", "incoming", "trail", "sparks"] as const)
        el(`social-exchange-${layer}`).setAttribute("d", exchangePixelPath(frame[layer]))
      const phase = elapsed < 700 && !reduced ? "exchangeTitle" : frame.phase
      if (phase !== lastPhase) {
        el("social-exchange-status").textContent = t(phase)
        lastPhase = phase
      }
      return frame
    }
    draw()
    playback.showModal()
    const tick = (now: number) => {
      // Pause while backgrounded; returning to the scene must not skip its arrival.
      if (!document.hidden) elapsed += Math.min(80, Math.max(0, now - previous))
      previous = now
      const frame = draw()
      if (frame.phase !== "complete") animation = requestAnimationFrame(tick)
      else {
        animation = undefined
        result.hidden = false
        void updateSocial((s) => {
          const saved = s.trades[trade.id]
          if (saved) saved.played = true
        }).catch(error)
        refreshBrowserViews()
      }
    }
    animation = requestAnimationFrame(tick)
  }
  const offerOptions = async () => {
    const pet = await readLocalState()
    const busy =
      otherBusy() ||
      Boolean(activeTrade || pet.pendingEvolution || pet.reserve?.pendingEvolution || (await readPendingBattle())) ||
      adventureBusy(await readAdventureState())
    return (["principal", "reserve"] as const).flatMap((slot) => {
      try {
        const offer = exchangeOffer(pet, slot, busy)
        return [{ slot, offer }]
      } catch {
        return []
      }
    })
  }
  const tradeReview = (
    code: string,
    local: Offer,
    remote: Offer | undefined,
    confirmAction: string,
    id: string,
    changeAction: string,
  ) => {
    const f = state.friends[code]
    if (!f) throw new Error("social.notFriend")
    const localId = local.partner.currentNodeId
    const remoteId = remote?.partner.currentNodeId
    const online = engine.online.has(code)
    const confirmation = action(
      confirmAction,
      online ? (remote ? "confirmExchange" : "offer") : "waitingConnection",
      id,
      true,
    ).replace(
      'type="button"',
      `type="button" data-requires-online="${code}" data-online-label="${remote ? "confirmExchange" : "offer"}" ${online ? "" : "disabled"}`,
    )
    modal(
      t("reviewExchange"),
      `${person(f.profile.alias, f.profile.nodeId, code)}${remote ? matchup(localId, remoteId ?? null, true) : `<div class="social-proposal-preview">${companionCard(localId, t("yourOffer"))}<p class="social-hint">${h("awaitOtherOffer")}</p></div>`}<div class="social-history-note"><p>■ ${escapeHtml(t("historySent", { name: DIGIMON_CATALOG.byId.get(localId)?.nameEn ?? t("yourCompanion"), alias: f.profile.alias }))}</p>${remoteId ? `<p>■ ${escapeHtml(t("historyReceived", { name: DIGIMON_CATALOG.byId.get(remoteId)?.nameEn ?? t("yourCompanion"), alias: f.profile.alias }))}</p>` : ""}<p>${h("historyPreserved")}</p></div>${remoteId ? `<div class="social-confirmation-lines"><p>✓ ${escapeHtml(t(confirmAction === "confirm-trade" ? "friendConfirmed" : "friendChosen", { alias: f.profile.alias, name: DIGIMON_CATALOG.byId.get(remoteId)?.nameEn ?? t("yourCompanion") }))}</p><p>□ ${h(confirmAction === "confirm-trade" ? "yourConfirmationPending" : "bothConfirmationPending")}</p></div>` : `<p class="social-hint">${h("proposalOnly")}</p>`}<p class="social-hint social-review-availability" data-code="${code}" ${engine.online.has(code) ? "hidden" : ""}>${h("reviewOffline")}</p><div class="social-dialog-actions">${confirmation}${action(changeAction, "changeOffer", id)}${action(confirmAction === "confirm-trade" ? "decline-ready" : confirmAction === "ready-trade" ? "decline-trade" : "close", "cancelExchange", id)}</div>`,
      t("tradeReviewStep"),
    )
  }
  const tradeModal = async (code: string, incomingId?: string, readyId?: string, selectedSlot?: Offer["slot"]) => {
    const f = state.friends[code]
    if (!f) throw new Error("social.notFriend")
    if (readyId) {
      const r = state.inbox[readyId]
      if (r?.event.kind !== "trade-ready") throw new Error("social.invalid")
      const out = state.outbox[r.event.tradeId]
      if (out?.event.kind !== "trade-offer") throw new Error("social.invalid")
      tradeReview(code, out.event.offer, r.event.offer, "confirm-trade", readyId, "replace-offer")
      return
    }
    const options = await offerOptions()
    dialogOffers = options
    const incoming = incomingId ? state.inbox[incomingId] : undefined
    const offer =
      incoming?.event.kind === "trade-offer" && incoming.state === "pending" ? incoming.event.offer : undefined
    if (incomingId && !offer) throw new Error("social.invalid")
    modal(
      t("chooseOffer"),
      `${person(f.profile.alias, f.profile.nodeId, code)}${offer ? `<p class="social-hint">${escapeHtml(t("friendOffers", { alias: f.profile.alias, name: DIGIMON_CATALOG.byId.get(offer.partner.currentNodeId)?.nameEn ?? t("yourCompanion") }))}</p>` : ""}${options.length ? `<fieldset class="social-offers"><legend>${h("yourOffer")}</legend>${options.map((o, i) => `<label class="social-offer-option"><input type="radio" name="social-offer-slot" value="${o.slot}" ${selectedSlot ? (o.slot === selectedSlot ? "checked" : "") : i === 0 ? "checked" : ""}>${companionPortrait(o.offer.partner.currentNodeId)}<span><strong>${name(o.offer.partner.currentNodeId)}</strong><span class="social-eyebrow">${stage(o.offer.partner.currentNodeId)} · ${h(o.slot)}</span></span><span class="social-offer-check" aria-hidden="true">✓</span></label>`).join("")}</fieldset><p class="social-hint">${h("eligibleHint")}</p><div class="social-dialog-actions">${action(incomingId ? "review-selected-incoming" : "review-selected", "reviewExchange", incomingId ?? code, true)}${action("close", "cancel")}</div>` : `<p class="social-hint">${h("noEligible")}</p>${action("close", "cancel")}`}`,
      t(incomingId ? "tradeIncomingStep" : "tradeSelectionStep"),
    )
  }
  const act = async (kind: string, id: string) => {
    if (kind === "close") {
      dialog.close()
      return
    }
    if (kind === "invite") {
      await invite(id)
      return
    }
    if (!ensureProfile()) return
    if (!browserSaveSelected()) throw new Error("social.browserOnly")
    if (kind === "retry") {
      await engine.deliver(id)
      return
    }
    if (kind === "abort-pending") {
      const trade = state.trades[id]
      if (!trade || trade.coordinator || trade.phase !== "prepared") throw new Error("social.invalid")
      await engine.sendEvent(trade.code, { kind: "trade-abort-request", tradeId: id })
      return
    }
    if (kind === "reconnect") {
      engine.connect(id)
      await engine.reconnect()
      return
    }
    if (kind === "cancel-outgoing") {
      const withdrawal = await cancelInvitation(id)
      if (withdrawal) await engine.deliver(withdrawal)
      return
    }
    if (kind === "accept" || kind === "decline") {
      await engine.decide(id, kind === "accept")
      return
    }
    if (kind === "collect") {
      await collectGift(id)
      refreshBrowserViews()
      return
    }
    if (kind === "dismiss") {
      await updateSocial((s) => {
        if (s.inbox[id]) s.inbox[id].state = "done"
      })
      return
    }
    if (kind === "choose-fighter") {
      if (otherBusy() || activeTrade || (await readPendingBattle())) throw new Error("social.busy")
      await selectArenaFighter(id)
      dialog.close()
      await engine.publishProfile()
      return
    }
    if (kind === "companion") {
      const f = state.friends[id]
      if (!f) throw new Error("social.notFriend")
      modal(
        DIGIMON_CATALOG.byId.get(f.profile.nodeId ?? "")?.nameEn ?? t("theirCompanion"),
        `${person(f.profile.alias, f.profile.nodeId, id)}<div class="social-dialog-hero">${companionPortrait(f.profile.nodeId)}<h3>${name(f.profile.nodeId)}</h3></div><p class="social-hint">${escapeHtml(t("activeCompanionHint", { alias: f.profile.alias }))}</p><div class="social-dialog-actions">${action("close", "backFriends")}</div>`,
        t("currentCompanion"),
      )
      return
    }
    if (kind === "remove") {
      modal(
        t("remove"),
        `${state.friends[id] ? person(state.friends[id].profile.alias, state.friends[id].profile.nodeId, id) : ""}<p class="social-hint">${h("removeConfirm")}</p><div class="social-dialog-actions">${action("confirm-remove", "remove", id)}${action("close", "cancel")}</div>`,
      )
      return
    }
    if (kind === "confirm-remove") {
      await removeFriend(id)
      dialog.close()
      await engine.reconnect()
      return
    }
    if (kind === "gift") {
      modal(
        t("giftTitle"),
        `${state.friends[id] ? person(state.friends[id].profile.alias, state.friends[id].profile.nodeId, id) : ""}<div class="social-dialog-hero">${foodArtwork}<h3>${h("oneRation")}</h3><p class="social-hint">${h("foodForCompanion")}</p></div><div class="social-history-note"><p>${h("giftHint")}</p></div><div class="social-dialog-actions">${action("send-gift", "sendGift", id, true).replace(h("sendGift"), escapeHtml(t("sendTo", { alias: state.friends[id]?.profile.alias ?? t("player") })))}${action("close", "cancel")}</div>`,
        t("giftContext"),
      )
      return
    }
    if (kind === "send-gift") {
      if (!engine.online.has(id)) throw new Error("social.offline")
      await engine.sendEvent(id, { kind: "gift", day: new Date().toISOString().slice(0, 10) })
      dialog.close()
      return
    }
    if (kind === "challenge") {
      const f = state.friends[id]
      if (!f) throw new Error("social.notFriend")
      const fighter = await readArenaFighter()
      modal(
        t("challengeFriend"),
        `${person(f.profile.alias, f.profile.nodeId, id)}${matchup(fighter.currentNodeId, f.profile.arenaNodeId ?? f.profile.nodeId)}<p class="social-hint">${h("challengeHint")}</p><div class="social-dialog-actions">${action("send-challenge", "sendChallenge", id, true)}${action("close", "cancel")}</div>`,
        t("challengeContext"),
      )
      return
    }
    if (kind === "send-challenge") {
      if (!engine.online.has(id) || otherBusy() || activeTrade) throw new Error("social.busy")
      const code = el("battle-own-code").textContent ?? ""
      if (!/^\d{6}$/.test(code)) throw new Error("social.offline")
      await engine.sendEvent(id, { kind: "challenge", battleCode: code })
      dialog.close()
      navigate("activity")
      return
    }
    if (kind === "accept-challenge") {
      const r = state.inbox[id]
      if (r?.event.kind !== "challenge") throw new Error("social.invalid")
      el<HTMLInputElement>("battle-target").value = r.event.battleCode
      el<HTMLButtonElement>("battle-request").click()
      await updateSocial((s) => {
        const receipt = s.inbox[id]
        if (receipt) receipt.state = "done"
      })
      return
    }
    if (kind === "exchange") {
      await tradeModal(id)
      return
    }
    if (kind === "review-trade" || kind === "confirm-review") {
      const r = state.inbox[id]
      if (!r) throw new Error("social.invalid")
      await tradeModal(r.code, kind === "review-trade" ? id : undefined, kind === "confirm-review" ? id : undefined)
      return
    }
    if (kind === "review-selected" || kind === "review-selected-incoming") {
      const slot = document.querySelector<HTMLInputElement>('input[name="social-offer-slot"]:checked')?.value
      const option = dialogOffers.find((o) => o.slot === slot)
      if (!option) throw new Error("social.busy")
      const incoming = kind === "review-selected-incoming" ? state.inbox[id] : undefined
      if (
        kind === "review-selected-incoming" &&
        (incoming?.event.kind !== "trade-offer" || incoming.state !== "pending")
      )
        throw new Error("social.invalid")
      const code = incoming?.code ?? id
      reviewedOffer = { code, incomingId: incoming?.id, offer: option.offer }
      tradeReview(
        code,
        option.offer,
        incoming?.event.kind === "trade-offer" ? incoming.event.offer : undefined,
        incoming ? "ready-trade" : "offer-trade",
        incoming?.id ?? code,
        "change-selection",
      )
      return
    }
    if (kind === "change-selection") {
      if (!reviewedOffer) throw new Error("social.invalid")
      await tradeModal(reviewedOffer.code, reviewedOffer.incomingId, undefined, reviewedOffer.offer.slot)
      return
    }
    if (kind === "replace-offer") {
      const r = state.inbox[id]
      if (r?.event.kind !== "trade-ready") throw new Error("social.invalid")
      if (!engine.online.has(r.code)) throw new Error("social.offline")
      if (!(await abortTrade(r.event.tradeId, r.code))) throw new Error("social.busy")
      await engine.sendEvent(r.code, { kind: "trade-cancel", tradeId: r.event.tradeId })
      state = await readSocial()
      activeTrade = pendingTrade(state)
      await tradeModal(r.code)
      return
    }
    if (kind === "offer-trade" || kind === "ready-trade") {
      const selection = reviewedOffer
      if (!selection || (kind === "offer-trade" ? selection.code !== id : selection.incomingId !== id))
        throw new Error("social.invalid")
      if (!engine.online.has(selection.code) || otherBusy() || activeTrade) throw new Error("social.busy")
      if (kind === "offer-trade")
        await engine.sendEvent(selection.code, { kind: "trade-offer", offer: selection.offer })
      else await engine.readyTrade(id, selection.offer)
      reviewedOffer = undefined
      dialog.close()
      navigate("activity")
      return
    }
    if (kind === "confirm-trade") {
      await engine.confirmTrade(id)
      dialog.close()
      navigate("activity")
      return
    }
    if (["cancel-trade", "decline-trade", "decline-ready"].includes(kind)) {
      const r = state.inbox[id] ?? state.outbox[id]
      if (!r) throw new Error("social.invalid")
      const tradeId = r.event.kind === "trade-ready" ? r.event.tradeId : id
      if (await abortTrade(tradeId, r.code)) await engine.sendEvent(r.code, { kind: "trade-cancel", tradeId })
      dialog.close()
      return
    }
  }
  for (const root of [el("social-view"), dialog])
    root.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLElement>("[data-social-action]")
      if (button && button.dataset.socialAction !== "manual-connect")
        run(() => act(button.dataset.socialAction ?? "", button.dataset.id ?? ""))
    })
  el("social-add").addEventListener("click", () => {
    if (!ensureProfile()) return
    const form = el<HTMLFormElement>("social-add-form")
    form.hidden = !form.hidden
    el("social-add").setAttribute("aria-expanded", String(!form.hidden))
    if (!form.hidden) el<HTMLInputElement>("social-target").focus()
  })
  el("social-connect").addEventListener("click", () => el<HTMLFormElement>("social-add-form").requestSubmit())
  el<HTMLFormElement>("social-add-form").addEventListener("submit", (event) => {
    event.preventDefault()
    run(async () => {
      if (!ensureProfile()) return
      const code = normalizeCode(el<HTMLInputElement>("social-target").value)
      if (!validCode(code)) throw new Error("social.invalid")
      if (code === engine.code) throw new Error("social.self")
      if (state.friends[code]) throw new Error("social.alreadyFriend")
      const revision = dialogRevision
      engine.connect(code)
      el("social-add-status").textContent = t("connecting")
      const deadline = Date.now() + 12000
      while (
        Date.now() < deadline &&
        revision === dialogRevision &&
        !el("social-add-form").hidden &&
        !el("social-friends").hidden
      ) {
        const profile = engine.channels.get(code)?.profile
        if (profile) {
          el("social-add-status").textContent = ""
          modal(
            t("addFriend"),
            `${person(profile.alias, profile.nodeId, code)}<p class="social-hint">${h("verifyCode")}</p><div class="social-dialog-actions">${action("invite", "sendRequest", code, true)}${action("close", "cancel")}</div>`,
            t("friends"),
          )
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      if (!el("social-add-form").hidden && !el("social-friends").hidden && revision === dialogRevision) {
        await invite(code)
      }
    })
  })
  el<HTMLFormElement>("social-alias-form").addEventListener("submit", (event) => {
    event.preventDefault()
    run(async () => {
      const alias = el<HTMLInputElement>("social-alias").value.trim()
      if (!validAlias(alias)) throw new Error("social.aliasRule")
      await saveAlias(alias)
      note(t("aliasSaved"))
      await engine.reconnect()
      await render()
      await engine.publishProfile()
      if (invitation) openInvite(invitation.code, invitation.alias)
    })
  })
  el("friends-copy-code").addEventListener("click", () => {
    void copy(displayCode(engine.code))
  })
  el("profile-copy-code").addEventListener("click", () => {
    void copy(displayCode(engine.code))
  })
  el("profile-copy-invite").addEventListener("click", () => {
    if (!ensureProfile()) return
    const url = new URL("/", location.origin)
    url.hash = `invite?code=${engine.code}&alias=${encodeURIComponent(state.profile?.alias ?? "")}`
    void copy(url.href)
  })
  el("profile-friends").addEventListener("click", () => navigate("friends"))
  el("social-choose-team").addEventListener("click", () =>
    run(async () => {
      if (!browserSaveSelected()) throw new Error("social.browserOnly")
      const team = await readLocalState()
      const fighter = await readArenaFighter(team)
      const busy =
        otherBusy() || Boolean(activeTrade || (await readPendingBattle())) || adventureBusy(await readAdventureState())
      const partners = [team, ...(team.reserve ? [team.reserve] : [])]
      modal(
        t("chooseTeam"),
        `<div class="social-fighter-options">${partners.map((partner) => `<button type="button" class="social-fighter-option" data-social-action="choose-fighter" data-id="${escapeHtml(partner.partnerId)}" aria-pressed="${partner.partnerId === fighter.partnerId}" ${busy || !arenaEligible(partner) ? "disabled" : ""}>${companionPortrait(partner.currentNodeId)}<span>${name(partner.currentNodeId)}<span class="social-eyebrow">${stage(partner.currentNodeId)} · ${h(partner.partnerId === team.partnerId ? "principal" : "reserve")}</span></span></button>`).join("")}</div>${partners.some((partner) => arenaEligible(partner)) ? "" : `<p class="social-hint">${h("noArenaEligible")}</p>`}`,
        t("arenaTeam"),
      )
    }),
  )
  el("social-exchange-done").addEventListener("click", () => playback.close())
  el("social-exchange-history").addEventListener("click", () => {
    playback.close()
    window.dispatchEvent(new CustomEvent("digital-pet:navigate", { detail: "/history" }))
  })
  playback.addEventListener("cancel", (event) => {
    if (animation !== undefined) event.preventDefault()
  })
  window.addEventListener("pagehide", () => {
    if (animation !== undefined) cancelAnimationFrame(animation)
  })
  const route = () => {
    if (!location.hash.startsWith("#invite?")) return
    const params = new URLSearchParams(location.hash.slice(8))
    const code = normalizeCode(params.get("code") ?? "")
    const raw = params.get("alias") ?? ""
    if (validCode(code)) openInvite(code, validAlias(raw) ? raw : "")
    else {
      modal(t("inviteTitle"), `<p>${h("invalid")}</p>${action("close", "close")}`)
    }
  }
  window.addEventListener("hashchange", route)
  window.addEventListener("popstate", route)
  window.addEventListener("digital-pet:save-updated", () => {
    engine.setEnabled(browserSaveSelected())
    void render().catch(error)
  })
  await engine.start()
  await render()
  route()
  return {
    get busy() {
      return Boolean(activeTrade)
    },
    setBrowserEnabled(value) {
      engine.setEnabled(value)
      void render().catch(error)
    },
  }
}
