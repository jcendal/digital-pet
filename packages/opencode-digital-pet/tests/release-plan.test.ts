import { describe, expect, test } from "bun:test"

import { planMergedRelease } from "../../../scripts/plan-merged-release.ts"

const productTags = ["v0.1.1", "opencode-digital-pet-v0.2.0", "cursor-digital-pet-v0.2.0"]

describe("merged pull request release planning", () => {
  test("Given no product releases When the release workflow PR merges Then both 0.2.0 candidates are released", () => {
    expect(
      planMergedRelease({
        changedFiles: [".github/workflows/release-after-merge.yml"],
        tags: ["v0.1.0", "v0.1.1"],
        title: "fix: automate releases",
        labels: [],
        opencodeVersion: "0.2.0-dev.0",
        alreadyReleased: { opencode: false, cursor: false },
      }),
    ).toEqual({
      opencode: { release: true, bump: "minor" },
      cursor: { release: true, bump: "patch" },
    })
  })

  test("Given existing product releases When only Cursor changes Then OpenCode is not republished", () => {
    expect(
      planMergedRelease({
        changedFiles: ["packages/cursor-digital-pet/src/extension.ts"],
        tags: productTags,
        title: "feat: improve the sidebar",
        labels: [],
        opencodeVersion: "0.2.1-dev.0",
        alreadyReleased: { opencode: false, cursor: false },
      }),
    ).toEqual({
      opencode: { release: false, bump: "minor" },
      cursor: { release: true, bump: "minor" },
    })
  })

  test("Given a shared package change When the PR has a release label Then both packages use that bump", () => {
    expect(
      planMergedRelease({
        changedFiles: ["packages/digital-pet-core/src/schema.ts"],
        tags: productTags,
        title: "refactor: change the database schema",
        labels: ["release:major"],
        opencodeVersion: "0.2.1-dev.0",
        alreadyReleased: { opencode: false, cursor: false },
      }),
    ).toEqual({
      opencode: { release: true, bump: "major" },
      cursor: { release: true, bump: "major" },
    })
  })

  test("Given a merge already contained in each product tag When a queued run starts Then it publishes nothing", () => {
    const plan = planMergedRelease({
      changedFiles: ["packages/opencode-digital-pet/src/index.ts", "packages/cursor-digital-pet/src/extension.ts"],
      tags: productTags,
      title: "fix: update both hosts",
      labels: [],
      opencodeVersion: "0.2.1-dev.0",
      alreadyReleased: { opencode: true, cursor: true },
    })

    expect(plan.opencode.release).toBe(false)
    expect(plan.cursor.release).toBe(false)
  })

  test("Given a documentation-only PR after the first releases When it merges Then it publishes nothing", () => {
    const plan = planMergedRelease({
      changedFiles: ["docs/monorepo.md"],
      tags: productTags,
      title: "docs: clarify releases",
      labels: [],
      opencodeVersion: "0.2.1-dev.0",
      alreadyReleased: { opencode: false, cursor: false },
    })

    expect(plan.opencode.release).toBe(false)
    expect(plan.cursor.release).toBe(false)
  })

  test("Given conflicting release labels When planning Then it rejects the ambiguous version bump", () => {
    expect(() =>
      planMergedRelease({
        changedFiles: ["packages/opencode-digital-pet/src/index.ts"],
        tags: productTags,
        title: "fix: update the plugin",
        labels: ["release:minor", "release:major"],
        opencodeVersion: "0.2.1-dev.0",
        alreadyReleased: { opencode: false, cursor: false },
      }),
    ).toThrow("only one")
  })
})
