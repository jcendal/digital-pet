import { expect, test } from "bun:test"
import { renderTerminalScene } from "../src/render/terminal-scene.ts"
import { createPixelFrame, decodePixelRuns, lcdArtworkFrame, mirrorPixelFrame } from "../src/themes/pixel-frame.ts"
import { createVisualScene, parseVisualScene, type VisualLayer } from "../src/themes/visual-scene.ts"

const layer = (frame: VisualLayer["frame"], changes: Partial<VisualLayer> = {}): VisualLayer => ({
  frame,
  x: 0,
  y: 0,
  facing: "left",
  opacity: 1,
  scale: 1,
  ...changes,
})

test("terminal half blocks retain different upper/lower colors and transparent halves", () => {
  const frame = createPixelFrame(4, 2, [null, "#ff0000", "#0000ff"], [1, 1, 0, 0, 2, 0, 2, 0])
  const rows = renderTerminalScene(createVisualScene("color", 4, 2, [layer(frame)]), "#ffffff")
  expect(rows).toEqual([
    {
      text: "▀▀▄ ",
      runs: [
        { start: 0, length: 1, fg: "#ff0000", bg: "#0000ff" },
        { start: 1, length: 1, fg: "#ff0000", bg: null },
        { start: 2, length: 1, fg: "#0000ff", bg: null },
        { start: 3, length: 1, fg: null, bg: null },
      ],
    },
  ])
  const cleared = renderTerminalScene(createVisualScene("color", 4, 2, []), "#ffffff")
  expect(cleared[0]).toEqual({ text: "    ", runs: [{ start: 0, length: 4, fg: null, bg: null }] })
})

test("independent fighter/projectile palettes survive mirroring, clipping and opacity", () => {
  const red = createPixelFrame(2, 2, [null, "#ff0000"], [1, 0, 1, 0])
  const blue = createPixelFrame(2, 2, [null, "#0000ff"], [1, 0, 1, 0])
  const green = createPixelFrame(1, 2, [null, "#00ff00"], [1, 1])
  const scene = createVisualScene("color", 4, 2, [
    layer(red),
    layer(blue, { x: 2, facing: "right" }),
    layer(green, { x: 1 }),
    layer(blue, { x: 0, opacity: 0.5 }),
    layer(green, { x: -2 }),
  ])
  expect(renderTerminalScene(scene, "#ffffff")[0]?.runs.map((run) => run.fg)).toEqual([
    "#800080",
    "#00ff00",
    null,
    "#0000ff",
  ])
  expect(red.pixels).toEqual([1, 0, 1, 0])
})

test("integer scaling and odd viewport heights have stable terminal geometry", () => {
  const frame = createPixelFrame(1, 1, [null, "#ffffff"], [1])
  const rows = renderTerminalScene(
    createVisualScene("color", 3, 3, [layer(frame, { x: 1, y: 1, scale: 2 })]),
    "#000000",
  )
  expect(rows.map((row) => row.text)).toEqual([" ▄▄", " ▀▀"])
  expect(rows[1]?.runs.at(-1)?.bg).toBeNull()
})

test("JSON wire round trips preserve scenes and reject invalid or unbounded inputs", () => {
  const original = createVisualScene("lcd", 2, 2, [layer(createPixelFrame(2, 2, [null, "#26351e"], [0, 1, 1, 0]))])
  const wire = JSON.parse(JSON.stringify(original))
  expect(parseVisualScene(wire)).toEqual(original)
  wire.layers[0].frame.pixels[0] = 1
  expect(original.layers[0]?.frame.pixels[0]).toBe(0)
  for (const patch of [
    { version: 2 },
    { theme: "future" },
    { width: 513 },
    { width: 1.5 },
    { layers: Array(33).fill({}) },
    { layers: Array(1) },
  ])
    expect(parseVisualScene({ ...original, ...patch })).toBeNull()
  expect(
    parseVisualScene({
      get version() {
        throw new Error("Unreadable input")
      },
    }),
  ).toBeNull()
  for (const patch of [
    { opacity: NaN },
    { opacity: -1 },
    { scale: 0 },
    { scale: 9 },
    { x: Infinity },
    { facing: "up" },
  ])
    expect(parseVisualScene({ ...original, layers: [{ ...original.layers[0], ...patch }] })).toBeNull()
  expect(
    parseVisualScene({
      ...original,
      layers: [{ ...original.layers[0], frame: { ...original.layers[0]?.frame, pixels: [999] } }],
    }),
  ).toBeNull()
})

test("pixel frames reject malformed palettes, sparse arrays and decompression overflow", () => {
  expect(() => createPixelFrame(1, 1, [null, "url(evil)"], [1])).toThrow()
  expect(() => createPixelFrame(1, 1, [null], [1])).toThrow()
  expect(() => createPixelFrame(1, 1, [null], Array(1))).toThrow()
  expect(() => createPixelFrame(257, 1, [null], [])).toThrow()
  expect(() => decodePixelRuns(1, 1, [null], btoa(String.fromCharCode(2, 0)))).toThrow()
  expect(() => decodePixelRuns(1, 1, [null], btoa(String.fromCharCode(0, 0)))).toThrow()
  expect(() => decodePixelRuns(1, 1, [null], btoa(String.fromCharCode(1)))).toThrow()
  expect(() => decodePixelRuns(1, 1, [null], "?")).toThrow()
})

test("LCD conversion retains the original mask and mirroring is lossless", () => {
  const frame = lcdArtworkFrame("█▀▄ ", "#26351e", 4, 2)
  expect(frame.pixels).toEqual([1, 1, 0, 0, 1, 0, 1, 0])
  expect(mirrorPixelFrame(mirrorPixelFrame(frame))).toEqual(frame)
  expect(Object.isFrozen(frame.pixels)).toBe(true)
  expect(() => lcdArtworkFrame("caption", "#26351e", 7, 2)).toThrow()
})
