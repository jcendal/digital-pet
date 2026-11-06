import { execFileSync } from "node:child_process"
import { appendFileSync, readFileSync } from "node:fs"

// Turbo selects workspace tasks. Gate packaging and the separate Python suite here.
const plan = JSON.parse(readFileSync(process.argv[2], "utf8"))
if (!Array.isArray(plan.packages)) throw new Error("Turbo dry run did not return a package list.")
const affected = new Set(plan.packages)
const base = process.env.TURBO_SCM_BASE
const head = process.env.TURBO_SCM_HEAD
if (!base || !head) throw new Error("Explicit base and head revisions are required.")
const changed = execFileSync("git", ["diff", "--name-only", "-z", base, head, "--"], { encoding: "utf8" }).split("\0")
const outputs = {
  opencode: affected.has("@jcendal/opencode-digital-pet"),
  cursor: affected.has("cursor-digital-pet"),
  importers: changed.some((path) =>
    /^(scripts\/.*\.(py|txt)|\.github\/workflows\/ci\.yml|packages\/digital-pet-(core|animation)\/src\/data\/)/.test(
      path,
    ),
  ),
}
if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required.")
appendFileSync(
  process.env.GITHUB_OUTPUT,
  Object.entries(outputs)
    .map(([name, selected]) => `${name}=${selected}\n`)
    .join(""),
)
console.log(`Affected packages: ${[...affected].join(", ") || "none"}`)
