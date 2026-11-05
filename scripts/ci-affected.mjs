import { appendFileSync, readFileSync } from "node:fs"

// Turbo owns change detection and the dependency graph. This only gates steps
// that must run outside its cache (packaging lifecycle hooks and browser tests).
const plan = JSON.parse(readFileSync(process.argv[2], "utf8"))
if (!Array.isArray(plan.packages)) throw new Error("Turbo dry run did not return a package list.")
const affected = new Set(plan.packages)
const outputs = {
  web: affected.has("@jcendal/web-digital-pet") || affected.has("@jcendal/web-digital-pet-backend"),
  opencode: affected.has("@jcendal/opencode-digital-pet"),
  cursor: affected.has("cursor-digital-pet"),
}
if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required.")
appendFileSync(
  process.env.GITHUB_OUTPUT,
  Object.entries(outputs)
    .map(([name, selected]) => `${name}=${selected}\n`)
    .join(""),
)
console.log(`Affected packages: ${[...affected].join(", ") || "none"}`)
