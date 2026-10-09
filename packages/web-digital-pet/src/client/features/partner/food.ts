import { renderPositionedArtwork } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"
import { consumeFood, peekLocalState, readLocalState } from "../../persistence/pet-store.ts"
import { animation } from "./animation.ts"
import { PresentationCancelled, runForegroundEvolution } from "./foreground-evolution.ts"
import {
  beginPresentation,
  endPresentation,
  isPresentingEvolution,
  presentationCurrent,
  presentationVersion,
} from "./presentation.ts"

type FoodView = {
  readonly partnerId: string
  readonly available: boolean
  readonly canEat: boolean
  readonly givesExperience: boolean
}
type FoodActions = {
  readonly width: number
  readonly deliver: (message: unknown) => void
  readonly active: () => boolean
  readonly valid: () => boolean
  readonly updated: () => void
}
let button: HTMLButtonElement | undefined
let feedback: HTMLSpanElement | undefined
let latest: { readonly view: FoodView; readonly actions: FoodActions } | undefined

// Whole pixel coordinates and currentColor preserve the LCD palette and crisp scaling.
const APPLE =
  '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M8 1h2v3H8zM10 2h3v2h-3zM3 5h3V4h2v1h2V4h3v1h1v2h1v5h-1v2h-2v1H9v-1H7v1H4v-1H2v-2H1V7h1V5z"/><path fill="var(--lcd)" d="M3 7h2v2H3zM3 9h1v2H3z"/></svg>'

const eat = async (): Promise<void> => {
  const request = latest
  if (
    !request?.view.available ||
    !request.view.canEat ||
    !request.actions.active() ||
    !request.actions.valid() ||
    !beginPresentation()
  )
    return
  const { view, actions } = request
  const revision = presentationVersion()
  if (button) button.disabled = true
  const valid = () => presentationCurrent(revision) && actions.valid()
  const play = async () => {
    const before = await readLocalState()
    if (!valid() || !actions.active() || !(await consumeFood(view.partnerId, () => valid() && actions.active()))) return
    if (button) button.hidden = true
    if (feedback) {
      feedback.hidden = false
      feedback.textContent = view.givesExperience ? "+25% EXPERIENCE" : "YUM!"
    }
    await runForegroundEvolution({
      active: actions.active,
      valid,
      current: async () => {
        const current = await peekLocalState()
        return current?.partnerId === view.partnerId && current.currentNodeId === before.currentNodeId
      },
      wait: () => new Promise((resolve) => window.setTimeout(resolve, 100)),
      present: async (checkpoint) => {
        await checkpoint()
        actions.deliver({ type: "presentation-state", state: { phase: "feeding", fromNodeId: before.currentNodeId } })
        let frame = animation.dispatch({ kind: "feed" })
        for (let tick = 0; tick < 3; tick++) {
          await checkpoint()
          actions.deliver({ type: "animation-frame", artwork: renderPositionedArtwork(frame, actions.width) })
          await new Promise((resolve) => window.setTimeout(resolve, 800))
          frame = animation.dispatch({ kind: "tick" })
        }
      },
      complete: async () => {},
    })
  }
  try {
    if (navigator.locks)
      await navigator.locks.request("digital-pet:evolution", { ifAvailable: true }, async (lock) => {
        if (lock) await play()
      })
    else await play()
  } catch (error) {
    if (!(error instanceof PresentationCancelled)) {
      if (button) button.title = "Could not feed your companion. Try again."
      throw error
    }
  } finally {
    endPresentation()
    actions.deliver({ type: "presentation-state", state: { phase: "idle" } })
    actions.updated()
  }
}

export const updateFoodButton = (
  view: FoodView | null,
  width: number,
  deliver: FoodActions["deliver"],
  active: FoodActions["active"],
  valid: FoodActions["valid"],
  updated: FoodActions["updated"],
): void => {
  latest = view ? { view, actions: { width, deliver, active, valid, updated } } : undefined
  if (!button && view) {
    const arena = document.querySelector(".arena")
    // A group keeps the feeding control accessible; role=img flattens interactive descendants.
    arena?.setAttribute("role", "group")
    button = document.createElement("button")
    button.type = "button"
    button.className = "pet-food"
    button.innerHTML = APPLE
    button.addEventListener("click", () => {
      void eat().catch(() => {
        if (feedback) {
          feedback.hidden = false
          feedback.textContent = "Could not feed. Try again."
        }
      })
    })
    arena?.append(button)
    feedback = document.createElement("span")
    feedback.className = "food-feedback"
    feedback.setAttribute("role", "status")
    feedback.hidden = true
    arena?.append(feedback)
  }
  if (!button) return
  if (feedback && !isPresentingEvolution()) feedback.hidden = true
  button.hidden = !view?.available || isPresentingEvolution()
  button.disabled = !view?.canEat || isPresentingEvolution()
  const label = view?.givesExperience ? "Feed your companion · +25% experience" : "Feed your companion"
  button.setAttribute("aria-label", label)
  button.title = label
}
