import { escapeHtml } from "../../shared/escape-html.ts"
import { PANEL_STYLES } from "./panel-styles.ts"
import { PANEL_THEME } from "./theme.ts"
import type { PanelWebviewResources } from "./webview-resources.ts"

type PanelLayout = {
  readonly summaryHtml: string
  readonly toolbarHtml: string
  readonly listLabel: string
  readonly listHeading: string
  readonly itemsLabel: string
  readonly detailLabel: string
  readonly keyboardHint: string
  readonly emptyHtml?: string
}

type PanelDocument = {
  readonly title: string
  readonly heading: string
  readonly viewClass: string
  readonly dataId: string
  readonly styles: string
  readonly script: string
  readonly layout: PanelLayout
}

/** HTML slots and scripts are authored by renderers; archive strings must be escaped before entering an HTML slot. */
export const buildPanelWebviewHtml = <T>(
  model: T,
  resources: PanelWebviewResources,
  document: PanelDocument,
): string => {
  const { nonce, fontUri, cspSource } = resources
  const { layout } = document
  const data = JSON.stringify(model).replaceAll("<", "\\u003c").replaceAll("&", "\\u0026")
  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${escapeHtml(cspSource)}; style-src 'unsafe-inline'; script-src 'nonce-${escapeHtml(nonce)}';">
  <title>${escapeHtml(document.title)}</title>
  <style>@font-face { font-family: 'Digital Pet Pixel'; src: url('${escapeHtml(fontUri)}') format('truetype'); font-display: swap; }${PANEL_THEME}${PANEL_STYLES}${document.styles}</style>
</head><body>
  <main class="device ${escapeHtml(document.viewClass)}">
    <header class="masthead"><p class="brand">DIGITAL MONSTER</p><h1>${escapeHtml(document.heading)}</h1></header>
    <div class="screen">
      ${layout.summaryHtml}
      <p id="notice" class="notice" role="status" hidden></p>
      <div class="toolbar">${layout.toolbarHtml}</div>
      <div class="workspace">
        <section class="catalog" aria-label="${escapeHtml(layout.listLabel)}">
          <div class="catalog-header"><h3>${escapeHtml(layout.listHeading)}</h3><span id="result-count" class="micro" role="status" aria-live="polite"></span></div>
          <div id="entries" class="entries" role="group" aria-label="${escapeHtml(layout.itemsLabel)}"></div>
          <p id="no-results" class="no-results" hidden>${layout.emptyHtml ?? ""}</p>
        </section>
        <section id="detail" class="detail" aria-label="${escapeHtml(layout.detailLabel)}"></section>
      </div>
      <p class="keyboard-hint">${escapeHtml(layout.keyboardHint)}</p>
    </div>
    <footer class="footer"><span>VPET · DATA ARCHIVE</span><span id="archive-status" class="archive-status">LOCAL ARCHIVE</span><span class="case-dots" aria-hidden="true">▪▪▪</span></footer>
  </main>
  <script id="${escapeHtml(document.dataId)}" type="application/json" nonce="${escapeHtml(nonce)}">${data}</script>
  <script nonce="${escapeHtml(nonce)}">${document.script}</script>
</body></html>`
}
