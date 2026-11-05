import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import semver from "semver"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const arguments_ = process.argv.slice(2)
if (arguments_.length !== 0 && (arguments_.length !== 2 || arguments_[0] !== "--sync")) {
  throw new Error("Usage: check-workspace-dependencies.mjs [--sync <private-workspace-name>]")
}
const syncPackage = arguments_[1]
const workspaces = [
  "digital-pet-intl",
  "digital-pet-core",
  "digital-pet-fields",
  "digital-pet-animation",
  "digital-pet-webviews",
  "web-digital-pet",
  "digital-pet-online",
  "web-digital-pet-backend",
  "opencode-digital-pet",
  "cursor-digital-pet",
]
const manifests = new Map()
const paths = new Map()

for (const workspace of workspaces) {
  const path = resolve(root, "packages", workspace, "package.json")
  const manifest = JSON.parse(await readFile(path, "utf8"))
  if (semver.valid(manifest.version) !== manifest.version) {
    throw new Error(`${workspace} must have an exact SemVer version.`)
  }
  manifests.set(manifest.name, manifest)
  paths.set(manifest.name, path)
}

if (syncPackage !== undefined && manifests.get(syncPackage)?.private !== true) {
  throw new Error(`Cannot synchronize an unknown or non-private workspace: ${syncPackage}.`)
}

const changed = new Set()
for (const manifest of manifests.values()) {
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      const internal = manifests.get(name)
      if (internal?.private !== true || version === internal.version) continue
      if (name !== syncPackage) {
        throw new Error(`${manifest.name} depends on ${name}@${version}, but the workspace is ${internal.version}.`)
      }
      manifest[section][name] = internal.version
      changed.add(manifest.name)
    }
  }
}

// Validate every manifest before writing; a release must not silently repair an
// unrelated mismatch. The default invocation remains a read-only check.
for (const name of changed) {
  await writeFile(paths.get(name), `${JSON.stringify(manifests.get(name), null, 2)}\n`)
  console.log(`Synchronized ${syncPackage} in ${name}.`)
}

console.log("Workspace dependency versions match their private packages.")
