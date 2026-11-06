import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import { ACTION_ICON_PATHS, type ActionIcon } from "../../shared/action-icons.ts"
import { IntlModule } from "../../shared/i18n.ts"
import { legalAccountNotice, legalLinksMarkup } from "./legal-markup.ts"

export const actionIcon = (name: ActionIcon) =>
  `<svg class="action-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="${ACTION_ICON_PATHS[name]}"/></svg>`
const backupCopy = (key: string) =>
  `<span data-i18n="web:backup.${key}">${escapeHtml(IntlModule.translate(`backup.${key}`))}</span>`
const copy = (key: string) =>
  `<span data-i18n="web:online.${key}">${escapeHtml(IntlModule.translate(`online.${key}`))}</span>`
export const accountLoginMarkup = `<p id="online-login-hint" class="section-description" hidden>${copy("loginHint")}</p><a id="online-login" class="google-action" href="/auth/login" hidden>${copy("google")}</a><div id="online-login-legal" class="account-legal" hidden><p>${legalAccountNotice}</p>${legalLinksMarkup}</div>`
export const accountSettingsMarkup = `<section id="online-account-settings" class="options-section account-settings" hidden aria-labelledby="online-account-title">
  <h3 id="online-account-title">${copy("settingsTitle")}</h3>
  <div class="account-session-row"><p id="online-session-status" class="section-description"></p>
  <button id="online-logout" class="text-action" type="button" hidden>${actionIcon("logout")}${copy("logout")}</button></div>
</section>`
export const accountMarkup = `<div id="online-account" hidden>
  <fieldset id="online-actions"><legend class="sr-only">${copy("account")}</legend>
    <fieldset id="online-copies" disabled hidden><legend>${copy("copies")}</legend>
      <p class="section-description">${copy("copiesHint")}</p>
      <div class="backup-actions backup-button-row">
        <button id="online-save" class="primary-action" type="button">${actionIcon("save")}${copy("save")}</button>
        <button id="online-list" class="wide-action" type="button" aria-expanded="false" aria-controls="online-backups">${actionIcon("list")}${copy("list")}</button>
      </div>
      <div id="online-backups" hidden></div>

    </fieldset>
  </fieldset>
  <p id="online-status" class="connection-status" role="status" aria-live="polite"></p>
</div>`
export const accountDialogMarkup = `<dialog id="online-preview" class="web-dialog flow-dialog" aria-labelledby="online-preview-title">
  <header class="dialog-head"><h2 id="online-preview-title">${backupCopy("recoverTitle")}</h2><form method="dialog"><button id="online-preview-close" class="dialog-close" data-i18n-aria-label="web:backup.dismiss" aria-label="${escapeHtml(IntlModule.translate("backup.dismiss"))}">✕</button></form></header>
  <div class="dialog-body">
    <div class="backup-preview-summary"><strong id="online-preview-pet"></strong><p id="online-preview-text" class="section-description"></p></div>
    <div class="backup-import-warning"><p>${backupCopy("replaceWarning")}</p><p class="section-description">${backupCopy("keepPrevious")}</p></div>
    <div class="dialog-actions"><button id="online-cancel-restore" type="button">${copy("cancel")}</button><button id="online-restore" class="primary-action" type="button">${actionIcon("restore")}${copy("restore")}</button></div>
    <p id="online-preview-status" class="connection-status" role="status"></p>
  </div>
</dialog>
<dialog id="online-migration" class="web-dialog" aria-labelledby="online-migration-title" aria-describedby="online-migration-description">
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
</dialog>
<dialog id="account-switch-dialog" class="web-dialog flow-dialog" aria-labelledby="account-switch-title" aria-describedby="account-switch-description">
  <header class="dialog-head"><h2 id="account-switch-title">${copy("switchTitle")}</h2><form method="dialog"><button id="account-switch-close" class="dialog-close" data-i18n-aria-label="web:backup.dismiss" aria-label="${escapeHtml(IntlModule.translate("backup.dismiss"))}">✕</button></form></header>
  <div class="dialog-body">
    <p id="account-switch-description"></p>
    <p>${copy("keepGame")}</p><p>${copy("contactsStay")}</p>
    <div class="dialog-actions"><button id="account-switch-cancel" type="button">${copy("back")}</button><button id="account-switch-confirm" class="primary-action" type="button">${copy("switch")}</button></div>
    <p id="account-switch-status" class="connection-status" role="status"></p>
  </div>
</dialog>`
