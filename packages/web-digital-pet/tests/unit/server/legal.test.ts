import { expect, test } from "bun:test"
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { LEGAL_SLUGS, legalSlug, renderLegalPage } from "../../../src/server/legal/page.ts"
import { exportLegalPages } from "../../../tooling/export-legal.ts"

const packageRoot = resolve(import.meta.dir, "../../..")

test("legal routes are public documents with canonical URLs and downloadable PDFs", () => {
  for (const slug of LEGAL_SLUGS) {
    expect(legalSlug(`/legal/${slug}`)).toBe(slug)
    const html = renderLegalPage(slug)
    expect(html).toContain('<html lang="es">')
    expect(html).toContain(`https://digital-pet.rebase.es/legal/${slug}`)
    expect(html).toContain(`href="/legal/${slug}.pdf" download`)
    expect(html).toContain("jorge_cendal@hotmail.com")
    expect(html).toContain("18 años")
    expect(html).not.toContain("<script")
    expect(html).not.toContain("/auth/")
  }
  expect(legalSlug("/legal/unknown")).toBeUndefined()
  expect(legalSlug("/legal/privacy/../terms")).toBeUndefined()
})

test("static legal export rejects stale source and altered PDFs instead of publishing conflicting documents", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "digital-pet-legal-"))
  try {
    await cp(resolve(packageRoot, "assets/legal"), resolve(directory, "assets/legal"), { recursive: true })
    await cp(resolve(packageRoot, "src/server/legal"), resolve(directory, "src/server/legal"), { recursive: true })
    const output = resolve(directory, "client")
    await exportLegalPages(directory, output)
    for (const slug of LEGAL_SLUGS) {
      expect(await readFile(resolve(output, `legal/${slug}.html`), "utf8")).toBe(renderLegalPage(slug))
      expect(await readFile(resolve(output, `legal/${slug}.pdf`))).toEqual(
        await readFile(resolve(packageRoot, `assets/legal/${slug}.pdf`)),
      )
    }
    const sourcePath = resolve(directory, "src/server/legal/documents.es.json")
    const source = await readFile(sourcePath)
    await writeFile(sourcePath, `${source.toString()}\n`)
    await expect(exportLegalPages(directory, output)).rejects.toThrow("Legal text changed")
    await writeFile(sourcePath, source)
    await writeFile(resolve(directory, "assets/legal/privacy.pdf"), "%PDF-altered")
    await expect(exportLegalPages(directory, output)).rejects.toThrow("Invalid legal PDF")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
