import { escapeHtml } from "../shared/escape-html.ts"
import { PANEL_STYLES } from "../shared/panel-styles.ts"
import { PANEL_THEME } from "../shared/theme.ts"
import { SIDEBAR_SCRIPT } from "./sidebar-script.ts"
import { SIDEBAR_STYLES } from "./sidebar-styles.ts"

export const buildSidebarWebviewHtml = (
  nonce: string,
  resources?: { readonly fontUri: string; readonly cspSource: string; readonly webShell?: boolean },
): string => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Digital Pet Partner</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; font-src ${escapeHtml(resources?.cspSource ?? "'none'")}; img-src ${escapeHtml(resources?.cspSource ?? "'none'")}; style-src 'unsafe-inline'; script-src 'nonce-${escapeHtml(nonce)}';">
<style>${resources ? `@font-face { font-family: 'Digital Pet Pixel'; src: url('${escapeHtml(resources.fontUri)}') format('truetype'); font-display: swap; }` : ""}${PANEL_THEME}${resources?.webShell ? PANEL_STYLES : ""}${SIDEBAR_STYLES}</style></head>
<body>${resources?.webShell ? '<main class="device partner-device"><header class="masthead"><p class="brand">DIGITAL MONSTER</p><h1>PARTNER</h1></header><div class="screen">' : ""}<${resources?.webShell ? "section" : "main"} class="pet-module" aria-label="Digital Pet">
<header class="pet-header"><span id="phase" role="status" aria-live="polite">LOADING</span><span class="micro">VPET</span></header>
<div id="content"><div class="arena" role="img" aria-label="Partner animation"><div id="battle-scores" hidden><span id="player-score"></span><span id="opponent-score"></span></div><svg id="artwork" aria-hidden="true"></svg><span id="battle-caption" aria-live="polite" hidden></span></div>
<div class="identity"><h2 id="name"></h2><p id="stage" class="micro"></p></div>
<div class="progress"><div class="progress-heading"><span id="progress-label">NEXT CHECK</span><span id="percent"></span></div>
<div id="meter" role="progressbar" aria-label="Evolution check progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="meter-fill"></span></div><p id="gauge" class="micro"></p></div></div>
<p id="empty" hidden></p>
<footer class="pet-actions"><button type="button" data-panel="dex">DEX</button><button type="button" data-panel="history">HISTORY</button></footer>
</${resources?.webShell ? "section" : "main"}>${resources?.webShell ? '<div class="partner-spacer" aria-hidden="true"></div></div><footer class="footer"><span>VPET · DATA ARCHIVE</span><span class="archive-status">LOCAL ARCHIVE</span><span class="case-dots" aria-hidden="true">▪▪▪</span></footer></main>' : ""}<script nonce="${escapeHtml(nonce)}">${SIDEBAR_SCRIPT}</script></body></html>`
