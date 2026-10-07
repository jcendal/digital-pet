import { buildPanelWebviewHtml } from "../../shared/panel-render.ts"
import type { PanelWebviewResources } from "../../shared/webview-resources.ts"
import type { HistoryPanelModel } from "./history-model.ts"
import { HISTORY_SCRIPT } from "./history-script.ts"
import { HISTORY_STYLES } from "./history-styles.ts"

export const buildHistoryWebviewHtml = (model: HistoryPanelModel, resources: PanelWebviewResources): string =>
  buildPanelWebviewHtml(model, resources, {
    title: "Digital Pet History",
    heading: "HISTORY",
    viewClass: "history",
    dataId: "history-data",
    styles: HISTORY_STYLES,
    script: HISTORY_SCRIPT,
    layout: {
      listLabel: "Partner generations",
      listHeading: "GENERATIONS",
      itemsLabel: "Select a generation",
      detailLabel: "Selected generation",
      keyboardHint: "ARROW KEYS: BROWSE GENERATIONS",
      summaryHtml: `<section class="completion" aria-label="Partner history summary"><div><p class="micro">PARTNER HISTORY</p><strong id="generation-count">00</strong><span class="micro">GENERATIONS</span></div></section>`,
      toolbarHtml: `<label class="field search-field"><span class="micro">SEARCH GENERATIONS</span><input id="search" type="search" aria-label="Search generations" placeholder="Generation or Digimon name..." autocomplete="off" spellcheck="false"></label>
        <label class="field"><span class="micro">STATUS</span><select id="status"><option value="all">All generations</option><option value="current">Current</option><option value="retired">Retired</option></select></label>
        <button id="refresh" class="utility" type="button">REFRESH</button>`,
    },
  })
