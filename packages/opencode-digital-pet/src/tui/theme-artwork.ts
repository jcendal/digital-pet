import { renderTerminalScene } from "@jcendal/digital-pet-animation/render/terminal-scene.ts"
import type { VisualScene } from "@jcendal/digital-pet-animation/themes/visual-scene.ts"
import { RGBA, StyledText, type TextRenderable } from "@opentui/core"

/** Solid coerces its JSX content prop to a string; assign styled rows through the renderable instead. */
export const updateThemeArtworkRow = (renderable: TextRenderable, content: StyledText): void => {
  renderable.content = content
  renderable.requestRender()
}

/** Translate shared pixel scenes through OpenTUI's supported styled-text API. */
export const terminalSceneContent = (scene: VisualScene, backdrop: string): readonly StyledText[] => {
  const colors = new Map<string, RGBA>()
  const color = (value: string): RGBA => {
    let cached = colors.get(value)
    if (!cached) {
      cached = RGBA.fromHex(value)
      colors.set(value, cached)
    }
    return cached
  }
  return renderTerminalScene(scene, backdrop).map(
    (row) =>
      new StyledText(
        row.runs.map((run) => ({
          __isChunk: true,
          text: row.text.slice(run.start, run.start + run.length),
          ...(run.fg === null ? {} : { fg: color(run.fg) }),
          ...(run.bg === null ? {} : { bg: color(run.bg) }),
        })),
      ),
  )
}
