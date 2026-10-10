const icon = (content: string): string =>
  `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${content}</svg>`

const icons = {
  partner: icon(
    '<path fill="currentColor" d="M4 3h4v3h8V3h4v15h-3v3H7v-3H4z"/><path fill="var(--case)" d="M7 9h3v3H7zm7 0h3v3h-3zM8 15h8v2H8z"/>',
  ),
  dex: icon(
    '<path fill="none" stroke="currentColor" stroke-width="2" d="M12 5v15M3 4h5l4 2 4-2h5v14h-5l-4 2-4-2H3zM6 8h3M6 12h3m6-4h3m-3 4h3"/>',
  ),
  battle: icon(
    '<path fill="none" stroke="currentColor" stroke-width="2" d="M4 3h4l11 13-3 3L3 8V4h1zm16 0h-4l-4 5m-4 4-3 4 3 3 4-5M3 15l6 6m6-18 6 6M3 21l3-3m12 0 3 3"/>',
  ),
  history: icon(
    '<path fill="none" stroke="currentColor" stroke-width="2" d="M4 8V3M4 8h5m-5 0 4-4h8l4 4v8l-4 4H8l-4-4m8-9v6h5"/>',
  ),
  options: icon(
    '<path fill="currentColor" d="M9 2h6v3h3v3h4v8h-4v3h-3v3H9v-3H6v-3H2V8h4V5h3z"/><path fill="var(--case)" d="M9 9h6v6H9z"/>',
  ),
}
const label = (text: string): string => `<span class="nav-label" aria-hidden="true">${text}</span>`
const battleButton = `<button id="battle-button" class="nav-battle" type="button" aria-label="BATTLE" title="Player battle" aria-haspopup="dialog" aria-controls="battle-dialog" aria-expanded="false" disabled>${icons.battle}${label("BATTLE")}</button>`

export const navigationMarkup = (page: "sidebar" | "dex" | "history"): string => {
  const links = (["sidebar", "dex", "history"] as const)
    .map((view) => {
      const name = view === "sidebar" ? "PARTNER" : view.toUpperCase()
      const symbol = view === "sidebar" ? icons.partner : icons[view]
      const link = `<a href="${view === "sidebar" ? "/" : `/${view}`}" data-page="${view}" aria-label="${name}" title="${name}"${view === page ? ' aria-current="page"' : ""}>${symbol}${label(name)}</a>`
      return view === "dex" ? link + battleButton : link
    })
    .join("")
  return `<nav class="web-nav" aria-label="Digital Pet">${links}<button id="options-button" type="button" aria-label="OPTIONS" title="Options" aria-haspopup="dialog" aria-controls="options-dialog" aria-expanded="false">${icons.options}${label("OPTIONS")}</button></nav>`
}
