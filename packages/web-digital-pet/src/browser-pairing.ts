import type { DataConnection } from "peerjs"

import {
  getDeviceCode,
  hasPreviousSave,
  readLocalState,
  replaceLocalState,
  restorePreviousSave,
} from "./browser-store.ts"
import {
  BrowserTransfer,
  CODE_LENGTH,
  displayDeviceCode,
  normalizeDeviceCode,
  validDeviceCode,
} from "./browser-transfer.ts"
import { parsePetTransfer, TRANSFER_VERSION, type PetTransfer } from "./transfer-protocol.ts"

type PairMessage =
  | { type: "request"; version: 1 }
  | { type: "snapshot"; transfer: PetTransfer }
  | { type: "result"; accepted: boolean }
  | { type: "decline" }

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing pairing control: ${id}`)
  return found as T
}

const browserModeAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch("/api/mode", { cache: "no-store" })
    if (!response.ok) return false
    const result = (await response.json()) as { mode?: string }
    return result.mode === "browser"
  } catch {
    return localStorage.getItem("digital-pet:source") === "browser"
  }
}

const refreshViews = (): void => {
  for (const frame of Array.from(document.querySelectorAll<HTMLIFrameElement>(".web-view")))
    frame.contentWindow?.postMessage({ type: "browser-save-updated" }, location.origin)
}

export const initBrowserPairing = async (): Promise<void> => {
  const button = element<HTMLButtonElement>("pair-button")
  const dialog = element<HTMLDialogElement>("pair-dialog")
  const ownCode = element<HTMLElement>("pair-own-code")
  const copy = element<HTMLButtonElement>("pair-copy")
  const input = element<HTMLInputElement>("pair-target")
  const request = element<HTMLButtonElement>("pair-request")
  const status = element<HTMLElement>("pair-status")
  const incoming = element<HTMLElement>("pair-incoming")
  const incomingCode = element<HTMLElement>("pair-incoming-code")
  const send = element<HTMLButtonElement>("pair-send")
  const decline = element<HTMLButtonElement>("pair-decline")
  const preview = element<HTMLElement>("pair-preview")
  const previewText = element<HTMLElement>("pair-preview-text")
  const importSave = element<HTMLButtonElement>("pair-import")
  const rejectSave = element<HTMLButtonElement>("pair-reject")
  const restore = element<HTMLButtonElement>("pair-restore")

  const deviceCode = await getDeviceCode()
  ownCode.textContent = displayDeviceCode(deviceCode)
  input.maxLength = CODE_LENGTH + 3
  button.hidden = false
  await updateRestore()

  let connection: DataConnection | null = null
  let direction: "send" | "receive" | null = null
  let pendingTransfer: PetTransfer | null = null
  let timer: number | undefined
  let ready = false
  let finishing = false
  const ownTitle = document.title

  function note(message: string): void {
    status.textContent = message
  }

  function openDialog(): void {
    if (!dialog.open) dialog.showModal()
  }

  function resetConnection(): void {
    window.clearTimeout(timer)
    connection?.close()
    connection = null
    direction = null
    pendingTransfer = null
    incoming.hidden = true
    preview.hidden = true
    request.disabled = !ready
    document.title = ownTitle
  }

  function finish(message: PairMessage, noteText: string): void {
    if (!connection) return
    finishing = true
    connection.send(message)
    note(noteText)
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      resetConnection()
      finishing = false
    }, 750)
  }

  async function updateRestore(): Promise<void> {
    restore.hidden = !(await hasPreviousSave())
  }

  const transfer = new BrowserTransfer(deviceCode, {
    ready: () => {
      ready = true
      request.disabled = false
      note("Connected. Share your code or enter another device's code.")
    },
    incoming: (remote) => {
      if (connection) {
        remote.close()
        return
      }
      bind(remote, "send")
    },
    disconnected: () => {
      ready = false
      request.disabled = true
      note("Pairing connection lost. Reconnecting…")
    },
    error: (message) => {
      ready = false
      request.disabled = true
      note(`Pairing unavailable: ${message}`)
    },
  })

  function bind(remote: DataConnection, role: "send" | "receive"): void {
    connection = remote
    direction = role
    finishing = false
    request.disabled = true
    note(role === "receive" ? "Contacting the other device…" : "Incoming connection…")
    timer = window.setTimeout(() => {
      if (connection === remote) {
        resetConnection()
        note("Request timed out. Both devices need to keep the app open.")
      }
    }, 120_000)
    remote.on("open", () => {
      if (connection !== remote) return
      if (role === "receive") {
        remote.send({ type: "request", version: TRANSFER_VERSION } satisfies PairMessage)
        note("Waiting for the other device to approve the request…")
      }
    })
    remote.on("data", (data) => {
      void receive(remote, data).catch((error: unknown) => {
        note(error instanceof Error ? error.message : "The transfer could not be completed")
        resetConnection()
      })
    })
    remote.on("close", () => {
      if (connection === remote) {
        resetConnection()
        if (!finishing) note("The other device disconnected.")
        finishing = false
      }
    })
    remote.on("error", (error) => {
      if (connection === remote) {
        resetConnection()
        note(`Connection failed: ${error.message}`)
      }
    })
  }

  async function receive(remote: DataConnection, data: unknown): Promise<void> {
    if (remote !== connection || typeof data !== "object" || data === null || !("type" in data)) return
    const message = data as { type: string; [key: string]: unknown }
    if (direction === "send" && message.type === "request" && message.version === TRANSFER_VERSION) {
      if (!(await browserModeAvailable())) throw new Error("Browser save transfer is unavailable in SQLite mode")
      incomingCode.textContent = displayDeviceCode(remote.peer.replace(/^web-digital-pet-/, ""))
      incoming.hidden = false
      document.title = "TRANSFER REQUEST · Digital Pet"
      note("Another device requests your saved pet. Choose whether to send it.")
      openDialog()
      return
    }
    if (direction === "receive" && message.type === "snapshot") {
      const parsed = parsePetTransfer(message.transfer)
      const catalogPath = "/browser-local.js"
      const catalog = (await import(catalogPath)) as { isKnownNode: (id: string) => boolean }
      if (
        !catalog.isKnownNode(parsed.state.currentNodeId) ||
        parsed.state.events.some((event) => !catalog.isKnownNode(event.currentNodeId))
      )
        throw new Error("The received save contains an unknown Digimon")
      if (!(await browserModeAvailable())) throw new Error("Browser save transfer is unavailable in SQLite mode")
      pendingTransfer = parsed
      previewText.textContent = `Partner ${parsed.state.currentNodeId} · ${parsed.state.events.length} history records. Your current save will be kept as a backup.`
      preview.hidden = false
      note("Save received. Review it before replacing this device's progress.")
      openDialog()
      return
    }
    if (direction === "send" && message.type === "result" && typeof message.accepted === "boolean") {
      resetConnection()
      note(message.accepted ? "Save sent and accepted by the other device." : "The other device kept its current save.")
      return
    }
    if (message.type === "decline") {
      resetConnection()
      note("The transfer was declined.")
    }
  }

  button.addEventListener("click", openDialog)
  dialog.addEventListener("close", () => {
    if (!connection) return
    finish({ type: "decline" }, "Transfer cancelled.")
  })
  copy.addEventListener("click", () => {
    void navigator.clipboard.writeText(deviceCode).then(
      () => note("Code copied."),
      () => note("Could not copy the code."),
    )
  })
  request.addEventListener("click", async () => {
    const target = normalizeDeviceCode(input.value)
    if (!validDeviceCode(target)) return note("Enter the full 16-character device code.")
    if (target === deviceCode) return note("Enter a different device's code.")
    if (connection) return note("Finish the current transfer first.")
    if (!(await browserModeAvailable())) return note("Transfers are only available for browser saves.")
    try {
      bind(transfer.connect(target), "receive")
    } catch (error) {
      note(error instanceof Error ? error.message : "Could not connect to the pairing service")
    }
  })
  send.addEventListener("click", async () => {
    const remote = connection
    if (!remote || direction !== "send") return
    send.disabled = true
    try {
      if (!(await browserModeAvailable())) throw new Error("Transfers are only available for browser saves")
      const state = await readLocalState()
      const snapshot = parsePetTransfer({ version: TRANSFER_VERSION, state })
      remote.send({ type: "snapshot", transfer: snapshot } satisfies PairMessage)
      incoming.hidden = true
      note("Save sent. Waiting for the other device to accept it…")
    } catch (error) {
      note(error instanceof Error ? error.message : "Could not send the save")
      resetConnection()
    } finally {
      send.disabled = false
    }
  })
  decline.addEventListener("click", () => {
    finish({ type: "decline" }, "Request declined.")
  })
  importSave.addEventListener("click", async () => {
    const remote = connection
    const snapshot = pendingTransfer
    if (!remote || !snapshot || direction !== "receive") return
    importSave.disabled = true
    try {
      if (!(await browserModeAvailable())) throw new Error("Transfers are only available for browser saves")
      await replaceLocalState(snapshot.state)
      finish({ type: "result", accepted: true }, "Save imported. This device now has the transferred progress.")
      await updateRestore()
      refreshViews()
    } catch (error) {
      note(error instanceof Error ? error.message : "Could not import the save")
    } finally {
      importSave.disabled = false
    }
  })
  rejectSave.addEventListener("click", () => {
    finish({ type: "result", accepted: false }, "Your current save was kept.")
  })
  restore.addEventListener("click", async () => {
    if (connection) return note("Finish the current transfer first.")
    if (!(await browserModeAvailable())) return note("Browser saves are unavailable in SQLite mode.")
    if (!window.confirm("Restore the previous save on this device? The current save will become the backup.")) return
    if (await restorePreviousSave()) {
      refreshViews()
      note("Previous save restored.")
    }
  })
  window.addEventListener("pagehide", () => transfer.stop())
}
