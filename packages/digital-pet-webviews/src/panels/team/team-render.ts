import { IntlModule } from "../../i18n.ts"
import { escapeHtml } from "../../shared/escape-html.ts"
import script from "./team-client.browser.js" with { type: "text" }
import styles from "./team-styles.css" with { type: "text" }

export const TEAM_STYLES = styles
export const TEAM_SCRIPT = script

export const teamManagementMarkup = (): string => {
  const text = (key: string) => escapeHtml(IntlModule.translate(key))
  return `<section id="dex-team-panel" class="team-management" role="tabpanel" aria-labelledby="dex-team-tab" hidden>
    <h2 data-i18n="webviews:team.heading">${text("team.heading")}</h2>
    <div id="team-members"></div>
    <footer class="team-actions">
    <button id="team-switch" class="primary-action" type="button" disabled><svg viewBox="0 0 16 16" aria-hidden="true" class="switch-symbol"><path d="M13 5a5 5 0 0 0-8-2L3 5m0-3v3h3M3 11a5 5 0 0 0 8 2l2-2m0 3v-3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"/></svg><span data-i18n="webviews:team.switch">${text("team.switch")}</span></button>
    <p class="team-caption" data-i18n="webviews:team.rest">${text("team.rest")}</p>
    <p id="team-status" role="status" aria-live="polite"></p>
    </footer>
  </section>
  <dialog id="egg-carousel" class="egg-carousel" aria-labelledby="egg-carousel-title">
    <header><h2 id="egg-carousel-title" data-i18n="webviews:eggs.choose">${text("eggs.choose")}</h2><button id="egg-close" type="button" aria-label="${text("team.close")}">✕</button></header>
    <div class="egg-carousel-stage"><button id="egg-previous" type="button" aria-label="${text("eggs.previous")}">‹</button><div><svg id="egg-preview" viewBox="0 0 16 16" aria-hidden="true"><path></path></svg><h3 id="egg-name"></h3><p id="egg-unlock"></p></div><button id="egg-next" type="button" aria-label="${text("eggs.next")}">›</button></div>
    <label class="team-caption" for="egg-slot" data-i18n="webviews:eggs.slot">${text("eggs.slot")}</label><select id="egg-slot"><option value="principal" data-i18n="webviews:team.principal">${text("team.principal")}</option><option value="reserve" data-i18n="webviews:team.reserve">${text("team.reserve")}</option></select>
    <p id="egg-replacement"></p><button id="egg-create" class="primary-action" type="button"></button>
    <p id="egg-status" role="status" aria-live="polite"></p>
  </dialog>`
}
