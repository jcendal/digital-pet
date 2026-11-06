import { escapeHtml } from "@jcendal/digital-pet-webviews/shared/escape-html.ts"
import documents from "./documents.es.json" with { type: "json" }
import styles from "./styles.css" with { type: "text" }

export const LEGAL_SLUGS = ["privacy", "terms"] as const
export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export const legalSlug = (pathname: string): LegalSlug | undefined =>
  LEGAL_SLUGS.find((slug) => pathname === `/legal/${slug}` || pathname === `/legal/${slug}.html`)

export const renderLegalPage = (slug: LegalSlug): string => {
  const document = documents[slug]
  const sections = document.pages.flat()
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer"><meta name="description" content="${escapeHtml(document.summary)}">
<title>${escapeHtml(document.title)} | Digital Pet</title>
<link rel="canonical" href="${documents.origin}/legal/${slug}"><style>${styles}</style></head>
<body><header><a class="brand" href="/">Digital Pet</a><nav aria-label="Documentos legales"><a href="/legal/privacy"${slug === "privacy" ? ' aria-current="page"' : ""}>Privacidad</a><a href="/legal/terms"${slug === "terms" ? ' aria-current="page"' : ""}>Condiciones</a></nav></header>
<main><p class="eyebrow">Información legal</p><h1>${escapeHtml(document.title)}</h1>
<p class="updated">Última actualización: <time datetime="${documents.version}">${escapeHtml(documents.updated)}</time></p>
<p class="summary">${escapeHtml(document.summary)}</p>
<a class="download" href="/legal/${slug}.pdf" download>Descargar PDF <span aria-hidden="true">↓</span></a>
<nav class="contents" aria-label="Índice"><ol>${sections.map((section, index) => `<li><a href="#section-${index + 1}">${escapeHtml(section.title.replace(/^\d+\. /, ""))}</a></li>`).join("")}</ol></nav>
${sections.map((section, index) => `<section aria-labelledby="section-${index + 1}"><h2 id="section-${index + 1}">${escapeHtml(section.title)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("")}
<section><h2>Enlaces de consulta</h2><ul>${document.links.map((link) => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></li>`).join("")}</ul></section>
<footer><p>Contacto: <a href="mailto:${escapeHtml(documents.email)}">${escapeHtml(documents.email)}</a></p><a href="/">Volver al juego</a></footer></main></body></html>`
}
