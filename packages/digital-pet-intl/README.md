# Digital Pet Intl

Shared, host-independent translation runtime for English (`en`), Korean (`ko`), Spanish (`es`) and Galician (`gl`). Each workspace owns its copy in `assets/i18n/<locale>.json` and registers it under a package namespace through its `i18n.ts` entry point.

```typescript
import { IntlModule } from "./i18n.ts"

IntlModule.translate("battleStats.evasion")
IntlModule.translate("world.openInDex", { name: "Agumon" })
```

Keys can be dotted JSON properties or paths through nested objects. `{name}` placeholders accept strings and numbers. Missing translations fall back to English and then the key. Catalogs contain plain text; renderers must escape HTML and browser clients must use `textContent`.

`IntlModule` from this package manages the shared locale and namespace registry. `register(namespace, catalogs)` returns a translator scoped to that package. `createIntlModule()` creates an isolated runtime for tests or independent consumers. `resolveLocale(preferred, languages)` prioritizes a valid saved choice, then the first supported browser language, then English; regional variants such as `es-MX` resolve to `es`.

The web document adapter reads `digital-pet:language` from local storage. Automatic browser detection does not save a preference. The Options selector saves an explicit choice and reloads the shell and its panels together. Catalogs are bundled locally and cached with the PWA, so translation and language changes work offline. Language preferences belong to the device and are independent of pet saves and device transfers.

Cursor initializes the locale from the editor language. OpenCode initializes it from `DIGITAL_PET_LANGUAGE`, or the first available `LC_ALL`, `LC_MESSAGES` and `LANG` environment setting. The existing `jp`/`en` Digimon naming setting remains independent of the interface language; custom stage labels are preserved.

`intl.browser.js` is the same translation engine used by modules and embedded webviews. `browser-script.ts` embeds its source and the document adapter with serialized catalogs; executable logic stays in browser source files. A realm-wide registry lets inline webview scripts and host modules share one locale without external libraries or translation requests.

Add copy to all four catalogs in its owning package. Catalog tests check matching keys, placeholders and plain text. Add a new locale to the runtime type, supported locale list, selector and all package catalogs together.
