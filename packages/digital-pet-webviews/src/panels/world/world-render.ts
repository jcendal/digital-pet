import { getField, getRegionLocations, getRegionProgress } from "@jcendal/digital-pet-fields/application/world.ts"
import { REGIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import type { Region, WorldVisit } from "@jcendal/digital-pet-fields/domain/world.ts"
import { escapeHtml } from "../../shared/escape-html.ts"
import type { WorldPanelModel } from "./world-model.ts"
import worldStylesSource from "./world-styles.css" with { type: "text" }

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

export const worldStyles = worldStylesSource
