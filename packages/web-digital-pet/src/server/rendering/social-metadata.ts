import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import { IntlModule } from "../../shared/i18n.ts"
import { assetUrl, type WebResources } from "./build-resources.ts"

// The public origin is defined by infra/web-digital-pet.yml, not the local request Host header.
export const PUBLIC_SITE_URL = "https://digital-pet.rebase.es/"

/** Crawlers must receive sharing metadata in the initial HTML, without running browser scripts. */
export const socialMetadata = (resources: WebResources): string => {
  const title = escapeHtml(IntlModule.translate("sharing.title"))
  const description = escapeHtml(IntlModule.translate("sharing.description"))
  const imageAlt = escapeHtml(IntlModule.translate("sharing.imageAlt"))
  const image = escapeHtml(new URL(assetUrl(resources, "/social/digital-pet-share.png"), PUBLIC_SITE_URL).href)
  return `<meta name="application-name" content="Digital Pet">
<meta name="apple-mobile-web-app-title" content="Digital Pet">
<meta name="description" content="${description}">
<link rel="canonical" href="${PUBLIC_SITE_URL}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Digital Pet">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${PUBLIC_SITE_URL}">
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${imageAlt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<meta name="twitter:image:alt" content="${imageAlt}">`
}
