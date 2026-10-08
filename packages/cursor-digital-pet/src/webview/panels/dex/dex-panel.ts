import { randomBytes } from "node:crypto"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import * as vscode from "vscode"
import { createDatabaseChangeWatcher } from "../../../adapters/sqlite/database-change-watcher.ts"
import { resolveDatabasePath } from "../../../adapters/sqlite/options.ts"
import type { CreateSqliteDigitalPetArchiveReaderOptions } from "../../../adapters/sqlite/sqlite-digital-pet-archive-reader.ts"
import { readArchive } from "../../../adapters/sqlite/sqlite-digital-pet-archive-reader.ts"
import { createAsyncRefreshQueue } from "../../../shared/async-refresh-queue.ts"
import { buildDexPanelModel } from "./dex-model.ts"
import { buildDexWebviewHtml } from "./dex-render.ts"

const panels = new Map<string, { readonly panel: vscode.WebviewPanel; readonly refresh: () => Promise<void> }>()

export const openDexPanel = async (
  context: vscode.ExtensionContext,
  options: CreateSqliteDigitalPetArchiveReaderOptions = {},
  selectedId?: string,
): Promise<void> => {
  const databasePath = resolveDatabasePath(options)
  const existing = panels.get(databasePath)
  if (existing !== undefined) {
    existing.panel.reveal(vscode.ViewColumn.One)
    await existing.refresh()
    if (selectedId !== undefined) await existing.panel.webview.postMessage({ type: "dex-select", id: selectedId })
    return
  }
  const archive = await readArchive(options)
  // Another invocation may have opened the panel while the archive was being read.
  const opened = panels.get(databasePath)
  if (opened !== undefined) {
    opened.panel.reveal(vscode.ViewColumn.One)
    await opened.refresh()
    if (selectedId !== undefined) await opened.panel.webview.postMessage({ type: "dex-select", id: selectedId })
    return
  }
  let model = buildDexPanelModel(archive, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
  const mediaRoot = vscode.Uri.joinPath(context.extensionUri, "media")
  const panel = vscode.window.createWebviewPanel("cursorDigitalPetDex", "Digital Pet Digidex", vscode.ViewColumn.One, {
    enableScripts: true,
    localResourceRoots: [mediaRoot],
  })
  let disposed = false
  let pendingSelection = selectedId
  const queue = createAsyncRefreshQueue()
  const refresh = (): Promise<void> =>
    queue.run(async () => {
      if (disposed) return
      model = buildDexPanelModel(await readArchive(options), DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
      if (!disposed) await panel.webview.postMessage({ type: "dex-model", model })
      if (!disposed && pendingSelection !== undefined) {
        await panel.webview.postMessage({ type: "dex-select", id: pendingSelection })
        pendingSelection = undefined
      }
    })
  const requestRefresh = (): void => {
    void refresh().catch((error: unknown) => {
      if (!disposed) void vscode.window.showWarningMessage(`Digital Pet Dex could not refresh: ${String(error)}`)
    })
  }
  const watcher = createDatabaseChangeWatcher({ ...options, databasePath, onChange: requestRefresh })
  const messages = panel.webview.onDidReceiveMessage((message: unknown) => {
    if (typeof message !== "object" || message === null || !("type" in message)) return
    if (message.type === "dex-ready" || message.type === "dex-refresh") {
      requestRefresh()
    } else if (message.type === "dex-reference" && "id" in message && typeof message.id === "string") {
      const entry = model.entries.find((candidate) => candidate.id === message.id && candidate.discovered)
      // Resolve the URL from the trusted catalog, never from a webview supplied URL.
      if (entry?.url.startsWith("https://digimon.net/")) void vscode.env.openExternal(vscode.Uri.parse(entry.url))
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
  panel.webview.html = buildDexWebviewHtml(model, {
    nonce: randomBytes(16).toString("hex"),
    fontUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "fonts", "Silkscreen-Regular.ttf")).toString(),
    cspSource: panel.webview.cspSource,
  })
  context.subscriptions.push(panel)
}
