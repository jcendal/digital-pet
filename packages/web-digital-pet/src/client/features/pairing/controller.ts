import type { DataConnection } from "peerjs"
import { type PetTransfer, parsePetTransfer, TRANSFER_VERSION } from "../../../domain/transfer/protocol.ts"
import { IntlModule } from "../../../shared/i18n.ts"
import {
  getDeviceCode,
  getPairedDevice,
  hasPreviousSave,
  readLocalState,
  replaceLocalState,
  restorePreviousSave,
  setPairedDevice,
} from "../../persistence/pet-store.ts"
import { browserSaveSelected, refreshBrowserViews } from "../../platform/save-source.ts"
import { BrowserTransfer, CODE_LENGTH, displayDeviceCode, normalizeDeviceCode, validDeviceCode } from "./transport.ts"

type PairMessage =
  | { type: "request"; version: 1; sync: boolean }
  | { type: "snapshot"; transfer: PetTransfer }
  | { type: "result"; accepted: boolean }
  | { type: "decline" }

export type BrowserPairingControls = {
  readonly busy: boolean
  setBrowserEnabled: (enabled: boolean) => void
}

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id)
  if (!found) throw new Error(IntlModule.translate("controller.missingPairingControl", { id: id }))
  return found as T
}
const remoteCode = (connection: DataConnection): string => connection.peer.replace(/^web-digital-pet-/, "")

