import { resolve } from "node:path"
import { Script } from "node:vm"
import { expect, test } from "@playwright/test"
import { buildSync } from "esbuild"
import { openOptions } from "./helpers/navigation.ts"

test("color battle frames replace every effect at launch, contact, miss and pause", async ({ page }, info) => {
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toBeEmpty()
  await openOptions(page)
  await page.locator("#theme-select").selectOption("color")
  await page.locator("#options-dialog .dialog-close").click()
  await expect(pet.locator("#artwork path")).not.toHaveCount(0)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const send = (message: unknown) =>
    page.evaluate((message) => {
      document
        .querySelector<HTMLIFrameElement>('iframe[data-page="sidebar"]')
        ?.contentWindow?.postMessage(
          { type: "digital-pet:battle-presentation", battleId: "color-frame-review", message },
          location.origin,
        )
    }, message)
  const bundle = buildSync({
    entryPoints: [resolve(import.meta.dirname, "helpers/color-battle.ts")],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    target: "node24",
    logLevel: "silent",
  })
  const output = bundle.outputFiles[0]
  if (!output) throw new Error("Missing color battle fixtures")
  const module = { exports: {} as typeof import("./helpers/color-battle.ts") }
  new Script(output.text).runInNewContext({ module, exports: module.exports, atob })
  for (const { id, name, shooter, phase, snapshot, expected } of module.exports.colorBattleFrames) {
    await send({
      type: "sidebar-model",
      kind: "partner",
      name,
      stage: "",
      progress: 0.5,
      gauge: "50 / 100",
      terminal: false,
      frozen: false,
    })
    await send({ type: "presentation-state", state: { phase: "battle", fromNodeId: id, opponentNodeId: id } })
    await send({ type: "animation-frame", artwork: " ", visual: snapshot })
    await expect
      .poll(() =>
        pet.locator("#artwork path").evaluateAll((paths) =>
          paths.map((path) => ({
            path: path.getAttribute("d"),
            color: path.getAttribute("fill"),
            opacity: Number(path.getAttribute("opacity")),
          })),
        ),
      )
      .toEqual(expected)
    if (shooter === "opponent" && ["flight", "hit"].includes(phase))
      await pet.locator("#artwork").screenshot({ path: info.outputPath(`${id}-${shooter}-${phase}.png`) })
  }
  expect(errors).toEqual([])
})
