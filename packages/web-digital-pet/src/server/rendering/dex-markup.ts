import { IntlModule as webviewsIntl } from "@jcendal/digital-pet-webviews/i18n"
import { teamManagementMarkup } from "@jcendal/digital-pet-webviews/panels/team/team-render.ts"
import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import { IntlModule } from "../../shared/i18n.ts"

export const dexMarkup = (panels: string, selected: "dex" | "history"): string => {
  const copy = (key: string) => escapeHtml(IntlModule.translate(key))
  return `<main id="dex-view" class="device dex-device" hidden>
    <header class="masthead"><p class="brand" data-i18n="webviews:panelRender.digitalMonster">${escapeHtml(webviewsIntl.translate("panelRender.digitalMonster"))}</p><h1 data-i18n="web:pages.digidex">${copy("pages.digidex")}</h1></header>
    <section class="screen dex-screen">
      <div class="dex-tabs" role="tablist" aria-label="${copy("pages.digidex")}" data-i18n-aria-label="web:pages.digidex">
        ${(["dex", "team", "history"] as const).map((page) => `<button id="dex-${page}-tab" type="button" role="tab" data-dex-page="${page}" aria-selected="${page === selected}" aria-controls="dex-${page}-panel" tabindex="${page === selected ? "0" : "-1"}" data-i18n="web:navigation.${page}">${copy(`navigation.${page}`)}</button>`).join("")}
      </div>
      <div class="dex-panels">${panels}${teamManagementMarkup()}</div>
    </section>
    <footer class="footer"><span data-i18n="webviews:panelRender.vpetDataArchive">${escapeHtml(webviewsIntl.translate("panelRender.vpetDataArchive"))}</span><span class="case-dots" aria-hidden="true">▪▪▪</span></footer>
  </main>`
}
