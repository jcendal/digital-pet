import { expect, test } from "@playwright/test"

for (const [slug, title] of [
  ["privacy", "Política de privacidad"],
  ["terms", "Condiciones del servicio"],
]) {
  test(`${slug} is public, readable on mobile and serves a PDF without authentication`, async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const response = await page.goto(`http://127.0.0.1:4175/legal/${slug}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Descargar PDF" })).toHaveAttribute("href", `/legal/${slug}.pdf`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    for (const port of [4175, 4176, 4177]) {
      const html = await request.get(`http://127.0.0.1:${port}/legal/${slug}`)
      expect(html.status()).toBe(200)
      expect(await html.text()).toContain(`<title>${title} | Digital Pet</title>`)
      const pdf = await request.get(`http://127.0.0.1:${port}/legal/${slug}.pdf`)
      expect(pdf.status()).toBe(200)
      expect(pdf.headers()["content-type"]).toContain("application/pdf")
      expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-")
    }
  })
}
