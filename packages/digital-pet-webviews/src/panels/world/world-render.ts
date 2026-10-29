import type { BossVictory } from "@jcendal/digital-pet-core/domain/boss-victory.ts"
import { IntlModule as CoreIntlModule } from "@jcendal/digital-pet-core/i18n"
import { getField, getRegionLocations, getRegionProgress } from "@jcendal/digital-pet-fields/application/world.ts"
import { REGIONS_BY_DIFFICULTY } from "@jcendal/digital-pet-fields/data/regions.ts"
import type { Region, WorldVisit } from "@jcendal/digital-pet-fields/domain/world.ts"
import { IntlModule } from "../../i18n.ts"
import { escapeHtml } from "../../shared/escape-html.ts"
import type { WorldPanelModel } from "./world-model.ts"
import worldStylesSource from "./world-styles.css" with { type: "text" }

export const worldRegionsMarkup = (photos: readonly string[]) => /* html */ `
<section id="world-regions" class="world-regions" role="tabpanel" aria-labelledby="map-regions-tab" tabindex="0" data-photos="${escapeHtml(JSON.stringify(photos))}" hidden>
  <div id="world-content"></div>
  <p id="world-status" role="status" aria-live="polite"></p>
</section>`

const defaultSceneUrl = (locationId: string): string => `/regions/${locationId}/scene.svg`

const bossStar = (): string =>
  `<span class="world-boss-star" role="img" aria-label="${escapeHtml(IntlModule.translate("world.bossDefeated"))}"><svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path d="M7 1h2v3h1v1h5v2h-2v1h-1v1h-1v2h1v3h-2v-1H9v-1H7v1H6v1H4v-3h1V9H4V8H3V7H1V5h5V4h1z"/></svg></span>`

