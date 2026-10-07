import { createServer, type ServerResponse } from "node:http"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { MonsterAnimationController } from "@jcendal/digital-pet-animation/idle/monster-animation.ts"
import { renderPositionedArtwork } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"
import { buildDexPanelModel } from "@jcendal/digital-pet-webviews/panels/dex/dex-model.ts"
import { buildDexWebviewHtml } from "@jcendal/digital-pet-webviews/panels/dex/dex-render.ts"
import { buildHistoryPanelModel } from "@jcendal/digital-pet-webviews/panels/history/history-model.ts"
import { buildHistoryWebviewHtml } from "@jcendal/digital-pet-webviews/panels/history/history-render.ts"
import { buildSidebarWebviewHtml } from "@jcendal/digital-pet-webviews/sidebar/sidebar-document.ts"
import { buildSidebarPresentation } from "@jcendal/digital-pet-webviews/sidebar/sidebar-presenter.ts"
import { LOCATIONS, REGIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import { buildWorldPanelModel } from "@jcendal/digital-pet-webviews/panels/world/world-model.ts"
import { worldMarkup, worldStyles } from "@jcendal/digital-pet-webviews/panels/world/world-render.ts"
import { PANEL_THEME } from "@jcendal/digital-pet-webviews/shared/theme.ts"

import { databasePath, hasHostDatabase, readArchive, readSidebarSnapshot } from "./database.ts"
import { optionsMarkup, optionsStyles } from "./options-view.ts"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fontPath = resolve(packageRoot, "..", "digital-pet-webviews", "media", "fonts", "Silkscreen-Regular.ttf")
const fieldsAssets = resolve(packageRoot, "..", "digital-pet-fields", "assets")
const backgroundPath = resolve(fieldsAssets, "backgrounds", "dragon-eye-lake.png")
const availablePhotos = LOCATIONS.filter((place) =>
  existsSync(resolve(fieldsAssets, "backgrounds", place.backgroundFile)),
).map((place) => place.id)
const browserWorldScript = readFile(resolve(packageRoot, "dist", "browser-world.js"))
const manifestPath = resolve(packageRoot, "assets", "manifest.webmanifest")
const serviceWorkerPath = resolve(packageRoot, "assets", "service-worker.js")
const browserLocalPath = resolve(packageRoot, "dist", "browser-local.js")
const browserLocalScript = readFile(browserLocalPath)
const browserLocalGzip = browserLocalScript.then((script) => gzipSync(script))
const browserOptionsPath = resolve(packageRoot, "dist", "browser-options.js")
const browserOptionsScript = readFile(browserOptionsPath)
const browserOptionsGzip = browserOptionsScript.then((script) => gzipSync(script))
const browserPairingPath = resolve(packageRoot, "dist", "browser-pairing.js")
const browserPairingScript = readFile(browserPairingPath)
const browserPairingGzip = browserPairingScript.then((script) => gzipSync(script))
const faviconPath = resolve(packageRoot, "assets", "favicon.ico")
const icon16Path = resolve(packageRoot, "assets", "icons", "digital-pet-16.png")
const icon32Path = resolve(packageRoot, "assets", "icons", "digital-pet-32.png")
const icon180Path = resolve(packageRoot, "assets", "icons", "digital-pet-180.png")
const icon192Path = resolve(packageRoot, "assets", "icons", "digital-pet-192.png")
const icon512Path = resolve(packageRoot, "assets", "icons", "digital-pet-512.png")
const maskable192Path = resolve(packageRoot, "assets", "icons", "digital-pet-maskable-192.png")
const maskable512Path = resolve(packageRoot, "assets", "icons", "digital-pet-maskable-512.png")
const animation = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
let currentPartner = ""

const dexModel = () => buildDexPanelModel(readArchive(), DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
const historyModel = () => buildHistoryPanelModel(readArchive(), DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)

const sidebarData = (requestedWidth: number) => {
  const presentation = buildSidebarPresentation(readSidebarSnapshot())
  const identity = presentation.partner
  const partnerKey = identity ? `${identity.sprite}:${identity.isDigitama}` : ""
  if (partnerKey !== currentPartner) {
    currentPartner = partnerKey
    animation.dispatch({ kind: "partner_changed", partner: identity })
  }
  const width = Math.max(16, Math.min(120, Math.floor(requestedWidth) || 40))
  animation.dispatch({ kind: "viewport_resized", width })
  const frame = animation.dispatch({ kind: "tick" })
  return {
    model: presentation.payload,
    frame: { type: "animation-frame", artwork: renderPositionedArtwork(frame, width) },
  }
}

const webStyles = /* css */ `
  html { width: 100%; height: 100%; min-height: 100dvh; overflow: hidden; display: grid; place-items: center;
    background: linear-gradient(#0b171a44, #0b171a55), url('/images/digital-world-lake-background.png') center / cover no-repeat #101b1b; }
  body { width: min(100vw, 430px); height: min(100dvh, 880px); min-height: 0; margin: 0; padding: 0;
    overflow: hidden; display: flex; flex-direction: column; background: var(--case); box-shadow: 0 20px 65px #000b; }
  .web-nav { display: flex; flex: none; gap: 0; min-height: 64px; padding: 0 8px 6px;
    background: var(--case); border: 4px solid var(--case-edge); border-top: 0; }
  .web-nav a, .web-nav button { flex: 1; display: grid; place-items: center; padding: 8px 3px; color: var(--case-ink);
    text-align: center; text-decoration: none; font: inherit; font-size: 12px; border: 0; border-top: 3px solid #342b21;
    background: transparent; cursor: pointer; }
  .web-nav button[hidden] { display: none; }
  .web-nav a[aria-current=page] { color: var(--lcd); border-color: var(--lcd); }
  .web-nav a:focus-visible, .web-nav button:focus-visible { outline: 2px solid var(--lcd); }
  .device { width: 100%; height: 100%; min-height: 0; max-width: none; margin: 0; flex: 1; overflow: hidden; }
  .screen { overflow-x: hidden; overflow-y: auto; scrollbar-color: var(--muted) var(--line); scrollbar-width: thin; }
  .workspace { display: flex; flex: none; flex-direction: column; gap: 18px; min-height: 0; }
  .catalog, .detail { flex: none; min-height: 0; }
  .entries { flex: 0 0 min(28dvh, 250px); height: min(28dvh, 250px); max-height: none; overflow-y: auto; }
  .detail { border-left: 0; border-top: 4px solid var(--line); padding: 16px 0 0; }
  .detail-body { overflow: visible; }
  .toolbar { max-height: none; overflow: visible; }
  .dex .toolbar { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .history .toolbar { grid-template-columns: minmax(0, 1fr) auto; }
  .toolbar .field, .toolbar select { min-width: 0; max-width: 100%; }
  .panel-filters { flex: none; margin-bottom: 12px; }
  .partner-device .screen { display: flex; flex-direction: column; overflow: hidden; }
  .partner-device .arena { --artwork-pixel-size: 7.5; background: url("/regions/dragon-eye-lake/scene.svg") center / 100% 100% no-repeat; }
  .partner-device .arena:not(.with-battle-hud) #artwork { height: 85%; align-self: start; }
  #world-location { flex: none; padding: 8px 6px; margin: 0 0 8px; text-align: left; font: inherit; font-size: 10px; color: var(--muted); border: 0; border-bottom: 2px dotted var(--line); background: transparent; cursor: pointer; }
  #world-location:hover { color: var(--ink); }
  #world-location:focus-visible { outline: 2px dotted var(--ink); }
  @media (max-width: 390px) { .partner-device .arena { --artwork-pixel-size: 6; } }
  .pet-module { flex: 1; display: flex; flex-direction: column; width: 100%; min-height: 0; padding: 0; border: 0;
    background: transparent; box-shadow: none; }
  .pet-header { flex: none; padding: 8px 6px 12px; }
  .pet-module #content { flex: 1; grid-template-rows: 40px minmax(0, 1fr) 76px; min-height: 0; }
  .pet-module .arena { height: 100%; min-height: 0; }
  .pet-module .identity { padding: 0 6px; }
  .pet-module #name { font-size: 18px; }
  .pet-module #stage { font-size: 14px; }
  .pet-module .progress { height: auto; padding: 12px 6px; }
  .pet-module .pet-actions, .partner-spacer { display: none; }
  .pet-module #empty { flex: 1; display: grid; place-items: center; text-align: center; }
  .pet-module.animating #content { grid-template-rows: 40px minmax(0, 1fr); }
  .pet-module.animating .arena { height: 100%; }
  @media (max-height: 590px) { .pet-header { padding: 4px 6px 6px; } .footer { padding-top: 5px; }
    .web-nav { min-height: 48px; } .pet-module #content { grid-template-rows: 30px minmax(0, 1fr) 65px; } }
`

const bridgeScript = (page: "sidebar" | "dex" | "history") => /* javascript */ `
  (() => {
    const page = ${JSON.stringify(page)};
    const key = 'digital-pet:' + page;
    let width = 40;
    let busy = false;
    let refreshRequested = false;
    const deliver = data => window.dispatchEvent(new MessageEvent('message', { data }));
    const navigate = path => {
      if (window.parent === window) { location.href = path; return; }
      window.parent.postMessage({ type: 'digital-pet:navigate', path }, location.origin);
    };
    const refresh = async () => {
      if (busy) { refreshRequested = true; return; }
      busy = true;
      const preferred = localStorage.getItem('digital-pet:preferred-source');
      const deliverCurrent = data => {
        if (preferred !== localStorage.getItem('digital-pet:preferred-source')) { refreshRequested = true; return; }
        deliver(data);
      };
      try {
        const path = page === 'sidebar' ? '/api/sidebar?width=' + width : '/api/' + page;
        let data;
        try {
          if (preferred === 'browser') data = { mode: 'browser' };
          else {
            const response = await fetch(path, { cache: 'no-store' });
            if (!response.ok) throw new Error('Could not read Digital Pet data');
            data = await response.json();
          }
        } catch (error) {
          if (preferred === 'sqlite' || localStorage.getItem('digital-pet:source') !== 'browser') throw error;
          data = { mode: 'browser' };
        }
        if (preferred !== localStorage.getItem('digital-pet:preferred-source')) { refreshRequested = true; return; }
        if (data.mode === 'browser') {
          localStorage.setItem('digital-pet:source', 'browser');
          const local = await import('/browser-local.js');
          if (page === 'sidebar') {
            const snapshot = await local.sidebar(width);
            deliverCurrent(snapshot.model); deliverCurrent(snapshot.frame);
          } else {
            deliverCurrent({ type: page + '-model', model: await local[page]() });
          }
        } else {
          localStorage.setItem('digital-pet:source', 'sqlite');
          if (page === 'sidebar') { deliverCurrent(data.model); deliverCurrent(data.frame); }
          else { deliverCurrent({ type: page + '-model', model: data }); }
        }
      } catch (error) {
        const notice = document.getElementById('notice') || document.getElementById('empty');
        if (notice) { notice.hidden = false; notice.textContent = String(error); }
      } finally {
        busy = false;
        if (refreshRequested) { refreshRequested = false; queueMicrotask(refresh); }
      }
    };
    window.digitalPetBridge = {
      getState: () => { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } },
      setState: state => sessionStorage.setItem(key, JSON.stringify(state)),
      postMessage: message => {
        if (message.type === 'artwork-width') { width = message.width; return; }
        if (message.type === 'open-panel') { navigate('/' + message.panel); return; }
        if (message.type === 'history-dex') { navigate('/dex?selected=' + encodeURIComponent(message.id)); return; }
        if (message.type === 'dex-reference') { window.open('/api/reference?id=' + encodeURIComponent(message.id) + '&source=' + localStorage.getItem('digital-pet:source'), '_blank', 'noopener'); return; }
        if (message.type.endsWith('-ready')) {
          refresh();
          setInterval(refresh, page === 'sidebar' ? 800 : 5000);
          if (page === 'dex') {
            const selected = new URLSearchParams(location.search).get('selected');
            if (selected) setTimeout(() => deliver({ type: 'dex-select', id: selected }), 0);
          }
          return;
        }
        if (message.type.endsWith('-refresh')) refresh();
      }
    };
    window.addEventListener('storage', event => {
      if (event.key === 'digital-pet:preferred-source') refresh();
    });
    if (page === 'sidebar') {
      document.addEventListener('click', event => {
        if (event.target.closest('#world-location')) window.parent.postMessage({ type: 'digital-pet:world-open' }, location.origin);
      });
      window.addEventListener('message', event => {
        if (event.source !== window.parent || event.origin !== location.origin || event.data?.type !== 'digital-pet:world-changed') return;
        if (!${JSON.stringify(LOCATIONS.map((place) => place.id))}.includes(event.data.locationId)) return;
        document.querySelector('.arena').style.backgroundImage = "url('/regions/" + event.data.locationId + "/scene.svg')";
        document.getElementById('world-location').textContent = event.data.name + ' →';
      });
    }
    window.addEventListener('message', event => {
      if (event.source === window.parent && event.origin === location.origin && event.data?.type === 'browser-save-updated') refresh();
    });
  })();
`

const renderPage = (page: "sidebar" | "dex" | "history"): string => {
  const nonce = randomBytes(16).toString("hex")
  const resources = { nonce, fontUri: "/fonts/Silkscreen-Regular.ttf", cspSource: "'self'", webShell: true }
  const html =
    page === "sidebar"
      ? buildSidebarWebviewHtml(nonce, resources)
      : page === "dex"
        ? buildDexWebviewHtml(dexModel(), resources)
        : buildHistoryWebviewHtml(historyModel(), resources)
  const withWorld =
    page === "sidebar"
      ? html.replace(
          '<div id="content">',
          '<button id="world-location" type="button" aria-haspopup="dialog">Dragon Eye Lake →</button><div id="content">',
        )
      : html
  return withWorld
    .replace('<svg id="artwork"', '<svg id="artwork" preserveAspectRatio="xMidYMax"')
    .replace("script-src 'nonce-", "script-src 'self' 'nonce-")
    .replace(
      "</style>",
      `${webStyles}html { display: block; min-height: 0; background: transparent; } body { width: 100%; height: 100dvh; box-shadow: none; }</style>`,
    )
    .replace("<body>", `<body><script nonce="${nonce}">${bridgeScript(page)}</script>`)
}

const renderShell = (page: "sidebar" | "dex" | "history"): string => {
  const nonce = randomBytes(16).toString("hex")
  const views = (["sidebar", "dex", "history"] as const)
    .map(
      (view) =>
        `<iframe class="web-view${view === page ? " active" : ""}" data-page="${view}" src="/view/${view}" title="${view === "sidebar" ? "Partner" : view === "dex" ? "Digidex" : "History"}"${view === page ? "" : ' aria-hidden="true"'}></iframe>`,
    )
    .join("")
  const links = (["sidebar", "dex", "history"] as const)
    .map(
      (view) =>
        `<a href="${view === "sidebar" ? "/" : `/${view}`}" data-page="${view}"${view === page ? ' aria-current="page"' : ""}>${view === "sidebar" ? "PARTNER" : view.toUpperCase()}</a>`,
    )
    .join("")
  const script = /* javascript */ `
    (() => {
      const frames = Array.from(document.querySelectorAll('.web-view'));
      const links = Array.from(document.querySelectorAll('.web-nav a'));
      const pageFromPath = path => path === '/dex' ? 'dex' : path === '/history' ? 'history' : 'sidebar';
      const selectRecord = path => {
        const id = new URL(path, location.origin).searchParams.get('selected');
        const frame = frames.find(node => node.dataset.page === 'dex');
        if (!id || !frame) return;
        const deliver = () => frame.contentWindow?.postMessage({ type: 'dex-select', id }, location.origin);
        if (frame.contentDocument?.readyState === 'complete') deliver();
        else frame.addEventListener('load', deliver, { once: true });
      };
      const show = path => {
        const page = pageFromPath(new URL(path, location.origin).pathname);
        for (const frame of frames) {
          const active = frame.dataset.page === page;
          frame.classList.toggle('active', active);
          if (active) frame.removeAttribute('aria-hidden');
          else frame.setAttribute('aria-hidden', 'true');
        }
        for (const link of links) {
          if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        }
        if (page === 'dex') selectRecord(path);
      };
      const navigate = path => { history.pushState(null, '', path); show(path); };
      for (const link of links) link.addEventListener('click', event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); navigate(link.getAttribute('href'));
      });
      window.addEventListener('message', event => {
        if (event.origin !== location.origin || event.data?.type !== 'digital-pet:navigate') return;
        if (!frames.some(frame => frame.contentWindow === event.source)) return;
        navigate(event.data.path);
      });
      window.addEventListener('digital-pet:navigate', event => {
        const path = event.detail;
        if (typeof path === 'string' && /^\\/(?:dex(?:\\?selected=[0-7]-[0-9]{3})?|history)?$/.test(path)) navigate(path);
      });
      import('/browser-world.js').then(module => module.initBrowserWorld()).catch(() => {});
      window.addEventListener('popstate' , () => show(location.pathname + location.search));
      show(location.pathname + location.search);
      import('/browser-options.js').then(module => module.initBrowserOptions()).catch(error => {
        const dialog = document.getElementById('options-dialog');
        document.getElementById('options-status').textContent = String(error);
        document.getElementById('options-button').addEventListener('click', () => { if (!dialog.open) dialog.showModal(); });
      });
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
      }
    })();
  `
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#594130"><meta name="apple-mobile-web-app-capable" content="yes"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src 'self'; worker-src 'self'; font-src 'self'; img-src 'self'; style-src 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'; connect-src 'self' https://0.peerjs.com wss://0.peerjs.com"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" type="image/x-icon" href="/favicon.ico"><link rel="icon" type="image/png" sizes="16x16" href="/icons/digital-pet-16.png"><link rel="icon" type="image/png" sizes="32x32" href="/icons/digital-pet-32.png"><link rel="apple-touch-icon" sizes="180x180" href="/icons/digital-pet-180.png"><title>Digital Pet</title><style>@font-face { font-family: 'Digital Pet Pixel'; src: url('/fonts/Silkscreen-Regular.ttf') format('truetype'); font-display: swap; }${PANEL_THEME}${webStyles}.view-stack { position: relative; flex: 1; min-height: 0; }.web-view { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; visibility: hidden; pointer-events: none; }.web-view.active { visibility: visible; pointer-events: auto; }${optionsStyles}${worldStyles}</style></head><body><div class="view-stack">${views}</div><nav class="web-nav" aria-label="Digital Pet">${links}<button id="options-button" type="button" aria-haspopup="dialog">OPTIONS</button></nav>${optionsMarkup}${worldMarkup(availablePhotos)}<script nonce="${nonce}">${script}</script></body></html>`
}

const send = (response: ServerResponse, status: number, contentType: string, body: string | Buffer): void => {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  response.end(body)
}

const port = Number(process.env.PORT ?? 4173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535")
const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" || !request.url)
      return send(response, 405, "text/plain; charset=utf-8", "Method not allowed")
    const host = request.headers.host ?? ""
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
      return send(response, 403, "text/plain; charset=utf-8", "Forbidden")
    const url = new URL(request.url, `http://${host}`)
    if (url.pathname === "/fonts/Silkscreen-Regular.ttf") {
      return send(response, 200, "font/ttf", await readFile(fontPath))
    }
    if (url.pathname === "/images/digital-world-lake-background.png") {
      return send(response, 200, "image/png", await readFile(backgroundPath))
    }
    if (url.pathname === "/browser-world.js")
      return send(response, 200, "text/javascript; charset=utf-8", await browserWorldScript)
    const worldAsset = /^\/regions\/([a-z-]+)\/(scene\.svg|background\.png)$/.exec(url.pathname)
    if (worldAsset) {
      const place = LOCATIONS.find((candidate) => candidate.id === worldAsset[1])
      if (!place) return send(response, 404, "text/plain; charset=utf-8", "Unknown location")
      if (worldAsset[2] === "scene.svg")
        return send(
          response,
          200,
          "image/svg+xml",
          await readFile(resolve(fieldsAssets, "scenes", `${place.scene}.svg`)),
        )
      if (!availablePhotos.includes(place.id))
        return send(response, 404, "text/plain; charset=utf-8", "Background coming soon")
      return send(
        response,
        200,
        "image/png",
        await readFile(resolve(fieldsAssets, "backgrounds", place.backgroundFile)),
      )
    }
    if (url.pathname === "/manifest.webmanifest") {
      return send(response, 200, "application/manifest+json; charset=utf-8", await readFile(manifestPath))
    }
    if (url.pathname === "/service-worker.js") {
      return send(response, 200, "text/javascript; charset=utf-8", await readFile(serviceWorkerPath))
    }
    if (url.pathname === "/browser-local.js") {
      if (request.headers["accept-encoding"]?.includes("gzip")) {
        response.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Content-Encoding": "gzip",
          Vary: "Accept-Encoding",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        return response.end(await browserLocalGzip)
      }
      return send(response, 200, "text/javascript; charset=utf-8", await browserLocalScript)
    }
    if (url.pathname === "/browser-options.js") {
      if (request.headers["accept-encoding"]?.includes("gzip")) {
        response.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Content-Encoding": "gzip",
          Vary: "Accept-Encoding",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        return response.end(await browserOptionsGzip)
      }
      return send(response, 200, "text/javascript; charset=utf-8", await browserOptionsScript)
    }
    if (url.pathname === "/browser-pairing.js") {
      if (request.headers["accept-encoding"]?.includes("gzip")) {
        response.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Content-Encoding": "gzip",
          Vary: "Accept-Encoding",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        return response.end(await browserPairingGzip)
      }
      return send(response, 200, "text/javascript; charset=utf-8", await browserPairingScript)
    }
    if (url.pathname === "/favicon.ico") {
      return send(response, 200, "image/x-icon", await readFile(faviconPath))
    }
    if (url.pathname === "/icons/digital-pet-16.png") {
      return send(response, 200, "image/png", await readFile(icon16Path))
    }
    if (url.pathname === "/icons/digital-pet-32.png") {
      return send(response, 200, "image/png", await readFile(icon32Path))
    }
    if (url.pathname === "/icons/digital-pet-180.png") {
      return send(response, 200, "image/png", await readFile(icon180Path))
    }
    if (url.pathname === "/icons/digital-pet-192.png") {
      return send(response, 200, "image/png", await readFile(icon192Path))
    }
    if (url.pathname === "/icons/digital-pet-512.png") {
      return send(response, 200, "image/png", await readFile(icon512Path))
    }
    if (url.pathname === "/icons/digital-pet-maskable-192.png") {
      return send(response, 200, "image/png", await readFile(maskable192Path))
    }
    if (url.pathname === "/icons/digital-pet-maskable-512.png") {
      return send(response, 200, "image/png", await readFile(maskable512Path))
    }
    if (url.pathname === "/api/mode") {
      return send(
        response,
        200,
        "application/json; charset=utf-8",
        JSON.stringify({ mode: hasHostDatabase() ? "sqlite" : "browser" }),
      )
    }
    if (url.pathname === "/api/world") {
      const regionId = url.searchParams.get("region") ?? "digital-ocean"
      if (!REGIONS.some((region) => region.id === regionId))
        return send(response, 400, "text/plain; charset=utf-8", "Unknown region")
      if (!hasHostDatabase()) return send(response, 200, "application/json; charset=utf-8", '{"mode":"browser"}')
      return send(
        response,
        200,
        "application/json; charset=utf-8",
        JSON.stringify(buildWorldPanelModel(regionId, readArchive(), DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)),
      )
    }
    if (url.pathname === "/api/sidebar") {
      if (!hasHostDatabase()) return send(response, 200, "application/json; charset=utf-8", '{"mode":"browser"}')
      const width = Number(url.searchParams.get("width") ?? 40)
      return send(response, 200, "application/json; charset=utf-8", JSON.stringify(sidebarData(width)))
    }
    if (url.pathname === "/api/dex") {
      if (!hasHostDatabase()) return send(response, 200, "application/json; charset=utf-8", '{"mode":"browser"}')
      return send(response, 200, "application/json; charset=utf-8", JSON.stringify(dexModel()))
    }
    if (url.pathname === "/api/history") {
      if (!hasHostDatabase()) return send(response, 200, "application/json; charset=utf-8", '{"mode":"browser"}')
      return send(response, 200, "application/json; charset=utf-8", JSON.stringify(historyModel()))
    }
    if (url.pathname === "/api/reference") {
      const id = url.searchParams.get("id")
      const entry =
        hasHostDatabase() && url.searchParams.get("source") !== "browser"
          ? dexModel().entries.find((candidate) => candidate.id === id && candidate.discovered)
          : DIGIMON_CATALOG.byId.get(id ?? "")
      if (entry?.url.startsWith("https://digimon.net/")) {
        response.writeHead(302, { Location: entry.url, "Cache-Control": "no-store" })
        return response.end()
      }
      return send(response, 404, "text/plain; charset=utf-8", "Record unavailable")
    }
    if (url.pathname === "/view/sidebar" || url.pathname === "/view/dex" || url.pathname === "/view/history") {
      const page = url.pathname.slice(6) as "sidebar" | "dex" | "history"
      return send(response, 200, "text/html; charset=utf-8", renderPage(page))
    }
    if (url.pathname === "/" || url.pathname === "/dex" || url.pathname === "/history") {
      const page = url.pathname === "/" ? "sidebar" : (url.pathname.slice(1) as "dex" | "history")
      return send(response, 200, "text/html; charset=utf-8", renderShell(page))
    }
    return send(response, 404, "text/plain; charset=utf-8", "Not found")
  } catch (error) {
    console.error(error)
    return send(response, 500, "text/plain; charset=utf-8", "Digital Pet could not load")
  }
})

server.listen(port, "127.0.0.1", () => {
  console.log(`Digital Pet Web: http://localhost:${port} (database: ${databasePath})`)
})
