import type { ExchangePixel } from "@jcendal/digital-pet-animation/sequences/partner-exchange.ts"

/** Snap the animated artwork to whole LCD cells, preserving crisp pixel edges. */
export const exchangePixelPath = (pixels: readonly ExchangePixel[]): string =>
  pixels
    .map(({ x, y, size }) => {
      const cell = Math.max(1, Math.round(size))
      return `M${Math.round(x)} ${Math.round(y)}h${cell}v${cell}h-${cell}z`
    })
    .join("")

export const exchangeArtwork = `<svg class="social-exchange-artwork" viewBox="0 0 80 56" aria-hidden="true" shape-rendering="crispEdges"><path class="social-exchange-corners" d="M1 8V2h6M73 2h6v6M1 48v6h6M73 54h6v-6"/><path id="social-exchange-trail"/><path id="social-exchange-outgoing"/><path id="social-exchange-incoming"/><path id="social-exchange-sparks"/></svg>`
