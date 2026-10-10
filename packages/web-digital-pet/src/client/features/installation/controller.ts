import { IntlModule } from "../../../shared/i18n.ts"

type InstallPrompt = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/** Show installation only when the browser provides a native installation prompt. */
export const initBrowserInstallation = (): void => {
  const banner = document.getElementById("install-banner")!
  const section = document.getElementById("install-section")!
  const action = document.getElementById("install-app") as HTMLButtonElement
  const open = document.getElementById("install-open") as HTMLButtonElement
  const standalone = matchMedia("(display-mode: standalone)")
  let installed = standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  let prompt: InstallPrompt | undefined
  let dismissed = false
  const update = (): void => {
    const available = !installed && Boolean(prompt)
    section.hidden = !available
    banner.hidden = !available || dismissed
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    prompt = event as InstallPrompt
    update()
  })
  window.addEventListener("appinstalled", () => {
    installed = true
    prompt = undefined
    update()
  })
  standalone.addEventListener("change", () => {
    installed = standalone.matches
    update()
  })
  document.getElementById("install-dismiss")!.addEventListener("click", () => {
    dismissed = true
    update()
  })
  const install = async (): Promise<void> => {
    const current = prompt
    if (!current) return
    prompt = undefined
    update()
    try {
      await current.prompt()
      const choice = await current.userChoice
      if (choice.outcome === "accepted") installed = true
    } catch {
      const dialog = document.getElementById("options-dialog") as HTMLDialogElement
      if (!dialog.open) dialog.showModal()
      document.getElementById("options-button")!.setAttribute("aria-expanded", "true")
      document.getElementById("options-status")!.textContent = IntlModule.translate("installation.failed")
    }
    update()
  }
  open.addEventListener("click", () => void install())
  action.addEventListener("click", () => void install())
  update()
}
