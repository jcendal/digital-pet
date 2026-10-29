/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { createPixelFrame } from "@jcendal/digital-pet-animation/themes/pixel-frame.ts"
import { createVisualScene } from "@jcendal/digital-pet-animation/themes/visual-scene.ts"
import type { TextRenderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { createEffect, createSignal } from "solid-js"
import { terminalSceneContent, updateThemeArtworkRow } from "../src/tui/theme-artwork.ts"

test("OpenTUI paints both half-cell colors and removes them when the next scene is empty", async () => {
  const scene = createVisualScene("color", 3, 2, [
    {
      frame: createPixelFrame(3, 2, [null, "#ff0000", "#0000ff"], [1, 0, 0, 2, 2, 0]),
      x: 0,
      y: 0,
      scale: 1,
      facing: "left",
      opacity: 1,
    },
  ])
  const [content, setContent] = createSignal(terminalSceneContent(scene, "#123456")[0])
  const setup = await testRender(
    () => {
      let row: TextRenderable | undefined
      createEffect(() => {
        const next = content()
        if (row && next) updateThemeArtworkRow(row, next)
      })
      return (
        <text
          ref={(renderable) => {
            row = renderable
          }}
          bg="#123456"
        />
      )
    },
    { width: 3, height: 1 },
  )
  try {
    await setup.flush()
    expect(setup.captureCharFrame().trimEnd()).toBe("▀▄")
    const spans = setup.captureSpans().lines[0]?.spans ?? []
    expect(spans[0]?.fg.toInts()).toEqual([255, 0, 0, 255])
    expect(spans[0]?.bg.toInts()).toEqual([0, 0, 255, 255])
    expect(spans[1]?.fg.toInts()).toEqual([0, 0, 255, 255])
    expect(spans[1]?.bg.toInts()).toEqual([18, 52, 86, 255])
    setContent(terminalSceneContent(createVisualScene("lcd", 3, 2, []), "#123456")[0])
    await setup.flush()
    expect(setup.captureCharFrame().trim()).toBe("")
    for (const span of setup.captureSpans().lines[0]?.spans ?? []) expect(span.bg.toInts()).toEqual([18, 52, 86, 255])
  } finally {
    setup.renderer.destroy()
  }
})
