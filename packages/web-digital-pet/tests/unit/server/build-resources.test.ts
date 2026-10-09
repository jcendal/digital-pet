import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"

import { loadBuildResources } from "../../../src/server/rendering/build-resources.ts"

test("entry tags include transitive CSS once and fail on missing manifest entries", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "pet-manifest-"))
  try {
    await mkdir(resolve(root, ".vite"))
    await writeFile(resolve(root, ".vite/resources.json"), JSON.stringify({ "/font.ttf": "/assets/font-123.ttf" }))
    await writeFile(
      resolve(root, ".vite/manifest.json"),
      JSON.stringify({
        "src/client/shell/main.browser.js": {
          file: "assets/shell-123.js",
          css: ["assets/shell-123.css"],
          imports: ["shared", "shared"],
        },
        shared: { file: "assets/shared-456.js", css: ["assets/common-456.css"], imports: ["shared"] },
      }),
    )
    const resources = await loadBuildResources(root, "browser")
    const tags = resources.entryTags("shell")
    expect(tags.match(/common-456.css/g)).toHaveLength(1)
    expect(tags.indexOf("common-456.css")).toBeLessThan(tags.indexOf("shell-123.css"))
    expect(tags).toContain('type="module" src="/assets/shell-123.js"')
    expect(resources.assets["/font.ttf"]).toBe("/assets/font-123.ttf")
    expect(() => resources.entryTags("frame")).toThrow("Missing Vite entry")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
