import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "bun:test"

import { pushRelease } from "../../../scripts/push-release.ts"

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
}

const git = (cwd: string, args: readonly string[]): void => {
  execFileSync("git", args, { cwd, env: gitEnv, stdio: "pipe" })
}

const commitRelease = (cwd: string, fileName: string, tag: string): void => {
  writeFileSync(join(cwd, fileName), `${fileName}\n`)
  writeFileSync(join(cwd, "package-lock.json"), `${fileName}-release\n`)
  git(cwd, ["add", fileName, "package-lock.json"])
  git(cwd, ["commit", "-m", `release ${fileName}`])
  git(cwd, ["tag", "-a", tag, "-m", tag])
  writeFileSync(join(cwd, fileName), `${fileName}-dev\n`)
  git(cwd, ["add", fileName])
  git(cwd, ["commit", "-m", `dev ${fileName}`])
}

describe("push release when main moved", () => {
  let root: string | undefined

  afterEach(() => {
    if (root !== undefined) rmSync(root, { recursive: true, force: true })
  })

  test("Given another product already pushed When this release pushes Then both changes land on main", () => {
    root = mkdtempSync(join(tmpdir(), "push-release-"))
    const origin = join(root, "origin.git")
    const seed = join(root, "seed")
    const first = join(root, "first")
    const second = join(root, "second")
    git(root, ["init", "--bare", "-b", "main", origin])
    git(root, ["init", "-b", "main", seed])
    writeFileSync(join(seed, "package.json"), '{"name":"root","version":"0.0.0","private":true}\n')
    writeFileSync(join(seed, "package-lock.json"), "base\n")
    git(seed, ["add", "package.json", "package-lock.json"])
    git(seed, ["commit", "-m", "init"])
    git(seed, ["remote", "add", "origin", origin])
    git(seed, ["push", "origin", "main"])
    git(root, ["clone", origin, first])
    git(root, ["clone", origin, second])
    for (const cwd of [first, second]) {
      git(cwd, ["config", "user.name", "Test"])
      git(cwd, ["config", "user.email", "test@example.com"])
    }
    commitRelease(first, "opencode.txt", "opencode-v1.0.0")
    commitRelease(second, "cursor.txt", "cursor-v1.0.0")

    const previous = process.cwd()
    try {
      process.chdir(first)
      pushRelease("opencode-v1.0.0")
      process.chdir(second)
      pushRelease("cursor-v1.0.0")
    } finally {
      process.chdir(previous)
    }

    const check = join(root, "check")
    git(root, ["clone", origin, check])
    expect(execFileSync("git", ["tag", "--list"], { cwd: check, encoding: "utf8" })).toContain("opencode-v1.0.0")
    expect(execFileSync("git", ["tag", "--list"], { cwd: check, encoding: "utf8" })).toContain("cursor-v1.0.0")
    expect(execFileSync("git", ["show", "HEAD:opencode.txt"], { cwd: check, encoding: "utf8" })).toBe(
      "opencode.txt-dev\n",
    )
    expect(execFileSync("git", ["show", "HEAD:cursor.txt"], { cwd: check, encoding: "utf8" })).toBe("cursor.txt-dev\n")
  })
})
