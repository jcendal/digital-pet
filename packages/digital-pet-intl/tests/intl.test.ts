import { describe, expect, test } from "bun:test"
import { createIntlModule, normalizeLocale, resolveLocale } from "../src/index.ts"

const catalogs = {
  en: { battleStats: { evasion: "Evasion" }, reward: "{name} earned {percent}% experience", onlyEnglish: "Fallback" },
  es: { battleStats: { evasion: "Evasión" }, reward: "{name} ganó {percent}% de experiencia" },
  gl: { battleStats: { evasion: "Evasión" }, reward: "{name} gañou {percent}% de experiencia" },
  ko: { battleStats: { evasion: "회피" }, reward: "{name}: 경험치 {percent}% 획득" },
}

describe("locale selection", () => {
  test("saved choices take precedence over browser languages", () => {
    expect(resolveLocale("gl", ["ko-KR", "es-ES"])).toBe("gl")
    expect(resolveLocale("en", ["es-ES"])).toBe("en")
  })
  test("regional browser locales use the first supported language without persisting a choice", () => {
    expect(resolveLocale(null, ["de-DE", "ko-KR", "es-ES"])).toBe("ko")
    expect(resolveLocale(undefined, ["es-MX"])).toBe("es")
    expect(resolveLocale(undefined, ["gl-ES"])).toBe("gl")
    expect(resolveLocale("invalid", ["fr-FR"])).toBe("en")
    expect(normalizeLocale("KO_kr.UTF-8")).toBe("ko")
    expect(normalizeLocale("es.UTF-8")).toBe("es")
    expect(normalizeLocale("english")).toBeUndefined()
  })
})

describe("translation", () => {
  test("dotted keys and interpolation work in every locale", () => {
    const runtime = createIntlModule()
    const IntlModule = runtime.register("test", catalogs)
    for (const locale of ["en", "es", "gl", "ko"] as const) {
      IntlModule.setLocale(locale)
      expect(IntlModule.translate("battleStats.evasion")).toBe(catalogs[locale].battleStats.evasion)
      expect(IntlModule.translate("reward", { name: "Agumon", percent: 20 })).toBe(
        catalogs[locale].reward.replace("{name}", "Agumon").replace("{percent}", "20"),
      )
    }
  })
  test("missing entries fall back to English, then their key; values are never executed", () => {
    const runtime = createIntlModule("ko")
    const IntlModule = runtime.register("test", catalogs)
    expect(IntlModule.translate("onlyEnglish")).toBe("Fallback")
    expect(IntlModule.translate("absent")).toBe("absent")
    expect(IntlModule.translate("constructor")).toBe("constructor")
    expect(IntlModule.translate("reward", { name: "<img onerror=alert(1)>" })).toContain("<img onerror=alert(1)>")
    expect(IntlModule.translate("reward")).toContain("{name}")
  })
  test("package namespaces and independent runtimes do not overwrite each other's catalogs", () => {
    const first = createIntlModule("es")
    const second = createIntlModule("ko")
    first.register("one", catalogs)
    first.register("two", { en: { reward: "Other copy" }, es: {}, ko: {}, gl: {} })
    second.register("one", catalogs)
    expect(first.scope("two").translate("reward")).toBe("Other copy")
    expect(first.scope("one").translate("battleStats.evasion")).toBe("Evasión")
    expect(second.scope("one").translate("battleStats.evasion")).toBe("회피")
  })
  test("locale subscribers only receive changes and can unsubscribe", () => {
    const runtime = createIntlModule()
    const changes: string[] = []
    const stop = runtime.subscribe((locale) => changes.push(locale))
    runtime.setLocale("es-MX")
    runtime.setLocale("es-ES")
    stop()
    runtime.setLocale("gl")
    expect(changes).toEqual(["es"])
  })
})
