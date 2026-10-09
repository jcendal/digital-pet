import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { Script } from "node:vm"
import { DEX_SCRIPT } from "@jcendal/digital-pet-webviews/panels/dex/dex-script.ts"
import { HISTORY_SCRIPT } from "@jcendal/digital-pet-webviews/panels/history/history-script.ts"
import { PANEL_THEME } from "@jcendal/digital-pet-webviews/shared/theme.ts"
import { SIDEBAR_SCRIPT } from "@jcendal/digital-pet-webviews/sidebar/sidebar-script.ts"
import { buildSync } from "esbuild"

test("shared Cursor clients retain their classic-script and text-import contract", () => {
  const native = {
    dex: DEX_SCRIPT,
    history: HISTORY_SCRIPT,
    sidebar: SIDEBAR_SCRIPT,
    theme: PANEL_THEME,
  }
  const result = buildSync({
    stdin: {
      resolveDir: resolve(import.meta.dir, "../../../.."),
      contents: `
export { DEX_SCRIPT as dex } from "@jcendal/digital-pet-webviews/panels/dex/dex-script.ts";
export { HISTORY_SCRIPT as history } from "@jcendal/digital-pet-webviews/panels/history/history-script.ts";
export { SIDEBAR_SCRIPT as sidebar } from "@jcendal/digital-pet-webviews/sidebar/sidebar-script.ts";
export { PANEL_THEME as theme } from "@jcendal/digital-pet-webviews/shared/theme.ts";
`,
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    target: "node24",
    logLevel: "silent",
  })
  const output = result.outputFiles[0]
  if (!output) throw new Error("Expected bundled browser assets")
  const module = { exports: {} as typeof native }
  new Script(output.text).runInNewContext({ module, exports: module.exports })

  for (const key of Object.keys(native) as (keyof typeof native)[]) expect(module.exports[key]).toBe(native[key])
  for (const key of ["dex", "history", "sidebar"] as const) expect(() => new Script(module.exports[key])).not.toThrow()
})
