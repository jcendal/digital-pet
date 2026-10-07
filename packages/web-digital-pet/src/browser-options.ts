import { readLocalState, setExperienceLevel, startNewPartner } from "./browser-store.ts"
import { ACTIVE_SOURCE_KEY, SOURCE_PREFERENCE_KEY, refreshBrowserViews, resolveSaveSource } from "./browser-source.ts"
import type { ExperienceLevel } from "./local-progress.ts"
import type { BrowserPairingControls } from "./browser-pairing.ts"

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const levels: readonly ExperienceLevel[] = ["low", "normal", "high"]
const descriptions: Record<ExperienceLevel, string> = {
  low: "A faster journey. One tenth of the original experience.",
  normal: "A steady journey. Half the original experience.",
  high: "The original pace. Take your time to evolve.",
}

export const initBrowserOptions = async (): Promise<void> => {
  const dialog = byId<HTMLDialogElement>("options-dialog")
  const computer = byId<HTMLInputElement>("source-computer")
  const browser = byId<HTMLInputElement>("source-browser")
  const fieldset = byId<HTMLFieldSetElement>("browser-options")
  const slider = byId<HTMLInputElement>("experience-level")
  const description = byId<HTMLElement>("experience-description")
  const status = byId<HTMLElement>("options-status")
  const confirmation = byId<HTMLElement>("new-partner-confirm")
  let pairing: BrowserPairingControls | undefined
  let available: boolean | null = null
  let source = resolveSaveSource(
    localStorage.getItem(SOURCE_PREFERENCE_KEY),
    null,
    localStorage.getItem(ACTIVE_SOURCE_KEY),
  )

  byId("options-button").addEventListener("click", () => {
    byId("options-status").textContent = ""
    dialog.showModal()
    dialog.querySelector(".dialog-body")?.scrollTo(0, 0)
  })
  try {
    const response = await fetch("/api/mode", { cache: "no-store" })
    if (response.ok) {
      const mode = (await response.json()) as { mode: string }
      available = mode.mode === "sqlite"
    }
  } catch {
    /* The browser save remains available offline. */
  }
  source = resolveSaveSource(
    localStorage.getItem(SOURCE_PREFERENCE_KEY),
    available,
    localStorage.getItem(ACTIVE_SOURCE_KEY),
  )
  computer.disabled = available !== true
  if (available === false && localStorage.getItem(SOURCE_PREFERENCE_KEY) === "sqlite")
    localStorage.setItem(SOURCE_PREFERENCE_KEY, "browser")
  byId("computer-availability").textContent =
    available === true ? "AVAILABLE" : available === false ? "UNAVAILABLE" : "OFFLINE"

  const describe = (level: ExperienceLevel): void => {
    description.textContent = descriptions[level]
    slider.setAttribute("aria-valuetext", level === "low" ? "Low" : level === "normal" ? "Normal" : "High")
    const index = levels.indexOf(level)
    byId("experience-amount").textContent = level === "low" ? "10%" : level === "normal" ? "50%" : "100%"
    byId("experience-control").style.setProperty("--range-fill", `${index * 50}%`)
    for (const button of Array.from(dialog.querySelectorAll<HTMLButtonElement>("[data-experience-index]")))
      button.setAttribute("aria-pressed", String(Number(button.dataset.experienceIndex) === index))
  }
  const refreshSettings = async (): Promise<void> => {
    if (source !== "browser") return
    const level = (await readLocalState()).experienceLevel ?? "high"
    slider.value = String(levels.indexOf(level))
    describe(level)
  }
  const updateSource = async (): Promise<void> => {
    localStorage.setItem(ACTIVE_SOURCE_KEY, source)
    computer.checked = source === "sqlite"
    browser.checked = source === "browser"
    fieldset.disabled = source !== "browser"
    byId("browser-options-hint").hidden = source === "browser"
    confirmation.hidden = true
    pairing?.setBrowserEnabled(source === "browser")
    await refreshSettings()
    refreshBrowserViews()
  }
  describe("high")
  await updateSource()
  window.addEventListener("storage", (event) => {
    if (event.key !== SOURCE_PREFERENCE_KEY) return
    source = resolveSaveSource(event.newValue, available, localStorage.getItem(ACTIVE_SOURCE_KEY))
    void updateSource()
  })
  for (const radio of [computer, browser])
    radio.addEventListener("change", () => {
      source = radio.value === "browser" ? "browser" : "sqlite"
      localStorage.setItem(SOURCE_PREFERENCE_KEY, source)
      void updateSource()
        .then(() => {
          status.textContent = ""
        })
        .catch((error: unknown) => {
          status.textContent = String(error)
        })
    })
  slider.addEventListener("input", () => describe(levels[Number(slider.value)] ?? "high"))
  for (const button of Array.from(dialog.querySelectorAll<HTMLButtonElement>("[data-experience-index]")))
    button.addEventListener("click", () => {
      slider.value = button.dataset.experienceIndex ?? "2"
      slider.dispatchEvent(new Event("input"))
      slider.dispatchEvent(new Event("change"))
    })
  slider.addEventListener("change", async () => {
    if (source !== "browser") return
    if (pairing?.busy) {
      status.textContent = "Finish the current device transfer first."
      await refreshSettings()
      return
    }
    try {
      await setExperienceLevel(levels[Number(slider.value)] ?? "high")
      refreshBrowserViews()
      status.textContent = "Experience requirement saved."
    } catch (error) {
      status.textContent = String(error)
    }
  })
  byId("new-partner").addEventListener("click", () => {
    confirmation.hidden = false
    byId("new-partner-cancel").focus()
  })
  byId("new-partner-cancel").addEventListener("click", () => {
    confirmation.hidden = true
    byId("new-partner").focus()
  })
  byId("new-partner-accept").addEventListener("click", async () => {
    if (source !== "browser") return
    if (pairing?.busy) {
      status.textContent = "Finish the current device transfer first."
      return
    }
    try {
      await startNewPartner()
      confirmation.hidden = true
      refreshBrowserViews()
      status.textContent = "A new egg is ready. Your previous companion is in History."
    } catch (error) {
      status.textContent = String(error)
    }
  })
  window.addEventListener("digital-pet:save-updated", () => {
    void refreshSettings()
  })
  try {
    const pairingPath = "/browser-pairing.js"
    const module = (await import(pairingPath)) as { initBrowserPairing: () => Promise<BrowserPairingControls> }
    pairing = await module.initBrowserPairing()
    pairing.setBrowserEnabled(source === "browser")
  } catch (error) {
    byId("pair-summary").textContent = `Device pairing unavailable: ${String(error)}`
  }
}
