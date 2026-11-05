import { afterEach, beforeEach, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const repository = resolve(import.meta.dir, "../..")
const web = "@jcendal/web-digital-pet"
let root: string

const readManifest = (workspace: string) =>
  JSON.parse(readFileSync(join(root, "packages", workspace, "package.json"), "utf8"))
const writeManifest = (workspace: string, manifest: unknown) =>
  writeFileSync(join(root, "packages", workspace, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`)
const check = (...args: string[]) =>
  spawnSync("node", ["scripts/check-workspace-dependencies.mjs", ...args], { cwd: root, encoding: "utf8" })
const lock = () =>
  spawnSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--offline", "--no-audit", "--no-fund"], {
    cwd: root,
    encoding: "utf8",
    timeout: 15_000,
  })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "digital-pet-workspace-release-"))
  mkdirSync(join(root, "scripts"))
  cpSync(
    join(repository, "scripts/check-workspace-dependencies.mjs"),
    join(root, "scripts/check-workspace-dependencies.mjs"),
  )
  cpSync(join(repository, "node_modules/semver"), join(root, "node_modules/semver"), { recursive: true })
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "release-fixture", private: true, workspaces: ["packages/*"] }),
  )
  for (const workspace of readdirSync(join(repository, "packages"))) {
    const source = JSON.parse(readFileSync(join(repository, "packages", workspace, "package.json"), "utf8"))
    mkdirSync(join(root, "packages", workspace), { recursive: true })
    writeManifest(workspace, {
      name: source.name,
      version: source.version,
      private: source.private,
      dependencies: Object.fromEntries(
        Object.entries(source.dependencies ?? {}).filter(([name]) => name.startsWith("@jcendal/")),
      ),
    })
  }
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

test("web release and next development version keep backend links resolvable offline", () => {
  expect(check().status).toBe(0)
  const originalWeb = readManifest("web-digital-pet")
  for (const version of ["1.2.3", "1.2.4-dev.0"]) {
    writeManifest("web-digital-pet", { ...originalWeb, version })
    expect(check().status).toBe(1)
    // Before synchronization npm tries to resolve the old private version from
    // the registry. Offline mode reproduces the failure without any network.
    expect(lock().status).not.toBe(0)
    const synced = check("--sync", web)
    expect(synced.status, synced.stderr).toBe(0)
    expect(readManifest("web-digital-pet-backend").dependencies[web]).toBe(version)
    const installed = lock()
    expect(installed.status, installed.stderr).toBe(0)
    const lockfile = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"))
    expect(lockfile.packages["node_modules/@jcendal/web-digital-pet"].link).toBe(true)
    expect(lockfile.packages["packages/web-digital-pet-backend"].dependencies[web]).toBe(version)
    expect(check().status).toBe(0)
  }
}, 30_000)

test("synchronization rejects unrelated mismatches before writing any manifest", () => {
  const backend = readManifest("web-digital-pet-backend")
  backend.dependencies[web] = "0.0.0"
  backend.dependencies["@jcendal/digital-pet-online"] = "0.0.0"
  writeManifest("web-digital-pet-backend", backend)
  const synced = check("--sync", web)
  expect(synced.status).toBe(1)
  expect(synced.stderr).toContain("@jcendal/digital-pet-online")
  expect(readManifest("web-digital-pet-backend")).toEqual(backend)
})

test("synchronization updates all dependency sections and rejects unknown targets", () => {
  const backend = readManifest("web-digital-pet-backend")
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    backend[section] = { ...backend[section], [web]: "0.0.0" }
  }
  writeManifest("web-digital-pet-backend", backend)
  expect(check("--sync", "@jcendal/missing").status).toBe(1)
  expect(check("--sync", web).status).toBe(0)
  const actual = readManifest("web-digital-pet-backend")
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    expect(actual[section][web]).toBe(readManifest("web-digital-pet").version)
  }
})
