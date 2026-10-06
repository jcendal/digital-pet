/** Expand terminal half-block artwork back into the original square LCD pixels. */
export const artworkToPixelPath = (artwork: string): string => {
  const pixels: string[] = []
  for (const [row, line] of artwork.split("\n").entries()) {
    for (const [column, cell] of Array.from(line).entries()) {
      if (cell === "█" || cell === "▀") pixels.push(`M${column} ${row * 2}h1v1h-1z`)
      if (cell === "█" || cell === "▄") pixels.push(`M${column} ${row * 2 + 1}h1v1h-1z`)
    }
  }
  return pixels.join("")
}
