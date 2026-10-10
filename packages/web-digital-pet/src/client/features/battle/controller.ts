import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { BattleNegotiation, battleNode, type Fighter } from "../../../domain/battle/protocol.ts"
import type { PendingBattle } from "../../../domain/battle/saved-battle.ts"
import type { LocalPetState } from "../../../domain/pet/progress.ts"
import { IntlModule } from "../../../shared/i18n.ts"
import { readLocalState, readPendingBattle, settleBattle } from "../../persistence/pet-store.ts"
import { browserSaveSelected, refreshBrowserViews } from "../../platform/save-source.ts"
import type { BrowserPairingControls } from "../pairing/controller.ts"
import { playSavedBattle } from "./playback.ts"
import { BattleTransport, battleCodeOf, validBattleCode } from "./transport.ts"
import { createBattleViewer } from "./viewer.ts"

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id)
  if (!found) throw new Error(IntlModule.translate("controller.missingBattleControl", { id: id }))
  return found as T
}
const randomSecret = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("")
const hash = async (text: string): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")

export const initBrowserBattles = async (otherBusy: () => boolean): Promise<BrowserPairingControls> => {
  const button = element<HTMLButtonElement>("battle-button")
  const dialog = element<HTMLDialogElement>("battle-dialog")
  const ownCode = element("battle-own-code")
  const input = element<HTMLInputElement>("battle-target")
  const request = element<HTMLButtonElement>("battle-request")
  const accept = element<HTMLButtonElement>("battle-accept")
  const decline = element<HTMLButtonElement>("battle-decline")
  const incoming = element("battle-incoming")
  let enabled = browserSaveSelected()
  let ready = false
  let pending: PendingBattle | undefined = await readPendingBattle()
  type Playback = { release?: () => void; viewer?: ReturnType<typeof createBattleViewer> }
  let playback: Playback | undefined
  type Session = {
    connection: import("peerjs").DataConnection
    negotiation: BattleNegotiation
    local?: LocalPetState
    queue: Promise<void>
    timer?: number
    release?: () => void
    agreed: boolean
    accepted: boolean
  }
  let session: Session | undefined
  const note = (message: string): void => {
    element("battle-status").textContent = message
  }
  const update = (): void => {
    button.disabled = !enabled
    button.title = enabled
      ? IntlModule.translate("controller.playerBattle")
      : IntlModule.translate("controller.chooseThisBrowserInOptionsToBattle")
    request.disabled = !enabled || !ready || Boolean(session || playback || pending)
  }
  const open = (): void => {
    if (!dialog.open) dialog.showModal()
    button.setAttribute("aria-expanded", "true")
  }
  const reset = (): void => {
    const previous = session
    session = undefined
    window.clearTimeout(previous?.timer)
    previous?.release?.()
    previous?.connection.close()
    incoming.hidden = true
    accept.disabled = false
    update()
  }
  const stopPlayback = (): void => {
    const previous = playback
    playback = undefined
    previous?.viewer?.finish()
    previous?.release?.()
  }
  const cancel = (message: string): void => {
    session?.negotiation.cancel()
    reset()
    note(message)
  }
  const enqueue = (current: Session, action: () => Promise<void>): void => {
    current.queue = current.queue
      .then(async () => {
        if (session === current) await action()
      })
      .catch((error: unknown) => {
        if (session !== current) return
        cancel(error instanceof Error ? error.message : IntlModule.translate("controller.theBattleCouldNotBeCompleted"))
      })
  }
  const reservePresentation = async (current: { release?: () => void }): Promise<void> => {
    if (!current.release && navigator.locks) {
      const hold = new Promise<void>((resolve) => {
        current.release = resolve
      })
      await new Promise<void>((resolve, reject) => {
        void navigator.locks
          .request("digital-pet:evolution", { ifAvailable: true }, async (lock) => {
            if (!lock) return reject(new Error(IntlModule.translate("controller.yourCompanionIsBusyInAnotherViewOr")))
            resolve()
            await hold
          })
          .catch(reject)
      })
    }
  }
  const resume = async (owner = session?.agreed ? session : undefined): Promise<void> => {
    if (playback || !enabled || !browserSaveSelected() || document.hidden || (!owner && session)) return
    const current: Playback = owner?.release ? { release: owner.release } : {}
    if (owner) delete owner.release
    playback = current
    update()
    const checkpoint = async (): Promise<void> => {
      while (
        playback === current &&
        enabled &&
        browserSaveSelected() &&
        (document.hidden || (current.viewer && !current.viewer.active))
      )
        await new Promise((resolve) => window.setTimeout(resolve, 100))
      if (playback !== current || !enabled || !browserSaveSelected())
        throw new Error(IntlModule.translate("controller.battlePlaybackPaused"))
    }
    try {
      if (otherBusy()) throw new Error(IntlModule.translate("controller.finishYourDeviceTransferToResumeTheSaved"))
      await reservePresentation(current)
      await checkpoint()
      const saved = await readPendingBattle()
      await checkpoint()
      pending = saved
      if (!saved) return
      incoming.hidden = true
      if (dialog.open) dialog.close()
      current.viewer = createBattleViewer(saved)
      await current.viewer.show()
      await checkpoint()
      note(
        saved.completedShots > 0
          ? IntlModule.translate("controller.resumingSavedBattle")
          : owner
            ? IntlModule.translate("controller.battleStarted")
            : IntlModule.translate("controller.resumingSavedBattle"),
      )
      const result = await playSavedBattle(saved, {
        checkpoint,
        width: current.viewer.width,
        frame: async (artwork, hud) => current.viewer?.frame(artwork, hud),
      })
      // The complete outcome has been shown and its pending entry has been cleared.
      pending = undefined
      if (playback === current) note(result)
      refreshBrowserViews()
    } catch (error) {
      if (playback === current)
        note(
          error instanceof Error
            ? IntlModule.translate("controller.reopenBattleToContinue", { message: error.message })
            : IntlModule.translate("controller.couldNotResumeTheSavedBattle"),
        )
    } finally {
      if (playback === current) stopPlayback()
      if (owner && session === owner) reset()
      update()
    }
  }
  const prepare = async (current: Session): Promise<Fighter> => {
    if (!enabled || !browserSaveSelected() || otherBusy())
      throw new Error(IntlModule.translate("controller.finishYourDeviceTransferFirst"))
    if (await readPendingBattle()) throw new Error(IntlModule.translate("controller.finishTheSavedBattleFirst"))
    await reservePresentation(current)
    const state = await readLocalState()
    if (session !== current || !enabled || !browserSaveSelected())
      throw new Error(IntlModule.translate("controller.battleCancelled"))
    if (!DIGIMON_CATALOG.byId.get(state.currentNodeId)?.stage)
      throw new Error(IntlModule.translate("controller.waitForYourEggToHatchBeforeBattling"))
    if (state.pendingEvolution)
      throw new Error(IntlModule.translate("controller.finishYourCompanionSEvolutionBeforeBattling"))
    current.local = state
    return { partnerId: state.partnerId, nodeId: state.currentNodeId }
  }

  function bind(connection: import("peerjs").DataConnection, challenger: boolean): void {
    if (session || playback || pending || !enabled || otherBusy()) {
      connection.close()
      return
    }
    const current: Session = {
      connection,
      queue: Promise.resolve(),
      agreed: false,
      accepted: false,
      negotiation: new BattleNegotiation(challenger, randomSecret(), {
        hash,
        send: (message) => {
          if (session === current) connection.send(message)
        },
        requested: (fighter) => {
          element("battle-incoming-text").textContent = IntlModule.translate("controller.challengesYourCompanion", {
            nameEn: battleNode(fighter.nodeId).nameEn,
            value1: battleCodeOf(connection),
          })
          incoming.hidden = false
          open()
          note(IntlModule.translate("controller.aPlayerWantsToBattleAcceptToUse"))
          decline.focus()
        },
        agreed: async (battleId, challengerFighter, receiver, plan, seed) => {
          if (session !== current || !current.local || !enabled || !browserSaveSelected()) return
          current.agreed = true
          window.clearTimeout(current.timer)
          pending = await settleBattle(
            {
              version: 1,
              battleId,
              challenger: challengerFighter,
              receiver,
              plan,
              seed,
              localSide: challenger ? "player" : "opponent",
            },
            current.local,
          )
          if (session !== current) return
          if (!pending) {
            reset()
            note(IntlModule.translate("controller.thisBattleWasAlreadyCompleted"))
            return
          }
          await resume(current)
        },
      }),
    }
    session = current
    incoming.hidden = true
    update()
    current.timer = window.setTimeout(() => {
      if (session === current) cancel(IntlModule.translate("controller.battleRequestTimedOutKeepBothAppsOpen"))
    }, 120_000)
    connection.on("open", () => {
      if (!challenger) return
      enqueue(current, async () => {
        const fighter = await prepare(current)
        await current.negotiation.start(crypto.randomUUID(), fighter)
        note(IntlModule.translate("controller.waitingForTheOtherPlayerToAccept"))
      })
    })
    connection.on("data", (data) => enqueue(current, () => current.negotiation.receive(data)))
    connection.on("close", () => {
      if (session === current && !current.agreed) {
        reset()
        note(IntlModule.translate("controller.theOtherPlayerDisconnectedNoRewardAwarded"))
      }
    })
    connection.on("error", (error) => {
      if (session === current && !current.agreed)
        cancel(IntlModule.translate("controller.battleConnectionFailed", { message: error.message }))
    })
  }

  const transport = new BattleTransport({
    ready: (code) => {
      ready = true
      ownCode.textContent = code
      update()
      if (!session && !playback && !pending) note(IntlModule.translate("controller.shareYourSixDigitCodeToReceiveA"))
    },
    incoming: (connection) => bind(connection, false),
    disconnected: () => {
      ready = false
      update()
      if (!session && !playback && !pending) note(IntlModule.translate("controller.reconnectingToTheBattleService"))
    },
    error: (message) => {
      ready = transport.connected
      update()
      if (!session?.agreed && !pending && !playback)
        cancel(IntlModule.translate("controller.couldNotConnect", { message: message }))
    },
  })
  button.addEventListener("click", () => {
    if (playback || pending) {
      window.dispatchEvent(new CustomEvent("digital-pet:navigate", { detail: "/" }))
      if (pending && !playback) void resume()
    } else open()
  })
  request.addEventListener("click", () => {
    const target = input.value.trim()
    if (!validBattleCode(target)) return note(IntlModule.translate("controller.enterASixDigitBattleCode"))
    if (target === transport.code) return note(IntlModule.translate("controller.enterTheOtherPlayerSCode"))
    if (otherBusy()) return note(IntlModule.translate("controller.finishTheCurrentDeviceTransferFirst"))
    try {
      bind(transport.connect(target), true)
      note(IntlModule.translate("controller.contactingTheOtherPlayer"))
    } catch (error) {
      note(error instanceof Error ? error.message : IntlModule.translate("controller.couldNotConnect2"))
    }
  })
  accept.addEventListener("click", () => {
    const current = session
    if (!current || accept.disabled) return
    accept.disabled = true
    enqueue(current, async () => {
      const fighter = await prepare(current)
      current.accepted = true
      incoming.hidden = true
      note(IntlModule.translate("controller.preparingTheBattle"))
      if (dialog.open) dialog.close()
      await current.negotiation.accept(fighter)
    })
  })
  decline.addEventListener("click", () => cancel(IntlModule.translate("controller.battleDeclined")))
  element("battle-copy").addEventListener("click", () => {
    if (ready)
      void navigator.clipboard.writeText(transport.code).then(
        () => note(IntlModule.translate("controller.battleCodeCopied")),
        () => note(IntlModule.translate("controller.couldNotCopyTheBattleCode")),
      )
  })
  dialog.addEventListener("close", () => {
    button.setAttribute("aria-expanded", "false")
    if (session && !session.accepted && !session.agreed && !playback) {
      cancel(IntlModule.translate("controller.battleCancelled2"))
      refreshBrowserViews()
    }
  })
  window.addEventListener("pagehide", () => {
    stopPlayback()
    reset()
    transport.stop()
  })
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && pending && !playback) void resume()
  })
  update()
  if (pending && enabled) void resume()
  return {
    get busy() {
      return Boolean(session || playback || pending)
    },
    setBrowserEnabled(value) {
      enabled = value
      if (!value) {
        stopPlayback()
        if (session) cancel(IntlModule.translate("controller.chooseThisBrowserToBattleWithYourCompanion"))
      }
      if (!value && dialog.open) dialog.close()
      update()
      if (value && pending) void resume()
    },
  }
}
