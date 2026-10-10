import { IntlModule as CoreIntlModule } from "@jcendal/digital-pet-core/i18n"
import { getField, getRegionLocations, getRegionProgress } from "@jcendal/digital-pet-fields/application/world.ts"
import { REGIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import type { Region, WorldVisit } from "@jcendal/digital-pet-fields/domain/world.ts"
import { IntlModule } from "../../i18n.ts"
import { escapeHtml } from "../../shared/escape-html.ts"
import type { WorldPanelModel } from "./world-model.ts"
import worldStylesSource from "./world-styles.css" with { type: "text" }

export const worldMarkup = (photos: readonly string[]) => /* html */ `
<dialog id="world-dialog" class="web-dialog" aria-labelledby="world-title" data-photos="${escapeHtml(JSON.stringify(photos))}">
  <header class="dialog-head"><div><p class="dialog-eyebrow" data-i18n="webviews:worldRender.theDigitalWorld">${escapeHtml(IntlModule.translate("worldRender.theDigitalWorld"))}</p><h2 id="world-title" data-i18n="webviews:worldRender.regions">${escapeHtml(IntlModule.translate("worldRender.regions"))}</h2></div><form method="dialog"><button class="dialog-close" aria-label="${escapeHtml(IntlModule.translate("worldRender.closeRegions"))}" data-i18n-aria-label="webviews:worldRender.closeRegions">✕</button></form></header>
  <div class="dialog-body"><div id="world-content"></div></div>
  <p id="world-status" class="dialog-feedback" role="status" aria-live="polite"></p>
</dialog>`

const defaultSceneUrl = (locationId: string): string => `/regions/${locationId}/scene.svg`

export const renderWorldOverview = (
  registered: ReadonlySet<string>,
  visit: WorldVisit,
  sceneUrl = defaultSceneUrl,
): string => `
<p class="world-intro" data-i18n="webviews:worldRender.chooseAPlaceToExploreWithYourCompanion">${escapeHtml(IntlModule.translate("worldRender.chooseAPlaceToExploreWithYourCompanion"))}</p>
<div class="world-grid">${REGIONS.map((region) => {
  const field = getField(region)
  const progress = getRegionProgress(region.id, registered)
  return `<button class="region-card" type="button" data-region="${region.id}" aria-label="${escapeHtml(IntlModule.translate("world.explore", { name: region.name }))}">
    <img src="${escapeHtml(sceneUrl(region.defaultLocationId))}" alt="" width="160" height="160">
    <span class="region-card-meta">${field.code}${visit.regionId === region.id ? `<span class="world-here" data-i18n="webviews:worldRender.here">${escapeHtml(IntlModule.translate("worldRender.here"))}</span>` : ""}</span>
    <strong>${escapeHtml(region.name)}</strong><small>${escapeHtml(IntlModule.translate("world.registeredCount", { count: progress.registered, total: progress.total }))}</small></button>`
}).join("")}</div>`

export const renderWorldRegion = (
  region: Region,
  model: WorldPanelModel,
  visit: WorldVisit,
  sceneUrl = defaultSceneUrl,
): string => {
  const field = getField(region)
  const locations = getRegionLocations(region.id)
  const selected = locations.find((location) => location.id === visit.locationId) ?? locations[0]!
  const residentStage = (resident: WorldPanelModel["residents"][number]) =>
    resident.stageKey && IntlModule.locale !== "en" ? CoreIntlModule.translate(resident.stageKey) : resident.stage
  const renderResidents = (residents: WorldPanelModel["residents"]) =>
    residents
      .map(
        (resident) =>
          `<div class="resident-row">${resident.artwork ? `<svg viewBox="${resident.artworkViewBox}" aria-hidden="true"><path d="${resident.artwork}"/></svg>` : `<span class="resident-art-missing" aria-label="${escapeHtml(IntlModule.translate("worldRender.artworkUnavailable"))}" data-i18n-aria-label="webviews:worldRender.artworkUnavailable">?</span>`}<div><strong>${escapeHtml(resident.name)}</strong><small>${escapeHtml(residentStage(resident))}</small></div>${resident.registered ? `<button type="button" data-world-dex="${resident.id}" aria-label="${escapeHtml(IntlModule.translate("world.openInDex", { name: resident.name }))}">✓<span data-i18n="webviews:worldRender.dex">${escapeHtml(IntlModule.translate("worldRender.dex"))}</span></button>` : `<span class="resident-unregistered" aria-label="${escapeHtml(IntlModule.translate("worldRender.notRegistered"))}" data-i18n-aria-label="webviews:worldRender.notRegistered">—</span>`}</div>`,
      )
      .join("")
  const remaining = model.residents.length - 5
  return `<button class="world-back text-action" type="button" data-world-back data-i18n="webviews:worldRender.allRegions">${escapeHtml(IntlModule.translate("worldRender.allRegions"))}</button>
    <div class="world-preview"><img id="world-preview-image" src="${escapeHtml(sceneUrl(selected.id))}" alt="${escapeHtml(IntlModule.translate("world.landscape", { name: selected.name }))}"><span>${escapeHtml(field.name)}</span></div>
    <h3 class="region-title">${escapeHtml(region.name)}</h3><p class="section-description">${escapeHtml(region.description)}</p>
    <p class="setting-caption">${escapeHtml(field.description)}</p>
    <div class="world-locations" role="group" aria-label="${escapeHtml(IntlModule.translate("worldRender.locations"))}" data-i18n-aria-label="webviews:worldRender.locations">${locations.map((location) => `<button type="button" data-location="${location.id}" aria-pressed="${location.id === selected.id}">${escapeHtml(location.name)}</button>`).join("")}</div>
    <button id="world-travel" class="primary-action" type="button" data-location="${selected.id}"><span>${escapeHtml(IntlModule.translate(visit.locationId === selected.id ? "world.youAreHere" : "world.travelHere"))}</span><span aria-hidden="true">→</span></button>
    <section class="world-inhabitants"><div class="section-heading"><h3 data-i18n="webviews:worldRender.habitatGuide">${escapeHtml(IntlModule.translate("worldRender.habitatGuide"))}</h3><span class="value-badge">${model.residents.length}</span></div>
      <p class="section-description" data-i18n="webviews:worldRender.speciesThatLiveHereVisitingKeepsYourDex">${escapeHtml(IntlModule.translate("worldRender.speciesThatLiveHereVisitingKeepsYourDex"))}</p>
      <div class="resident-list">${renderResidents(model.residents.slice(0, 5))}</div>
      ${remaining > 0 ? `<details class="resident-more"><summary><span class="residents-expand">${escapeHtml(IntlModule.translate("world.showMore", { count: remaining }))}</span><span class="resident-arrow" aria-hidden="true">⌄</span></summary><div class="resident-list">${renderResidents(model.residents.slice(5))}</div></details>` : ""}
    </section>`
}

export const worldStyles = worldStylesSource
