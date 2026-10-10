import { IntlModule } from "../../i18n.ts"
import { escapeHtml } from "../../shared/escape-html.ts"
import { buildPanelWebviewHtml } from "../../shared/panel-render.ts"
import type { PanelWebviewResources } from "../../shared/webview-resources.ts"
import type { DexPanelModel } from "./dex-model.ts"
import { DEX_SCRIPT } from "./dex-script.ts"
import { DEX_STYLES } from "./dex-styles.ts"

export const buildDexWebviewHtml = (model: DexPanelModel, resources: PanelWebviewResources): string =>
  buildPanelWebviewHtml(model, resources, {
    titleKey: "dexRender.digitalPetDigidex",
    headingKey: "dexRender.digidex",
    viewClass: "dex",
    dataId: "dex-data",
    styles: DEX_STYLES,
    script: DEX_SCRIPT,
    layout: {
      listLabelKey: "dexRender.digimonCatalog",
      listHeadingKey: "dexRender.catalogIndex",
      itemsLabelKey: "dexRender.selectADigimonRecord",
      detailLabelKey: "dexRender.selectedDigimonRecord",
      keyboardHintKey: "dexRender.arrowKeysBrowseEnterSelect",
      emptyHtmlKey: "dexRender.noMatchingRecordsBrTryAnotherNameId",
      summaryHtml: `<section class="completion" aria-label="${escapeHtml(IntlModule.translate("dexRender.collectionProgress"))}" data-i18n-aria-label="webviews:dexRender.collectionProgress">
      <div><p class="micro" data-i18n="webviews:dexRender.registeredDigimon">${escapeHtml(IntlModule.translate("dexRender.registeredDigimon"))}</p><strong id="discovered-count">000</strong><span class="micro"> / <span id="total-count">0</span></span></div>
      <div class="meter" id="meter" role="progressbar" aria-label="${escapeHtml(IntlModule.translate("dexRender.dexCompletion"))}" data-i18n-aria-label="webviews:dexRender.dexCompletion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="meter-fill" id="meter-fill"></div></div>
      <span id="percent">0%</span>
    </section>`,
      toolbarHtml: `<label class="field search-field"><span class="micro" data-i18n="webviews:dexRender.searchRecords">${escapeHtml(IntlModule.translate("dexRender.searchRecords"))}</span><input id="search" type="search" aria-label="${escapeHtml(IntlModule.translate("dexRender.searchDigimonRecords"))}" data-i18n-aria-label="webviews:dexRender.searchDigimonRecords" placeholder="${escapeHtml(IntlModule.translate("dexRender.nameOrCatalogId"))}" data-i18n-placeholder="webviews:dexRender.nameOrCatalogId" autocomplete="off" spellcheck="false"></label>
      <label class="field"><span class="micro" data-i18n="webviews:dexClient.stage">${escapeHtml(IntlModule.translate("dexClient.stage"))}</span><select id="stage"><option value="all" data-i18n="webviews:dexRender.allStages">${escapeHtml(IntlModule.translate("dexRender.allStages"))}</option>${model.stages.map((stage) => `<option value="${stage.value}"${stage.translationKey ? ` data-i18n="core:${stage.translationKey}"` : ""}>${escapeHtml(stage.label)}</option>`).join("")}</select></label>
      <label class="field"><span class="micro" data-i18n="webviews:dexRender.discovery">${escapeHtml(IntlModule.translate("dexRender.discovery"))}</span><select id="discovery"><option value="all" data-i18n="webviews:dexRender.allRecords">${escapeHtml(IntlModule.translate("dexRender.allRecords"))}</option><option value="registered" data-i18n="webviews:dexRender.registered">${escapeHtml(IntlModule.translate("dexRender.registered"))}</option><option value="unknown" data-i18n="webviews:dexRender.undiscovered">${escapeHtml(IntlModule.translate("dexRender.undiscovered"))}</option></select></label>
      <div class="switch" role="group" aria-label="${escapeHtml(IntlModule.translate("dexRender.catalogLayout"))}" data-i18n-aria-label="webviews:dexRender.catalogLayout"><button id="grid-mode" type="button" aria-pressed="true" data-i18n="webviews:dexRender.grid">${escapeHtml(IntlModule.translate("dexRender.grid"))}</button><button id="list-mode" type="button" aria-pressed="false" data-i18n="webviews:dexRender.list">${escapeHtml(IntlModule.translate("dexRender.list"))}</button></div>
      <button id="refresh" class="utility" type="button" aria-label="${escapeHtml(IntlModule.translate("dexRender.refreshDiscoveryArchive"))}" data-i18n-aria-label="webviews:dexRender.refreshDiscoveryArchive" data-i18n="webviews:dexRender.refresh">${escapeHtml(IntlModule.translate("dexRender.refresh"))}</button>`,
    },
  })
