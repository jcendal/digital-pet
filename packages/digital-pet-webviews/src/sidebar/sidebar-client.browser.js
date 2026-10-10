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
  document
    .querySelector(".arena")
    .setAttribute(
      "aria-label",
      "Battle: partner " +
        battleHud.playerHits +
        " / " +
        battleHud.hitsToWin +
        " hits; opponent " +
        battleHud.opponentHits +
        " / " +
        battleHud.hitsToWin +
        " hits" +
        (battleHud.caption ? "; " + battleHud.caption : ""),
    )
  for (const [id, hits] of [
    ["player-score", battleHud.playerHits],
    ["opponent-score", battleHud.opponentHits],
  ]) {
    const score = byId(id)
    score.replaceChildren()
    score.setAttribute(
      "aria-label",
      (id === "player-score" ? "Partner" : "Opponent") + ": " + hits + " / " + battleHud.hitsToWin + " hits",
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
    button.title = "Clean poop · +5% experience"
    button.setAttribute("aria-label", "Clean poop " + (index + 1) + " · +5% experience")
  }
}
const render = () => {
  renderPoops()
  const active = model?.kind === "partner"
  root.classList.toggle("no-partner", !active)
  root.classList.toggle("animating", state.phase !== "idle")
  root.classList.toggle("battling", state.phase === "battle")
  byId("empty").hidden = active
  byId("empty").textContent = model?.messageLine || "Spawn a partner to begin."
  byId("phase").textContent = !active
    ? "NO PARTNER"
    : state.phase === "idle"
      ? model.frozen
        ? "FROZEN"
        : model.hygiene?.mood === "sad"
          ? "SAD"
          : model.hygiene?.mood === "happy"
            ? "HAPPY"
            : "ACTIVE"
      : state.phase.toUpperCase()
  if (!active) return
  byId("name").textContent = model.name
  byId("name").title = model.name
  byId("stage").textContent =
    state.phase === "battle"
      ? model.opponentName || ""
      : state.phase === "evolving"
        ? "TRANSFORMING..."
        : state.phase === "draw"
          ? "DRAW · " + model.stage
          : state.phase === "defeated"
            ? "DEFEAT · " + model.stage
            : model.stage
  byId("stage").title = byId("stage").textContent
  const percent = Math.round(model.progress * 100)
  byId("progress-label").textContent = model.terminal ? "FINAL STAGE" : "NEXT CHECK"
  byId("percent").textContent = model.terminal ? "" : percent + "%"
  byId("meter").hidden = model.terminal
  byId("meter").setAttribute("aria-valuenow", String(percent))
  byId("meter-fill").style.width = percent + "%"
  const abbreviated = model.gauge
    .split("/")
    .map((value) => {
      const count = Number(value.replaceAll(",", ""))
      return Number.isFinite(count)
        ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count)
        : value
    })
    .join(" / ")
  byId("gauge").textContent = model.terminal ? "No further evolution check." : abbreviated
  byId("gauge").title = model.gauge
  document
    .querySelector(".arena")
    .setAttribute("aria-label", (state.phase === "idle" ? "Partner" : state.phase) + " animation: " + model.name)
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
