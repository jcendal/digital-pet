import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import { IntlModule } from "../../shared/i18n.ts"

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
const label = (key: string): string =>
  `<span class="nav-label" data-i18n="web:${key}" aria-hidden="true">${escapeHtml(IntlModule.translate(key))}</span>`
const battleButton = `<button id="battle-button" class="nav-battle" type="button" aria-label="${escapeHtml(IntlModule.translate("navigationMarkup.battle"))}" data-i18n-aria-label="web:navigationMarkup.battle" title="${escapeHtml(IntlModule.translate("controller.playerBattle"))}" data-i18n-title="web:controller.playerBattle" aria-haspopup="dialog" aria-controls="battle-dialog" aria-expanded="false" disabled>${icons.battle}${label("navigationMarkup.battle")}</button>`

export const navigationMarkup = (page: "sidebar" | "dex" | "history"): string => {
  const links = (["sidebar", "dex", "history"] as const)
    .map((view) => {
      const key = view === "sidebar" ? "navigationMarkup.partner" : `navigation.${view}`
      const name = escapeHtml(IntlModule.translate(key))
      const symbol = view === "sidebar" ? icons.partner : icons[view]
      const link = `<a href="${view === "sidebar" ? "/" : `/${view}`}" data-page="${view}" aria-label="${name}" title="${name}" data-i18n-aria-label="web:${key}" data-i18n-title="web:${key}"${view === page ? ' aria-current="page"' : ""}>${symbol}${label(key)}</a>`
      return view === "dex" ? link + battleButton : link
    })
    .join("")
  return `<nav class="web-nav" aria-label="${escapeHtml(IntlModule.translate("navigationMarkup.digitalPet"))}" data-i18n-aria-label="web:navigationMarkup.digitalPet">${links}<button id="options-button" type="button" aria-label="${escapeHtml(IntlModule.translate("navigationMarkup.options"))}" data-i18n-aria-label="web:navigationMarkup.options" title="${escapeHtml(IntlModule.translate("navigationMarkup.options2"))}" data-i18n-title="web:navigationMarkup.options2" aria-haspopup="dialog" aria-controls="options-dialog" aria-expanded="false">${icons.options}${label("navigationMarkup.options")}</button></nav>`
}
