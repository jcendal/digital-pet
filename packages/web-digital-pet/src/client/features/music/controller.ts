import { IntlModule } from "../../../shared/i18n.ts"
import { webAsset } from "../../platform/assets.ts"
import { createMusicPlayer, type MusicStatus } from "./player.ts"

const MUSIC_PREFERENCE_KEY = "digital-pet:music"

/** Sound belongs to the web shell, so opening another panel never starts a second player. */
export const initBrowserMusic = (): void => {
  const toggle = document.querySelector<HTMLButtonElement>("#music-toggle")!
  const badge = document.getElementById("music-state")!
  const caption = document.getElementById("music-status")!
  const audio = document.createElement("audio")
  audio.id = "background-music"
  audio.hidden = true
  document.body.append(audio)
  let enabled = localStorage.getItem(MUSIC_PREFERENCE_KEY) !== "off"
  const player = createMusicPlayer(
    audio,
    { game: webAsset("/music/butter-fly.mp3"), battle: webAsset("/music/brave-heart.mp3") },
    (status: MusicStatus) => {
      caption.textContent = IntlModule.translate(
        status === "waiting" ? "music.tapToPlay" : status === "failed" ? "music.unavailable" : "music.description",
      )
    },
  )
  const updatePreference = (): void => {
    enabled = localStorage.getItem(MUSIC_PREFERENCE_KEY) !== "off"
    toggle.setAttribute("aria-pressed", String(enabled))
    badge.textContent = IntlModule.translate(enabled ? "controller.on" : "controller.off")
    player.setEnabled(enabled)
  }
  toggle.addEventListener("click", () => {
    localStorage.setItem(MUSIC_PREFERENCE_KEY, enabled ? "off" : "on")
    updatePreference()
    if (enabled) player.start()
  })
  const unlock = (event: Event): void => {
    if (event.isTrusted && !(event.target instanceof Node && toggle.contains(event.target))) player.start()
  }
  const listenForGesture = (target: Document): void => {
    target.addEventListener("click", unlock, true)
    target.addEventListener("keydown", unlock, true)
  }
  listenForGesture(document)
  for (const frame of Array.from(document.querySelectorAll<HTMLIFrameElement>(".web-view"))) {
    const loaded = (): void => {
      if (frame.dataset.page === "sidebar") player.setBattle(false)
      if (frame.contentDocument) listenForGesture(frame.contentDocument)
    }
    frame.addEventListener("load", loaded)
    if (frame.contentDocument?.readyState === "complete") loaded()
  }
  const sidebar = document.querySelector<HTMLIFrameElement>('iframe[data-page="sidebar"]')!
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== location.origin || event.source !== sidebar.contentWindow) return
    const data = event.data as { type?: unknown; phase?: unknown } | null
    if (data?.type !== "digital-pet:presentation-state") return
    if (data.phase === "battle") player.setBattle(true)
    else if (["idle", "evolving", "evolved", "feeding"].includes(String(data.phase))) player.setBattle(false)
  })
  document.addEventListener("visibilitychange", () => player.setForeground(!document.hidden))
  window.addEventListener("pagehide", () => player.setForeground(false))
  window.addEventListener("pageshow", () => player.setForeground(!document.hidden))
  window.addEventListener("storage", (event) => {
    if (event.key === MUSIC_PREFERENCE_KEY || event.key === null) updatePreference()
  })
  player.setForeground(!document.hidden)
  updatePreference()
}
