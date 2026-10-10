import { expect, test } from "bun:test"
import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const packages = fileURLToPath(new URL("../..", import.meta.url))
const placeholders = (copy: string) => [...copy.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

test("every package ships complete locale catalogs with matching placeholders and plain text", async () => {
  for (const name of await readdir(packages)) {
    const directory = `${packages}/${name}/assets/i18n`
    const en: Record<string, string> = JSON.parse(await readFile(`${directory}/en.json`, "utf8"))
    expect(Object.keys(en).length).toBeGreaterThan(0)
    for (const locale of ["ko", "es", "gl"]) {
      const dictionary: Record<string, string> = JSON.parse(await readFile(`${directory}/${locale}.json`, "utf8"))
      expect(Object.keys(dictionary).sort()).toEqual(Object.keys(en).sort())
      for (const [key, copy] of Object.entries(en)) {
        const translation = dictionary[key]
        expect(typeof translation).toBe("string")
        expect(translation?.trim().length).toBeGreaterThan(0)
        expect(placeholders(translation ?? "")).toEqual(placeholders(copy))
        expect(translation).not.toMatch(/<\/?[a-z]+(?:\s[^>]*)?>/i)
      }
    }
  }
})
