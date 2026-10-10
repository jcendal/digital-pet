import documentAsset from "./document.browser.js?raw" with { type: "text" }
import { type Catalogs, IntlModule, intlCatalogs } from "./index.ts"
import engineSource from "./intl.browser.js?raw" with { type: "text" }

// The engine is an import-free module; only its final export is omitted in classic webviews.
// A distinct raw URL keeps Bun's executable module cache separate from the text asset.
const documentSource = documentAsset.replace(/\nexport \{[^\n]+\}\s*$/, "")
const classicEngine = engineSource.replace(/\nexport \{[^\n]+\}\s*$/, "")
export const buildIntlBrowserScript = (catalogs: Readonly<Record<string, Catalogs>>, browser: boolean): string => {
  const data = JSON.stringify({ catalogs: { intl: intlCatalogs, ...catalogs }, locale: IntlModule.locale, browser })
    .replaceAll("<", "\\u003c")
    .replaceAll("&", "\\u0026")
  return `${classicEngine}\n${documentSource}\ninitializeIntlDocument(${data});`
}
