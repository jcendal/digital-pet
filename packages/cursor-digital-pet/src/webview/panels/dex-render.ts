import { escapeHtml } from "../../shared/escape-html.ts"
import type { DexPanelModel } from "./dex-model.ts"
import { DEX_SCRIPT } from "./dex-script.ts"
import { DEX_STYLES } from "./dex-styles.ts"

export type DexWebviewResources = {
  readonly nonce: string
  readonly fontUri: string
  readonly cspSource: string
}

export const buildDexWebviewHtml = (model: DexPanelModel, resources: DexWebviewResources): string => {
  const { nonce, fontUri, cspSource } = resources
  const data = JSON.stringify(model).replaceAll("<", "\\u003c").replaceAll("&", "\\u0026")
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${escapeHtml(cspSource)}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Digital Pet Digidex</title>
  <style>@font-face { font-family: 'Dex Pixel'; src: url('${escapeHtml(fontUri)}') format('truetype'); font-display: swap; }${DEX_STYLES}</style>
</head>
<body>
  <main class="device">
    <header class="masthead">
      <p class="brand">DIGITAL MONSTER</p><h1>DIGIDEX</h1>
    </header>
    <div class="screen">
    <section class="completion" aria-label="Collection progress">
      <div><p class="micro">REGISTERED DIGIMON</p><strong id="discovered-count">000</strong><span class="micro"> / <span id="total-count">0</span></span></div>
      <div class="meter" id="meter" role="progressbar" aria-label="Dex completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="meter-fill" id="meter-fill"></div></div>
      <span id="percent">0%</span>
    </section>
    <p id="notice" class="notice" role="status" hidden></p>
    <div class="toolbar">
      <label class="field search-field"><span class="micro">SEARCH RECORDS</span><input id="search" type="search" aria-label="Search Digimon records" placeholder="Name or catalog ID..." autocomplete="off" spellcheck="false"></label>
      <label class="field"><span class="micro">STAGE</span><select id="stage"><option value="all">All stages</option>${model.stages.map((stage) => `<option value="${stage.value}">${escapeHtml(stage.label)}</option>`).join("")}</select></label>
      <label class="field"><span class="micro">DISCOVERY</span><select id="discovery"><option value="all">All records</option><option value="registered">Registered</option><option value="unknown">Undiscovered</option></select></label>
      <div class="switch" role="group" aria-label="Catalog layout"><button id="grid-mode" type="button" aria-pressed="true">GRID</button><button id="list-mode" type="button" aria-pressed="false">LIST</button></div>
      <button id="refresh" class="utility" type="button" aria-label="Refresh discovery archive">REFRESH</button>
    </div>
    <div class="workspace">
      <section class="catalog" aria-label="Digimon catalog">
        <div class="catalog-header"><h3>CATALOG INDEX</h3><span id="result-count" class="micro" role="status" aria-live="polite"></span></div>
        <div id="entries" class="entries" role="group" aria-label="Select a Digimon record"></div>
        <p id="no-results" class="no-results" hidden>No matching records.<br>Try another name, ID or filter.</p>
      </section>
      <section id="detail" class="detail" aria-label="Selected Digimon record"></section>
    </div>
    <p class="keyboard-hint">ARROW KEYS: BROWSE / ENTER: SELECT</p>
    </div>
    <footer class="footer"><span>VPET · DATA ARCHIVE</span><span id="archive-status" class="archive-status">LOCAL ARCHIVE</span><span aria-hidden="true" class="case-dots">▪▪▪</span></footer>
  </main>
  <script id="dex-data" type="application/json" nonce="${nonce}">${data}</script>
  <script nonce="${nonce}">${DEX_SCRIPT}</script>
</body>
</html>`
}
