import { IntlModule as sharedIntl } from "@jcendal/digital-pet-intl"
import en from "../assets/i18n/en.json" with { type: "json" }
import es from "../assets/i18n/es.json" with { type: "json" }
import gl from "../assets/i18n/gl.json" with { type: "json" }
import ko from "../assets/i18n/ko.json" with { type: "json" }
export const catalogs = { en, es, gl, ko }
export const IntlModule = sharedIntl.register("animation", catalogs)
