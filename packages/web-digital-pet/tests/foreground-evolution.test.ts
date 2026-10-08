import { expect, it } from "bun:test"
import { runForegroundEvolution } from "../src/foreground-evolution.ts"

const gate = () => {
  let resume!: () => void
  let paused!: () => void
  const waiting = new Promise<void>((resolve) => {
    paused = resolve
  })
  return {
    waiting,
    resume: () => resume(),
    wait: () =>
      new Promise<void>((resolve) => {
        resume = resolve
        paused()
      }),
  }
}

it("waits for an active view before starting, and pauses between animation frames", async () => {
  let active = false
  let frames = 0
  let completed = false
  let pause = gate()
  const task = runForegroundEvolution({
    active: () => active,
    valid: () => true,
    current: async () => true,
    wait: () => pause.wait(),
    present: async (checkpoint) => {
      await checkpoint()
      frames++
      active = false
      pause = gate()
      await checkpoint()
      frames++
    },
    complete: async () => {
      completed = true
    },
  })
  await pause.waiting
  expect(frames).toBe(0)
  active = true
  pause.resume()
  // The first frame creates a new pause gate.
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await pause.waiting
  expect(frames).toBe(1)
  expect(completed).toBe(false)
  active = true
  pause.resume()
  await task
  expect(frames).toBe(2)
  expect(completed).toBe(true)
})

it("does not commit an evolution if the view becomes inactive after its last frame", async () => {
  let active = true
  let completed = false
  const pause = gate()
  const task = runForegroundEvolution({
    active: () => active,
    valid: () => true,
    current: async () => true,
    wait: pause.wait,
    present: async (checkpoint) => {
      await checkpoint()
      active = false
    },
    complete: async () => {
      completed = true
    },
  })
  await pause.waiting
  expect(completed).toBe(false)
  active = true
  pause.resume()
  await task
  expect(completed).toBe(true)
})

it("cancels a paused presentation when the save or source is replaced", async () => {
  let valid = true
  let completed = false
  const pause = gate()
  const task = runForegroundEvolution({
    active: () => false,
    valid: () => valid,
    current: async () => true,
    wait: pause.wait,
    present: async () => {},
    complete: async () => {
      completed = true
    },
  })
  const rejected = task.catch((error: unknown) => error)
  await pause.waiting
  valid = false
  pause.resume()
  expect(await rejected).toMatchObject({ name: "AbortError" })
  expect(completed).toBe(false)
})

it("rechecks cancellation after the asynchronous identity query before rendering", async () => {
  let valid = true
  let presented = false
  await expect(
    runForegroundEvolution({
      active: () => true,
      valid: () => valid,
      current: async () => {
        valid = false
        return true
      },
      wait: async () => {},
      present: async () => {
        presented = true
      },
      complete: async () => {},
    }),
  ).rejects.toMatchObject({ name: "AbortError" })
  expect(presented).toBe(false)
})
