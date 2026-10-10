/** Back off when the signaling service is offline or limits connection attempts. */
export class PeerRetry {
  private timer: number | undefined
  private delay = 5_000

  constructor(private readonly retry: () => void) {}

  schedule(): void {
    if (this.timer !== undefined) return
    this.timer = window.setTimeout(() => {
      this.timer = undefined
      if (navigator.onLine) this.retry()
      else this.schedule()
    }, this.delay)
    this.delay = Math.min(this.delay * 2, 30_000)
  }

  reset(): void {
    this.stop()
    this.delay = 5_000
  }

  stop(): void {
    window.clearTimeout(this.timer)
    this.timer = undefined
  }
}
