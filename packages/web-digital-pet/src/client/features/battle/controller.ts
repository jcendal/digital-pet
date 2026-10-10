import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { BattleNegotiation, battleNode, type Fighter } from "../../../domain/battle/protocol.ts"
import type { PendingBattle } from "../../../domain/battle/saved-battle.ts"
import type { LocalPetState } from "../../../domain/pet/progress.ts"
import { readLocalState, readPendingBattle, settleBattle } from "../../persistence/pet-store.ts"
import { browserSaveSelected, refreshBrowserViews } from "../../platform/save-source.ts"
import type { BrowserPairingControls } from "../pairing/controller.ts"
import { playSavedBattle } from "./playback.ts"
import { BattleTransport, battleCodeOf, validBattleCode } from "./transport.ts"

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing battle control: ${id}`)
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
  const arena = element("battle-arena")
  let enabled = browserSaveSelected()
  let ready = false
  let pending: PendingBattle | undefined = await readPendingBattle()
  let playback: { release?: () => void } | undefined
  type Session = {
    connection: import("peerjs").DataConnection
    negotiation: BattleNegotiation
    local?: LocalPetState
    queue: Promise<void>
    timer?: number
    release?: () => void
    agreed: boolean
  }
  let session: Session | undefined
  const note = (message: string): void => {
    element("battle-status").textContent = message
  }
  const update = (): void => {
    button.disabled = !enabled
    button.title = enabled ? "Player battle" : "Choose THIS BROWSER in Options to battle"
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
        cancel(error instanceof Error ? error.message : "The battle could not be completed")
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
            if (!lock) return reject(new Error("Your companion is busy in another view or tab. Try again shortly."))
            resolve()
            await hold
          })
          .catch(reject)
      })
    }
  }
  const resume = async (owner = session?.agreed ? session : undefined): Promise<void> => {
    if (playback || !enabled || !browserSaveSelected() || document.hidden || (!owner && session)) return
    const current: { release?: () => void } = owner?.release ? { release: owner.release } : {}
    if (owner) delete owner.release
    playback = current
    update()
    const checkpoint = async (): Promise<void> => {
      while (playback === current && document.hidden) await new Promise((resolve) => window.setTimeout(resolve, 100))
      if (playback !== current || !enabled || !browserSaveSelected()) throw new Error("Battle playback paused")
    }
    try {
      if (otherBusy()) throw new Error("Finish your device transfer to resume the saved battle")
      await reservePresentation(current)
      await checkpoint()
      const saved = await readPendingBattle()
      await checkpoint()
      pending = saved
      if (!saved) return
      incoming.hidden = true
      arena.hidden = false
      open()
      note(saved.completedShots > 0 ? "Resuming saved battle…" : owner ? "Battle started!" : "Resuming saved battle…")
      const result = await playSavedBattle(saved, {
        checkpoint,
        artwork: (text) => {
          element("battle-artwork").textContent = text
        },
        score: (text) => {
          element("battle-score").textContent = text
        },
      })
      // The complete outcome has been shown and its pending entry has been cleared.
      pending = undefined
      if (playback === current) note(result)
      refreshBrowserViews()
    } catch (error) {
      if (playback === current)
        note(
          error instanceof Error ? `${error.message}. Reopen BATTLE to continue.` : "Could not resume the saved battle",
        )
    } finally {
      if (playback === current) stopPlayback()
      if (owner && session === owner) reset()
      update()
    }
  }
  const prepare = async (current: Session): Promise<Fighter> => {
    if (!enabled || !browserSaveSelected() || otherBusy()) throw new Error("Finish your device transfer first")
    if (await readPendingBattle()) throw new Error("Finish the saved battle first")
    await reservePresentation(current)
    const state = await readLocalState()
    if (session !== current || !enabled || !browserSaveSelected()) throw new Error("Battle cancelled")
    if (!DIGIMON_CATALOG.byId.get(state.currentNodeId)?.stage)
      throw new Error("Wait for your egg to hatch before battling")
    if (state.pendingEvolution) throw new Error("Finish your companion's evolution before battling")
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
      negotiation: new BattleNegotiation(challenger, randomSecret(), {
        hash,
        send: (message) => {
          if (session === current) connection.send(message)
        },
        requested: (fighter) => {
          element("battle-incoming-text").textContent =
            `${battleNode(fighter.nodeId).nameEn} (${battleCodeOf(connection)}) challenges your companion.`
          incoming.hidden = false
          arena.hidden = true
          open()
          note("A player wants to battle. Accept to use your current Digimon.")
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
            note("This battle was already completed.")
            return
          }
          await resume(current)
        },
      }),
    }
    session = current
    incoming.hidden = true
    arena.hidden = true
    update()
    current.timer = window.setTimeout(() => {
      if (session === current) cancel("Battle request timed out. Keep both apps open and try again.")
    }, 120_000)
    connection.on("open", () => {
      if (!challenger) return
      enqueue(current, async () => {
        const fighter = await prepare(current)
        await current.negotiation.start(crypto.randomUUID(), fighter)
        note("Waiting for the other player to accept…")
      })
    })
    connection.on("data", (data) => enqueue(current, () => current.negotiation.receive(data)))
    connection.on("close", () => {
      if (session === current && !current.agreed) {
        reset()
        note("The other player disconnected. No reward awarded.")
      }
    })
    connection.on("error", (error) => {
      if (session === current && !current.agreed) cancel(`Battle connection failed: ${error.message}`)
    })
  }

  const transport = new BattleTransport({
    ready: (code) => {
      ready = true
      ownCode.textContent = code
      update()
      if (!session && !playback && !pending) note("Share your six-digit code to receive a battle request.")
    },
    incoming: (connection) => bind(connection, false),
    disconnected: () => {
      ready = false
      update()
      if (!session && !playback && !pending) note("Reconnecting to the battle service…")
    },
    error: (message) => {
      ready = transport.connected
      update()
      if (!session?.agreed && !pending && !playback) cancel(`Could not connect: ${message}`)
    },
  })
  button.addEventListener("click", () => {
    open()
    if (pending) void resume()
  })
  request.addEventListener("click", () => {
    const target = input.value.trim()
    if (!validBattleCode(target)) return note("Enter a six-digit battle code.")
    if (target === transport.code) return note("Enter the other player's code.")
    if (otherBusy()) return note("Finish the current device transfer first.")
    try {
      bind(transport.connect(target), true)
      note("Contacting the other player…")
    } catch (error) {
      note(error instanceof Error ? error.message : "Could not connect")
    }
  })
  accept.addEventListener("click", () => {
    const current = session
    if (!current || accept.disabled) return
    accept.disabled = true
    enqueue(current, async () => {
      await current.negotiation.accept(await prepare(current))
      incoming.hidden = true
      note("Preparing the battle…")
    })
  })
  decline.addEventListener("click", () => cancel("Battle declined."))
  element("battle-copy").addEventListener("click", () => {
    if (ready)
      void navigator.clipboard.writeText(transport.code).then(
        () => note("Battle code copied."),
        () => note("Could not copy the battle code."),
      )
  })
  dialog.addEventListener("close", () => {
    button.setAttribute("aria-expanded", "false")
    if (session || playback) {
      const agreed = Boolean(pending || session?.agreed)
      stopPlayback()
      cancel(agreed ? "Battle paused. Reopen BATTLE to continue." : "Battle cancelled.")
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
        if (session) cancel("Choose THIS BROWSER to battle with your companion.")
      }
      if (!value && dialog.open) dialog.close()
      update()
      if (value && pending) void resume()
    },
  }
}
