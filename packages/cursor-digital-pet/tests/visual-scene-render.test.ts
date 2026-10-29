import { expect, test } from "bun:test"
import { createPixelFrame } from "@jcendal/digital-pet-animation/themes/pixel-frame.ts"
import { createVisualScene, type VisualLayer } from "@jcendal/digital-pet-animation/themes/visual-scene.ts"
import { renderVisualSceneSvg, visualScenePaths } from "@jcendal/digital-pet-webviews/shared/visual-scene.ts"

test("shared SVG rendering retains layered palettes, clipping and crisp pixel geometry", () => {
  const frame = createPixelFrame(2, 2, [null, "#ff0000", "#0000ff"], [1, 0, 0, 2])
  const base: VisualLayer = { frame, x: 0, y: 0, scale: 1, opacity: 1, facing: "left" }
  const scene = createVisualScene("color", 2, 2, [base, { ...base, facing: "right", x: -1, opacity: 0.5 }])
  expect(visualScenePaths(scene)).toEqual([
    { color: "#ff0000", path: "M0 0h1v1h-1z", opacity: 1 },
    { color: "#0000ff", path: "M1 1h1v1h-1z", opacity: 1 },
    { color: "#ff0000", path: "M0 0h1v1h-1z", opacity: 0.5 },
  ])
  const svg = renderVisualSceneSvg(scene)
  expect(svg).toContain('viewBox="0 0 2 2"')
  expect(svg).toContain('shape-rendering="crispEdges"')
  expect(svg).toContain('fill="#0000ff"')
  expect(svg).not.toContain("currentColor")
  expect(svg).not.toContain("<script")
})
