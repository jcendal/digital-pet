import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { WebResources } from "../../../src/server/rendering/build-resources.ts"
import { PUBLIC_SITE_URL, socialMetadata } from "../../../src/server/rendering/social-metadata.ts"
import { resourceFiles } from "../../../tooling/resources.ts"

const root = resolve(import.meta.dir, "../../..")
const files = resourceFiles(root)
const resources: WebResources = {
  mode: "browser",
  assets: Object.fromEntries(Object.keys(files).map((path) => [path, `/assets/test${path.replaceAll("/", "-")}`])),
  entryTags: () => "",
}

test("sharing metadata includes the crawler title, description and absolute image properties", () => {
  const head = socialMetadata(resources)
  expect(head).toContain('<meta property="og:type" content="website">')
  expect(head).toContain(`<meta property="og:url" content="${PUBLIC_SITE_URL}">`)
  expect(head).toContain(`<link rel="canonical" href="${PUBLIC_SITE_URL}">`)
  expect(head).toContain('<meta property="og:image:width" content="1200">')
  expect(head).toContain('<meta property="og:image:height" content="630">')
  expect(head).toContain('<meta name="twitter:card" content="summary_large_image">')
  expect(head).toContain('content="https://digital-pet.rebase.es/assets/test-social-digital-pet-share.png"')
  for (const key of ["og:title", "og:description", "og:image:alt"])
    expect(head).toMatch(new RegExp(`<meta property="${key}" content="[^"]+">`))
  expect(head.match(/property="og:image"/g)).toHaveLength(1)
})

test("sharing URLs are escaped and do not trust the local request origin", () => {
  const html = socialMetadata({
    ...resources,
    assets: { "/social/digital-pet-share.png": '/assets/card.png?crop=wide&label="preview"' },
  })
  expect(html).toContain("https://digital-pet.rebase.es/assets/card.png?")
  expect(html).toContain("&amp;label=")
  expect(html).not.toContain('label="preview"')
  expect(html).not.toContain("localhost")
})

test("sharing image dimensions and all install presentation assets agree with the resource inventory", async () => {
  const path = files["/social/digital-pet-share.png"]
  if (!path) throw new Error("Missing sharing image")
  const png = await readFile(path)
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
  expect(png.readUInt32BE(16)).toBe(1200)
  expect(png.readUInt32BE(20)).toBe(630)
  const manifest = JSON.parse(await readFile(resolve(root, "assets/manifest.webmanifest"), "utf8"))
  expect(manifest.id).toBe("/")
  expect(manifest.start_url).toBe("/")
  expect(manifest.screenshots.map((image: { form_factor: string }) => image.form_factor)).toEqual(["narrow", "wide"])
  const images = [...manifest.icons, ...manifest.screenshots]
  for (const shortcut of manifest.shortcuts) images.push(...shortcut.icons)
  for (const image of images) expect(files[image.src]).toBeDefined()
})
