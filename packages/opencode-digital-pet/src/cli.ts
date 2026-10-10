#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { installGlobalPlugin } from "./cli/install.ts"
import { initializeUiLanguage } from "./config/ui-language.ts"
import { IntlModule } from "./i18n.ts"

type Command = "init" | "update"

type ParsedArguments =
  | Readonly<{ readonly kind: "help" }>
  | Readonly<{ readonly kind: "command"; readonly command: Command; readonly dryRun: boolean }>
  | Readonly<{ readonly kind: "invalid"; readonly message: string }>

type PackageManifest = Readonly<{ readonly name: "@jcendal/opencode-digital-pet"; readonly version: string }>

const EXACT_SEMVER =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

const isPackageManifest = (value: unknown): value is PackageManifest => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  if (!("name" in value) || !("version" in value)) return false
  const { name, version } = value
  return name === "@jcendal/opencode-digital-pet" && typeof version === "string" && EXACT_SEMVER.test(version)
}

const readPackageManifest = async (): Promise<PackageManifest> => {
  const source = await readFile(new URL("../package.json", import.meta.url), "utf8")
  const manifest: unknown = JSON.parse(source)
  if (!isPackageManifest(manifest))
    throw new Error(IntlModule.translate("cli.invalidOpencodeDigitalPetPackageManifest"))
  return manifest
}

const parseArguments = (arguments_: readonly string[]): ParsedArguments => {
  if (arguments_.length === 1 && arguments_[0] === "--help") return { kind: "help" }
  const [command, ...options] = arguments_
  if (command !== "init" && command !== "update")
    return { kind: "invalid", message: IntlModule.translate("cli.expectedInitOrUpdate") }
  if (options.length === 0) return { kind: "command", command, dryRun: false }
  if (options.length === 1 && options[0] === "--dry-run") return { kind: "command", command, dryRun: true }
  return { kind: "invalid", message: IntlModule.translate("cli.onlyDryRunIsSupportedAfterACommand") }
}

const run = async (): Promise<number> => {
  initializeUiLanguage()
  const parsed = parseArguments(process.argv.slice(2))
  switch (parsed.kind) {
    case "help":
      process.stdout.write(IntlModule.translate("cli.help"))
      return 0
    case "invalid":
      process.stderr.write(`${parsed.message}\n\n${IntlModule.translate("cli.help")}`)
      return 2
    case "command": {
      const manifest = await readPackageManifest()
      const packageSpec = `${manifest.name}@${manifest.version}`
      if (parsed.dryRun) {
        process.stdout.write(`opencode plugin ${packageSpec} --global --force
`)
        return 0
      }
      await installGlobalPlugin(packageSpec)
      process.stdout.write(IntlModule.translate("cli.installed"))
      return 0
    }
  }
}

run()
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : IntlModule.translate("cli.unexpectedCliFailure")
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
