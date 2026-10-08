const vscode = window.digitalPetBridge || acquireVsCodeApi()
let model = JSON.parse(document.getElementById("history-data").textContent)
const saved = vscode.getState() || {}
const entries = document.getElementById("entries")
const detail = document.getElementById("detail")
const search = document.getElementById("search")
const status = document.getElementById("status")
let selectedId = typeof saved.selectedId === "string" ? saved.selectedId : model.generations[0]?.partnerId
let filtered = []
search.value = typeof saved.search === "string" ? saved.search : ""
status.value = ["all", "current", "retired"].includes(saved.status) ? saved.status : "all"
const remember = () =>
  vscode.setState({ selectedId, search: search.value, status: status.value, scroll: entries.scrollTop })
const { element, sprite } = createPanelHelpers(entries)
const date = (value, time = false) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "--"
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}
const title = (generation) => "GEN " + String(generation.generation).padStart(2, "0")
const state = (generation) => (generation.retiredAt === null ? "CURRENT" : "RETIRED")
const renderSelection = () => {
  for (const button of entries.children) {
    const selected = button.dataset.id === selectedId
    button.setAttribute("aria-pressed", String(selected))
    button.tabIndex = selected ? 0 : -1
  }
  detail.replaceChildren()
  const generation = filtered.find((g) => g.partnerId === selectedId)
  if (!generation) {
    detail.append(
      element(
        "p",
        "no-results",
        model.status === "unavailable"
          ? "History unavailable. Refresh to retry."
          : "Select a generation to see its recorded journey.",
      ),
    )
    return
  }
  const latest = generation.steps.at(-1)
  const heading = element("div", "detail-heading")
  heading.append(element("span", "", title(generation)), element("span", "micro", state(generation)))
  const body = element("div", "detail-body")
  const frame = element("div", "lcd-frame")
  const lcd = element("div", "lcd")
  lcd.append(sprite(latest || { artwork: "" }))
  frame.append(lcd)
  const name = element("div", "detail-name")
  name.append(
    element("h2", "", latest?.name || "No recorded Digimon"),
    element("p", "micro", latest?.stage || "No evolution events"),
  )
  name.append(element("span", "generation-date", "CREATED · " + date(generation.createdAt)))
  if (generation.retiredAt !== null)
    name.append(element("span", "generation-date", "RETIRED · " + date(generation.retiredAt)))
  body.append(frame, name, element("h3", "journey-title", "RECORDED JOURNEY"))
  const timeline = element("ol", "timeline")
  timeline.setAttribute("aria-label", "Recorded evolution journey")
  for (const step of generation.steps) {
    const item = element("li", "")
    item.append(
      element("span", "step-name", step.name),
      element("span", "step-date", step.id + " · " + date(step.createdAt, true)),
    )
    timeline.append(item)
  }
  body.append(timeline)
  if (!generation.steps.length) body.append(element("p", "hint", "No evolution events recorded for this generation."))
  const nav = element("div", "detail-nav")
  const button = element("button", "utility", "VIEW IN DIGIDEX >")
  button.type = "button"
  button.disabled = !latest?.catalogued
  button.addEventListener("click", () => {
    if (latest?.catalogued) vscode.postMessage({ type: "history-dex", id: latest.id, partnerId: generation.partnerId })
  })
  nav.append(button)
  detail.append(heading, body, nav)
}
const select = (id, focus = false) => {
  selectedId = id
  renderSelection()
  remember()
  if (focus) {
    const button = Array.from(entries.children).find((b) => b.dataset.id === id)
    button?.focus({ preventScroll: true })
    button?.scrollIntoView({ block: "nearest" })
  }
}
const render = () => {
  const query = search.value.trim().toLowerCase()
  filtered = model.generations.filter(
    (g) =>
      (status.value === "all" || (g.retiredAt === null ? "current" : "retired") === status.value) &&
      (!query ||
        title(g).toLowerCase().includes(query) ||
        String(g.generation) === query ||
        g.steps.some((s) => s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query))),
  )
  if (!filtered.some((g) => g.partnerId === selectedId)) selectedId = filtered[0]?.partnerId
  document.getElementById("generation-count").textContent =
    model.status === "unavailable" ? "--" : String(model.generations.length).padStart(2, "0")
  document.getElementById("result-count").textContent = filtered.length + " / " + model.generations.length
  const notice = document.getElementById("notice")
  notice.hidden = model.status !== "unavailable"
  notice.textContent = model.status === "unavailable" ? model.message : ""
  document.getElementById("archive-status").textContent =
    model.status === "unavailable" ? "ARCHIVE UNAVAILABLE" : "LOCAL ARCHIVE"
  const empty = document.getElementById("no-results")
  empty.hidden = filtered.length > 0
  empty.textContent =
    model.status === "unavailable"
      ? "Could not read partner history."
      : model.generations.length
        ? "No matching generations. Change your search or status filter."
        : model.message
  entries.replaceChildren()
  for (const generation of filtered) {
    const button = element("button", "entry generation")
    button.type = "button"
    button.dataset.id = generation.partnerId
    button.setAttribute("aria-label", title(generation) + ", " + state(generation).toLowerCase())
    button.append(
      element("span", "generation-title", title(generation)),
      element("span", "", ">"),
      element(
        "span",
        "generation-meta",
        state(generation) + " · " + date(generation.retiredAt || generation.createdAt),
      ),
    )
    button.addEventListener("click", () => select(generation.partnerId))
    entries.append(button)
  }
  renderSelection()
}
for (const control of [search, status])
  control.addEventListener(control === search ? "input" : "change", () => {
    render()
    remember()
  })
entries.addEventListener("scroll", remember)
entries.addEventListener("keydown", (event) => {
  const index = filtered.findIndex((g) => g.partnerId === selectedId)
  const offsets = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
  let next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? filtered.length - 1
        : event.key in offsets
          ? index + offsets[event.key]
          : -1
  if (event.key in offsets || ["Home", "End"].includes(event.key)) {
    event.preventDefault()
    next = Math.max(0, Math.min(filtered.length - 1, next))
    if (filtered[next]) select(filtered[next].partnerId, true)
  }
})
document.getElementById("refresh").addEventListener("click", () => vscode.postMessage({ type: "history-refresh" }))
window.addEventListener("message", (event) => {
  if (event.data?.type !== "history-model") return
  const scroll = entries.scrollTop
  const bodyScroll = detail.querySelector(".detail-body")?.scrollTop || 0
  model = event.data.model
  render()
  entries.scrollTop = scroll
  const body = detail.querySelector(".detail-body")
  if (body) body.scrollTop = bodyScroll
})
render()
if (Number.isFinite(saved.scroll)) entries.scrollTop = saved.scroll
vscode.postMessage({ type: "history-ready" })
