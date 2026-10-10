const vscode = window.digitalPetBridge || acquireVsCodeApi()
let model = null
let state = { phase: "idle" }
let artwork = ""
let artworkColumns = 32
let battleHud = null
let eggInteraction = null
const byId = (id) => document.getElementById(id)
const root = document.querySelector(".pet-module")
const positionEggControl = () => {
  const svg = byId("artwork")
  const bounds = svg.getBBox?.()
  const matrix = svg.getScreenCTM?.()
  if (!bounds?.width || !matrix) return
  const arena = document.querySelector(".arena").getBoundingClientRect()
  const x = (bounds.x + bounds.width / 2) * matrix.a + matrix.e - arena.left
  const y = (bounds.y + bounds.height / 2) * matrix.d + matrix.f - arena.top
  for (const id of ["pet-egg", "egg-pet-feedback"]) {
    const node = byId(id)
    if (!node) continue
    node.style.left = x + "px"
    node.style.top = y + "px"
    node.style.width = Math.max(44, bounds.width * matrix.a + 16) + "px"
    node.style.height = Math.max(44, bounds.height * matrix.d + 16) + "px"
  }
}
const renderEgg = () => {
  const button = byId("pet-egg")
  const hint = byId("egg-pet-hint")
  if (!button || !hint) return
  const egg = model?.kind === "partner" ? model.egg : null
  button.hidden = !egg || state.phase !== "idle"
  hint.hidden = button.hidden
  button.disabled = !egg?.canPet || eggInteraction !== null || state.phase !== "idle"
  button.title = IntlModule.translate("egg.pet")
  button.setAttribute("aria-label", IntlModule.translate("egg.pet"))
  hint.textContent = IntlModule.translate("egg.hint")
  positionEggControl()
}
const showEggSparkles = () => {
  const feedback = byId("egg-pet-feedback")
  if (!feedback) return
  const burst = document.createElement("span")
  burst.className = "egg-pet-burst"
  const reward = document.createElement("span")
  reward.className = "egg-pet-reward"
  reward.textContent = IntlModule.translate("egg.reward")
  burst.append(reward)
  for (const [x, y] of [
    [-34, -28],
    [28, -34],
    [-24, 18],
    [34, 8],
    [2, -42],
  ]) {
    const star = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    star.setAttribute("viewBox", "0 0 16 16")
    star.setAttribute("class", "egg-pet-star")
    star.style.setProperty("--star-x", x + "px")
    star.style.setProperty("--star-y", y + "px")
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("fill", "currentColor")
    path.setAttribute("d", "M7 0h2v5h2v2h5v2h-5v2H9v5H7v-5H5V9H0V7h5V5h2z")
    star.append(path)
    burst.append(star)
  }
  feedback.append(burst)
  setTimeout(() => burst.remove(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 200 : 800)
}
const renderBattleHud = () => {
  const visible = battleHud !== null
  root.classList.toggle("battle-intro", state.phase === "battle" && !visible)
  document.querySelector(".arena").classList.toggle("with-battle-hud", visible)
  byId("battle-scores").hidden = !visible
  byId("battle-caption").hidden = !visible || !battleHud.caption
  byId("battle-caption").textContent = battleHud?.caption || ""
  if (!visible) return
  document.querySelector(".arena").setAttribute(
    "aria-label",
    IntlModule.translate("sidebar.battleDescription", {
      playerHits: battleHud.playerHits,
      opponentHits: battleHud.opponentHits,
      hitsToWin: battleHud.hitsToWin,
      caption: battleHud.caption ? "; " + battleHud.caption : "",
    }),
  )
  for (const [id, hits] of [
    ["player-score", battleHud.playerHits],
    ["opponent-score", battleHud.opponentHits],
  ]) {
    const score = byId(id)
    score.replaceChildren()
    score.setAttribute(
      "aria-label",
      IntlModule.translate("sidebar.score", {
        side: IntlModule.translate(id === "player-score" ? "sidebar.partner" : "sidebar.opponent"),
        hits,
        total: battleHud.hitsToWin,
      }),
    )
    for (let index = 0; index < battleHud.hitsToWin; index++) {
      const pip = document.createElement("span")
      pip.className = index < hits ? "score-pip filled" : "score-pip"
      pip.setAttribute("aria-hidden", "true")
      score.append(pip)
    }
  }
}
const renderArtwork = () => {
  const svg = byId("artwork")
  svg.replaceChildren()
  const lines = artwork.split("\n")
  const width = Math.max(artworkColumns, ...lines.map((line) => Array.from(line).length))
  const intro = state.phase === "battle" && battleHud === null
  svg.setAttribute("viewBox", "0 0 " + width + " " + Math.max(intro ? 1 : 16, lines.length * 2))
  svg.setAttribute(
    "preserveAspectRatio",
    (state.phase === "idle" || state.phase === "feeding" ? svg.dataset.idleAlignment || "xMidYMid" : "xMidYMid") +
      " meet",
  )
  const append = (tag, attrs) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag)
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
    svg.append(node)
    return node
  }
  for (const [row, line] of lines.entries())
    for (const [column, cell] of Array.from(line).entries()) {
      if (
        battleHud &&
        (row === battleHud.scoreRow || row === battleHud.captionRow) &&
        column >= battleHud.gapStartColumn &&
        column < battleHud.gapStartColumn + battleHud.gapColumns
      )
        continue
      if ("█▀▄░▒▓".includes(cell)) {
        const top = cell !== "▄"
        const bottom = cell !== "▀"
        const opacity = cell === "░" ? 0.25 : cell === "▒" ? 0.5 : cell === "▓" ? 0.75 : 1
        if (top) append("rect", { x: column, y: row * 2, width: 1, height: 1, fill: "currentColor", opacity })
        if (bottom) append("rect", { x: column, y: row * 2 + 1, width: 1, height: 1, fill: "currentColor", opacity })
      } else if (cell.trim()) {
        // Battle captions (HIT!, WIN!, MISS) share frames with the pixel sprites.
        const text = append("text", {
          x: column + 0.5,
          y: row * 2 + 1.6,
          "text-anchor": "middle",
          "font-family": "monospace",
          "font-size": 1.6,
          fill: "currentColor",
        })
        text.textContent = cell
      }
    }
  positionEggControl()
}
const renderPoops = () => {
  const group = byId("pet-poops")
  if (!group) return
  group.hidden = state.phase !== "idle"
  const hygiene = model?.kind === "partner" ? model.hygiene : null
  const ids = hygiene?.poops || []
  for (const button of group.querySelectorAll("button"))
    if (!ids.includes(Number(button.dataset.poopId)) || button.dataset.partnerId !== hygiene?.partnerId) button.remove()
  for (const [index, id] of ids.entries()) {
    let button = group.querySelector('[data-poop-id="' + id + '"]')
    if (!button) {
      button = document.createElement("button")
      button.type = "button"
      button.className = "pet-poop"
      button.dataset.poopId = String(id)
      button.dataset.partnerId = hygiene.partnerId
      button.innerHTML =
        '<svg viewBox="0 0 16 20" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M8 6h2v2h1v2h2v3h2v5H1v-5h2v-3h2V8h3z"/><path fill="var(--lcd)" d="M6 10h5v1H6zM4 13h9v1H4zM3 16h10v1H3z"/><rect class="poop-fly poop-fly-one" fill="currentColor" x="4" y="3" width="1" height="1"/><rect class="poop-fly poop-fly-two" fill="currentColor" x="12" y="2" width="1" height="1"/></svg>'
      button.addEventListener("click", () => {
        button.disabled = true
        vscode.postMessage({
          type: "clean-poop",
          partnerId: button.dataset.partnerId,
          poopId: Number(button.dataset.poopId),
        })
      })
      group.append(button)
    }
    button.style.left = index * 48 + "px"
    button.disabled = !hygiene.canClean || state.phase !== "idle"
    button.title = IntlModule.translate("sidebarClient.cleanPoop5Experience")
    button.setAttribute("aria-label", IntlModule.translate("sidebar.cleanPoop", { number: index + 1 }))
  }
}
const render = () => {
  renderEgg()
  renderPoops()
  const active = model?.kind === "partner"
  root.classList.toggle("no-partner", !active)
  root.classList.toggle("animating", state.phase !== "idle" && state.phase !== "feeding")
  root.classList.toggle("battling", state.phase === "battle")
  byId("empty").hidden = active
  const [messageNamespace, messageKey] = (model?.messageKey || "").split(":")
  byId("empty").textContent =
    messageNamespace && messageKey
      ? getIntlModule().translate(messageKey, {}, messageNamespace)
      : model?.messageLine || IntlModule.translate("sidebarClient.spawnAPartnerToBegin")
  byId("phase").textContent = !active
    ? IntlModule.translate("sidebarClient.noPartner")
    : state.phase === "idle"
      ? model.frozen
        ? IntlModule.translate("sidebarClient.frozen")
        : model.hygiene?.mood === "sad"
          ? IntlModule.translate("sidebarClient.sad")
          : model.hygiene?.mood === "happy"
            ? IntlModule.translate("sidebarClient.happy")
            : IntlModule.translate("sidebarClient.active")
      : IntlModule.translate("phase." + state.phase)
  if (!active) return
  const name = model.overrideName ? IntlModule.translate("sidebarRender.set", { name: model.overrideName }) : model.name
  byId("name").textContent = name
  byId("name").title = name
  const stageLabel =
    model.stageKey && IntlModule.locale !== "en" ? getIntlModule().translate(model.stageKey, {}, "core") : model.stage
  const stageText =
    model.stageKey && model.frozen && IntlModule.locale !== "en"
      ? IntlModule.translate("sidebarRender.frozen", { stage: stageLabel })
      : stageLabel
  byId("stage").textContent =
    state.phase === "battle"
      ? model.opponentName || ""
      : state.phase === "evolving"
        ? IntlModule.translate("sidebarClient.transforming")
        : state.phase === "draw"
          ? IntlModule.translate("sidebar.drawStage", { stage: stageText })
          : state.phase === "defeated"
            ? IntlModule.translate("sidebar.defeatStage", { stage: stageText })
            : stageText
  byId("stage").title = byId("stage").textContent
  const percent = Math.round(model.progress * 100)
  byId("progress-label").textContent = model.terminal
    ? IntlModule.translate("sidebarClient.finalStage")
    : IntlModule.translate("sidebarClient.nextCheck")
  byId("percent").textContent = model.terminal ? "" : percent + "%"
  byId("meter").hidden = model.terminal
  byId("meter").setAttribute("aria-valuenow", String(percent))
  byId("meter-fill").style.width = percent + "%"
  const abbreviated = model.gauge
    .split("/")
    .map((value) => {
      const count = Number(value.replaceAll(",", ""))
      return Number.isFinite(count)
        ? new Intl.NumberFormat(IntlModule.locale, { notation: "compact", maximumFractionDigits: 1 }).format(count)
        : value
    })
    .join(" / ")
  byId("gauge").textContent = model.terminal
    ? IntlModule.translate("sidebarClient.noFurtherEvolutionCheck")
    : abbreviated
  byId("gauge").title = model.gauge
  document.querySelector(".arena").setAttribute(
    "aria-label",
    IntlModule.translate("sidebar.animation", {
      phase:
        state.phase === "idle" ? IntlModule.translate("sidebar.partner") : IntlModule.translate("phase." + state.phase),
      name: model.name,
    }),
  )
}
const reportWidth = () => {
  const arena = document.querySelector(".arena")
  const width = arena.clientWidth
  if (width > 0) {
    const pixelSize = parseFloat(getComputedStyle(arena).getPropertyValue("--artwork-pixel-size")) || 6
    const columns = Math.max(
      state.phase === "idle" || state.phase === "feeding" ? 16 : 36,
      Math.floor(width / pixelSize),
    )
    if (columns !== artworkColumns) {
      artworkColumns = columns
      renderArtwork()
    }
    vscode.postMessage({ type: "artwork-width", width: columns })
  }
}
for (const button of document.querySelectorAll("[data-panel]"))
  button.addEventListener("click", () => vscode.postMessage({ type: "open-panel", panel: button.dataset.panel }))
byId("pet-egg")?.addEventListener("click", () => {
  if (!model?.egg?.canPet || state.phase !== "idle" || eggInteraction !== null) return
  eggInteraction = crypto.randomUUID()
  byId("pet-egg").disabled = true
  vscode.postMessage({ type: "pet-egg", partnerId: model.egg.partnerId, interactionId: eggInteraction })
})
window.addEventListener("message", (event) => {
  const message = event.data
  if (message?.type === "egg-petted" && message.interactionId === eggInteraction && eggInteraction !== null) {
    eggInteraction = null
    if (message.accepted === true) showEggSparkles()
    renderEgg()
  }
  if (message?.type === "sidebar-model") {
    model = message
    render()
    reportWidth()
  }
  if (message?.type === "presentation-state") {
    state = message.state
    if (state.phase !== "battle") battleHud = null
    renderBattleHud()
    render()
    renderArtwork()
    reportWidth()
  }
  if (message?.type === "animation-frame" && typeof message.artwork === "string") {
    artwork = message.artwork
    battleHud = message.hud || null
    renderBattleHud()
    renderArtwork()
  }
})
new ResizeObserver(reportWidth).observe(root)
render()
reportWidth()
vscode.postMessage({ type: "sidebar-ready" })
