import { IntlModule } from "../../i18n.ts"
import { escapeHtml } from "../../shared/escape-html.ts"
import { buildPanelWebviewHtml } from "../../shared/panel-render.ts"
import type { PanelWebviewResources } from "../../shared/webview-resources.ts"
import type { HistoryPanelModel } from "./history-model.ts"
import { HISTORY_SCRIPT } from "./history-script.ts"
import { HISTORY_STYLES } from "./history-styles.ts"

export const buildHistoryWebviewHtml = (model: HistoryPanelModel, resources: PanelWebviewResources): string =>
  buildPanelWebviewHtml(model, resources, {
    titleKey: "historyRender.digitalPetHistory",
    headingKey: "historyRender.history",
    viewClass: "history",
    dataId: "history-data",
    styles: HISTORY_STYLES,
    script: HISTORY_SCRIPT,
    layout: {
      listLabelKey: "historyRender.partnerGenerations",
      listHeadingKey: "dexClient.generations",
      itemsLabelKey: "history.selectGeneration",
      detailLabelKey: "historyRender.selectedGeneration",
      keyboardHintKey: "historyRender.arrowKeysBrowseGenerations",
      summaryHtml: `<section class="completion" aria-label="${escapeHtml(IntlModule.translate("historyRender.partnerHistorySummary"))}" data-i18n-aria-label="webviews:historyRender.partnerHistorySummary"><div><p class="micro" data-i18n="webviews:historyRender.partnerHistory">${escapeHtml(IntlModule.translate("historyRender.partnerHistory"))}</p><strong id="generation-count">00</strong><span class="micro" data-i18n="webviews:dexClient.generations">${escapeHtml(IntlModule.translate("dexClient.generations"))}</span></div></section>`,
      toolbarHtml: `<label class="field search-field"><span class="micro" data-i18n="webviews:historyRender.searchGenerations2">${escapeHtml(IntlModule.translate("historyRender.searchGenerations2"))}</span><input id="search" type="search" aria-label="${escapeHtml(IntlModule.translate("historyRender.searchGenerations"))}" data-i18n-aria-label="webviews:historyRender.searchGenerations" placeholder="${escapeHtml(IntlModule.translate("historyRender.generationOrDigimonName"))}" data-i18n-placeholder="webviews:historyRender.generationOrDigimonName" autocomplete="off" spellcheck="false"></label>
        <label class="field"><span class="micro" data-i18n="webviews:historyRender.status">${escapeHtml(IntlModule.translate("historyRender.status"))}</span><select id="status"><option value="all" data-i18n="webviews:historyRender.allGenerations">${escapeHtml(IntlModule.translate("historyRender.allGenerations"))}</option><option value="current" data-i18n="webviews:historyRender.current">${escapeHtml(IntlModule.translate("historyRender.current"))}</option><option value="retired" data-i18n="webviews:historyRender.retired">${escapeHtml(IntlModule.translate("historyRender.retired"))}</option></select></label>
        <button id="refresh" class="utility" type="button" data-i18n="webviews:dexRender.refresh">${escapeHtml(IntlModule.translate("dexRender.refresh"))}</button>`,
    },
  })
