import { createHash, randomBytes } from "node:crypto"
import { LOCATIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import { buildIntlBrowserScript } from "@jcendal/digital-pet-intl/browser-script.ts"
import { catalogs as webviewCatalogs } from "@jcendal/digital-pet-webviews/i18n"
import { buildDexWebviewHtml } from "@jcendal/digital-pet-webviews/panels/dex/dex-render.ts"
import { buildHistoryWebviewHtml } from "@jcendal/digital-pet-webviews/panels/history/history-render.ts"
import { worldMarkup } from "@jcendal/digital-pet-webviews/panels/world/world-render.ts"
import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import { PANEL_THEME } from "@jcendal/digital-pet-webviews/shared/theme.ts"
import { buildSidebarWebviewHtml } from "@jcendal/digital-pet-webviews/sidebar/sidebar-document.ts"
import { IntlModule, catalogs as webCatalogs } from "../../shared/i18n.ts"
import { battleMarkup } from "./battle-markup.ts"
import { assetUrl, type WebResources } from "./build-resources.ts"
import { dexModel, historyModel } from "./host-models.ts"
import { navigationMarkup } from "./navigation-markup.ts"
import { optionsMarkup } from "./options-markup.ts"

const nonceFor = (resources: WebResources) =>
  resources.mode === "browser" ? "STATIC-NONCE" : randomBytes(16).toString("hex")
export const stableStaticNonce = (html: string): string =>
  html.replaceAll("STATIC-NONCE", createHash("sha256").update(html).digest("hex").slice(0, 32))

export const renderPage = (page: "sidebar" | "dex" | "history", web: WebResources): string => {
  const nonce = nonceFor(web)
  const resources = {
    nonce,
    fontUri: assetUrl(web, "/fonts/Silkscreen-Regular.ttf"),
    cspSource: "'self'",
    webShell: true,
    moduleClient: true,
  }
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
          `<button id="world-location" type="button" aria-haspopup="dialog" data-i18n="fields:regions.dragonEyeLake">${escapeHtml(IntlModule.translate("pages.dragonEyeLake"))}</button><div id="content">`,
        )
      : html
  return withWorld
    .replace("connect-src 'self'", `connect-src 'self'${web.development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`)
    .replace("<html", '<html data-save-host="' + web.mode + '"')
    .replace('<svg id="artwork"', '<svg id="artwork" data-idle-alignment="xMidYMax"')
    .replace("script-src 'nonce-", "script-src 'self' 'nonce-")
    .replace("style-src 'unsafe-inline'", "style-src 'self' 'unsafe-inline'")
    .replace("</head>", `${web.entryTags("frame")}</head>`)
    .replace("<body>", `<body data-page="${page}">`)
}

export const renderShell = (page: "sidebar" | "dex" | "history", web: WebResources): string => {
  const nonce = nonceFor(web)
  const views = (["sidebar", "dex", "history"] as const)
    .map(
      (view) =>
        `<iframe class="web-view${view === page ? " active" : ""}" data-page="${view}" src="${web.views?.[view] ?? `/view/${view}`}" title="${escapeHtml(IntlModule.translate(view === "sidebar" ? "pages.partner" : view === "dex" ? "pages.digidex" : "pages.history"))}" data-i18n-title="web:${view === "sidebar" ? "pages.partner" : view === "dex" ? "pages.digidex" : "pages.history"}"${view === page ? "" : ' aria-hidden="true"'}></iframe>`,
    )
    .join("")
  return `<!DOCTYPE html><html lang="en" data-save-host="${web.mode}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#594130"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; manifest-src 'self'; frame-src 'self'; worker-src 'self'; font-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'; connect-src 'self' https://0.peerjs.com wss://0.peerjs.com${web.development ? " ws://localhost:* ws://127.0.0.1:*" : ""}"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" type="image/x-icon" href="${assetUrl(web, "/favicon.ico")}"><link rel="icon" type="image/png" sizes="16x16" href="${assetUrl(web, "/icons/digital-pet-16.png")}"><link rel="icon" type="image/png" sizes="32x32" href="${assetUrl(web, "/icons/digital-pet-32.png")}"><link rel="apple-touch-icon" sizes="180x180" href="${assetUrl(web, "/icons/digital-pet-180.png")}"><title data-i18n="web:navigationMarkup.digitalPet">${escapeHtml(IntlModule.translate("navigationMarkup.digitalPet"))}</title><style>@font-face { font-family: 'Digital Pet Pixel'; src: url('${assetUrl(web, "/fonts/Silkscreen-Regular.ttf")}') format('truetype'); font-display: swap; }${PANEL_THEME}</style></head><body><div class="view-stack">${views}</div>${navigationMarkup(page)}${optionsMarkup}${battleMarkup}${worldMarkup(LOCATIONS.filter((place) => web.assets[`/regions/${place.id}/background.png`]).map((place) => place.id))}<script nonce="${nonce}">${buildIntlBrowserScript({ web: webCatalogs, webviews: webviewCatalogs }, true)}</script>${web.entryTags("shell")}</body></html>`
}
