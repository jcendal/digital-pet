import { catalogs as animation } from "@jcendal/digital-pet-animation/i18n"
import { catalogs as core } from "@jcendal/digital-pet-core/i18n"
import { catalogs as fields } from "@jcendal/digital-pet-fields/i18n"
import { buildIntlBrowserScript } from "@jcendal/digital-pet-intl/browser-script.ts"
import { catalogs as webviews } from "../i18n.ts"

export const intlScript = (browser: boolean): string =>
  `${buildIntlBrowserScript({ animation, core, fields, webviews }, browser)}\nconst IntlModule = getIntlModule().scope("webviews");`
