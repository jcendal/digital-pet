export type PixelFrame = Readonly<{
  width: number
  height: number
  /** Index zero is transparent. All other entries are opaque sRGB colors. */
  palette: readonly (string | null)[]
  pixels: readonly number[]
}>

export const MAX_FRAME_DIMENSION = 256
export const isPixelColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)

export const createPixelFrame = (
  width: number,
  height: number,
  palette: readonly (string | null)[],
  pixels: readonly number[],
): PixelFrame => {
  const colors = Array.from(palette)
  const indices = Array.from(pixels)
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_FRAME_DIMENSION ||
    height > MAX_FRAME_DIMENSION
  )
    throw new Error("Invalid pixel frame dimensions")
  if (
    colors.length < 1 ||
    colors.length > 256 ||
    colors[0] !== null ||
    colors.slice(1).some((color) => !isPixelColor(color))
  )
    throw new Error("Invalid pixel frame palette")
  if (
    indices.length !== width * height ||
    indices.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= colors.length)
  )
    throw new Error("Invalid pixel frame indices")
  return Object.freeze({
    width,
    height,
    palette: Object.freeze(colors.map((color) => color?.toLowerCase() ?? null)),
    pixels: Object.freeze(indices),
  })
}

/** Portable, bounded run-length decoding. Import tooling owns zlib decompression. */
export const decodePixelRuns = (
  width: number,
  height: number,
  palette: readonly (string | null)[],
  encoded: string,
): PixelFrame => {
  const maximum = MAX_FRAME_DIMENSION * MAX_FRAME_DIMENSION
  const expected = width * height
  if (!Number.isSafeInteger(expected) || expected < 1 || expected > maximum || encoded.length > maximum * 4)
    throw new Error("Invalid encoded pixel frame size")
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
    throw new Error("Invalid pixel frame encoding")
  const bytes = atob(encoded)
  if (bytes.length % 2 !== 0) throw new Error("Truncated pixel run")
  const pixels: number[] = []
  for (let offset = 0; offset < bytes.length; offset += 2) {
    const count = bytes.charCodeAt(offset)
    const index = bytes.charCodeAt(offset + 1)
    if (!count || pixels.length + count > expected) throw new Error("Invalid pixel run length")
    for (let repeat = 0; repeat < count; repeat += 1) pixels.push(index)
  }
  return createPixelFrame(width, height, palette, pixels)
}

/** Decode existing LCD artwork without thresholding or recoloring a color sprite. */
export const lcdArtworkFrame = (content: string, ink: string, width = 16, height = 16): PixelFrame => {
  const rows = content.split("\n").map((row) => Array.from(row))
  if (height % 2 || rows.length !== height / 2 || rows.some((row) => row.length !== width))
    throw new Error("Invalid LCD artwork dimensions")
  const pixels: number[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const glyph = rows[Math.floor(y / 2)]?.[x]
      if (glyph !== " " && glyph !== "█" && glyph !== "▀" && glyph !== "▄")
        throw new Error("Unsupported LCD artwork glyph")
      pixels.push(glyph === "█" || glyph === (y % 2 ? "▄" : "▀") ? 1 : 0)
    }
  }
  return createPixelFrame(width, height, [null, ink], pixels)
}

export const mirrorPixelFrame = (frame: PixelFrame): PixelFrame =>
  createPixelFrame(
    frame.width,
    frame.height,
    frame.palette,
    frame.pixels.map((_, index) => {
      const row = Math.floor(index / frame.width)
      return frame.pixels[row * frame.width + frame.width - 1 - (index % frame.width)] ?? 0
    }),
  )
