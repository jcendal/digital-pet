import { IntlModule } from "../i18n.ts"
import { escapeHtml } from "../shared/escape-html.ts"
import { intlScript } from "../shared/intl-script.ts"
import { PANEL_STYLES } from "../shared/panel-styles.ts"
import { PANEL_THEME } from "../shared/theme.ts"
import { SIDEBAR_SCRIPT } from "./sidebar-script.ts"
import { SIDEBAR_STYLES } from "./sidebar-styles.ts"

export const buildSidebarWebviewHtml = (
  nonce: string,
  resources?: {
    readonly fontUri: string
    readonly cspSource: string
    readonly webShell?: boolean
    readonly moduleClient?: boolean
  },
): string => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title data-i18n="webviews:sidebarDocument.digitalPetPartner">${escapeHtml(IntlModule.translate("sidebarDocument.digitalPetPartner"))}</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; font-src ${escapeHtml(resources?.cspSource ?? "'none'")}; img-src ${escapeHtml(resources?.cspSource ?? "'none'")}; style-src 'unsafe-inline'; script-src 'nonce-${escapeHtml(nonce)}';">
<style>${resources ? `@font-face { font-family: 'Digital Pet Pixel'; src: url('${escapeHtml(resources.fontUri)}') format('truetype'); font-display: swap; }` : ""}${PANEL_THEME}${resources?.webShell ? PANEL_STYLES : ""}${SIDEBAR_STYLES}</style></head>
<body>${resources?.webShell ? `<main class="device partner-device"><header class="masthead"><p class="brand" data-i18n="webviews:panelRender.digitalMonster">${escapeHtml(IntlModule.translate("panelRender.digitalMonster"))}</p><h1 data-i18n="webviews:sidebarDocument.partner">${escapeHtml(IntlModule.translate("sidebarDocument.partner"))}</h1></header><div class="screen">` : ""}<${resources?.webShell ? "section" : "main"} class="pet-module" aria-label="${escapeHtml(IntlModule.translate("sidebarDocument.digitalPet"))}" data-i18n-aria-label="webviews:sidebarDocument.digitalPet">
<header class="pet-header"><span id="phase" role="status" aria-live="polite" data-i18n="webviews:sidebarDocument.loading">${escapeHtml(IntlModule.translate("sidebarDocument.loading"))}</span><span class="micro" data-i18n="webviews:sidebarDocument.vpet">${escapeHtml(IntlModule.translate("sidebarDocument.vpet"))}</span></header>
<div id="content"><div class="arena" role="group" aria-label="${escapeHtml(IntlModule.translate("sidebarDocument.partnerAnimation"))}" data-i18n-aria-label="webviews:sidebarDocument.partnerAnimation"><div id="battle-scores" hidden><span id="player-score"></span><span id="opponent-score"></span></div><svg id="artwork" aria-hidden="true"></svg><button id="pet-egg" type="button" aria-label="${escapeHtml(IntlModule.translate("egg.pet"))}" hidden disabled></button><span id="egg-pet-hint" hidden></span><span id="egg-pet-feedback" aria-hidden="true"></span><span id="battle-caption" aria-live="polite" hidden></span><div id="pet-poops" aria-label="${escapeHtml(IntlModule.translate("sidebarDocument.cleanYourCompanionSPoop"))}" data-i18n-aria-label="webviews:sidebarDocument.cleanYourCompanionSPoop"></div></div>
<div class="identity"><h2 id="name"></h2><p id="stage" class="micro"></p></div>
<div class="progress"><div class="progress-heading"><span id="progress-label" data-i18n="webviews:sidebarClient.nextCheck">${escapeHtml(IntlModule.translate("sidebarClient.nextCheck"))}</span><span id="percent"></span></div>
<div id="meter" role="progressbar" aria-label="${escapeHtml(IntlModule.translate("sidebarDocument.evolutionCheckProgress"))}" data-i18n-aria-label="webviews:sidebarDocument.evolutionCheckProgress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="meter-fill"></span></div><p id="gauge" class="micro"></p></div></div>
<p id="empty" hidden></p>
<footer class="pet-actions"><button type="button" data-panel="dex" data-i18n="webviews:worldRender.dex">${escapeHtml(IntlModule.translate("worldRender.dex"))}</button><button type="button" data-panel="history" data-i18n="webviews:historyRender.history">${escapeHtml(IntlModule.translate("historyRender.history"))}</button></footer>
</${resources?.webShell ? "section" : "main"}>${resources?.webShell ? `<div class="partner-spacer" aria-hidden="true"></div></div><footer class="footer"><span data-i18n="webviews:panelRender.vpetDataArchive">${escapeHtml(IntlModule.translate("panelRender.vpetDataArchive"))}</span><span class="archive-status" data-i18n="webviews:dexClient.localArchive">${escapeHtml(IntlModule.translate("dexClient.localArchive"))}</span><span class="case-dots" aria-hidden="true">▪▪▪</span></footer></main>` : ""}<script${resources?.moduleClient ? ' type="module"' : ""} nonce="${escapeHtml(nonce)}">${intlScript(resources?.webShell === true)}
${SIDEBAR_SCRIPT}</script></body></html>`
