window.createAdventureClient = (bridge, intl) => {
  const toggle = document.getElementById("adventure-toggle")
  const stop = document.getElementById("adventure-stop")
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
    actions.hidden = !view.available || phase !== "idle" || offered
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
    const coolingDown = !traveling && !ready
    const minutes = Math.ceil(Math.max(0, view.readyAt - Date.now()) / 60000)
    const countdown = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`
    const label = coolingDown
      ? intl.translate("adventure.cooldown", { time: countdown })
      : intl.translate(running ? "adventure.pause" : traveling ? "adventure.resume" : "adventure.start")
    toggle.setAttribute("aria-label", label)
    toggle.title = label
    toggle.querySelector("span").textContent = coolingDown ? countdown : traveling ? "" : label
    toggle.dataset.cooldown = String(coolingDown)
    toggle
      .querySelector("path")
      .setAttribute(
        "d",
        running
          ? "M3 2h3v12H3zM10 2h3v12h-3z"
          : traveling
            ? "M4 2h2v2h3v2h3v4H9v2H6v2H4z"
            : "M6 0h4v2h2v2h2v2h2v4h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V6h2V4h2V2h2zM9 4H7v3H4v2h3v3h2V9h3V7H9z",
      )
    stop.hidden = !traveling
    stop.disabled = phase !== "idle"
    stop.setAttribute("aria-label", intl.translate("adventure.stop"))
    stop.title = intl.translate("adventure.stop")
    root.classList.toggle("adventuring", Boolean(running && event?.kind !== "battle" && phase === "idle"))
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
            : "M4 2h8v2h2v8h-2v2H4v-2H2V4h2zM4 4v8h8V4zM6 6h4v4H6zM5 0h1v2H5zM10 0h1v2h-1zM5 14h1v2H5zM10 14h1v2h-1zM0 5h2v1H0zM0 10h2v1H0zM14 5h2v1h-2zM14 10h2v1h-2z",
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
