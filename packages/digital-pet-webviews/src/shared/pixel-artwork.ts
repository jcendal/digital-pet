const artworkPixels = (artwork: string): readonly { x: number; y: number }[] => {
  const pixels: { x: number; y: number }[] = []
  for (const [row, line] of artwork.split("\n").entries()) {
    for (const [column, cell] of Array.from(line).entries()) {
      if (cell === "█" || cell === "▀") pixels.push({ x: column, y: row * 2 })
      if (cell === "█" || cell === "▄") pixels.push({ x: column, y: row * 2 + 1 })
    }
  }
  return pixels
}

const pixelPath = (pixels: readonly { x: number; y: number }[]): string =>
  pixels.map(({ x, y }) => `M${x} ${y}h1v1h-1z`).join("")

/** Expand terminal half-block artwork back into the original square LCD pixels. */
export const artworkToPixelPath = (artwork: string): string => pixelPath(artworkPixels(artwork))

/** Center the visible pixels while keeping a consistent scale between species. */
export const artworkToCenteredPixelArt = (artwork: string): { path: string; viewBox: string } => {
  const pixels = artworkPixels(artwork)
  if (!pixels.length) return { path: "", viewBox: "0 0 32 32" }
  const left = Math.min(...pixels.map((pixel) => pixel.x))
  const top = Math.min(...pixels.map((pixel) => pixel.y))
  const right = Math.max(...pixels.map((pixel) => pixel.x)) + 1
  const bottom = Math.max(...pixels.map((pixel) => pixel.y)) + 1
  const size = Math.max(32, right - left, bottom - top)
  return {
    path: pixelPath(pixels),
    viewBox: `${(left + right - size) / 2} ${(top + bottom - size) / 2} ${size} ${size}`,
  }
}
