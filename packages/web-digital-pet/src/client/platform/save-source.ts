export const SOURCE_PREFERENCE_KEY = "digital-pet:preferred-source"
export const ACTIVE_SOURCE_KEY = "digital-pet:source"
export type SaveSource = "browser" | "sqlite"

export const resolveSaveSource = (
  preferred: string | null,
  computerAvailable: boolean | null,
  previous: string | null,
): SaveSource => {
  if (preferred === "browser") return "browser"
  if (computerAvailable !== null) return computerAvailable ? "sqlite" : "browser"
  if (preferred === "sqlite") return "sqlite"
  return previous === "sqlite" ? "sqlite" : "browser"
}

export const isBrowserSaveSelected = (preferred: string | null, active: string | null): boolean =>
  preferred === "browser" || (preferred !== "sqlite" && active === "browser")

export const browserSaveSelected = (): boolean =>
  isBrowserSaveSelected(localStorage.getItem(SOURCE_PREFERENCE_KEY), localStorage.getItem(ACTIVE_SOURCE_KEY))

export const refreshBrowserViews = (): void => {
  for (const frame of Array.from(document.querySelectorAll<HTMLIFrameElement>(".web-view")))
    frame.contentWindow?.postMessage({ type: "browser-save-updated" }, location.origin)
  window.dispatchEvent(new Event("digital-pet:save-updated"))
}
