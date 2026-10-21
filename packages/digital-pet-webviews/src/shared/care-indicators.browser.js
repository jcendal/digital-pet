window.createCareIndicator = (kind, label, value, className = "") => {
  const indicator = document.createElement("span")
  indicator.className = `care-indicator ${className}`.trim()
  indicator.dataset.indicator = kind
  indicator.setAttribute("role", "img")
  indicator.setAttribute("aria-label", label)
  indicator.title = label
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  icon.setAttribute("viewBox", kind === "care" ? "0 4 16 16" : "0 0 9 9")
  icon.setAttribute("aria-hidden", "true")
  icon.setAttribute("focusable", "false")
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
  path.setAttribute("fill-rule", "evenodd")
  path.setAttribute(
    "d",
    kind === "care"
      ? "M8 6h2v2h1v2h2v3h2v5H1v-5h2v-3h2V8h3zM6 10h5v1H6zM4 13h9v1H4zM3 16h10v1H3z"
      : "M1 2h2v5H1zM0 3h1v3H0zM3 4h3v1H3zM6 2h2v5H6zM8 3h1v3H8z",
  )
  icon.append(path)
  const number = document.createElement("span")
  number.className = "care-indicator-value"
  number.textContent = value
  number.setAttribute("aria-hidden", "true")
  indicator.append(icon, number)
  return indicator
}
