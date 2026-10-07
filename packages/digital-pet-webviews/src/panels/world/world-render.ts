import { REGIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import { getField, getRegionLocations, getRegionProgress } from "@jcendal/digital-pet-fields/application/world.ts"
import type { Region, WorldVisit } from "@jcendal/digital-pet-fields/domain/world.ts"
import { escapeHtml } from "../../shared/escape-html.ts"
import type { WorldPanelModel } from "./world-model.ts"

export const worldMarkup = (photos: readonly string[]) => /* html */ `
<dialog id="world-dialog" class="web-dialog" aria-labelledby="world-title" data-photos="${escapeHtml(JSON.stringify(photos))}">
  <header class="dialog-head"><div><p class="dialog-eyebrow">THE DIGITAL WORLD</p><h2 id="world-title">REGIONS</h2></div><form method="dialog"><button class="dialog-close" aria-label="Close regions">✕</button></form></header>
  <div class="dialog-body"><div id="world-content"></div></div>
  <p id="world-status" class="dialog-feedback" role="status" aria-live="polite"></p>
</dialog>`

export const renderWorldOverview = (registered: ReadonlySet<string>, visit: WorldVisit): string => `
<p class="world-intro">Choose a place to explore with your companion.</p>
<div class="world-grid">${REGIONS.map((region) => {
  const field = getField(region)
  const progress = getRegionProgress(region.id, registered)
  return `<button class="region-card" type="button" data-region="${region.id}" aria-label="Explore ${escapeHtml(region.name)}">
    <img src="/regions/${region.defaultLocationId}/scene.svg" alt="" width="160" height="160">
    <span class="region-card-meta">${field.code}${visit.regionId === region.id ? '<span class="world-here">HERE</span>' : ""}</span>
    <strong>${escapeHtml(region.name)}</strong><small>${progress.registered} / ${progress.total} REGISTERED</small></button>`
}).join("")}</div>`

export const renderWorldRegion = (region: Region, model: WorldPanelModel, visit: WorldVisit): string => {
  const field = getField(region)
  const locations = getRegionLocations(region.id)
  const selected = locations.find((location) => location.id === visit.locationId) ?? locations[0]!
  const renderResidents = (residents: WorldPanelModel["residents"]) =>
    residents
      .map(
        (resident) =>
          `<div class="resident-row">${resident.artwork ? `<svg viewBox="${resident.artworkViewBox}" aria-hidden="true"><path d="${resident.artwork}"/></svg>` : '<span class="resident-art-missing" aria-label="Artwork unavailable">?</span>'}<div><strong>${escapeHtml(resident.name)}</strong><small>${escapeHtml(resident.stage)}</small></div>${resident.registered ? `<button type="button" data-world-dex="${resident.id}" aria-label="Open ${escapeHtml(resident.name)} in Dex">✓<span>DEX</span></button>` : '<span class="resident-unregistered" aria-label="Not registered">—</span>'}</div>`,
      )
      .join("")
  const remaining = model.residents.length - 5
  return `<button class="world-back text-action" type="button" data-world-back>← ALL REGIONS</button>
    <div class="world-preview"><img id="world-preview-image" src="/regions/${selected.id}/scene.svg" alt="${escapeHtml(selected.name)} pixel landscape"><span>${escapeHtml(field.name)}</span></div>
    <h3 class="region-title">${escapeHtml(region.name)}</h3><p class="section-description">${escapeHtml(region.description)}</p>
    <p class="setting-caption">${escapeHtml(field.description)}</p>
    <div class="world-locations" role="group" aria-label="Locations">${locations.map((location) => `<button type="button" data-location="${location.id}" aria-pressed="${location.id === selected.id}">${escapeHtml(location.name)}</button>`).join("")}</div>
    <button id="world-travel" class="primary-action" type="button" data-location="${selected.id}"><span>${visit.locationId === selected.id ? "YOU ARE HERE" : "TRAVEL HERE"}</span><span aria-hidden="true">→</span></button>
    <section class="world-inhabitants"><div class="section-heading"><h3>HABITAT GUIDE</h3><span class="value-badge">${model.residents.length}</span></div>
      <p class="section-description">Species that live here. Visiting keeps your Dex discoveries as they are.</p>
      <div class="resident-list">${renderResidents(model.residents.slice(0, 5))}</div>
      ${remaining > 0 ? `<details class="resident-more"><summary><span class="residents-expand">SHOW ${remaining} MORE</span><span class="resident-arrow" aria-hidden="true">⌄</span></summary><div class="resident-list">${renderResidents(model.residents.slice(5))}</div></details>` : ""}
    </section>`
}

export const worldStyles = /* css */ `
#world-dialog { height: min(90dvh, 820px); }
.web-dialog .world-intro { margin-bottom: 16px; color: var(--muted); font-size: 11px; }
.world-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.web-dialog .region-card { min-width: 0; display: flex; flex-direction: column; text-align: left; padding: 0 0 12px; border: 2px solid var(--muted); }
.region-card img { display: block; width: 100%; height: 100px; object-fit: cover; image-rendering: pixelated; border-bottom: 2px solid var(--muted); }
.region-card-meta { display: flex; justify-content: space-between; width: 100%; box-sizing: border-box; padding: 9px 10px 0; font-size: 9px; }
.world-here { background: var(--ink); color: var(--lcd); padding: 1px 3px; font-size: 8px; }
.region-card strong { font-size: 12px; font-weight: 400; line-height: 1.5; padding: 5px 10px; }
.region-card small { margin-top: auto; padding: 0 10px; font-size: 8px; }
.web-dialog .world-back { text-align: left; margin: -8px 0 8px; padding-left: 0; }
.world-preview { position: relative; height: 180px; border: 2px solid var(--muted); margin-bottom: 16px; overflow: hidden; }
.world-preview img { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
.world-preview span { position: absolute; bottom: 8px; left: 8px; background: var(--lcd); border: 2px solid var(--muted); padding: 4px 6px; font-size: 9px; }
.web-dialog .region-title { font-size: 18px; }
.world-locations { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 12px; }
.world-locations button { flex: 1; font-size: 10px; }
.web-dialog .world-locations button[aria-pressed=true] { background: var(--line); border-color: var(--ink); }
.resident-list { margin-top: 14px; }
.resident-more { margin-top: 12px; }
.resident-more summary { display: flex; align-items: center; justify-content: space-between; cursor: pointer; list-style: none; border: 2px solid var(--muted); padding: 12px; font-size: 10px; }
.resident-more summary::-webkit-details-marker { display: none; }
.resident-more summary:hover { background: var(--line); }
.resident-more summary:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.resident-more[open] { margin-top: 0; }
.resident-more[open] summary { display: none; }
.resident-arrow { font-size: 18px; line-height: 1; }
.resident-more .resident-list { margin-top: 0; }
.resident-row { display: flex; align-items: center; gap: 12px; border-top: 2px dotted var(--line); padding: 10px 0; }
.resident-row svg { width: 48px; height: 48px; flex: none; fill: var(--ink); shape-rendering: crispEdges; }
.resident-art-missing { display: grid; place-items: center; width: 48px; height: 48px; flex: none; border: 2px dotted var(--line); box-sizing: border-box; font-size: 24px; color: var(--muted); }
.resident-row > div { flex: 1; min-width: 0; }
.resident-row strong { display: block; font-size: 11px; font-weight: 400; overflow-wrap: anywhere; }
.resident-row small { display: block; font-size: 9px; margin-top: 4px; color: var(--muted); }
.web-dialog .resident-row button { padding: 4px 8px; font-size: 11px; }
.resident-row button span { display: block; font-size: 8px; }
.resident-unregistered { color: var(--muted); padding: 0 10px; }
#world-current { display: block; font-size: 10px; margin-top: 6px; }
`
