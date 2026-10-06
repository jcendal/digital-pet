import { spawnSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"

import semver from "semver"

type Product = "opencode" | "cursor"
type ReleaseBump = "patch" | "minor" | "major"

type ReleasePlanInput = {
  readonly changedFiles: readonly string[]
  readonly tags: readonly string[]
  readonly title: string
  readonly labels: readonly string[]
  readonly opencodeVersion: string
  readonly alreadyReleased: Readonly<Record<Product, boolean>>
}

export type ReleasePlan = {
  readonly opencode: { readonly release: boolean; readonly bump: ReleaseBump }
  readonly cursor: { readonly release: boolean; readonly bump: ReleaseBump }
}

const PRODUCT_TAG_PREFIX: Readonly<Record<Product, string>> = {
  opencode: "opencode-digital-pet-v",
  cursor: "cursor-digital-pet-v",
}

const latestStableTag = (tags: readonly string[], prefix: string): string | undefined => {
  const versions = tags.flatMap((tag) => {
    if (!tag.startsWith(prefix)) return []
    const version = tag.slice(prefix.length)
    return semver.valid(version) === version && semver.prerelease(version) === null ? [version] : []
  })
  const latest = semver.rsort(versions)[0]
  return latest === undefined ? undefined : `${prefix}${latest}`
}

const bumpFromPullRequest = (title: string, labels: readonly string[]): ReleaseBump => {
  const selected = (["major", "minor", "patch"] as const).filter((bump) => labels.includes(`release:${bump}`))
  if (selected.length > 1) throw new Error("A pull request may have only one release:major/minor/patch label.")
  if (selected[0] !== undefined) return selected[0]
  if (/^[a-z]+(?:\([^)]*\))?!:/i.test(title) || /BREAKING CHANGE/i.test(title)) return "major"
  if (/^feat(?:\([^)]*\))?(?::|\/)/i.test(title)) return "minor"
  return "patch"
}

const firstOpenCodeBump = (tags: readonly string[], sourceVersion: string, fallback: ReleaseBump): ReleaseBump => {
  const legacyTag = latestStableTag(tags, "v")
  if (legacyTag === undefined) return fallback
  const candidate = sourceVersion.replace(/-dev\.0$/, "")
  const difference = semver.diff(legacyTag.slice(1), candidate)
  if (difference === "major" || difference === "minor" || difference === "patch") return difference
  throw new Error(`Cannot derive the first OpenCode release from ${legacyTag} and ${sourceVersion}.`)
}

export const planMergedRelease = (input: ReleasePlanInput): ReleasePlan => {
  const firstOpenCodeRelease = latestStableTag(input.tags, PRODUCT_TAG_PREFIX.opencode) === undefined
  const firstCursorRelease = latestStableTag(input.tags, PRODUCT_TAG_PREFIX.cursor) === undefined
  const sharedChanged = input.changedFiles.some(
    (path) => path.startsWith("packages/digital-pet-core/") || path.startsWith("packages/digital-pet-animation/"),
  )
  const opencodeChanged =
    sharedChanged || input.changedFiles.some((path) => path.startsWith("packages/opencode-digital-pet/"))
  const cursorChanged =
    sharedChanged || input.changedFiles.some((path) => path.startsWith("packages/cursor-digital-pet/"))
  const requestedBump = bumpFromPullRequest(input.title, input.labels)

  return {
    opencode: {
      release: !input.alreadyReleased.opencode && (firstOpenCodeRelease || opencodeChanged),
      bump: firstOpenCodeRelease ? firstOpenCodeBump(input.tags, input.opencodeVersion, requestedBump) : requestedBump,
    },
    cursor: {
      release: !input.alreadyReleased.cursor && (firstCursorRelease || cursorChanged),
      bump: requestedBump,
    },
  }
}

type PullRequestEvent = {
  readonly pull_request?: {
    readonly merged?: boolean
    readonly merge_commit_sha?: string | null
    readonly title?: string
    readonly labels?: readonly { readonly name?: string }[]
  }
}

const isAlreadyReleased = (mergeSha: string, tag: string | undefined): boolean => {
  if (tag === undefined) return false
  const result = spawnSync("git", ["merge-base", "--is-ancestor", mergeSha, `${tag}^{commit}`])
  if (result.status === 0) return true
  if (result.status === 1) return false
  throw new Error(`Could not compare pull request commit with ${tag}: ${result.stderr.toString()}`)
}

const run = async (): Promise<void> => {
  const [changedFilesPath] = process.argv.slice(2)
  const eventPath = process.env["GITHUB_EVENT_PATH"]
  const outputPath = process.env["GITHUB_OUTPUT"]
  if (changedFilesPath === undefined || eventPath === undefined || outputPath === undefined) {
    throw new Error("Expected changed-files path, GITHUB_EVENT_PATH and GITHUB_OUTPUT.")
  }

  const event: PullRequestEvent = JSON.parse(await readFile(eventPath, "utf8"))
  const pullRequest = event.pull_request
  if (pullRequest?.merged !== true || !pullRequest.merge_commit_sha || !pullRequest.title) {
    throw new Error("Expected a merged pull request with a merge commit and title.")
  }

  let tagInput = ""
  for await (const chunk of process.stdin) tagInput += chunk.toString()
  const tags = tagInput.split(/\r?\n/).filter(Boolean)
  const changedFiles = (await readFile(changedFilesPath, "utf8")).split(/\r?\n/).filter(Boolean)
  const opencodePackage = JSON.parse(await readFile("packages/opencode-digital-pet/package.json", "utf8"))
  const plan = planMergedRelease({
    changedFiles,
    tags,
    title: pullRequest.title,
    labels: (pullRequest.labels ?? []).flatMap((label) => (label.name === undefined ? [] : [label.name])),
    opencodeVersion: opencodePackage.version,
    alreadyReleased: {
      opencode: isAlreadyReleased(pullRequest.merge_commit_sha, latestStableTag(tags, PRODUCT_TAG_PREFIX.opencode)),
      cursor: isAlreadyReleased(pullRequest.merge_commit_sha, latestStableTag(tags, PRODUCT_TAG_PREFIX.cursor)),
    },
  })
  await writeFile(
    outputPath,
    `release_opencode=${plan.opencode.release}\nopencode_bump=${plan.opencode.bump}\nrelease_cursor=${plan.cursor.release}\ncursor_bump=${plan.cursor.bump}\n`,
    { flag: "a" },
  )
  process.stdout.write(`${JSON.stringify(plan)}\n`)
}

if (import.meta.main) await run()
