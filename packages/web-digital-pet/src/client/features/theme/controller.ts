import type { ArtworkSnapshot } from "@jcendal/digital-pet-animation/themes/artwork-snapshot.ts"
import { VISUAL_THEMES } from "@jcendal/digital-pet-animation/themes/theme.ts"
import { createVisualScene } from "@jcendal/digital-pet-animation/themes/visual-scene.ts"
import { normalizeVisualTheme, type VisualThemeId } from "@jcendal/digital-pet-core/config/theme.ts"
import { LOCATIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import { visualScenePaths } from "@jcendal/digital-pet-webviews/shared/visual-scene.ts"
import { webAsset } from "../../platform/assets.ts"
import "./styles.css"

export const THEME_KEY = "digital-pet:theme"
let current: VisualThemeId = "lcd"
let colors: typeof import("@jcendal/digital-pet-animation/themes/color-scene.ts") | undefined
let loading: Promise<typeof colors> | undefined
const svgNS = "http://www.w3.org/2000/svg"
const portraits = new WeakMap<SVGElement, { key: string; viewBox: string }>()
const images = new Map<string, { lcd: string; color: string }>()
for (const place of LOCATIONS) {
  const pair = {
    lcd: webAsset(`/regions/${place.id}/scene.svg`),
    color: webAsset(`/regions/${place.id}/scene-color.svg`),
  }
  images.set(pair.lcd, pair)
  images.set(pair.color, pair)
}
const mapPair = { lcd: webAsset("/maps/file-island.svg"), color: webAsset("/maps/file-island-color.svg") }
images.set(mapPair.lcd, mapPair)
images.set(mapPair.color, mapPair)

export const visualTheme = (): VisualThemeId => current
const readTheme = (): VisualThemeId => {
  try {
    return normalizeVisualTheme(localStorage.getItem(THEME_KEY))
  } catch {
    return "lcd"
  }
}
const paths = (parent: SVGElement, scene: Parameters<typeof visualScenePaths>[0]) => {
  for (const { path, color, opacity } of visualScenePaths(scene)) {
    const node = document.createElementNS(svgNS, "path")
    node.setAttribute("d", path)
    node.setAttribute("fill", color)
    node.style.fill = color
    node.setAttribute("opacity", String(opacity))
    parent.append(node)
  }
}
const paintPortraits = () => {
  if (current === "color" && !colors) return
  for (const svg of Array.from(document.querySelectorAll<SVGElement>("svg[data-monster-id]"))) {
    const id = svg.dataset.monsterId ?? ""
    const origin = svg.dataset.eggOrigin ?? ""
    const key = `${id}:${origin}:${current}`
    const previous = portraits.get(svg)
    if (previous?.key === key) continue
    const originalViewBox = previous?.viewBox ?? svg.getAttribute("viewBox") ?? "0 0 16 16"
    svg.querySelector(".theme-color-art")?.remove()
    svg.removeAttribute("data-color-ready")
    if (current === "color" && colors) {
      const frame = colors.colorMonsterFrame(id, "walk_1", origin)
      if (frame) {
        const group = document.createElementNS(svgNS, "g")
        group.classList.add("theme-color-art")
        paths(group, createVisualScene("color", 16, 16, [{ frame, x: 0, y: 0, scale: 1, facing: "left", opacity: 1 }]))
        svg.append(group)
        svg.dataset.colorReady = "true"
        const size = Number(originalViewBox.split(" ")[2]) || 16
        svg.setAttribute("viewBox", `${8 - size / 2} ${8 - size / 2} ${size} ${size}`)
      }
    } else svg.setAttribute("viewBox", originalViewBox)
    portraits.set(svg, { key, viewBox: originalViewBox })
  }
  for (const image of Array.from(document.querySelectorAll<HTMLImageElement>("img"))) {
    const pair = images.get(image.getAttribute("src") ?? "")
    if (pair && image.getAttribute("src") !== pair[current]) image.src = pair[current]
  }
}

const apply = async (theme: VisualThemeId) => {
  current = theme
  const tokens = VISUAL_THEMES[theme].tokens
  const root = document.documentElement
  root.dataset.theme = theme
  for (const [name, value] of Object.entries(tokens)) {
    const cssName =
      name === "screen"
        ? "lcd"
        : name === "screenEdge"
          ? "lcd-edge"
          : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    root.style.setProperty(`--${cssName}`, value)
  }
  for (const control of Array.from(document.querySelectorAll<HTMLSelectElement>("#theme-select"))) control.value = theme
  if (theme === "color" && !colors) {
    loading ??= import("@jcendal/digital-pet-animation/themes/color-scene.ts")
    try {
      colors = await loading
    } catch {
      loading = undefined
      root.dataset.themeError = "assets-unavailable"
      return
    }
  }
  root.removeAttribute("data-theme-error")
  paintPortraits()
  window.dispatchEvent(new Event("digital-pet:theme-render"))
}

/** A host preference: no save reload, animation restart, or peer transaction. */
export const setVisualTheme = async (theme: VisualThemeId): Promise<void> => {
  localStorage.setItem(THEME_KEY, theme)
  await apply(theme)
}

export const initVisualTheme = () => {
  Object.assign(window, {
    digitalPetVisuals: {
      paint(
        svg: SVGElement,
        snapshot: ArtworkSnapshot | undefined,
        state: Record<string, string>,
        model: { team?: { principal?: { nodeId?: string } } } | null,
      ) {
        if (current !== "color" || !colors || !snapshot) return false
        const ids = [state.fromNodeId, state.toNodeId, state.opponentNodeId, model?.team?.principal?.nodeId].filter(
          (id): id is string => Boolean(id),
        )
        const scene = colors.colorArtworkScene(snapshot, ids)
        svg.replaceChildren()
        svg.setAttribute("viewBox", `0 0 ${scene.width} ${scene.height}`)
        paths(svg, scene)
        return true
      },
    },
  })
  void apply(readTheme())
  window.addEventListener("storage", (event) => {
    if (event.key === THEME_KEY || event.key === null) void apply(readTheme())
  })
  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      paintPortraits()
    })
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-monster-id", "data-egg-origin", "src"],
  })
  paintPortraits()
}

