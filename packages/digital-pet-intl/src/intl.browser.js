/** @typedef {"en" | "ko" | "es" | "gl"} Locale */
/** @typedef {{ [key: string]: string | Dictionary }} Dictionary */
/** @typedef {Record<Locale, Dictionary>} Catalogs */
/** @typedef {Readonly<Record<string, string | number>>} Parameters */

const SUPPORTED_LOCALES = Object.freeze(["en", "ko", "es", "gl"])

/** @param {unknown} value @returns {Locale | undefined} */
function normalizeLocale(value) {
  if (typeof value !== "string") return undefined
  const language = value
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .split(/[.\-@]/)[0]
  return language === "en" || language === "ko" || language === "es" || language === "gl" ? language : undefined
}

/** @param {unknown} preferred @param {readonly string[]} languages @returns {Locale} */
function resolveLocale(preferred, languages = []) {
  const chosen = normalizeLocale(preferred)
  if (chosen) return chosen
  for (const language of languages) {
    const supported = normalizeLocale(language)
    if (supported) return supported
  }
  return "en"
}

/** @param {Dictionary | undefined} dictionary @param {string} key @returns {string | undefined} */
function lookup(dictionary, key) {
  if (!dictionary) return undefined
  if (Object.hasOwn(dictionary, key) && typeof dictionary[key] === "string") return dictionary[key]
  /** @type {string | Dictionary | undefined} */
  let value = dictionary
  for (const part of key.split(".")) {
    if (!value || typeof value === "string" || !Object.hasOwn(value, part)) return undefined
    value = value[part]
  }
  return typeof value === "string" ? value : undefined
}

/** A host-independent translator. Catalog ownership stays with its package. @param {Locale} initialLocale */
function createIntlModule(initialLocale = "en") {
  let locale = initialLocale
  /** @type {Map<string, Catalogs>} */
  const catalogs = new Map()
  /** @type {Set<(locale: Locale) => void>} */
  const listeners = new Set()
  const module = {
    get locale() {
      return locale
    },
    /** @param {unknown} value */
    setLocale(value) {
      const next = resolveLocale(value)
      if (next === locale) return
      locale = next
      for (const listener of listeners) listener(locale)
    },
    /** @param {string} namespace @param {Catalogs} translations */
    register(namespace, translations) {
      catalogs.set(namespace, translations)
      return module.scope(namespace)
    },
    /** @param {(locale: Locale) => void} listener */
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** @param {string} key @param {Parameters} parameters @param {string} namespace */
    translate(key, parameters = {}, namespace = "intl") {
      const translations = catalogs.get(namespace)
      const text = lookup(translations?.[locale], key) ?? lookup(translations?.en, key) ?? key
      return text.replace(/\{([\w]+)\}/g, (placeholder, name) =>
        Object.hasOwn(parameters, name) ? String(parameters[name]) : placeholder,
      )
    },
    /** @param {string} namespace */
    scope(namespace) {
      return {
        get locale() {
          return locale
        },
        setLocale: module.setLocale,
        subscribe: module.subscribe,
        /** @param {string} key @param {Parameters} parameters */
        translate: (key, parameters = {}) => module.translate(key, parameters, namespace),
      }
    },
  }
  return module
}

// The inline webview and a host's ES modules must share the same instance in one realm.
/** @returns {ReturnType<typeof createIntlModule>} */
function getIntlModule() {
  const key = Symbol.for("digital-pet.intl")
  const registry = /** @type {Record<symbol, ReturnType<typeof createIntlModule>>} */ (
    /** @type {unknown} */ (globalThis)
  )
  const existing = registry[key]
  if (existing) return existing
  const module = createIntlModule()
  registry[key] = module
  return module
}

export { createIntlModule, getIntlModule, normalizeLocale, resolveLocale, SUPPORTED_LOCALES }
