export type MusicStatus = "off" | "waiting" | "playing" | "paused" | "failed"
type MusicTrack = "game" | "battle"
type MusicAudio = Pick<HTMLAudioElement, "src" | "paused" | "loop" | "preload" | "volume" | "play" | "pause">

/** One media element keeps Safari's gesture permission when the soundtrack changes. */
export const createMusicPlayer = (
  audio: MusicAudio,
  tracks: Record<MusicTrack, string>,
  onStatus: (status: MusicStatus) => void,
) => {
  let enabled = true
  let foreground = true
  let unlocked = false
  let track: MusicTrack = "game"
  let loadedTrack: MusicTrack | undefined
  let starting = false
  let revision = 0
  audio.loop = true
  audio.preload = "none"
  audio.volume = 0.25

  const sync = (): void => {
    if (!enabled || !foreground || !unlocked) {
      revision++
      starting = false
      audio.pause()
      onStatus(!enabled ? "off" : !foreground ? "paused" : "waiting")
      return
    }
    if (loadedTrack !== track) {
      revision++
      starting = false
      audio.pause()
      audio.src = tracks[track]
      loadedTrack = track
    }
    if (starting || !audio.paused) return
    const current = ++revision
    starting = true
    void audio.play().then(
      () => {
        if (current !== revision) return
        starting = false
        onStatus("playing")
      },
      (error: unknown) => {
        if (current !== revision) return
        starting = false
        const blocked = error instanceof DOMException && error.name === "NotAllowedError"
        // Reset a failed resource so the next gesture can retry after connectivity recovers.
        if (!blocked) loadedTrack = undefined
        onStatus(blocked ? "waiting" : "failed")
      },
    )
  }
  return {
    start(): void {
      unlocked = true
      sync()
    },
    setEnabled(value: boolean): void {
      enabled = value
      sync()
    },
    setForeground(value: boolean): void {
      foreground = value
      sync()
    },
    setBattle(value: boolean): void {
      track = value ? "battle" : "game"
      sync()
    },
  }
}