export const initBrowserPairing = async (otherBusy: () => boolean = () => false): Promise<BrowserPairingControls> => {
  const button = element<HTMLButtonElement>("pair-button")
  const sync = element<HTMLButtonElement>("pair-sync")
  const forget = element<HTMLButtonElement>("pair-forget")
  const paired = element<HTMLElement>("paired-device")
  const linked = element<HTMLElement>("pair-linked")
  const summary = element<HTMLElement>("pair-summary")
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
  let pairedCode = await getPairedDevice()
  ownCode.textContent = displayDeviceCode(deviceCode)
  input.maxLength = CODE_LENGTH + 3
  if (pairedCode) input.value = displayDeviceCode(pairedCode)
  restore.hidden = !(await hasPreviousSave())

  let connection: DataConnection | null = null
  let direction: "send" | "receive" | null = null
  let pendingTransfer: PetTransfer | null = null
  let timer: number | undefined
  let ready = false
  let enabled = browserSaveSelected()
  let finishing = false
  let automatic = false
  let approved = false
  let receiving = false
  const ownTitle = document.title

  function note(message: string): void {
    status.textContent = message
    summary.textContent = message
  }
  function updateControls(): void {
    paired.hidden = pairedCode === null
    forget.hidden = pairedCode === null
    element("pair-button-label").textContent = pairedCode
      ? IntlModule.translate("controller.pairAnotherDevice")
      : IntlModule.translate("controller.pairDevices")
    linked.textContent = pairedCode ? displayDeviceCode(pairedCode) : ""
    request.disabled = !ready || !enabled || connection !== null
    sync.disabled = !ready || !enabled || connection !== null || pairedCode === null
    forget.disabled = connection !== null
    button.disabled = !enabled
  }
  function openDialog(): void {
    if (!dialog.open) dialog.showModal()
  }
  function resetConnection(): void {
    window.clearTimeout(timer)
    const previous = connection
    connection = null
    previous?.close()
    direction = null
    pendingTransfer = null
    receiving = false
    incoming.hidden = true
    preview.hidden = true
    updateControls()
    document.title = ownTitle
  }
  function finish(message: PairMessage, noteText: string): void {
    if (!connection) return
    finishing = true
    connection.send(message)
    incoming.hidden = true
    preview.hidden = true
    note(noteText)
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      resetConnection()
      finishing = false
    }, 750)
  }
  function requireBrowser(): void {
    if (!enabled || !browserSaveSelected())
      throw new Error(IntlModule.translate("controller.chooseThisBrowserOnBothDevicesToTransfer"))
  }
  async function remember(remote: DataConnection): Promise<void> {
    const code = remoteCode(remote)
    if (!validDeviceCode(code)) throw new Error(IntlModule.translate("controller.theOtherDeviceHasAnInvalidCode"))
    await setPairedDevice(code)
    pairedCode = code
    updateControls()
  }

  const transfer = new BrowserTransfer(deviceCode, {
    ready: () => {
      ready = true
      updateControls()
      note(IntlModule.translate("controller.readyToConnectYourDevices"))
    },
    incoming: (remote) => {
      if (connection || otherBusy() || !enabled || !validDeviceCode(remoteCode(remote))) {
        remote.close()
        return
      }
      bind(remote, "send", false)
    },
    disconnected: () => {
      ready = false
      updateControls()
      note(IntlModule.translate("controller.deviceConnectionLostReconnecting"))
    },
    error: (message) => {
      ready = transfer.connected
      if (connection) resetConnection()
      updateControls()
      note(IntlModule.translate("controller.couldNotConnectCheckThatTheOtherApp", { message: message }))
    },
  })

  function bind(remote: DataConnection, role: "send" | "receive", syncRequest: boolean): void {
    connection = remote
    direction = role
    finishing = false
    automatic = syncRequest
    approved = false
    receiving = false
    updateControls()
    note(
      role === "receive"
        ? IntlModule.translate("controller.contactingTheOtherDevice")
        : IntlModule.translate("controller.incomingConnection"),
    )
    timer = window.setTimeout(() => {
      if (connection === remote) {
        resetConnection()
        note(IntlModule.translate("controller.requestTimedOutKeepBothAppsOpenWith"))
      }
    }, 120_000)
    remote.on("open", () => {
      if (connection !== remote) return
      if (role === "receive") {
        remote.send({ type: "request", version: TRANSFER_VERSION, sync: syncRequest } satisfies PairMessage)
        note(
          syncRequest
            ? IntlModule.translate("controller.requestingTheLatestSaveFromYourPairedDevice")
            : IntlModule.translate("controller.waitingForTheOtherDeviceToApprovePairing"),
        )
      }
    })
    remote.on("data", (data) => {
      void receive(remote, data).catch((error: unknown) => {
        if (remote !== connection) return
        resetConnection()
        note(error instanceof Error ? error.message : IntlModule.translate("controller.theTransferCouldNotBeCompleted"))
      })
    })
    remote.on("close", () => {
      if (connection === remote) {
        resetConnection()
        if (!finishing) note(IntlModule.translate("controller.theOtherDeviceDisconnectedTryAgainWithBoth"))
        finishing = false
      }
    })
    remote.on("error", (error) => {
      if (connection === remote) {
        resetConnection()
        note(IntlModule.translate("controller.connectionFailed", { message: error.message }))
      }
    })
  }

  async function sendSnapshot(remote: DataConnection): Promise<void> {
    requireBrowser()
    if (remote !== connection || direction !== "send" || approved) return
    approved = true
    const state = await readLocalState()
    if (remote !== connection) return
    requireBrowser()
    remote.send({
      type: "snapshot",
      transfer: parsePetTransfer({ version: TRANSFER_VERSION, state }),
    } satisfies PairMessage)
    incoming.hidden = true
    note(IntlModule.translate("controller.saveSentWaitingForTheOtherDeviceTo"))
  }

  async function importSnapshot(remote: DataConnection, snapshot: PetTransfer): Promise<void> {
    requireBrowser()
    if (remote !== connection || direction !== "receive" || receiving) return
    receiving = true
    importSave.disabled = true
    try {
      await replaceLocalState(snapshot.state)
      await remember(remote)
      finish(
        { type: "result", accepted: true },
        automatic
          ? IntlModule.translate("controller.syncedYourCompanionIsUpToDateWith")
          : IntlModule.translate("controller.pairedTheOtherDeviceSCompanionIsNow"),
      )
      restore.hidden = !(await hasPreviousSave())
      refreshBrowserViews()
    } finally {
      receiving = false
      importSave.disabled = false
    }
  }

  async function receive(remote: DataConnection, data: unknown): Promise<void> {
    if (remote !== connection || finishing || typeof data !== "object" || data === null || !("type" in data)) return
    const message = data as { type: string; [key: string]: unknown }
    if (direction === "send" && message.type === "request" && message.version === TRANSFER_VERSION && !approved) {
      requireBrowser()
      pairedCode = await getPairedDevice()
      if (remote !== connection) return
      if (message.sync === true && pairedCode === remoteCode(remote)) {
        automatic = true
        await sendSnapshot(remote)
      } else {
        incomingCode.textContent = displayDeviceCode(remoteCode(remote))
        element("pair-incoming-description").textContent = IntlModule.translate("pairing.requestDescription", {
          code: incomingCode.textContent,
        })
        incoming.hidden = false
        document.title = IntlModule.translate("controller.pairingRequestDigitalPet")
        note(IntlModule.translate("controller.anotherDeviceWantsToReceiveYourCompanionAnd"))
        openDialog()
      }
      return
    }
    if (direction === "receive" && message.type === "snapshot" && !pendingTransfer && !receiving) {
      const parsed = parsePetTransfer(message.transfer)
      const catalog = await import("../../presentation/browser-session.ts")
      const events = [
        ...parsed.state.events,
        ...(parsed.state.retiredPartners ?? []).flatMap((partner) => partner.events),
      ]
      if (
        !catalog.isKnownNode(parsed.state.currentNodeId) ||
        events.some((event) => !catalog.isKnownNode(event.currentNodeId))
      )
        throw new Error(IntlModule.translate("controller.theReceivedSaveContainsAnUnknownDigimon"))
      if (remote !== connection) return
      requireBrowser()
      pendingTransfer = parsed
      if (automatic && pairedCode === remoteCode(remote)) {
        await importSnapshot(remote, parsed)
      } else {
        previewText.textContent = IntlModule.translate("controller.companionGenerationsYourCurrentSaveWillBeKept", {
          currentNodeId: parsed.state.currentNodeId,
          value1: (parsed.state.retiredPartners?.length ?? 0) + 1,
        })
        preview.hidden = false
        note(IntlModule.translate("controller.saveReceivedChooseWhetherToReplaceYourSave"))
        openDialog()
      }
      return
    }
    if (direction === "send" && approved && message.type === "result" && typeof message.accepted === "boolean") {
      if (message.accepted) await remember(remote)
      resetConnection()
      note(
        message.accepted
          ? IntlModule.translate("controller.saveAcceptedYourDevicesArePairedForManual")
          : IntlModule.translate("controller.theOtherDeviceKeptItsCompanion"),
      )
      return
    }
    if (message.type === "decline") {
      resetConnection()
      note(IntlModule.translate("controller.theRequestWasDeclined"))
    }
  }

  async function requestFrom(target: string, syncRequest: boolean): Promise<void> {
    if (!validDeviceCode(target)) return note(IntlModule.translate("controller.enterTheFull16CharacterDeviceCode"))
    if (target === deviceCode) return note(IntlModule.translate("controller.enterADifferentDeviceSCode"))
    if (connection) return note(IntlModule.translate("controller.finishTheCurrentTransferFirst"))
    if (otherBusy()) return note(IntlModule.translate("controller.finishTheCurrentBattleFirst"))
    requireBrowser()
    bind(transfer.connect(target), "receive", syncRequest)
  }
  const showError = (error: unknown): void =>
    note(error instanceof Error ? error.message : IntlModule.translate("controller.couldNotCompleteTheRequest"))

  button.addEventListener("click", openDialog)
  dialog.addEventListener("close", () => {
    if (connection && !finishing) finish({ type: "decline" }, IntlModule.translate("controller.transferCancelled"))
  })
  copy.addEventListener("click", () => {
    void navigator.clipboard.writeText(displayDeviceCode(deviceCode)).then(
      () => note(IntlModule.translate("controller.codeCopied")),
      () => note(IntlModule.translate("controller.couldNotCopyTheCode")),
    )
  })
  request.addEventListener("click", () => {
    void requestFrom(normalizeDeviceCode(input.value), false).catch(showError)
  })
  sync.addEventListener("click", () => {
    if (pairedCode) void requestFrom(pairedCode, true).catch(showError)
  })
  forget.addEventListener("click", async () => {
    if (connection) return
    await setPairedDevice(null)
    pairedCode = null
    updateControls()
    note(IntlModule.translate("controller.deviceForgottenPairAgainToUseManualSync"))
  })
  send.addEventListener("click", () => {
    if (!connection) return
    send.disabled = true
    void sendSnapshot(connection)
      .catch(showError)
      .finally(() => {
        send.disabled = false
      })
  })
  decline.addEventListener("click", () =>
    finish({ type: "decline" }, IntlModule.translate("controller.pairingDeclined")),
  )
  importSave.addEventListener("click", () => {
    if (connection && pendingTransfer) void importSnapshot(connection, pendingTransfer).catch(showError)
  })
  rejectSave.addEventListener("click", () =>
    finish({ type: "result", accepted: false }, IntlModule.translate("controller.yourCurrentCompanionWasKept")),
  )
  restore.addEventListener("click", async () => {
    if (connection || otherBusy()) return note(IntlModule.translate("controller.finishTheCurrentTransferOrBattleFirst"))
    requireBrowser()
    if (!window.confirm(IntlModule.translate("controller.restoreThePreviousSaveOnThisDeviceThe"))) return
    if (await restorePreviousSave()) {
      refreshBrowserViews()
      note(IntlModule.translate("controller.previousSaveRestored"))
    }
  })
  window.addEventListener("pagehide", () => transfer.stop())
  updateControls()
  return {
    get busy() {
      return connection !== null
    },
    setBrowserEnabled(value) {
      enabled = value
      if (!value) {
        if (connection)
          finish({ type: "decline" }, IntlModule.translate("controller.chooseThisBrowserToUseDevicePairing"))
        if (dialog.open) dialog.close()
      }
      updateControls()
    },
  }
}
