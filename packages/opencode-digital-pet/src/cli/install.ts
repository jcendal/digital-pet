import { spawn } from "node:child_process"
import { IntlModule } from "../i18n.ts"

export class OpenCodePluginInstallError extends Error {
  readonly name = "OpenCodePluginInstallError"

  constructor(readonly exitCode: number | null) {
    super(
      exitCode === null
        ? IntlModule.translate("install.opencodePluginInstallerExitedWithoutAStatus")
        : IntlModule.translate("install.opencodePluginInstallerExitedWithStatus", { exitCode: exitCode }),
    )
  }
}

export type CommandExecutor = (command: string, arguments_: readonly string[]) => Promise<void>

export const runCommand: CommandExecutor = (command, arguments_) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { shell: false, stdio: "inherit" })
    child.once("error", reject)
    child.once("close", (exitCode) => {
      if (exitCode === 0) resolve()
      else reject(new OpenCodePluginInstallError(exitCode))
    })
  })

export const installGlobalPlugin = async (packageSpec: string, execute: CommandExecutor = runCommand): Promise<void> =>
  execute("opencode", ["plugin", packageSpec, "--global", "--force"])
