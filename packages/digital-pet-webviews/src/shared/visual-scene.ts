import { type VisualScene, visitLayerPixels } from "@jcendal/digital-pet-animation/themes/visual-scene.ts"
import { escapeHtml } from "./escape-html.ts"

/** One path per palette color/layer keeps sprite painting independent of host APIs. */
export const visualScenePaths = (scene: VisualScene): readonly { path: string; color: string; opacity: number }[] =>
  scene.layers.flatMap((layer) => {
    const paths = new Map<string, string[]>()
    visitLayerPixels(scene, layer, (x, y, color) => {
      const segments = paths.get(color) ?? []
      segments.push(`M${x} ${y}h1v1h-1z`)
      paths.set(color, segments)
    })
    return [...paths].map(([color, segments]) => ({ color, path: segments.join(""), opacity: layer.opacity }))
  })

/** Only trusted numeric geometry and validated palette colors reach this markup. */
export const renderVisualSceneSvg = (scene: VisualScene): string =>
  `<svg viewBox="0 0 ${scene.width} ${scene.height}" aria-hidden="true" shape-rendering="crispEdges">${visualScenePaths(
    scene,
  )
    .map(
      ({ path, color, opacity }) => `<path fill="${escapeHtml(color)}" opacity="${opacity}" d="${escapeHtml(path)}"/>`,
    )
    .join("")}</svg>`
