// biome-ignore lint/correctness/noUnusedVariables: Called by the panel client after both sources are embedded together.
function createPanelHelpers(entries) {
  function translateReference(reference, fallback) {
    if (!reference) return fallback
    const [namespace, key] = reference.split(":")
    return getIntlModule().translate(key, {}, namespace)
  }
  function translateStage(entry) {
    return entry.stageKey && IntlModule.locale !== "en"
      ? getIntlModule().translate(entry.stageKey, {}, "core")
      : entry.stage
  }

  const element = (tag, className, text) => {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }
  const UNKNOWN = "M5 3h6v1H5zM4 4h2v2H4zM10 4h2v3h-2zM8 7h3v1H8zM7 8h2v3H7zM7 13h2v2H7z"
  const sprite = (entry, className) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("viewBox", "0 0 16 16")
    svg.setAttribute("aria-hidden", "true")
    if (className) svg.setAttribute("class", className)
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", entry.artwork || UNKNOWN)
    path.setAttribute("fill", "currentColor")
    svg.append(path)
    return svg
  }
  entries.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".entry")) return
    const filters = document.getElementById("filters")
    if (filters) filters.open = false
    if (!window.digitalPetBridge) return
    requestAnimationFrame(() => {
      const screen = document.querySelector(".screen")
      const heading = document.querySelector(".catalog-header")
      if (screen && heading)
        screen.scrollTop += heading.getBoundingClientRect().top - screen.getBoundingClientRect().top - 16
    })
  })

  return { element, sprite, translateReference, translateStage }
}
