window.createAdventureClient = (bridge, intl) => {
  const controls = document.getElementById("adventure-controls")
  const toggle = document.getElementById("adventure-toggle")
  const stop = document.getElementById("adventure-stop")
  const status = document.getElementById("adventure-status")
  const time = document.getElementById("adventure-time")
  const actions = document.getElementById("adventure-actions")
  const offer = document.getElementById("adventure-offer")
  const accept = document.getElementById("adventure-accept")
  const decline = document.getElementById("adventure-decline")
  const loot = document.getElementById("adventure-loot")
  const root = document.querySelector(".pet-module")
  let view = { available: false, readyAt: 0, lootLifetimeMs: 0 }
  let phase = "idle"
  let collecting = null
  const send = (command) =>
    bridge.postMessage({
      type: "adventure",
      command: { ...command, ...(view.state ? { adventureId: view.state.id } : {}) },
    })
  const render = () => {
    const trip = view.state
    const traveling = trip?.status === "travel"
    const running = traveling && trip.running
    const event = trip?.event
    const destination = document.getElementById("world-location")
    if (destination) destination.disabled = Boolean(traveling)
    accept.disabled = !view.available || phase !== "idle"
    decline.disabled = !view.available || phase !== "idle"
    const offered = event?.kind === "offer"
    const ready = Date.now() >= view.readyAt
    actions.hidden = !view.available || phase !== "idle" || offered || (!traveling && !ready)
    controls.hidden = !view.available && !trip
    offer.hidden = !offered || phase !== "idle"
    if (offered) {
      document.getElementById("adventure-offer-title").textContent = intl.translate("adventure.offer", {
        name: event.opponentName,
      })
      document.getElementById("adventure-offer-description").textContent = intl.translate("adventure.offerDescription")
      accept.textContent = intl.translate("adventure.accept")
      decline.textContent = intl.translate("adventure.decline")
    }
    toggle.disabled = !view.available || phase !== "idle" || (!traveling && !ready)
    const label = intl.translate(running ? "adventure.pause" : traveling ? "adventure.resume" : "adventure.start")
    toggle.setAttribute("aria-label", label)
    toggle.title = label
    toggle.querySelector("span").textContent = traveling ? "" : label
    toggle
      .querySelector("path")
      .setAttribute(
        "d",
        running ? "M8 5v14M16 5v14" : traveling ? "m8 5 12 7-12 7Z" : "m12 2 9 10-9 10L3 12Zm3 7-6 2-2 6 6-2Z",
      )
    stop.hidden = !traveling
    stop.disabled = phase !== "idle"
    stop.setAttribute("aria-label", intl.translate("adventure.stop"))
    stop.title = intl.translate("adventure.stop")
    root.classList.toggle("adventuring", Boolean(running && event?.kind !== "battle" && phase === "idle"))
    const clock = (elapsedMs) =>
      `${Math.floor(elapsedMs / 60000)}:${String(Math.floor(elapsedMs / 1000) % 60).padStart(2, "0")}`
    const remaining = Math.max(0, view.readyAt - Date.now())
    time.textContent = traveling
      ? clock(trip.elapsedMs)
      : remaining
        ? intl.translate("adventure.cooldown", {
            time: `${Math.floor(Math.ceil(remaining / 60000) / 60)}:${String(Math.ceil(remaining / 60000) % 60).padStart(2, "0")}`,
          })
        : ""
    const key =
      !view.available && !trip
        ? "adventure.unavailable"
        : !trip
          ? "adventure.hint"
          : trip.status === "evolved"
            ? "adventure.evolved"
            : trip.status === "complete"
              ? "adventure.complete"
              : trip.status === "defeated"
                ? "adventure.defeated"
                : offered
                  ? "adventure.offered"
                  : !running
                    ? "adventure.paused"
                    : event?.kind === "battle"
                      ? event.difficult
                        ? "adventure.difficult"
                        : "adventure.encounter"
                      : event?.kind === "loot"
                        ? "adventure.collect"
                        : "adventure.walking"
    const copy = intl.translate(key, {
      name: event?.opponentName ?? "",
      collected: trip?.collected ?? 0,
      victories: trip?.victories ?? 0,
    })
    if (status.textContent !== copy) status.textContent = copy
    status.title = copy
    loot.hidden = !running || phase !== "idle" || event?.kind !== "loot"
    if (!loot.hidden) {
      if (collecting !== event.id) collecting = null
      loot.disabled = collecting === event.id
      loot.dataset.eventId = String(event.id)
      loot.dataset.item = event.item
      const label = intl.translate("adventure." + event.item)
      loot.setAttribute("aria-label", label)
      loot.title = label
      loot
        .querySelector("path")
        .setAttribute(
          "d",
          event.item === "food"
            ? "M8 1h2v2H8zM5 3h3v2h3v1h2v7h-2v2H5v-2H3V6h2zM5 6h2v2H5z"
            : "M6 1h4v2h2v2h2v6h-2v2h-2v2H6v-2H4v-2H2V5h2V3h2zM7 4h2v7H7zM6 7h4v2H6z",
        )
      const age = Math.max(0, trip.elapsedMs - event.appearedAt)
      loot.style.left = Math.max(-10, 90 - (age / Math.max(1, view.lootLifetimeMs)) * 100) + "%"
    }
  }
  toggle.addEventListener("click", () => {
    if (toggle.disabled) return
    const trip = view.state
    send(
      trip?.status === "travel"
        ? { kind: trip.running ? "pause" : "resume" }
        : { kind: "start", id: crypto.randomUUID() },
    )
  })
  stop.addEventListener("click", () => {
    if (!stop.disabled) send({ kind: "stop" })
  })
  const chooseCompanion = (kind) => {
    const event = view.state?.event
    if (event?.kind !== "offer" || phase !== "idle") return
    accept.disabled = true
    decline.disabled = true
    send({ kind, eventId: event.id })
  }
  accept.addEventListener("click", () => chooseCompanion("accept-companion"))
  decline.addEventListener("click", () => chooseCompanion("decline-companion"))
  loot.addEventListener("click", () => {
    const event = view.state?.event
    if (loot.hidden || loot.disabled || event?.kind !== "loot") return
    collecting = event.id
    loot.disabled = true
    send({ kind: "collect", eventId: event.id })
  })
  setInterval(() => {
    if (!document.hidden && view.state?.running && view.state.status === "travel" && phase === "idle")
      send({ kind: "tick" })
  }, 250)
  setInterval(() => {
    if (!document.hidden && !view.state?.running) render()
  }, 1000)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && view.state?.running) send({ kind: "pause" })
  })
  getIntlModule().subscribe(render)
  return {
    update(next) {
      view = next
      render()
    },
    present(next) {
      phase = next
      render()
    },
  }
}
