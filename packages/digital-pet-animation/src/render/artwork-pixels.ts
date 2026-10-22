export const artworkPixels = (artwork: string): readonly { x: number; y: number }[] => {
  const pixels: { x: number; y: number }[] = []
  for (const [row, line] of artwork.split("\n").entries()) {
    for (const [column, cell] of Array.from(line).entries()) {
      if (cell === "█" || cell === "▀") pixels.push({ x: column, y: row * 2 })
      if (cell === "█" || cell === "▄") pixels.push({ x: column, y: row * 2 + 1 })
    }
  }
  return pixels
}
