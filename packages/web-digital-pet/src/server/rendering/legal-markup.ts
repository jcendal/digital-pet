import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import { IntlModule } from "../../shared/i18n.ts"

export const legalLinksMarkup = `<p class="legal-links"><a href="/legal/privacy" target="_blank" rel="noopener" hreflang="es" data-i18n="web:legal.privacy">${escapeHtml(IntlModule.translate("legal.privacy"))}</a><a href="/legal/terms" target="_blank" rel="noopener" hreflang="es" data-i18n="web:legal.terms">${escapeHtml(IntlModule.translate("legal.terms"))}</a></p>`
export const legalAccountNotice = `<span data-i18n="web:legal.accountNotice">${escapeHtml(IntlModule.translate("legal.accountNotice"))}</span>`
