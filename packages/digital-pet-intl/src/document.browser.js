/** @param {{catalogs: Record<string, import('./intl.browser.js').Catalogs>, locale: string, browser: boolean}} configuration */
function initializeIntlDocument(configuration) {
  const module = getIntlModule()
  for (const [namespace, catalogs] of Object.entries(configuration.catalogs)) module.register(namespace, catalogs)
  let preferred = configuration.locale || ""
  if (configuration.browser) {
    try {
      preferred = localStorage.getItem("digital-pet:language") ?? ""
    } catch {}
  }
  module.setLocale(resolveLocale(preferred, navigator.languages))
  document.documentElement.lang = module.locale
  const apply = () => {
    document.documentElement.lang = module.locale
    for (const node of Array.from(document.querySelectorAll("[data-i18n]"))) {
      const [namespace, key] = (node.getAttribute("data-i18n") ?? "").split(":")
      if (namespace && key) node.textContent = module.translate(key, {}, namespace)
    }
    for (const attribute of ["aria-label", "aria-valuetext", "title", "placeholder"]) {
      for (const node of Array.from(document.querySelectorAll(`[data-i18n-${attribute}]`))) {
        const [namespace, key] = (node.getAttribute(`data-i18n-${attribute}`) ?? "").split(":")
        if (namespace && key) node.setAttribute(attribute, module.translate(key, {}, namespace))
      }
    }
    const selector = document.querySelector("#language-select")
    if (selector instanceof HTMLSelectElement) selector.value = module.locale
  }
  apply()
  module.subscribe(apply)
  return module
}

export { initializeIntlDocument }
