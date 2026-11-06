import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import { ACTION_ICON_PATHS, type ActionIcon } from "../../shared/action-icons.ts"
import { IntlModule } from "../../shared/i18n.ts"
import { legalAccountNotice, legalLinksMarkup } from "./legal-markup.ts"

export const actionIcon = (name: ActionIcon) =>
  `<svg class="action-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="${ACTION_ICON_PATHS[name]}"/></svg>`
const copy = (key: string) =>
  `<span data-i18n="web:online.${key}">${escapeHtml(IntlModule.translate(`online.${key}`))}</span>`
export const accountLoginMarkup = `<p id="online-login-hint" class="section-description" hidden>${copy("loginHint")}</p><a id="online-login" class="google-action" href="/auth/login" hidden>${copy("google")}</a><div id="online-login-legal" class="account-legal" hidden><p>${legalAccountNotice}</p>${legalLinksMarkup}</div>`
export const accountMarkup = `<div id="online-account" hidden>
  <fieldset id="online-actions"><legend class="sr-only">${copy("account")}</legend>
    <div id="online-connection" class="account-connection" hidden>
      <p id="online-session-status"></p>
      <p id="online-adopt-hint" class="section-description" hidden>${copy("adoptHint")}</p>
      <button id="online-adopt" class="primary-action" type="button" hidden>${copy("adopt")}${actionIcon("adopt")}</button>
    </div>
    <fieldset id="online-copies" disabled hidden><legend>${copy("copies")}</legend>
      <p class="section-description">${copy("copiesHint")}</p>
      <div class="backup-actions">
        <button id="online-save" class="primary-action" type="button">${copy("save")}${actionIcon("save")}</button>
        <button id="online-list" class="wide-action" type="button">${copy("list")}${actionIcon("list")}</button>
      </div>
      <div id="online-backups"></div>
      <div id="online-preview" class="confirm-box" hidden>
        <strong>${copy("restoreTitle")}</strong><p id="online-preview-text"></p>
        <div class="dialog-actions">
          <button id="online-restore" class="primary-action" type="button">${copy("restore")}${actionIcon("restore")}</button>
          <button id="online-cancel-restore" type="button">${copy("cancel")}${actionIcon("cancel")}</button>
        </div>
      </div>
    </fieldset>
  </fieldset>
  <p id="online-status" class="connection-status" role="status" aria-live="polite"></p>
</div>`
export const accountDialogMarkup = `<dialog id="online-migration" class="web-dialog" aria-labelledby="online-migration-title" aria-describedby="online-migration-description">
  <header class="dialog-head">
    <div><p class="dialog-eyebrow">Digital Pet</p><h2 id="online-migration-title">${copy("welcome")}</h2></div>
    <form method="dialog"><button class="dialog-close" aria-label="${escapeHtml(IntlModule.translate("online.close"))}" data-i18n-aria-label="web:online.close">✕</button></form>
  </header>
  <div class="dialog-body">
    <p id="online-migration-description">${copy("migration")}</p>
    <div class="account-benefits">
      <div><strong>${copy("playTogether")}</strong><p>${copy("playTogetherHint")}</p></div>
    </div>
    <a href="/auth/login" class="google-action">${copy("google")}</a>
    <div class="account-legal"><p>${legalAccountNotice}</p>${legalLinksMarkup}</div>
    <p class="account-reassurance">${copy("identityOnly")}</p>
    <form method="dialog"><button id="online-later" class="text-action">${copy("later")}</button></form>
  </div>
</dialog>`
