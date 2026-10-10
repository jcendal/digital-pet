import { IntlModule, resolveLocale } from "@jcendal/digital-pet-intl"
export const initializeUiLanguage = (): void => {
  IntlModule.setLocale(
    resolveLocale(process.env["DIGITAL_PET_LANGUAGE"], [
      process.env["LC_ALL"] ?? process.env["LC_MESSAGES"] ?? process.env["LANG"] ?? "en",
    ]),
  )
}