export const themedExchangeArtwork = (
  fallback: import("@jcendal/digital-pet-animation/sequences/partner-exchange.ts").ExchangeArtwork,
  outgoing: string,
  incoming: string,
) => (current === "color" && colors ? colors.colorExchangeArtwork(outgoing, incoming) : fallback)

export const paintExchangeColors = (
  svg: SVGElement,
  frame: Record<
    "outgoing" | "incoming" | "trail" | "sparks",
    readonly import("@jcendal/digital-pet-animation/sequences/partner-exchange.ts").ExchangePixel[]
  >,
) => {
  svg.querySelector(".exchange-color-art")?.remove()
  const color = current === "color" && colors !== undefined
  for (const id of ["outgoing", "incoming", "trail", "sparks"]) {
    const original = svg.querySelector<SVGElement>(`#social-exchange-${id}`)
    if (original) original.style.display = color ? "none" : ""
  }
  if (!color) return
  const group = document.createElementNS(svgNS, "g")
  group.classList.add("exchange-color-art")
  for (const [kind, pixels] of Object.entries(frame)) {
    if (!["outgoing", "incoming", "trail", "sparks"].includes(kind) || !Array.isArray(pixels)) continue
    const shades = new Map<string, string[]>()
    for (const pixel of pixels) {
      const shade = pixel.color ?? (kind === "sparks" ? "#c78215" : "#3f8cac")
      const path = shades.get(shade) ?? []
      const size = Math.max(1, Math.round(pixel.size))
      path.push(`M${Math.round(pixel.x)} ${Math.round(pixel.y)}h${size}v${size}h-${size}z`)
      shades.set(shade, path)
    }
    for (const [shade, parts] of shades) {
      const path = document.createElementNS(svgNS, "path")
      path.setAttribute("d", parts.join(""))
      path.style.fill = shade
      if (kind === "trail") path.style.opacity = "0.3"
      group.append(path)
    }
  }
  svg.append(group)
}
