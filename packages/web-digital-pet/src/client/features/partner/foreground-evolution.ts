export type ForegroundEvolutionDependencies = {
  readonly active: () => boolean
  readonly valid: () => boolean
  readonly current: () => Promise<boolean>
  readonly wait: () => Promise<void>
  readonly present: (checkpoint: () => Promise<void>) => Promise<void>
  readonly complete: () => Promise<void>
}

/** Every animation frame and the final save pass through the same visibility gate. */
export const runForegroundEvolution = async (dependencies: ForegroundEvolutionDependencies): Promise<void> => {
  const checkpoint = async () => {
    for (;;) {
      while (dependencies.valid() && !dependencies.active()) await dependencies.wait()
      if (!dependencies.valid() || !(await dependencies.current())) throw new PresentationCancelled()
      // Storage reads yield; recheck visibility and source before presenting or committing.
      if (!dependencies.valid()) throw new PresentationCancelled()
      if (dependencies.active()) return
    }
  }
  await checkpoint()
  await dependencies.present(checkpoint)
  await checkpoint()
  await dependencies.complete()
}

export class PresentationCancelled extends Error {
  override name = "AbortError"
  constructor() {
    super("Presentation cancelled")
  }
}
