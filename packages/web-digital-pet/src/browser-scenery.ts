import {
  advanceLandscape,
  LANDSCAPE_MOTION_KEY,
  landscapeDirection,
  landscapeMotionEnabled,
  type SceneMotion,
} from "./scene-motion.ts"

export const initPartnerScenery = () => {
  const arena = document.querySelector<HTMLElement>(".arena")!
  const scenery = document.createElement("div")
  scenery.className = "world-scenery"
  scenery.setAttribute("aria-hidden", "true")
  const track = document.createElement("div")
  track.className = "world-scenery-track"
  const tiles = Array.from({ length: 4 }, () => {
    const tile = document.createElement("img")
    tile.alt = ""
    tile.draggable = false
    track.append(tile)
    return tile
  })
  scenery.append(track)
  arena.prepend(scenery)
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
  let preference = localStorage.getItem(LANDSCAPE_MOTION_KEY)
  const enabled = () => landscapeMotionEnabled(preference, reducedMotion.matches)
  window.addEventListener("storage", (event) => {
    if (event.key === LANDSCAPE_MOTION_KEY || event.key === null)
      preference = localStorage.getItem(LANDSCAPE_MOTION_KEY)
  })
  let previous: SceneMotion | undefined
  let direction: -1 | 0 | 1 = 0
  let offset = 0
  let width = arena.clientWidth
  let requested: number | undefined
  let lastTime = 0
  let lastMotionAt = 0
  let locationId = ""

  const paint = () => {
    track.style.transform = `translateX(${offset}px)`
  }
  new ResizeObserver(() => {
    const nextWidth = arena.clientWidth
    if (width > 0 && nextWidth > 0) offset *= nextWidth / width
    width = nextWidth
    paint()
  }).observe(arena)

  const visible = () => !document.hidden && window.frameElement?.getAttribute("aria-hidden") !== "true"
  const animate = (now: number) => {
    requested = undefined
    if (!enabled() || !visible() || !direction || now - lastMotionAt > 1300) return
    offset = advanceLandscape(offset, direction, now - lastTime, width)
    lastTime = now
    paint()
    requested = requestAnimationFrame(animate)
  }
  const setLocation = (next: string) => {
    if (locationId === next) return
    locationId = next
    offset = 0
    previous = undefined
    direction = 0
    for (const tile of tiles) tile.src = `/regions/${encodeURIComponent(next)}/scene.svg`
    paint()
  }
  setLocation(arena.dataset.locationId ?? "dragon-eye-lake")

  return {
    setLocation,
    update(motion: SceneMotion | undefined) {
      if (!motion) {
        previous = undefined
        direction = 0
        return
      }
      direction = landscapeDirection(previous, motion)
      previous = motion
      lastMotionAt = performance.now()
      if (direction && requested === undefined && enabled() && visible()) {
        lastTime = lastMotionAt
        requested = requestAnimationFrame(animate)
      }
    },
  }
}
