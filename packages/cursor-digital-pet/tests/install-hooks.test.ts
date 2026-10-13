import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { type HooksJson, installDigitalPetHooks } from "../src/adapters/cursor/install-hooks.ts"

describe("Cursor Agent hook updates", () => {
  let tempRoot: string | undefined

  afterEach(() => {
    if (tempRoot !== undefined) rmSync(tempRoot, { recursive: true, force: true })
    tempRoot = undefined
  })

  test("an extension update replaces removed bridge paths while preserving other Agent hooks", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "digital-pet-hooks-"))
    const hooksPath = join(tempRoot, "hooks.json")
    const oldHook = { command: 'node "/extensions/digital-pet-0.2.0/hook-bridge.js"' }
    const otherHook = { command: "node /my-hooks/audit.js" }
    writeFileSync(
      hooksPath,
      JSON.stringify({
        version: 1,
        hooks: {
          beforeSubmitPrompt: [oldHook, otherHook],
          stop: [oldHook],
          afterFileEdit: [otherHook],
        },
      }),
    )

    installDigitalPetHooks("/extensions/digital-pet-0.15.0/hook-bridge.js", hooksPath)

    const config = JSON.parse(readFileSync(hooksPath, "utf8")) as HooksJson
    const updatedHook = { command: 'node "/extensions/digital-pet-0.15.0/hook-bridge.js"' }
    expect(config.hooks.beforeSubmitPrompt).toEqual([otherHook, updatedHook])
    expect(config.hooks.stop).toEqual([updatedHook])
    expect(config.hooks.afterFileEdit).toEqual([otherHook])

    const modifiedAt = statSync(hooksPath).mtimeMs
    installDigitalPetHooks("/extensions/digital-pet-0.15.0/hook-bridge.js", hooksPath)
    expect(statSync(hooksPath).mtimeMs).toBe(modifiedAt)
    expect(JSON.parse(readFileSync(hooksPath, "utf8"))).toEqual(config)
  })
})
