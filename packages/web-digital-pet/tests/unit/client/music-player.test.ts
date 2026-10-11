import { expect, test } from "bun:test"
import { createMusicPlayer, type MusicStatus } from "../../../src/client/features/music/player.ts"

const setup = () => {
  const statuses: MusicStatus[] = []
  const plays: { resolve(): void; reject(error: unknown): void }[] = []
  const audio = {
    src: "",
    paused: true,
    loop: false,
    preload: "auto",
    volume: 1,
    play() {
      this.paused = false
      return new Promise<void>((resolve, reject) => plays.push({ resolve, reject }))
    },
    pause() {
      this.paused = true
    },
  }
  const player = createMusicPlayer(audio, { game: "/game.mp3", battle: "/battle.mp3" }, (status) =>
    statuses.push(status),
  )
  return { player, audio, statuses, plays }
}

test("music waits for a gesture, keeps one looping player, and changes track only at battle transitions", async () => {
  const { player, audio, statuses, plays } = setup()
  player.setEnabled(true)
  expect(audio.src).toBe("")
  expect(statuses.at(-1)).toBe("waiting")
  player.start()
  expect(audio.src).toBe("/game.mp3")
  expect(audio.loop).toBe(true)
  plays[0]!.resolve()
  await Promise.resolve()
  expect(statuses.at(-1)).toBe("playing")
  player.start()
  player.setBattle(false)
  expect(plays).toHaveLength(1)
  player.setBattle(true)
  expect(audio.src).toBe("/battle.mp3")
  player.setBattle(true)
  expect(plays).toHaveLength(2)
  plays[1]!.resolve()
  await Promise.resolve()
  player.setBattle(false)
  expect(audio.src).toBe("/game.mp3")
  expect(plays).toHaveLength(3)
})

test("mute and backgrounding stop immediately and stale playback results cannot override them", async () => {
  const { player, audio, statuses, plays } = setup()
  player.start()
  player.setEnabled(false)
  expect(audio.paused).toBe(true)
  plays[0]!.resolve()
  await Promise.resolve()
  expect(statuses.at(-1)).toBe("off")
  player.setBattle(true)
  expect(plays).toHaveLength(1)
  player.setForeground(false)
  player.setEnabled(true)
  expect(plays).toHaveLength(1)
  player.setForeground(true)
  expect(audio.src).toBe("/battle.mp3")
  player.setForeground(false)
  plays[1]!.reject(new DOMException("Interrupted", "AbortError"))
  await Promise.resolve()
  expect(audio.paused).toBe(true)
  expect(statuses.at(-1)).toBe("paused")
})

test("an autoplay refusal or failed media load stays retryable by a later user gesture", async () => {
  const { player, audio, statuses, plays } = setup()
  player.start()
  audio.paused = true
  plays[0]!.reject(new DOMException("User gesture required", "NotAllowedError"))
  await Promise.resolve()
  expect(statuses.at(-1)).toBe("waiting")
  player.start()
  audio.paused = true
  plays[1]!.reject(new DOMException("Unavailable", "NotSupportedError"))
  await Promise.resolve()
  expect(statuses.at(-1)).toBe("failed")
  player.start()
  plays[2]!.resolve()
  await Promise.resolve()
  expect(statuses.at(-1)).toBe("playing")
})
