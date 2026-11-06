import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { LEGAL_SLUGS, renderLegalPage } from "../src/server/legal/page.ts"

const hash = (content: string | Buffer) => createHash("sha256").update(content).digest("hex")

export const exportLegalPages = async (packageRoot: string, output: string): Promise<void> => {
  const assets = resolve(packageRoot, "assets/legal")
  const manifest = JSON.parse(await readFile(resolve(assets, "manifest.json"), "utf8")) as {
    source: string
    privacy: string
    terms: string
  }
  const source = await readFile(resolve(packageRoot, "src/server/legal/documents.es.json"))
  if (manifest.source !== hash(source)) throw new Error("Legal text changed: regenerate PDFs with npm run legal:pdf")
  await mkdir(resolve(output, "legal"), { recursive: true })
  for (const slug of LEGAL_SLUGS) {
    const pdf = await readFile(resolve(assets, `${slug}.pdf`))
    if (manifest[slug] !== hash(pdf) || !pdf.subarray(0, 5).equals(Buffer.from("%PDF-")))
      throw new Error(`Invalid legal PDF: ${slug}`)
    await writeFile(resolve(output, `legal/${slug}.html`), renderLegalPage(slug))
    await writeFile(resolve(output, `legal/${slug}.pdf`), pdf)
  }
}
