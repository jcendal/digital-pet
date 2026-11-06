import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import { IntlModule } from "../../shared/i18n.ts"

const copy = (key: string) => `<span data-i18n="web:${key}">${escapeHtml(IntlModule.translate(key))}</span>`

export const battleMarkup = /* html */ `
<details id="social-code-battle">
  <summary data-i18n="web:social.codeBattle">${escapeHtml(IntlModule.translate("social.codeBattle"))}</summary>
  <div id="battle-code-controls" class="battle-details-body" hidden>
    <div class="battle-code-option">
      <label for="battle-own-code">${copy("battleUi.share")}</label>
      <div class="battle-code-control"><output id="battle-own-code" aria-live="polite"></output><button id="battle-copy" type="button" disabled>${copy("battleMarkup.copy")}</button></div>
    </div>
    <div class="battle-code-option">
      <label for="battle-target">${copy("battleUi.join")}</label>
      <div class="battle-code-control"><input id="battle-target" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="000000"><button id="battle-request" class="primary-action" type="button" disabled>${copy("battleMarkup.challenge")}</button></div>
    </div>
    <p id="battle-status" class="connection-status" role="status" aria-live="polite"></p>
  </div>
  <div id="battle-code-login" class="battle-code-login" hidden>
    <p><span id="battle-login-message" data-i18n="web:battleUi.signIn">${escapeHtml(IntlModule.translate("battleUi.signIn"))}</span></p>
    <button id="battle-login" type="button"><span id="battle-login-label" data-i18n="web:battleUi.connect">${escapeHtml(IntlModule.translate("battleUi.connect"))}</span></button>
  </div>
</details>
<details id="social-battle-rules">
  <summary data-i18n="web:social.battleRules">${escapeHtml(IntlModule.translate("social.battleRules"))}</summary>
  <div class="battle-details-body battle-rules">
    <section><h3>${copy("battleUi.requirements")}</h3><ul><li>${copy("battleUi.keepOpen")}</li><li>${copy("battleUi.hatched")}</li></ul></section>
    <section><h3>${copy("battleUi.victory")}</h3><dl class="battle-rewards">
      <div><dt>${copy("battleUi.sameStage")}</dt><dd>20 %</dd></div>
      <div><dt>${copy("battleUi.lowerStage")}</dt><dd>${copy("battleUi.half")}</dd></div>
      <div><dt>${copy("battleUi.higherStage")}</dt><dd>${copy("battleUi.double")}</dd></div>
    </dl></section>
    <ul class="battle-rule-notes"><li>${copy("battleUi.draw")}</li><li>${copy("battleUi.finalStage")}</li></ul>
  </div>
</details>
<dialog id="battle-dialog" class="web-dialog" aria-labelledby="battle-title"><header class="dialog-head"><h2 id="battle-title" data-i18n="web:battleMarkup.battleRequest">${escapeHtml(IntlModule.translate("battleMarkup.battleRequest"))}</h2><form method="dialog"><button class="dialog-close" aria-label="${escapeHtml(IntlModule.translate("battleMarkup.closeBattle"))}">✕</button></form></header><div class="dialog-body"><section id="battle-incoming" hidden><p id="battle-incoming-text"></p><div class="dialog-actions"><button id="battle-accept" class="primary-action" type="button" data-i18n="web:battleMarkup.acceptBattle">${escapeHtml(IntlModule.translate("battleMarkup.acceptBattle"))}</button><button id="battle-decline" type="button" data-i18n="web:battleMarkup.decline">${escapeHtml(IntlModule.translate("battleMarkup.decline"))}</button></div></section></div></dialog>`
