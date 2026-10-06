import { spawnSync } from "node:child_process"

const MAX_ATTEMPTS = 5

const run = (command: string, args: readonly string[], allowFailure = false): string => {
  const result = spawnSync(command, args, { encoding: "utf8" })
  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}`)
  }
  return result.stdout
}

const git = (args: readonly string[], allowFailure = false): string => run("git", args, allowFailure)

const succeeded = (args: readonly string[]): boolean => spawnSync("git", args, { encoding: "utf8" }).status === 0

const conflictedPaths = (): string[] =>
  git(["diff", "--name-only", "--diff-filter=U"])
    .split("\n")
    .map((path) => path.trim())
    .filter((path) => path.length > 0)

const resolveLockfileConflict = (): void => {
  const conflicts = conflictedPaths()
  const unexpected = conflicts.filter((path) => path !== "package-lock.json")
  if (unexpected.length > 0) {
    throw new Error(
      `Cannot retry the release push. Conflicts are not limited to package-lock.json: ${unexpected.join(", ")}`,
    )
  }
  git(["checkout", "--ours", "--", "package-lock.json"])
  run("npm", ["install", "--package-lock-only", "--ignore-scripts"])
  git(["add", "package-lock.json"])
  git(["-c", "core.editor=true", "cherry-pick", "--continue"])
}

const replay = (commit: string): void => {
  if (!succeeded(["cherry-pick", commit])) resolveLockfileConflict()
}

export const pushRelease = (tag: string): void => {
  const releaseCommit = git(["rev-parse", "HEAD~1"]).trim()
  const devCommit = git(["rev-parse", "HEAD"]).trim()
  const message = git(["for-each-ref", "--format=%(contents)", `refs/tags/${tag}`]).trim() || tag

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (succeeded(["push", "--atomic", "origin", "HEAD:refs/heads/main", `refs/tags/${tag}`])) return
    if (attempt === MAX_ATTEMPTS) break
    process.stderr.write(`main moved during the release. Retrying push ${attempt} of ${MAX_ATTEMPTS - 1}.\n`)
    git(["fetch", "origin", "main"])
    git(["switch", "--detach", "origin/main"])
    replay(releaseCommit)
    git(["tag", "-f", "-a", tag, "HEAD", "-m", message])
    replay(devCommit)
  }
  throw new Error(`Could not push ${tag} after main moved.`)
}

if (import.meta.main) {
  const tag = process.argv[2]
  if (tag === undefined || tag.length === 0) throw new Error("Expected the release tag to push.")
  pushRelease(tag)
}
