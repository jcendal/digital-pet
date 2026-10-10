const vscode = window.digitalPetBridge || acquireVsCodeApi()
let model = null
let state = { phase: "idle" }
let artwork = ""
let artworkColumns = 32
let battleHud = null
const byId = (id) => document.getElementById(id)
const root = document.querySelector(".pet-module")
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
        '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M7 2h3v2h2v3h2v3h1v4H1v-4h2V7h2V4h2z"/><path fill="var(--lcd)" d="M7 5h4v1H7zM5 8h8v1H5zM3 11h10v1H3z"/></svg>'
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
  renderPoops()
  const active = model?.kind === "partner"
  root.classList.toggle("no-partner", !active)
  root.classList.toggle("animating", state.phase !== "idle")
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
    const columns = Math.max(state.phase === "idle" ? 16 : 36, Math.floor(width / pixelSize))
    if (columns !== artworkColumns) {
      artworkColumns = columns
      renderArtwork()
    }
    vscode.postMessage({ type: "artwork-width", width: columns })
  }
}
for (const button of document.querySelectorAll("[data-panel]"))
  button.addEventListener("click", () => vscode.postMessage({ type: "open-panel", panel: button.dataset.panel }))
window.addEventListener("message", (event) => {
  const message = event.data
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
