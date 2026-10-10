export type Locale = "en" | "ko" | "es" | "gl"
export type Dictionary = { readonly [key: string]: string | Dictionary }
export type Catalogs = Readonly<Record<Locale, Dictionary>>
export type Parameters = Readonly<Record<string, string | number>>
export type Translator = {
  readonly locale: Locale
  setLocale(value: unknown): void
  translate(key: string, parameters?: Parameters): string
  subscribe(listener: (locale: Locale) => void): () => void
}
export type IntlRuntime = Omit<Translator, "translate"> & {
  register(namespace: string, translations: Catalogs): Translator
  scope(namespace: string): Translator
  translate(key: string, parameters?: Parameters, namespace?: string): string
}
export const SUPPORTED_LOCALES: readonly Locale[]
export function normalizeLocale(value: unknown): Locale | undefined
export function resolveLocale(preferred: unknown, languages?: readonly string[]): Locale
export function createIntlModule(initialLocale?: Locale): IntlRuntime
export function getIntlModule(): IntlRuntime