export const renderWorldOverview = (
  registered: ReadonlySet<string>,
  visit: WorldVisit,
  sceneUrl = defaultSceneUrl,
  bossVictories: readonly BossVictory[] = [],
): string => `
<p class="world-intro" data-i18n="webviews:worldRender.chooseAPlaceToExploreWithYourCompanion">${escapeHtml(IntlModule.translate("worldRender.chooseAPlaceToExploreWithYourCompanion"))}</p>
<div class="world-grid">${REGIONS_BY_DIFFICULTY.map((region) => {
  const field = getField(region)
  const progress = getRegionProgress(region.id, registered)
  return `<button class="region-card" type="button" data-region="${region.id}" aria-label="${escapeHtml(IntlModule.translate("world.explore", { name: region.name }))}">
    <span class="region-card-thumbnail"><img src="${escapeHtml(sceneUrl(region.defaultLocationId))}" alt="" width="160" height="160">${bossVictories.some((victory) => victory.regionId === region.id) ? bossStar() : ""}</span>
    <span class="region-card-meta">${field.code}${visit.regionId === region.id ? `<span class="world-here" data-i18n="webviews:worldRender.here">${escapeHtml(IntlModule.translate("worldRender.here"))}</span>` : ""}</span>
    <strong>${escapeHtml(region.name)}</strong><small class="region-difficulty">${escapeHtml(IntlModule.translate(`world.difficulty.${region.difficulty}`))}</small><small>${escapeHtml(IntlModule.translate("world.registeredCount", { count: progress.registered, total: progress.total }))}</small></button>`
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
          `<div class="resident-row">${resident.artwork ? `<svg data-monster-id="${escapeHtml(resident.id)}" viewBox="${resident.artworkViewBox}" aria-hidden="true"><path d="${resident.artwork}"/></svg>` : `<span class="resident-art-missing" aria-label="${escapeHtml(IntlModule.translate("worldRender.artworkUnavailable"))}" data-i18n-aria-label="webviews:worldRender.artworkUnavailable">?</span>`}<div><strong>${escapeHtml(resident.name)}</strong><small>${escapeHtml(residentStage(resident))}</small></div>${resident.registered ? `<button type="button" data-world-dex="${resident.id}" aria-label="${escapeHtml(IntlModule.translate("world.openInDex", { name: resident.name }))}">✓<span data-i18n="webviews:worldRender.dex">${escapeHtml(IntlModule.translate("worldRender.dex"))}</span></button>` : `<span class="resident-unregistered" aria-label="${escapeHtml(IntlModule.translate("worldRender.notRegistered"))}" data-i18n-aria-label="webviews:worldRender.notRegistered">—</span>`}</div>`,
      )
      .join("")
  const remaining = model.residents.length - 5
  const nextRegion =
    REGIONS_BY_DIFFICULTY[
      (REGIONS_BY_DIFFICULTY.findIndex((candidate) => candidate.id === region.id) + 1) % REGIONS_BY_DIFFICULTY.length
    ]!
  return `<nav class="world-region-navigation" aria-label="${escapeHtml(IntlModule.translate("worldRender.allRegions"))}"><button class="world-back text-action" type="button" data-world-back data-i18n="webviews:worldRender.allRegions">${escapeHtml(IntlModule.translate("worldRender.allRegions"))}</button><button class="world-next text-action" type="button" data-region="${nextRegion.id}" data-i18n="webviews:worldRender.nextRegion">${escapeHtml(IntlModule.translate("worldRender.nextRegion"))}</button></nav>
    <div class="world-preview"><img id="world-preview-image" src="${escapeHtml(sceneUrl(selected.id))}" alt="${escapeHtml(IntlModule.translate("world.landscape", { name: selected.name }))}"><span>${escapeHtml(field.name)}</span></div>
    <h3 class="region-title">${escapeHtml(region.name)}</h3><p class="setting-caption region-difficulty">${escapeHtml(IntlModule.translate(`world.difficulty.${region.difficulty}`))}</p><p class="section-description">${escapeHtml(region.description)}</p>
    <p class="setting-caption">${escapeHtml(field.description)}</p>
    <div class="world-locations" role="group" aria-label="${escapeHtml(IntlModule.translate("worldRender.locations"))}" data-i18n-aria-label="webviews:worldRender.locations">${locations.map((location) => `<button type="button" data-location="${location.id}" aria-pressed="${location.id === selected.id}">${escapeHtml(location.name)}</button>`).join("")}</div>
    <button id="world-travel" class="primary-action" type="button" data-location="${selected.id}"><span>${escapeHtml(IntlModule.translate(visit.locationId === selected.id ? "world.youAreHere" : "world.travelHere"))}</span><span aria-hidden="true">→</span></button>
    <section class="world-bosses"><h3 data-i18n="webviews:world.bosses">${escapeHtml(IntlModule.translate("world.bosses"))}</h3><div class="resident-list">${(model.bosses ?? []).map((boss) => `<div class="resident-row"><svg data-monster-id="${escapeHtml(boss.id)}" viewBox="${escapeHtml(boss.artworkViewBox)}" aria-hidden="true"><path d="${escapeHtml(boss.artwork)}"/></svg><div><strong>${escapeHtml(boss.name)}</strong><small>${escapeHtml(residentStage(boss))}</small></div>${boss.defeated ? bossStar() : ""}</div>`).join("")}</div></section>
    <section class="world-inhabitants"><div class="section-heading"><h3 data-i18n="webviews:worldRender.habitatGuide">${escapeHtml(IntlModule.translate("worldRender.habitatGuide"))}</h3><span class="value-badge">${model.residents.length}</span></div>
      <p class="section-description" data-i18n="webviews:worldRender.speciesThatLiveHereVisitingKeepsYourDex">${escapeHtml(IntlModule.translate("worldRender.speciesThatLiveHereVisitingKeepsYourDex"))}</p>
      <div class="resident-list">${renderResidents(model.residents.slice(0, 5))}</div>
      ${remaining > 0 ? `<details class="resident-more"><summary><span class="residents-expand">${escapeHtml(IntlModule.translate("world.showMore", { count: remaining }))}</span><span class="resident-arrow" aria-hidden="true">⌄</span></summary><div class="resident-list">${renderResidents(model.residents.slice(5))}</div></details>` : ""}
    </section>`
}

export const worldStyles = worldStylesSource
