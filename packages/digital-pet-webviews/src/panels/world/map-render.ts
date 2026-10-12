import { getLocation } from "@jcendal/digital-pet-fields/application/world.ts"
import { LOCATIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import { WORLD_MAP_PLACES, WORLD_MAP_SIZE } from "@jcendal/digital-pet-fields/data/world-map.ts"
import { IntlModule } from "../../i18n.ts"
import { escapeHtml } from "../../shared/escape-html.ts"
import mapClient from "./map-client.browser.js" with { type: "text" }

export const worldMapScript = mapClient

export const worldMapMarkup = (
  atlasUri: string,
  sceneUrl = (locationId: string) => `/regions/${locationId}/scene.svg`,
): string => {
  const copy = (key: string) => escapeHtml(IntlModule.translate(key))
  return `<main id="world-map-view" class="device map-device" hidden>
    <header class="masthead"><p class="brand" data-i18n="webviews:panelRender.digitalMonster">${copy("panelRender.digitalMonster")}</p><h1 data-i18n="webviews:map.title">${copy("map.title")}</h1></header>
    <section class="screen" aria-labelledby="map-location-name">
      <header class="map-heading"><p class="micro" data-i18n="webviews:worldRender.theDigitalWorld">${copy("worldRender.theDigitalWorld")}</p><h2 id="map-location-name"></h2></header>
      <div class="map-viewport"><div class="world-atlas" role="group" aria-label="${copy("map.destinations")}" data-i18n-aria-label="webviews:map.destinations">
        <img class="map-landscape" src="${escapeHtml(atlasUri)}" alt="" width="160" height="176" draggable="false">
        ${WORLD_MAP_PLACES.map((point) => {
          const place = getLocation(point.locationId)
          return `<button class="map-place" data-label-align="${point.x < 40 ? "left" : point.x > 110 ? "right" : "center"}" type="button" data-map-zone="${place.id}" data-region-id="${place.regionId}" data-name="${escapeHtml(place.name)}" style="left:${(point.x / WORLD_MAP_SIZE.width) * 100}%;top:${(point.y / WORLD_MAP_SIZE.height) * 100}%" aria-label="${escapeHtml(place.name)}" aria-pressed="false" aria-expanded="false" aria-controls="map-location-picker" disabled><span class="map-pin" aria-hidden="true"><svg viewBox="-2 -2 12 12"><path class="map-pin-brackets" fill="currentColor" d="M-2 1v-3h3v1h-2v2zM7-2h3v3H9v-2H7zM10 7v3H7V9h2V7zM1 10h-3V7h1v2h2z"/><path fill="currentColor" d="M3 0h2v1h1v1h1v1h1v2H7v1H6v1H5v1H3V7H2V6H1V5H0V3h1V2h1V1h1z"/><path fill="var(--lcd)" d="M3 2h2v1h1v2H5v1H3V5H2V3h1z"/></svg></span><span class="map-boss-star" hidden role="img" aria-label="${copy("world.bossDefeated")}" data-i18n-aria-label="webviews:world.bossDefeated"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 1h2v3h1v1h5v2h-2v1h-1v1h-1v2h1v3h-2v-1H9v-1H7v1H6v1H4v-3h1V9H4V8H3V7H1V5h5V4h1z"/></svg></span><span class="map-place-name">${escapeHtml(place.name)}</span></button>`
        }).join("")}
        <span id="map-traveler" aria-hidden="true" hidden><svg viewBox="0 0 12 18"><g class="map-traveler-body"><path fill="var(--ink)" d="M3 0h6v1h2v5h-1v2H9v1h2v3h1v3h-2v-2H9v3H3v-3H2v2H0v-3h1V9h2V8H2V6H1V2h2z"/><path fill="var(--lcd)" d="M3 4h6v3H3z"/><path fill="var(--lcd-edge)" d="M3 1h6v2H3zm1 9h4v4H4z"/><path fill="var(--ink)" d="M3 16h2v2H2v-1h1zm4 0h2v1h1v1H7z"/></g></svg></span>
      </div>
      <div id="map-location-picker" class="map-location-picker" role="group" aria-labelledby="map-picker-title" hidden>
        <header class="map-picker-header"><svg class="map-picker-icon" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M3 0h6v2h2v6H9v2H7v2H5v-2H3V8H1V2h2z"/><path fill="var(--lcd)" d="M4 3h4v4H4z"/></svg><span id="map-picker-title" data-i18n="webviews:map.chooseLocation">${copy("map.chooseLocation")}</span><button id="map-picker-close" type="button" aria-label="${copy("map.closeLocations")}" data-i18n-aria-label="webviews:map.closeLocations"><svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M1 0h2v2h2v2h2V2h2V0h2v2H9v2H7v2h2v2h2v2H9V8H7V6H5v2H3v2H1V8h2V6h2V4H3V2H1z"/></svg></button></header>
        ${LOCATIONS.map((place) => `<button type="button" class="map-location-option" data-map-location="${place.id}" data-region-id="${place.regionId}" data-name="${escapeHtml(place.name)}" aria-pressed="false" hidden><img class="map-option-preview" src="${escapeHtml(sceneUrl(place.id))}" alt="" width="32" height="32" draggable="false"><span class="map-option-name">${escapeHtml(place.name)}</span><svg class="map-option-direction" viewBox="0 0 8 12" aria-hidden="true"><path fill="currentColor" d="M0 0h2v2h2v2h2v2H4v2H2v2H0V8h2V6h2V4H2V2H0z"/></svg><svg class="map-option-current" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M10 1h2v3h-2v2H8v2H6v2H4V8H2V6H0V3h2v2h2v2h2V5h2V3h2z"/></svg></button>`).join("")}
      </div></div>
      <p id="map-status" role="status" aria-live="polite"></p>
      <p class="map-hint" data-i18n="webviews:map.hint">${copy("map.hint")}</p>
    </section>
    <footer class="footer"><span data-i18n="webviews:panelRender.vpetDataArchive">${copy("panelRender.vpetDataArchive")}</span><span class="case-dots" aria-hidden="true">▪▪▪</span></footer>
  </main>`
}
