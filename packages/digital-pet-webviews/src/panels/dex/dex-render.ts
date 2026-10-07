import { escapeHtml } from "../../shared/escape-html.ts"
import { buildPanelWebviewHtml } from "../../shared/panel-render.ts"
import type { PanelWebviewResources } from "../../shared/webview-resources.ts"
import type { DexPanelModel } from "./dex-model.ts"
import { DEX_SCRIPT } from "./dex-script.ts"
import { DEX_STYLES } from "./dex-styles.ts"

export const buildDexWebviewHtml = (model: DexPanelModel, resources: PanelWebviewResources): string =>
  buildPanelWebviewHtml(model, resources, {
    title: "Digital Pet Digidex",
    heading: "DIGIDEX",
    viewClass: "dex",
    dataId: "dex-data",
    styles: DEX_STYLES,
    script: DEX_SCRIPT,
    layout: {
      listLabel: "Digimon catalog",
      listHeading: "CATALOG INDEX",
      itemsLabel: "Select a Digimon record",
      detailLabel: "Selected Digimon record",
      keyboardHint: "ARROW KEYS: BROWSE / ENTER: SELECT",
      emptyHtml: "No matching records.<br>Try another name, ID or filter.",
      summaryHtml: `<section class="completion" aria-label="Collection progress">
      <div><p class="micro">REGISTERED DIGIMON</p><strong id="discovered-count">000</strong><span class="micro"> / <span id="total-count">0</span></span></div>
      <div class="meter" id="meter" role="progressbar" aria-label="Dex completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="meter-fill" id="meter-fill"></div></div>
      <span id="percent">0%</span>
    </section>`,
      toolbarHtml: `<label class="field search-field"><span class="micro">SEARCH RECORDS</span><input id="search" type="search" aria-label="Search Digimon records" placeholder="Name or catalog ID..." autocomplete="off" spellcheck="false"></label>
      <label class="field"><span class="micro">STAGE</span><select id="stage"><option value="all">All stages</option>${model.stages.map((stage) => `<option value="${stage.value}">${escapeHtml(stage.label)}</option>`).join("")}</select></label>
      <label class="field"><span class="micro">DISCOVERY</span><select id="discovery"><option value="all">All records</option><option value="registered">Registered</option><option value="unknown">Undiscovered</option></select></label>
      <div class="switch" role="group" aria-label="Catalog layout"><button id="grid-mode" type="button" aria-pressed="true">GRID</button><button id="list-mode" type="button" aria-pressed="false">LIST</button></div>
      <button id="refresh" class="utility" type="button" aria-label="Refresh discovery archive">REFRESH</button>`,
    },
  })
