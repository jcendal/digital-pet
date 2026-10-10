import { LANGUAGE_PREFERENCE_KEY } from "@jcendal/digital-pet-intl"
import type { ExperienceLevel } from "../../../domain/pet/progress.ts"
import {
  MAX_BACKUP_BYTES,
  type PetTransfer,
  parsePetTransfer,
  TRANSFER_VERSION,
} from "../../../domain/transfer/protocol.ts"
import { IntlModule } from "../../../shared/i18n.ts"
import { LANDSCAPE_MOTION_KEY, landscapeMotionEnabled } from "../../../shared/scene-motion.ts"
import {
  hasPreviousSave,
  readLocalState,
  replaceLocalState,
  restorePreviousSave,
  setExperienceLevel,
  startNewPartner,
} from "../../persistence/pet-store.ts"
import { checkComputerSave } from "../../platform/computer-save.ts"
import {
  ACTIVE_SOURCE_KEY,
  refreshBrowserViews,
  resolveSaveSource,
  SOURCE_PREFERENCE_KEY,
} from "../../platform/save-source.ts"
import type { BrowserPairingControls } from "../pairing/controller.ts"

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const levels: readonly ExperienceLevel[] = ["low", "normal", "high"]
const descriptions: Record<ExperienceLevel, string> = {
  low: IntlModule.translate("controller.aFasterJourneyOneTenthOfTheOriginal"),
  normal: IntlModule.translate("controller.aSteadyJourneyHalfTheOriginalExperience"),
  high: IntlModule.translate("controller.theOriginalPaceTakeYourTimeToEvolve"),
}

