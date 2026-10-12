import { expect, type Page, test } from "@playwright/test"
import { saveAdventure } from "./helpers/adventure.ts"
import { openOptions } from "./helpers/navigation.ts"

const revealMusic = async (page: Page): Promise<void> => {
  await page.locator("#options-dialog .dialog-body").evaluate((body) => {
    const section = body.querySelector<HTMLElement>(".music-section")!
    body.scrollTop +=
      section.getBoundingClientRect().top -
      body.getBoundingClientRect().top -
      (body.clientHeight - section.clientHeight) / 2
  })
  await expect(page.locator("#options-dialog .dialog-head")).toBeInViewport({ ratio: 1 })
  await expect(page.locator(".music-section")).toBeInViewport({ ratio: 1 })
}

test("real MP3 playback waits for a gesture, loops, and remembers mute across reloads", async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  const audio = page.locator("#background-music")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  await expect(audio).toHaveJSProperty("paused", true)
  await expect(audio).not.toHaveAttribute("src")
  // The first gesture is inside the pet iframe, not in the shell's Options panel.
  await pet.locator("#world-location").click()
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0.2)
  await expect(audio).toHaveAttribute("src", /butter-fly-.*\.mp3$/)
  await expect(audio).toHaveJSProperty("loop", true)
  await expect(audio).toHaveJSProperty("error", null)
  await page.locator('a[data-page="sidebar"]').click()
  await audio.evaluate((element: HTMLAudioElement) => {
    element.currentTime = element.duration - 0.3
  })
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeLessThan(3)
  await expect(audio).toHaveJSProperty("paused", false)
  await expect(audio).toHaveJSProperty("ended", false)

  // Only the pet frame, at this origin, may change the soundtrack.
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>('iframe[data-page="sidebar"]')!
    for (const [origin, source] of [
      ["https://example.com", frame.contentWindow],
      [location.origin, window],
    ] as const)
      window.dispatchEvent(
        new MessageEvent("message", {
          origin,
          source,
          data: { type: "digital-pet:presentation-state", phase: "battle" },
        }),
      )
  })
  await expect(audio).toHaveAttribute("src", /butter-fly-.*\.mp3$/)
  await openOptions(page)
  await expect(page.locator("#music-toggle")).toHaveAttribute("aria-pressed", "true")
  await revealMusic(page)
  await page.screenshot({ path: testInfo.outputPath("music-options-390.png") })
  await page.setViewportSize({ width: 320, height: 760 })
  await revealMusic(page)
  await page.screenshot({ path: testInfo.outputPath("music-options-320.png") })
  await page.locator("#music-toggle").click()
  await expect(audio).toHaveJSProperty("paused", true)
  await expect(page.locator("#music-state")).toHaveText("OFF")
  await page.reload()
  await openOptions(page)
  await expect(page.locator("#music-toggle")).toHaveAttribute("aria-pressed", "false")
  await expect(audio).toHaveJSProperty("paused", true)
  await expect(audio).not.toHaveAttribute("src")
  await page.locator("#music-toggle").click()
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0.2)
  await expect(audio).toHaveJSProperty("error", null)
  expect(errors).toEqual([])
})

test("an actual adventure battle changes music offline, then returns to the world theme", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    Math.random = () => 0.9
  })
  await page.goto("/")
  const pet = page.frameLocator('iframe[data-page="sidebar"]')
  await expect(pet.locator("#name")).not.toHaveText("")
  await saveAdventure(page, true)
  await expect(pet.locator("#adventure-toggle")).toHaveAttribute("aria-label", "Continue")
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      )
  })
  await context.setOffline(true)
  const audio = page.locator("#background-music")
  await pet.locator("#adventure-toggle").click()
  await expect(pet.locator(".pet-module")).toHaveClass(/battling/)
  await expect(audio).toHaveAttribute("src", /brave-heart-.*\.mp3$/)
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0.2)
  await expect(audio).toHaveJSProperty("error", null)
  await page.screenshot({ path: testInfo.outputPath("music-battle-offline.png") })
  const source = await audio.getAttribute("src")
  const range = await page.evaluate(async (source) => {
    const response = await fetch(source!, { headers: { Range: "bytes=0-1" } })
    return { status: response.status, length: (await response.arrayBuffer()).byteLength }
  }, source)
  expect(range).toEqual({ status: 206, length: 2 })
  await expect(pet.locator(".pet-module")).not.toHaveClass(/battling/, { timeout: 40_000 })
  await expect(audio).toHaveAttribute("src", /butter-fly-.*\.mp3$/)
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0.2)
  await expect(audio).toHaveJSProperty("error", null)
  await audio.evaluate((element: HTMLAudioElement) => {
    element.currentTime = element.duration - 0.3
  })
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeLessThan(3)
  await expect(audio).toHaveJSProperty("paused", false)
  await page.reload()
  await expect(pet.locator("#name")).not.toHaveText("")
  await openOptions(page)
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0.2)
  await expect(page.locator("#music-toggle")).toHaveAttribute("aria-pressed", "true")
})

test("the production server supplies audio ranges with the correct media type", async ({ request }) => {
  const resources: Record<string, string> = await (
    await request.get("http://127.0.0.1:4175/.vite/resources.json")
  ).json()
  for (const name of ["butter-fly", "brave-heart"]) {
    const source = `http://127.0.0.1:4176${resources[`/music/${name}.mp3`]}`
    const partial = await request.get(source, { headers: { Range: "bytes=0-1" } })
    expect(partial.status()).toBe(206)
    expect(partial.headers()["content-type"]).toBe("audio/mpeg")
    expect(partial.headers()["content-range"]).toMatch(/^bytes 0-1\/\d+$/)
    expect(await partial.body()).toHaveLength(2)
  }
})
