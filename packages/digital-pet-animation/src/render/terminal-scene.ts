import { isPixelColor } from "../themes/pixel-frame.ts"
import { type VisualScene, visitLayerPixels } from "../themes/visual-scene.ts"

export type TerminalPixelRun = Readonly<{ start: number; length: number; fg: string | null; bg: string | null }>
export type TerminalPixelRow = Readonly<{ text: string; runs: readonly TerminalPixelRun[] }>

const blend = (foreground: string, background: string, opacity: number): string => {
  if (opacity === 1) return foreground
  let color = "#"
  for (const offset of [1, 3, 5]) {
    const front = Number.parseInt(foreground.slice(offset, offset + 2), 16)
    const back = Number.parseInt(background.slice(offset, offset + 2), 16)
    color += Math.round(front * opacity + back * (1 - opacity))
      .toString(16)
      .padStart(2, "0")
  }
  return color
}

/** A terminal cell retains two pixel colors using foreground/background half blocks. */
export const renderTerminalScene = (scene: VisualScene, backdrop: string): readonly TerminalPixelRow[] => {
  if (!isPixelColor(backdrop)) throw new Error("Invalid terminal backdrop")
  const pixels: (string | null)[] = Array.from({ length: scene.width * scene.height }, () => null)
  for (const layer of scene.layers) {
    visitLayerPixels(scene, layer, (x, y, color) => {
      const index = y * scene.width + x
      pixels[index] = blend(color, pixels[index] ?? backdrop, layer.opacity)
    })
  }
  const rows: TerminalPixelRow[] = []
  for (let y = 0; y < scene.height; y += 2) {
    let text = ""
    const runs: { start: number; length: number; fg: string | null; bg: string | null }[] = []
    for (let x = 0; x < scene.width; x += 1) {
      const top = pixels[y * scene.width + x] ?? null
      const bottom = pixels[(y + 1) * scene.width + x] ?? null
      const fg = top ?? bottom
      const bg = top ? bottom : null
      text += top ? "▀" : bottom ? "▄" : " "
      const previous = runs.at(-1)
      if (previous && previous.fg === fg && previous.bg === bg) previous.length += 1
      else runs.push({ start: x, length: 1, fg, bg })
    }
    rows.push(Object.freeze({ text, runs: Object.freeze(runs.map((run) => Object.freeze(run))) }))
  }
  return Object.freeze(rows)
}
