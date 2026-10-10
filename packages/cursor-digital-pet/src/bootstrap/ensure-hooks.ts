import { join } from "node:path"
import * as vscode from "vscode"
import { installDigitalPetHooks } from "../adapters/cursor/install-hooks.ts"
import { IntlModule } from "../i18n.ts"

export const ensureHooksInstalled = async (context: vscode.ExtensionContext): Promise<void> => {
  const key = "digital-pet.hooksInstalled"
  if (context.globalState.get<boolean>(key) === true) return

  const choice = await vscode.window.showInformationMessage(
    IntlModule.translate("ensureHooks.description"),
    IntlModule.translate("ensureHooks.installHooks"),
    IntlModule.translate("ensureHooks.notNow"),
  )
  if (choice !== IntlModule.translate("ensureHooks.installHooks")) return

  const bridgePath = join(context.extensionPath, "hook-bridge.js")
  const result = installDigitalPetHooks(bridgePath)
  await context.globalState.update(key, true)
  vscode.window.showInformationMessage(
    IntlModule.translate("ensureHooks.digitalPetHooksInstalledAt", { hooksPath: result.hooksPath }),
  )
}
