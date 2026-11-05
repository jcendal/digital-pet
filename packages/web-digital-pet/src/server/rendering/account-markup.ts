import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import { IntlModule } from "../../shared/i18n.ts"

const copy = (key: string) =>
  `<span data-i18n="web:online.${key}">${escapeHtml(IntlModule.translate(`online.${key}`))}</span>`
export const accountMarkup = `<section id="online-account" class="options-section" hidden>
  <h3>${copy("account")}</h3><p>${copy("localFirst")}</p>
  <p id="online-status" role="status" aria-live="polite"></p>
  <a id="online-login" class="wide-action" href="/auth/login">${copy("google")}</a>
  <button id="online-adopt" type="button" hidden>${copy("adopt")}</button>
  <p id="online-adopt-hint" hidden>${copy("adoptHint")}</p>
  <button id="online-logout" type="button" hidden>${copy("logout")}</button>
  <fieldset id="online-copies" disabled><legend>${copy("copies")}</legend>
    <button id="online-save" type="button">${copy("save")}</button>
    <button id="online-list" type="button">${copy("list")}</button>
    <div id="online-backups"></div>
    <div id="online-preview" hidden><p id="online-preview-text"></p>
      <button id="online-restore" type="button">${copy("restore")}</button>
      <button id="online-cancel-restore" type="button">${copy("cancel")}</button>
    </div>
  </fieldset>
</section>`
export const accountDialogMarkup = `<dialog id="online-migration" class="web-dialog" aria-labelledby="online-migration-title">
  <div class="dialog-body"><h2 id="online-migration-title">${copy("welcome")}</h2><p>${copy("migration")}</p>
    <a href="/auth/login" class="wide-action">${copy("google")}</a>
    <form method="dialog"><button id="online-later">${copy("later")}</button></form>
  </div>
</dialog>`
