import { expect, test } from "@playwright/test"

test("static HTML exposes the share card before JavaScript and serves its hashed image", async ({ request }) => {
  const response = await request.get("/")
  expect(response.ok()).toBe(true)
  const html = await response.text()
  const head = html.slice(0, html.indexOf("</head>"))
  expect(head).toContain('property="og:site_name" content="Digital Pet"')
  expect(head).toContain('property="og:image:width" content="1200"')
  expect(head).toContain('property="og:image:height" content="630"')
  expect(head).toContain('name="twitter:card" content="summary_large_image"')
  const image = head.match(/property="og:image" content="([^"]+)"/)?.[1]
  expect(image).toBeTruthy()
  const url = new URL(image ?? "")
  expect(url.origin).toBe("https://digital-pet.rebase.es")
  expect(url.pathname).toMatch(/^\/assets\/digital-pet-share-[\w-]+\.png$/)
  const card = await request.get(url.pathname)
  expect(card.ok()).toBe(true)
  expect(card.headers()["content-type"]).toContain("image/png")
  const bytes = await card.body()
  expect(bytes.readUInt32BE(16)).toBe(1200)
  expect(bytes.readUInt32BE(20)).toBe(630)
})

test("the install manifest serves screenshots and shortcut icons from the compiled asset inventory", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest")
  const manifest = await response.json()
  expect(manifest.id).toBe("/")
  expect(manifest.start_url).toBe("/")
  expect(manifest.screenshots).toHaveLength(2)
  expect(manifest.shortcuts).toHaveLength(2)
  const images = [...manifest.icons, ...manifest.screenshots]
  for (const shortcut of manifest.shortcuts) images.push(...shortcut.icons)
  for (const image of images) {
    expect(image.src).toMatch(/^\/assets\//)
    const asset = await request.get(image.src)
    expect(asset.ok()).toBe(true)
    expect(asset.headers()["content-type"]).toContain(image.type)
  }
})