export const initBrowserOptions = async (): Promise<void> => {
  const language = document.querySelector<HTMLSelectElement>("#language-select")!
  language.value = IntlModule.locale
  language.addEventListener("change", () => {
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, language.value)
    // Reload all views together so models, notifications and controls use one locale.
    location.reload()
  })

  const dialog = byId<HTMLDialogElement>("options-dialog")
  const landscape = byId<HTMLButtonElement>("landscape-motion")
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
  const describeLandscape = () => {
    const on = landscapeMotionEnabled(localStorage.getItem(LANDSCAPE_MOTION_KEY), reducedMotion.matches)
    landscape.setAttribute("aria-pressed", String(on))
    byId("landscape-motion-state").textContent = on
      ? IntlModule.translate("controller.on")
      : IntlModule.translate("controller.off")
  }
  landscape.addEventListener("click", () => {
    const on = landscape.getAttribute("aria-pressed") !== "true"
    localStorage.setItem(LANDSCAPE_MOTION_KEY, on ? "on" : "off")
    describeLandscape()
  })
  window.addEventListener("storage", (event) => {
    if (event.key === LANDSCAPE_MOTION_KEY || event.key === null) describeLandscape()
  })
  reducedMotion.addEventListener("change", describeLandscape)
  describeLandscape()
  const computer = byId<HTMLInputElement>("source-computer")
  const browser = byId<HTMLInputElement>("source-browser")
  const fieldset = byId<HTMLFieldSetElement>("browser-options")
  const slider = byId<HTMLInputElement>("experience-level")
  const description = byId<HTMLElement>("experience-description")
  const status = byId<HTMLElement>("options-status")
  const confirmation = byId<HTMLElement>("new-partner-confirm")
  const backupFile = byId<HTMLInputElement>("backup-file")
  const backupConfirm = byId<HTMLElement>("backup-confirm")
  const backupRestore = byId<HTMLButtonElement>("backup-restore")
  let pendingBackup: PetTransfer | null = null
  let pairing: BrowserPairingControls | undefined
  let battles: BrowserPairingControls | undefined
  let available: boolean | null = null
  let source = resolveSaveSource(
    localStorage.getItem(SOURCE_PREFERENCE_KEY),
    null,
    localStorage.getItem(ACTIVE_SOURCE_KEY),
  )

  const browserOnly = document.documentElement.dataset.saveHost === "browser"
  available = await checkComputerSave(browserOnly)
  source = resolveSaveSource(
    localStorage.getItem(SOURCE_PREFERENCE_KEY),
    available,
    localStorage.getItem(ACTIVE_SOURCE_KEY),
  )
  const describeAvailability = () => {
    computer.disabled = available !== true
    byId("computer-availability").textContent =
      available === true
        ? IntlModule.translate("controller.available")
        : available === false
          ? IntlModule.translate("controller.unavailable")
          : IntlModule.translate("controller.offline")
    byId("computer-connection-hint").textContent =
      available === true
        ? IntlModule.translate("controller.yourComputerCompanionIsReady")
        : browserOnly
          ? IntlModule.translate("controller.useTheLocalAppOnYourComputerTo")
          : available === false
            ? IntlModule.translate("controller.noComputerCompanionFoundStartOneInCursor")
            : IntlModule.translate("controller.openDigitalPetOnThisComputerThenTry")
    byId("computer-retry").hidden = browserOnly || available === true
  }
  describeAvailability()

  const describe = (level: ExperienceLevel): void => {
    description.textContent = descriptions[level]
    slider.setAttribute(
      "aria-valuetext",
      level === "low"
        ? IntlModule.translate("controller.low")
        : level === "normal"
          ? IntlModule.translate("controller.normal")
          : IntlModule.translate("controller.high"),
    )
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
    backupRestore.hidden = !(await hasPreviousSave())
  }
  const updateSource = async (): Promise<void> => {
    localStorage.setItem(ACTIVE_SOURCE_KEY, source)
    computer.checked = source === "sqlite"
    browser.checked = source === "browser"
    fieldset.disabled = source !== "browser"
    byId("browser-options-hint").hidden = source === "browser"
    confirmation.hidden = true
    backupConfirm.hidden = true
    pendingBackup = null
    pairing?.setBrowserEnabled(source === "browser")
    battles?.setBrowserEnabled(source === "browser")
    await refreshSettings()
    refreshBrowserViews()
  }
  describe("high")
  await updateSource()
  let checking: Promise<void> | undefined
  const refreshAvailability = (): Promise<void> => {
    if (checking) return checking
    checking = (async () => {
      const previous = available
      available = await checkComputerSave(browserOnly)
      describeAvailability()
      const next = resolveSaveSource(
        localStorage.getItem(SOURCE_PREFERENCE_KEY),
        available,
        localStorage.getItem(ACTIVE_SOURCE_KEY),
      )
      if (next !== source || previous !== available) {
        source = next
        await updateSource()
      } else await refreshSettings()
    })().finally(() => {
      checking = undefined
    })
    return checking
  }
  byId("options-button").addEventListener("click", () => {
    byId("options-status").textContent = ""
    dialog.showModal()
    byId("options-button").setAttribute("aria-expanded", "true")
    dialog.querySelector(".dialog-body")?.scrollTo(0, 0)
    void refreshAvailability()
  })
  dialog.addEventListener("close", () => byId("options-button").setAttribute("aria-expanded", "false"))
  byId("computer-retry").addEventListener("click", () => {
    void refreshAvailability()
  })
  window.addEventListener("online", () => {
    void refreshAvailability()
  })
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
  byId("backup-download").addEventListener("click", async () => {
    if (source !== "browser") return
    try {
      const state = await readLocalState()
      const blob = new Blob([JSON.stringify({ version: TRANSFER_VERSION, state }, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `digital-pet-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      status.textContent = IntlModule.translate("controller.backupDownloadedKeepTheFileSomewhereSafe")
    } catch (error) {
      status.textContent = String(error)
    }
  })
  byId("backup-import").addEventListener("click", () => backupFile.click())
  backupFile.addEventListener("change", async () => {
    const file = backupFile.files?.[0]
    backupFile.value = ""
    backupConfirm.hidden = true
    pendingBackup = null
    if (!file || source !== "browser") return
    if (file.size > MAX_BACKUP_BYTES) {
      status.textContent = IntlModule.translate("controller.thisBackupFileIsTooLarge")
      return
    }
    try {
      pendingBackup = parsePetTransfer(JSON.parse(await file.text()) as unknown, MAX_BACKUP_BYTES)
      byId("backup-preview").textContent = IntlModule.translate("controller.backupFrom", {
        value0: new Date(pendingBackup.state.createdAt).toLocaleDateString(IntlModule.locale),
      })
      backupConfirm.hidden = false
      byId("backup-cancel").focus()
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : IntlModule.translate("controller.thisBackupCouldNotBeRead")
    }
  })
  byId("backup-cancel").addEventListener("click", () => {
    backupConfirm.hidden = true
    pendingBackup = null
    byId("backup-import").focus()
  })
  byId("backup-accept").addEventListener("click", async () => {
    if (source !== "browser" || !pendingBackup) return
    if (pairing?.busy || battles?.busy) {
      status.textContent = IntlModule.translate("controller.finishTheCurrentTransferOrBattleFirst")
      return
    }
    try {
      await replaceLocalState(pendingBackup.state)
      backupConfirm.hidden = true
      pendingBackup = null
      refreshBrowserViews()
      status.textContent = IntlModule.translate("controller.backupImportedYourPreviousSaveCanBeRestored")
    } catch (error) {
      status.textContent = String(error)
    }
  })
  backupRestore.addEventListener("click", async () => {
    if (source !== "browser") return
    if (pairing?.busy || battles?.busy) {
      status.textContent = IntlModule.translate("controller.finishTheCurrentTransferOrBattleFirst")
      return
    }
    try {
      if (await restorePreviousSave()) {
        refreshBrowserViews()
        status.textContent = IntlModule.translate("controller.previousSaveRestored")
      } else {
        backupRestore.hidden = true
        status.textContent = IntlModule.translate("controller.thereIsNoPreviousSaveToRestore")
      }
    } catch (error) {
      status.textContent = String(error)
    }
  })
  for (const button of Array.from(dialog.querySelectorAll<HTMLButtonElement>("[data-experience-index]")))
    button.addEventListener("click", () => {
      slider.value = button.dataset.experienceIndex ?? "2"
      slider.dispatchEvent(new Event("input"))
      slider.dispatchEvent(new Event("change"))
    })
  slider.addEventListener("change", async () => {
    if (source !== "browser") return
    if (pairing?.busy || battles?.busy) {
      status.textContent = IntlModule.translate("controller.finishTheCurrentTransferOrBattleFirst")
      await refreshSettings()
      return
    }
    try {
      await setExperienceLevel(levels[Number(slider.value)] ?? "high")
      refreshBrowserViews()
      status.textContent = IntlModule.translate("controller.experienceRequirementSaved")
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
    if (pairing?.busy || battles?.busy) {
      status.textContent = IntlModule.translate("controller.finishTheCurrentTransferOrBattleFirst")
      return
    }
    try {
      await startNewPartner()
      confirmation.hidden = true
      refreshBrowserViews()
      status.textContent = IntlModule.translate("controller.aNewEggIsReadyYourPreviousCompanion")
    } catch (error) {
      status.textContent = String(error)
    }
  })
  window.addEventListener("digital-pet:save-updated", () => {
    void refreshSettings()
  })
  try {
    const module = await import("../pairing/controller.ts")
    pairing = await module.initBrowserPairing(() => Boolean(battles?.busy))
    pairing.setBrowserEnabled(source === "browser")
  } catch (error) {
    byId("pair-summary").textContent = IntlModule.translate("controller.devicePairingUnavailable", {
      value0: String(error),
    })
  }
  try {
    const module = await import("../battle/controller.ts")
    battles = await module.initBrowserBattles(() => Boolean(pairing?.busy))
    battles.setBrowserEnabled(source === "browser")
  } catch (error) {
    byId("battle-status").textContent = IntlModule.translate("controller.playerBattlesUnavailable", {
      value0: String(error),
    })
    byId<HTMLButtonElement>("battle-button").disabled = true
    byId("battle-button").title = IntlModule.translate("controller.playerBattlesUnavailableReloadToTryAgain")
  }
}
