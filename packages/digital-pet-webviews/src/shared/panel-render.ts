import { IntlModule } from "../i18n.ts"
import { escapeHtml } from "./escape-html.ts"
import { intlScript } from "./intl-script.ts"
import { PANEL_STYLES } from "./panel-styles.ts"
import { PANEL_THEME } from "./theme.ts"
import type { PanelWebviewResources } from "./webview-resources.ts"

type PanelLayout = {
  readonly summaryHtml: string
  readonly toolbarHtml: string
  readonly listLabelKey: string
  readonly listHeadingKey: string
  readonly itemsLabelKey: string
  readonly detailLabelKey: string
  readonly keyboardHintKey: string
  readonly emptyHtmlKey?: string
}

type PanelDocument = {
  readonly titleKey: string
  readonly headingKey: string
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; font-src ${escapeHtml(cspSource)}; img-src ${escapeHtml(cspSource)}; style-src 'unsafe-inline'; script-src 'nonce-${escapeHtml(nonce)}';">
  <title data-i18n="webviews:${escapeHtml(document.titleKey)}">${escapeHtml(IntlModule.translate(document.titleKey))}</title>
  <style>@font-face { font-family: 'Digital Pet Pixel'; src: url('${escapeHtml(fontUri)}') format('truetype'); font-display: swap; }${PANEL_THEME}${PANEL_STYLES}${document.styles}</style>
</head><body>
  <main class="device ${escapeHtml(document.viewClass)}">
    <header class="masthead"><p class="brand" data-i18n="webviews:panelRender.digitalMonster">${escapeHtml(IntlModule.translate("panelRender.digitalMonster"))}</p><h1 data-i18n="webviews:${escapeHtml(document.headingKey)}">${escapeHtml(IntlModule.translate(document.headingKey))}</h1></header>
    <div class="screen">
      ${layout.summaryHtml}
      <p id="notice" class="notice" role="status" hidden></p>
      <details id="filters" class="panel-filters"><summary data-i18n="webviews:panelRender.filters">${escapeHtml(IntlModule.translate("panelRender.filters"))}</summary><div class="toolbar">${layout.toolbarHtml}</div></details>
      <div class="workspace">
        <section class="catalog" data-i18n-aria-label="webviews:${escapeHtml(layout.listLabelKey)}" aria-label="${escapeHtml(IntlModule.translate(layout.listLabelKey))}">
          <div class="catalog-header"><h3 data-i18n="webviews:${escapeHtml(layout.listHeadingKey)}">${escapeHtml(IntlModule.translate(layout.listHeadingKey))}</h3><span id="result-count" class="micro" role="status" aria-live="polite"></span></div>
          <div id="entries" class="entries" role="group" data-i18n-aria-label="webviews:${escapeHtml(layout.itemsLabelKey)}" aria-label="${escapeHtml(IntlModule.translate(layout.itemsLabelKey))}"></div>
          <p id="no-results" class="no-results" data-i18n="webviews:${escapeHtml(layout.emptyHtmlKey ?? "")}" hidden>${layout.emptyHtmlKey ? escapeHtml(IntlModule.translate(layout.emptyHtmlKey)) : ""}</p>
        </section>
        <section id="detail" class="detail" data-i18n-aria-label="webviews:${escapeHtml(layout.detailLabelKey)}" aria-label="${escapeHtml(IntlModule.translate(layout.detailLabelKey))}"></section>
      </div>
      <p class="keyboard-hint" data-i18n="webviews:${escapeHtml(layout.keyboardHintKey)}">${escapeHtml(IntlModule.translate(layout.keyboardHintKey))}</p>
    </div>
    <footer class="footer"><span data-i18n="webviews:panelRender.vpetDataArchive">${escapeHtml(IntlModule.translate("panelRender.vpetDataArchive"))}</span><span id="archive-status" class="archive-status" data-i18n="webviews:dexClient.localArchive">${escapeHtml(IntlModule.translate("dexClient.localArchive"))}</span><span class="case-dots" aria-hidden="true">▪▪▪</span></footer>
  </main>
  <script id="${escapeHtml(document.dataId)}" type="application/json" nonce="${escapeHtml(nonce)}">${data}</script>
  <script${resources.moduleClient ? ' type="module"' : ""} nonce="${escapeHtml(nonce)}">${intlScript(resources.moduleClient === true)}
${document.script}</script>
</body></html>`
}
