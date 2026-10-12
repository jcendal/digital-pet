;(() => {
  const view = document.getElementById("world-map-view")
  if (!view) return
  const zones = Array.from(view.querySelectorAll("[data-map-zone]"))
  const options = Array.from(view.querySelectorAll("[data-map-location]"))
  const viewport = view.querySelector(".map-viewport")
  const picker = view.querySelector("#map-location-picker")
  const traveler = view.querySelector("#map-traveler")
  const heading = view.querySelector("#map-location-name")
  const status = view.querySelector("#map-status")
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
  let selected = ""
  let openZone
  let walkingTimer
  const closePicker = (restoreFocus = false) => {
    const previous = openZone
    picker.hidden = true
    openZone = undefined
    for (const zone of zones) zone.setAttribute("aria-expanded", "false")
    if (restoreFocus) previous?.focus()
  }
  const positionPicker = () => {
    if (!openZone || picker.hidden) return
    const bounds = viewport.getBoundingClientRect()
    const anchor = openZone.getBoundingClientRect()
    const left = anchor.x + anchor.width / 2 - bounds.x - picker.offsetWidth / 2
    const below = anchor.bottom - bounds.y + 4
    const top = below + picker.offsetHeight <= bounds.height ? below : anchor.y - bounds.y - picker.offsetHeight - 4
    picker.style.left = `${Math.max(8, Math.min(left, bounds.width - picker.offsetWidth - 8))}px`
    picker.style.top = `${Math.max(8, Math.min(top, bounds.height - picker.offsetHeight - 8))}px`
  }
  window.addEventListener("digital-pet:map-state", (event) => {
    const state = event.detail
    const location = options.find((option) => option.dataset.mapLocation === state.locationId)
    if (!location) return
    const current =
      zones.find((zone) => zone.dataset.mapZone === state.locationId) ??
      zones.find((zone) => zone.dataset.regionId === location.dataset.regionId)
    if (!current) return
    for (const option of options) {
      const name = state.names?.[option.dataset.mapLocation]
      if (name) {
        option.dataset.name = name
        option.querySelector(".map-option-name").textContent = name
        option.title = name
      }
      option.disabled = state.busy
      option.setAttribute("aria-pressed", String(option === location))
    }
    for (const zone of zones) {
      const name = state.names?.[zone.dataset.mapZone]
      if (name) {
        zone.dataset.name = name
        zone.setAttribute("aria-label", name)
        zone.querySelector(".map-place-name").textContent = name
      }
      zone.disabled = state.busy
      zone.setAttribute("aria-pressed", String(zone === current))
      zone.querySelector(".map-boss-star").hidden = !state.bossRegionIds.includes(zone.dataset.regionId)
    }
    heading.textContent = location.dataset.name
    heading.title = location.dataset.name
    status.textContent = state.error ?? ""
    view.setAttribute("aria-busy", String(state.busy))
    if (selected !== state.locationId) {
      clearTimeout(walkingTimer)
      const moved = traveler.style.left !== current.style.left || traveler.style.top !== current.style.top
      const walking = selected && moved && !view.hidden && !reducedMotion.matches
      traveler.classList.toggle("walking", Boolean(walking))
      traveler.style.left = current.style.left
      traveler.style.top = current.style.top
      traveler.hidden = false
      selected = state.locationId
      walkingTimer = setTimeout(() => traveler.classList.remove("walking"), 700)
    }
    positionPicker()
  })
  view.addEventListener("click", (event) => {
    const zone = event.target.closest("[data-map-zone]")
    if (zone && !zone.disabled) {
      if (openZone === zone) {
        closePicker()
        return
      }
      closePicker()
      openZone = zone
      for (const option of options) option.hidden = option.dataset.regionId !== zone.dataset.regionId
      zone.setAttribute("aria-expanded", "true")
      picker.hidden = false
      positionPicker()
      const visible = options.filter((option) => !option.hidden)
      ;(visible.find((option) => option.dataset.mapLocation === selected) ?? visible[0])?.focus()
      return
    }
    const option = event.target.closest("[data-map-location]")
    if (option && !option.disabled) {
      closePicker(true)
      if (option.dataset.mapLocation !== selected)
        window.dispatchEvent(new CustomEvent("digital-pet:map-travel", { detail: option.dataset.mapLocation }))
    } else if (event.target.closest("#map-picker-close")) closePicker(true)
  })
  document.addEventListener("pointerdown", (event) => {
    if (!picker.contains(event.target) && !event.target.closest("[data-map-zone]")) closePicker()
  })
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !picker.hidden) {
      event.preventDefault()
      closePicker(true)
    }
  })
  window.addEventListener("resize", positionPicker)
  window.addEventListener("digital-pet:map-open", () => closePicker())
  new MutationObserver(() => {
    if (view.hidden) closePicker()
  }).observe(view, { attributes: true, attributeFilter: ["hidden"] })
})()
