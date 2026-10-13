import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { Script } from "node:vm"
import { expect, test } from "@playwright/test"
import { buildSync } from "esbuild"

const preview = () => {
  const bundle = buildSync({
    stdin: {
      resolveDir: resolve(import.meta.dirname, "../../../.."),
      contents: `
import { buildSidebarWebviewHtml } from "@jcendal/digital-pet-webviews/sidebar/sidebar-document.ts";
import { MonsterAnimationController } from "@jcendal/digital-pet-animation/idle/monster-animation.ts";
import { renderPositionedArtwork } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts";
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts";
export const html = buildSidebarWebviewHtml("cursor-test", {
  fontUri: "/fonts/Silkscreen-Regular.ttf",
  cspSource: "'self'",
  adventureSceneUri: "/regions/dragon-eye-lake/scene.svg",
});
const animation = new MonsterAnimationController(MONSTER_FRAME_CATALOG, () => 0.5, () => 0);
animation.dispatch({ kind: "partner_changed", partner: { sprite: "greymon", isDigitama: false } });
animation.dispatch({ kind: "adventure_changed", active: true });
export const artwork = renderPositionedArtwork(animation.output(), 50);
`,
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    target: "node24",
    logLevel: "silent",
  })
  const output = bundle.outputFiles[0]
  if (!output) throw new Error("Missing Cursor sidebar preview")
  const module = { exports: {} as { html: string; artwork: string } }
  new Script(output.text).runInNewContext({ module, exports: module.exports })
  return module.exports
}

test("Cursor adventure keeps the pet above a continuously moving landscape and pauses cleanly", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  const { html, artwork } = preview()
  await page.addInitScript(() => {
    Object.assign(window, { digitalPetBridge: { postMessage: () => {} } })
  })
  await page.route("**/__cursor-preview", (route) => route.fulfill({ contentType: "text/html", body: html }))
  await page.route("**/regions/dragon-eye-lake/scene.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: readFileSync(resolve(import.meta.dirname, "../../../digital-pet-fields/assets/scenes/lake.svg")),
    }),
  )
  await page.route("**/fonts/Silkscreen-Regular.ttf", (route) =>
    route.fulfill({
      contentType: "font/ttf",
      body: readFileSync(
        resolve(import.meta.dirname, "../../../digital-pet-webviews/assets/fonts/Silkscreen-Regular.ttf"),
      ),
    }),
  )
  await page.setViewportSize({ width: 300, height: 440 })
  await page.goto("/__cursor-preview")
  const scenery = page.locator(".adventure-scenery")
  const pet = page.locator("#artwork")
  await page.evaluate((frame) => {
    window.postMessage(
      {
        type: "sidebar-model",
        kind: "partner",
        name: "Greymon",
        stage: "Champion",
        progress: 0.65,
        terminal: false,
        gauge: "65 / 100",
        frozen: false,
      },
      location.origin,
    )
    window.postMessage({ type: "animation-frame", artwork: frame }, location.origin)
    window.postMessage(
      {
        type: "adventure-state",
        view: {
          available: true,
          readyAt: 0,
          lootLifetimeMs: 10000,
          state: { id: "preview", status: "travel", running: true, elapsedMs: 0 },
        },
      },
      location.origin,
    )
  }, artwork)
  await expect(page.locator(".pet-module")).toHaveClass(/adventuring/)
  await expect(scenery).toBeVisible()
  await expect(pet.locator("rect").first()).toHaveCSS("fill", "rgb(38, 53, 30)")
  const layering = await pet
    .locator("rect")
    .first()
    .evaluate((pixel) => {
      const box = pixel.getBoundingClientRect()
      const background = document.querySelector<HTMLElement>(".adventure-scenery")
      if (!background) throw new Error("Missing adventure scenery")
      background.style.pointerEvents = "auto"
      const layers = document.elementsFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      background.style.pointerEvents = ""
      const spriteIndex = layers.indexOf(pixel)
      const sceneryIndex = layers.findIndex((node) => node.classList.contains("adventure-scenery"))
      return { spriteIndex, sceneryIndex }
    })
  expect(layering.spriteIndex).toBeGreaterThanOrEqual(0)
  expect(layering.sceneryIndex).toBeGreaterThan(layering.spriteIndex)
  const firstPosition = await scenery.evaluate((node) => getComputedStyle(node).backgroundPositionX)
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "adventure-state",
        view: {
          available: true,
          readyAt: 0,
          lootLifetimeMs: 10000,
          state: { id: "preview", status: "travel", running: true, elapsedMs: 2000 },
        },
      },
      location.origin,
    )
  })
  await expect
    .poll(() => scenery.evaluate((node) => getComputedStyle(node).backgroundPositionX))
    .not.toBe(firstPosition)
  await expect(scenery).toHaveCSS("background-position-x", "-120px")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(scenery).toHaveCSS("background-position-x", "0px")
  await expect(scenery).toHaveCSS("transition-duration", "0s")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect(scenery).toHaveCSS("background-position-x", "-120px")
  await page.screenshot({ path: testInfo.outputPath("cursor-adventure.png") })
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "adventure-state",
        view: {
          available: true,
          readyAt: 0,
          lootLifetimeMs: 10000,
          state: { id: "preview", status: "travel", running: false, elapsedMs: 2000 },
        },
      },
      location.origin,
    )
  })
  await expect(scenery).not.toBeVisible()
  await expect(scenery).toHaveCSS("animation-name", "none")
  await expect(scenery).toHaveCSS("background-position-x", "-120px")
})
