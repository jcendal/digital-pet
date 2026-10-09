# Web builds, resources and caching

See the [package architecture](../packages/web-digital-pet/docs/architecture.md)
for directory ownership and dependency rules.

## Ownership

The web package uses Vite for both browser bundles and the Node server build. It
retains the native Node HTTP server and the read-only SQLite integration.

- `vite.config.ts` configures the two builds and the PWA plugin.
- `tooling/resources.ts` discovers icons, fonts and world scenery once. Its Vite
  plugin supplies browser URLs and `.vite/resources.json`; CSS resolves the same
  inventory through Vite aliases. Resources receive content hashes. Documentation
  screenshots in `assets/screenshots` are excluded; the shared font is resolved
  through the webviews package asset export.
- `src/server/rendering/build-resources.ts` reads Vite's entry manifest, including transitive CSS.
- `src/server/rendering/pages.ts` renders shared views using these URLs and entry tags.
- `src/server/http/app.ts` owns local HTTP/API routes; `src/server/main.ts` starts it explicitly.
- `tooling/render-static.ts` generates browser-only HTML and manifest icons after the client
  build. Each iframe document receives its own content hash. It refuses to run
  with a real host database; the build supplies an isolated missing database path.
- `src/worker/service-worker.ts` uses Workbox. `vite-plugin-pwa` compiles it and injects
  the precache inventory after HTML generation. There is no handwritten file list.

Web shell/bridge scripts are module entries with ordinary imports. Web CSS is
external and processed by Vite. Shared Cursor renderers retain their text imports;
Vite translates those imports to `?raw`. Their optional `moduleClient` flag lets
the web bridge initialize before the shared client executes, while Cursor keeps
its existing classic-script behavior and nonce. World renderers accept a scene
URL resolver so each host can supply its own resource locations.

## Resource policy

| Resource | Static deployment | Local server |
| --- | --- | --- |
| `/assets/` scripts, CSS, fonts, icons, scenery and iframe documents | Per-file hashes; HTTP `max-age=31536000,immutable`; Workbox cache first | Same hashed assets, immutable HTTP caching and ETags |
| Entry HTML | Stable URL, `no-cache`; network first with offline/5xx fallback | Dynamic HTML, `no-store` |
| Manifest and service worker | Stable URLs, `no-cache` | ETags and revalidation |
| `/api/` | Excluded from worker routes | Live read-only SQLite data, `no-store` |

A normal warm reload performs entry/update checks, not asset downloads. Hard
reloads and DevTools' **Disable cache** intentionally behave differently. Verify
actual server requests rather than counting rows in the browser network panel.

All emitted resources are precached, including supplied world photos. The current
per-file precache ceiling is 4 MiB because the pixel catalog and lake image exceed
Workbox's 2 MiB default. The build reports the total precache size and still warns
about large JavaScript chunks; extracting/lazy-loading catalog artwork is a
separate optimization. Adding assets above the ceiling requires an explicit
budget decision, rather than silently losing offline coverage.

## Updates and compatibility

Workbox reuses unchanged precache entries between releases. A waiting worker does
not call `skipWaiting` or reload the page. It activates after controlled tabs close,
then removes obsolete app caches and temporary runtime caches. IndexedDB saves
are independent and never cleared. Failed installation preserves the active worker.

Old workers can fetch new hashed assets while an update waits. The entry document
checks the network, with cached fallback for network errors and 5xx responses;
404s remain visible. Shell selection queries share one offline shell entry. API,
external, explicit `no-store`, and partial/range requests bypass worker caching.

The local SQLite server and Vite development do not install a worker. They retire
legacy app registrations on that origin and clear only their app caches. Use the
static preview to verify the PWA. Development includes Vite's module refresh and
allows its loopback WebSocket in CSP; production does not add those permissions.

The release workflow uploads `/assets/` before entry HTML and the worker. It keeps
older assets and legacy `/revisions/` objects for existing tabs/installed workers.
CloudFront invalidates stable routes, never content-hashed assets. The existing
CloudFront route mappings still apply; S3/CloudFront needs no Node runtime.

## Development and verification

From the repository root:

```sh
npm run dev --workspace @jcendal/web-digital-pet
npm run build:static --workspace @jcendal/web-digital-pet
npm run preview --workspace @jcendal/web-digital-pet
npm run validate
npx playwright install chromium
npm run test:browser --workspace @jcendal/web-digital-pet
```

`dev` uses port 5173 and renders the local API through Vite middleware. `npm run web`
continues to build and run the local production server on port 4173. `build:static`
copies the generated site to `dist-static`, excluding internal build manifests.
`preview` serves the generated browser site with production route mappings.

Playwright checks the actual compiled worker in Chromium: shared view startup,
world images, options, warm network requests, true offline navigation, 5xx recovery,
waiting updates, preserved saves, failed installs, bypass rules, and future assets.
It also checks the production local server and Vite development. CI runs these
checks after building all apps. Tests use isolated browser contexts and an absent
SQLite path; they do not read the user's save. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can
select an existing Chromium installation for local runs.
