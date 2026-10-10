import en from "../assets/i18n/en.json" with { type: "json" }
import es from "../assets/i18n/es.json" with { type: "json" }
import gl from "../assets/i18n/gl.json" with { type: "json" }
import ko from "../assets/i18n/ko.json" with { type: "json" }
import { getIntlModule } from "./intl.browser.js"

export type { Catalogs, Dictionary, Locale, Parameters } from "./intl.browser.js"
export { createIntlModule, normalizeLocale, resolveLocale, SUPPORTED_LOCALES } from "./intl.browser.js"
export const IntlModule = getIntlModule()
export const LANGUAGE_PREFERENCE_KEY = "digital-pet:language"
export const intlCatalogs = { en, es, gl, ko }
IntlModule.register("intl", intlCatalogs)
