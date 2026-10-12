;(() => {
  const view = document.getElementById("world-map-view")
  if (!view) return
  const buttons = Array.from(view.querySelectorAll("[data-map-location]"))
  const traveler = view.querySelector("#map-traveler")
  const heading = view.querySelector("#map-location-name")
  const status = view.querySelector("#map-status")
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
  let selected = ""
  let walkingTimer
  window.addEventListener("digital-pet:map-state", (event) => {
    const state = event.detail
    const current = buttons.find((button) => button.dataset.mapLocation === state.locationId)
    if (!current) return
    for (const button of buttons) {
      const name = state.names?.[button.dataset.mapLocation]
      if (name) {
        button.dataset.name = name
        button.setAttribute("aria-label", name)
        button.querySelector(".map-place-name").textContent = name
      }
      button.disabled = state.busy
      button.setAttribute("aria-pressed", String(button === current))
      button.querySelector(".map-boss-star").hidden = !state.bossRegionIds.includes(button.dataset.regionId)
    }
    heading.textContent = current.dataset.name
    heading.title = current.dataset.name
    status.textContent = state.error ?? ""
    view.setAttribute("aria-busy", String(state.busy))
    if (selected !== state.locationId) {
      clearTimeout(walkingTimer)
      const walking = selected && !view.hidden && !reducedMotion.matches
      traveler.classList.toggle("walking", Boolean(walking))
      traveler.style.left = current.style.left
      traveler.style.top = current.style.top
      traveler.hidden = false
      selected = state.locationId
      walkingTimer = setTimeout(() => traveler.classList.remove("walking"), 700)
    }
  })
  view.addEventListener("click", (event) => {
    const button = event.target.closest("[data-map-location]")
    if (!button || button.disabled || button.dataset.mapLocation === selected) return
    window.dispatchEvent(new CustomEvent("digital-pet:map-travel", { detail: button.dataset.mapLocation }))
  })
})()
