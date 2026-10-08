import { randomBytes } from "node:crypto"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import * as vscode from "vscode"
import { createDatabaseChangeWatcher } from "../../../adapters/sqlite/database-change-watcher.ts"
import { resolveDatabasePath } from "../../../adapters/sqlite/options.ts"
import type { CreateSqliteDigitalPetArchiveReaderOptions } from "../../../adapters/sqlite/sqlite-digital-pet-archive-reader.ts"
import { readArchive } from "../../../adapters/sqlite/sqlite-digital-pet-archive-reader.ts"
import { createAsyncRefreshQueue } from "../../../shared/async-refresh-queue.ts"
import { openDexPanel } from "../dex/dex-panel.ts"
import { buildHistoryPanelModel } from "./history-model.ts"
import { buildHistoryWebviewHtml } from "./history-render.ts"

const panels = new Map<string, { readonly panel: vscode.WebviewPanel; readonly refresh: () => Promise<void> }>()

export const openHistoryPanel = async (
  context: vscode.ExtensionContext,
  options: CreateSqliteDigitalPetArchiveReaderOptions = {},
): Promise<void> => {
  const databasePath = resolveDatabasePath(options)
  const existing = panels.get(databasePath)
  if (existing !== undefined) {
    existing.panel.reveal(vscode.ViewColumn.One)
    await existing.refresh()
    return
  }
  const archive = await readArchive(options)
  // Another invocation may have opened the panel while the archive was being read.
  const opened = panels.get(databasePath)
  if (opened !== undefined) {
    opened.panel.reveal(vscode.ViewColumn.One)
    return opened.refresh()
  }
  let model = buildHistoryPanelModel(archive, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
  const mediaRoot = vscode.Uri.joinPath(context.extensionUri, "media")
  const panel = vscode.window.createWebviewPanel(
    "cursorDigitalPetHistory",
    "Digital Pet History",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [mediaRoot],
    },
  )
  let disposed = false
  const queue = createAsyncRefreshQueue()
  const refresh = (): Promise<void> =>
    queue.run(async () => {
      if (disposed) return
      model = buildHistoryPanelModel(await readArchive(options), DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
      if (!disposed) await panel.webview.postMessage({ type: "history-model", model })
    })
  const requestRefresh = (): void => {
    void refresh().catch((error: unknown) => {
      if (!disposed) void vscode.window.showWarningMessage(`Digital Pet History could not refresh: ${String(error)}`)
    })
  }
  const watcher = createDatabaseChangeWatcher({ ...options, databasePath, onChange: requestRefresh })
  const messages = panel.webview.onDidReceiveMessage((message: unknown) => {
    if (typeof message !== "object" || message === null || !("type" in message)) return
    if (message.type === "history-ready" || message.type === "history-refresh") {
      requestRefresh()
    } else if (
      message.type === "history-dex" &&
      "id" in message &&
      typeof message.id === "string" &&
      "partnerId" in message &&
      typeof message.partnerId === "string"
    ) {
      const generation = model.generations.find((candidate) => candidate.partnerId === message.partnerId)
      const step = generation?.steps.at(-1)
      if (step?.catalogued && step.id === message.id) {
        void openDexPanel(context, options, step.id).catch((error: unknown) => {
          void vscode.window.showWarningMessage(`Digital Pet Dex could not open: ${String(error)}`)
        })
      }
    }
  })
  const visibility = panel.onDidChangeViewState((event) => {
    if (event.webviewPanel.visible) requestRefresh()
  })
  const disposal = panel.onDidDispose(() => {
    disposed = true
    panels.delete(databasePath)
    watcher.dispose()
    messages.dispose()
    visibility.dispose()
    disposal.dispose()
  })
  panels.set(databasePath, { panel, refresh })
  panel.webview.html = buildHistoryWebviewHtml(model, {
    nonce: randomBytes(16).toString("hex"),
    fontUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "fonts", "Silkscreen-Regular.ttf")).toString(),
    cspSource: panel.webview.cspSource,
  })
  context.subscriptions.push(panel)
}
