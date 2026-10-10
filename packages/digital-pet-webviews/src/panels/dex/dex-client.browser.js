const vscode = window.digitalPetBridge || acquireVsCodeApi()
let model = JSON.parse(document.getElementById("dex-data").textContent)
const saved = vscode.getState() || {}
const search = document.getElementById("search")
const stage = document.getElementById("stage")
const discovery = document.getElementById("discovery")
const entries = document.getElementById("entries")
const detail = document.getElementById("detail")
let selectedId =
  typeof saved.selectedId === "string"
    ? saved.selectedId
    : model.entries.find((e) => e.discovered)?.id || model.entries[0]?.id
let mode = saved.mode === "grid" ? "grid" : "list"
let expanded = saved.expanded === true
let filtered = []
let requestedId = null
search.value = typeof saved.search === "string" ? saved.search : ""
stage.value = typeof saved.stage === "string" ? saved.stage : "all"
if (!stage.value) stage.value = "all"
discovery.value = ["all", "registered", "unknown"].includes(saved.discovery) ? saved.discovery : "all"
const remember = () =>
  vscode.setState({
    selectedId,
    mode,
    expanded,
    search: search.value,
    stage: stage.value,
    discovery: discovery.value,
    scroll: entries.scrollTop,
  })
const { element, sprite, translateReference, translateStage } = createPanelHelpers(entries)
const date = (value) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "--"
  return new Date(value).toLocaleDateString(IntlModule.locale, { year: "numeric", month: "short", day: "numeric" })
}
const fact = (label, value) => {
  const node = element("div", "fact")
  node.append(element("span", "micro", label), element("span", "", value))
  return node
}
const selectEntry = (id, focus = false) => {
  requestedId = null
  selectedId = id
  renderSelection()
  remember()
  if (focus) {
    const button = Array.from(entries.children).find((node) => node.dataset.id === id)
    button?.focus({ preventScroll: true })
    button?.scrollIntoView({ block: "nearest" })
  }
}
const routeGroup = (label, ids) => {
  const section = element("section", "routes")
  section.append(element("h3", "route-label", label))
  const items = element("div", "route-items")
  for (const id of ids) {
    const target = model.entries.find((e) => e.id === id)
    if (!target) continue
    const button = element("button", "route", target.discovered ? target.name : "???")
    button.type = "button"
    button.append(element("span", "", id))
    button.addEventListener("click", () => {
      // A route may leave the current filter. Reset filters so the selected entry stays in its catalog context.
      search.value = ""
      stage.value = "all"
      discovery.value = "all"
      selectedId = id
      render()
      selectEntry(id, true)
    })
    items.append(button)
  }
  if (!items.childElementCount)
    items.append(element("p", "hint", IntlModule.translate("dexClient.noRoutesInThisVPetCatalog")))
  section.append(items)
  return section
}
const renderSelection = () => {
  for (const button of entries.children) {
    const selected = button.dataset.id === selectedId
    button.setAttribute("aria-pressed", String(selected))
    button.tabIndex = selected ? 0 : -1
  }
  detail.replaceChildren()
  const entry = model.entries.find((e) => e.id === selectedId)
  if (!entry) {
    detail.append(
      element("p", "no-results", IntlModule.translate("dexClient.noMatchingRecordsChangeYourFiltersToContinue")),
    )
    return
  }
  const heading = element("div", "detail-heading")
  heading.append(
    element("span", "micro", IntlModule.translate("dexClient.digimonRecord")),
    element("span", "detail-id", entry.id),
  )
  const body = element("div", "detail-body")
  const frame = element("div", "lcd-frame")
  const lcd = element("div", "lcd")
  lcd.append(
    sprite(entry),
    element(
      "span",
      "lcd-label",
      entry.discovered
        ? entry.artwork
          ? IntlModule.translate("dexClient.dataRegistered")
          : IntlModule.translate("dexClient.spriteUnavailable")
        : IntlModule.translate("dexClient.noData"),
    ),
    element("span", "lcd-number", IntlModule.translate("dexClient.lv") + entry.stageNumber),
  )
  frame.append(lcd)
  const name = element("div", "detail-name")
  name.append(
    element(
      "div",
      "badge",
      entry.discovered ? IntlModule.translate("dexClient.registered2") : IntlModule.translate("dexClient.undiscovered"),
    ),
    element("h2", "", entry.name),
  )
  if (entry.alternateName && entry.alternateName !== entry.name) name.append(element("p", "micro", entry.alternateName))
  const facts = element("div", "facts")
  facts.append(
    fact(IntlModule.translate("dexClient.stage"), translateStage(entry)),
    fact(IntlModule.translate("dexClient.catalogId"), entry.id),
  )
  if (entry.combatStats)
    facts.append(
      fact(IntlModule.translate("battleStats.strength"), entry.combatStats.strength + " / 100"),
      fact(IntlModule.translate("battleStats.evasion"), entry.combatStats.evasion + " / 100"),
    )
  body.append(frame, name, facts)
  if (entry.discovered) {
    const extra = element("details", "record-extra")
    extra.open = expanded
    extra.addEventListener("toggle", () => {
      expanded = extra.open
      remember()
    })
    extra.append(element("summary", "", IntlModule.translate("dexClient.evolutionArchive")))
    const history = element("div", "facts")
    history.append(
      fact(IntlModule.translate("dexClient.firstRegistered"), date(entry.firstSeen)),
      fact(IntlModule.translate("dexClient.generations"), String(entry.generations)),
    )
    extra.append(
      history,
      routeGroup(IntlModule.translate("dexClient.evolvesFrom"), entry.previousIds),
      routeGroup(IntlModule.translate("dexClient.evolvesTo"), entry.nextIds),
    )
    extra.append(element("p", "hint", IntlModule.translate("dexClient.routesFollowThisVPetCatalogOtherDigimon")))
    if (entry.url) {
      const reference = element("button", "utility reference", IntlModule.translate("dexClient.openDigimonReference"))
      reference.type = "button"
      reference.addEventListener("click", () =>
        vscode.postMessage({ type: "dex-reference", id: entry.id, url: entry.url }),
      )
      extra.append(reference)
    }
    body.append(extra)
  } else {
    body.append(
      element(
        "p",
        "hint locked-message",
        model.status === "unavailable"
          ? IntlModule.translate("dexClient.thePartnerArchiveCouldNotBeReadRefresh")
          : IntlModule.translate("dexClient.raiseAndEvolveAPartnerToRegisterThis"),
      ),
    )
  }
  const nav = element("nav", "detail-nav")
  nav.setAttribute("aria-label", IntlModule.translate("dexClient.recordNavigation"))
  const index = filtered.findIndex((e) => e.id === selectedId)
  for (const [offset, label] of [
    [-1, IntlModule.translate("dexClient.previous")],
    [1, IntlModule.translate("dexClient.next")],
  ]) {
    const button = element("button", "", label)
    button.type = "button"
    const target = filtered[index + offset]
    button.disabled = !target
    button.addEventListener("click", () => {
      if (target) selectEntry(target.id, true)
    })
    nav.append(button)
  }
  detail.append(heading, body, nav)
}
const render = () => {
  const query = search.value.trim().toLowerCase()
  filtered = model.entries.filter(
    (entry) =>
      (stage.value === "all" || String(entry.stageNumber) === stage.value) &&
      (discovery.value === "all" || entry.discovered === (discovery.value === "registered")) &&
      (entry.id.toLowerCase().includes(query) ||
        (entry.discovered && (entry.name + " " + entry.alternateName).toLowerCase().includes(query))),
  )
  if (!filtered.some((entry) => entry.id === selectedId)) selectedId = filtered[0]?.id
  entries.className = "entries " + mode
  const fragment = document.createDocumentFragment()
  for (const entry of filtered) {
    const button = element("button", "entry" + (entry.discovered ? "" : " locked"))
    button.type = "button"
    button.dataset.id = entry.id
    button.setAttribute(
      "aria-label",
      entry.id +
        ", " +
        entry.name +
        ", " +
        translateStage(entry) +
        ", " +
        (entry.discovered
          ? IntlModule.translate("dexClient.registered")
          : IntlModule.translate("dexClient.undiscovered2")),
    )
    const status = element("span", "entry-status")
    status.setAttribute("aria-hidden", "true")
    status.append(
      element(
        "span",
        "status-text",
        entry.discovered ? IntlModule.translate("dexClient.found") : IntlModule.translate("dexClient.locked"),
      ),
    )
    const mark = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    mark.setAttribute("viewBox", "0 0 8 8")
    mark.setAttribute("class", "status-mark")
    const markPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
    markPath.setAttribute("fill", "currentColor")
    markPath.setAttribute("d", entry.discovered ? "M1 4h1v1h1v1h1V4h1V2h1V1h1v2H6v2H5v2H3V6H2V5H1z" : "M2 4h4v1H2z")
    mark.append(markPath)
    status.append(mark)
    button.append(
      element("span", "entry-id", entry.id),
      sprite(entry, "entry-sprite"),
      element("span", "entry-name", entry.discovered ? entry.name : "???"),
      element("span", "entry-stage", translateStage(entry)),
      status,
    )
    button.addEventListener("click", () => selectEntry(entry.id))
    fragment.append(button)
  }
  entries.replaceChildren(fragment)
  document.getElementById("no-results").hidden = filtered.length > 0
  document.getElementById("result-count").textContent = filtered.length + " / " + model.entries.length
  document.getElementById("discovered-count").textContent =
    model.status === "unavailable" ? "--" : String(model.discovered).padStart(3, "0")
  document.getElementById("total-count").textContent = String(model.entries.length)
  const progress = Math.round((model.discovered / Math.max(1, model.entries.length)) * 100)
  document.getElementById("percent").textContent = model.status === "unavailable" ? "--" : progress + "%"
  const meter = document.getElementById("meter")
  meter.setAttribute("aria-valuenow", String(progress))
  meter.setAttribute(
    "aria-valuetext",
    model.status === "unavailable"
      ? IntlModule.translate("dexClient.archiveUnavailable")
      : IntlModule.translate("dex.discoveredCount", { count: model.discovered, total: model.entries.length }),
  )
  document.getElementById("meter-fill").style.width = progress + "%"
  const notice = document.getElementById("notice")
  notice.hidden = model.status === "available"
  notice.textContent = translateReference(model.messageKey, model.message)
  document.getElementById("archive-status").textContent =
    model.status === "unavailable"
      ? IntlModule.translate("dexClient.archiveOffline")
      : IntlModule.translate("dexClient.localArchive")
  for (const value of ["grid", "list"])
    document.getElementById(value + "-mode").setAttribute("aria-pressed", String(mode === value))
  renderSelection()
  remember()
}
search.addEventListener("input", render)
stage.addEventListener("change", render)
discovery.addEventListener("change", render)
entries.addEventListener("scroll", remember)
entries.addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
  event.preventDefault()
  const index = filtered.findIndex((e) => e.id === selectedId)
  const columns = mode === "list" ? 1 : Math.max(1, getComputedStyle(entries).gridTemplateColumns.split(" ").length)
  const step =
    event.key === "ArrowDown" ? columns : event.key === "ArrowUp" ? -columns : event.key === "ArrowLeft" ? -1 : 1
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? filtered.length - 1
        : Math.min(filtered.length - 1, Math.max(0, index + step))
  if (filtered[next]) selectEntry(filtered[next].id, true)
})
for (const value of ["grid", "list"])
  document.getElementById(value + "-mode").addEventListener("click", () => {
    mode = value
    render()
  })
document.getElementById("refresh").addEventListener("click", () => vscode.postMessage({ type: "dex-refresh" }))
const applyRequestedSelection = () => {
  const target = model.entries.find((entry) => entry.id === requestedId && entry.discovered)
  if (!target) return false
  search.value = ""
  stage.value = "all"
  discovery.value = "all"
  selectedId = target.id
  render()
  selectEntry(target.id, true)
  return true
}
window.addEventListener("message", (event) => {
  if (event.data?.type === "dex-select") {
    requestedId = event.data.id
    applyRequestedSelection()
    return
  }
  if (event.data?.type !== "dex-model") return
  model = event.data.model
  if (applyRequestedSelection()) return
  const scroll = entries.scrollTop
  render()
  entries.scrollTop = scroll
})
render()
if (Number.isFinite(saved.scroll)) entries.scrollTop = saved.scroll
vscode.postMessage({ type: "dex-ready" })
