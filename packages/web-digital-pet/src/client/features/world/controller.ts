import { DEFAULT_WORLD_VISIT, getLocation, getRegion } from "@jcendal/digital-pet-fields/application/world.ts"
import { LOCATIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import type { WorldVisit } from "@jcendal/digital-pet-fields/domain/world.ts"
import type { WorldPanelModel } from "@jcendal/digital-pet-webviews/panels/world/world-model.ts"
import { renderWorldOverview, renderWorldRegion } from "@jcendal/digital-pet-webviews/panels/world/world-render.ts"
import { IntlModule } from "../../../shared/i18n.ts"
import { COMPUTER_WORLD_KEY, worldStoreFor } from "../../persistence/world-store.ts"
import { webAsset } from "../../platform/assets.ts"
import { checkComputerSave } from "../../platform/computer-save.ts"
import {
  ACTIVE_SOURCE_KEY,
  resolveSaveSource,
  type SaveSource,
  SOURCE_PREFERENCE_KEY,
} from "../../platform/save-source.ts"

export const initBrowserWorld = async (): Promise<void> => {
  const regions = document.querySelector<HTMLElement>("#world-regions")!
  const content = document.querySelector<HTMLElement>("#world-content")!
  const status = document.querySelector<HTMLElement>("#world-status")!
  const photos = new Set<string>(JSON.parse(regions.dataset.photos ?? "[]"))
  const frames = Array.from(document.querySelectorAll<HTMLIFrameElement>(".web-view"))
  let visit: WorldVisit = DEFAULT_WORLD_VISIT
  let source: SaveSource = "browser"
  let selectedRegion: string | null = null
  let revision = 0
  let model: WorldPanelModel = { registeredIds: [], residents: [] }
  const mapView = document.querySelector<HTMLElement>("#world-map-view")!
  let mapReady = false
  let mapSaving = false
  let mapError = ""
  const updateMap = () => {
    window.dispatchEvent(
      new CustomEvent("digital-pet:map-state", {
        detail: {
          locationId: visit.locationId,
          names: Object.fromEntries(LOCATIONS.map((place) => [place.id, place.name])),
          bossRegionIds: (model.bossVictories ?? []).map((victory) => victory.regionId),
          busy: !mapReady || mapSaving,
          error: mapError,
        },
      }),
    )
  }

  const applyVisit = () => {
    const place = getLocation(visit.locationId)
    const photo = photos.has(place.id)
      ? `linear-gradient(#0b171a44, #0b171a55), url('${webAsset(`/regions/${place.id}/background.png`)}') center / cover no-repeat`
      : `linear-gradient(160deg, ${place.atmosphere[0]}, ${place.atmosphere[1]})`
    document.documentElement.style.background = photo
    for (const frame of frames)
      frame.contentWindow?.postMessage(
        { type: "digital-pet:world-changed", locationId: place.id, name: place.name },
        location.origin,
      )
  }
  for (const frame of frames) frame.addEventListener("load", applyVisit)

  const loadModel = async (regionId: string, selectedSource: SaveSource): Promise<WorldPanelModel> => {
    if (selectedSource === "browser") return (await import("../../presentation/browser-session.ts")).world(regionId)
    const response = await fetch(`/api/world?region=${encodeURIComponent(regionId)}`, { cache: "no-store" })
    if (!response.ok) throw new Error(IntlModule.translate("controller.couldNotLoadYourWorldPleaseTryAgain"))
    const data = await response.json()
    if (data.mode === "browser")
      throw new Error(IntlModule.translate("controller.computerSaveIsUnavailableChooseThisBrowserIn"))
    return data
  }
  const render = () => {
    content.innerHTML = selectedRegion
      ? renderWorldRegion(getRegion(selectedRegion), model, visit, (id) => webAsset(`/regions/${id}/scene.svg`))
      : renderWorldOverview(
          new Set(model.registeredIds),
          visit,
          (id) => webAsset(`/regions/${id}/scene.svg`),
          model.bossVictories,
        )
    regions.scrollTop = 0
  }
  const refresh = async () => {
    const token = ++revision
    mapReady = false
    updateMap()
    const preferred = localStorage.getItem(SOURCE_PREFERENCE_KEY)
    const available = await checkComputerSave(document.documentElement.dataset.saveHost === "browser")
    const selectedSource = resolveSaveSource(preferred, available, localStorage.getItem(ACTIVE_SOURCE_KEY))
    const next = await worldStoreFor(selectedSource).load()
    if (token !== revision) return
    source = selectedSource
    visit = next
    mapReady = true
    mapError = ""
    applyVisit()
    updateMap()
    if (!mapView.hidden) {
      status.textContent = IntlModule.translate("controller.loadingHabitatGuide")
      const nextModel = await loadModel(selectedRegion ?? visit.regionId, source)
      if (token !== revision) return
      model = nextModel
      if (!regions.hidden) render()
      updateMap()
      status.textContent = ""
    }
  }
  const report = (error: unknown) => {
    const message = error instanceof Error ? error.message : IntlModule.translate("controller.couldNotLoadRegions")
    status.textContent = message
    mapError = message
    updateMap()
  }
  window.addEventListener("digital-pet:map-open", () => {
    updateMap()
    void refresh().catch(report)
  })
  window.addEventListener("digital-pet:map-travel", (event) => {
    const locationId: unknown = (event as CustomEvent).detail
    if (mapView.hidden || !mapReady || mapSaving || !LOCATIONS.some((place) => place.id === locationId)) return
    const place = getLocation(locationId as string)
    const next = { regionId: place.regionId, locationId: place.id }
    mapSaving = true
    mapError = ""
    updateMap()
    void worldStoreFor(source)
      .save(next)
      .then(async () => {
        await refresh()
        for (const frame of frames) frame.contentWindow?.postMessage({ type: "browser-save-updated" }, location.origin)
      })
      .catch(report)
      .finally(() => {
        mapSaving = false
        updateMap()
      })
  })
  window.addEventListener("digital-pet:map-section", () => {
    if (!mapView.hidden && !regions.hidden) void refresh().catch(report)
  })
  window.addEventListener("digital-pet:save-updated", () => {
    void refresh().catch(report)
  })
  window.addEventListener("storage", (event) => {
    if (event.key === SOURCE_PREFERENCE_KEY || event.key === COMPUTER_WORLD_KEY) void refresh().catch(report)
  })
  content.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
    if (!button) return
    if (button.dataset.region) {
      selectedRegion = button.dataset.region
      void refresh().catch(report)
    } else if (button.hasAttribute("data-world-back")) {
      selectedRegion = null
      render()
      void refresh().catch(report)
    } else if (button.dataset.worldDex) {
      window.dispatchEvent(
        new CustomEvent("digital-pet:navigate", {
          detail: `/dex?selected=${encodeURIComponent(button.dataset.worldDex)}`,
        }),
      )
    } else if (button.id === "world-travel") {
      const place = getLocation(button.dataset.location!)
      const next = { regionId: place.regionId, locationId: place.id }
      const travelSource = source
      button.disabled = true
      void worldStoreFor(travelSource)
        .save(next)
        .then(async () => {
          await refresh()
          window.dispatchEvent(new CustomEvent("digital-pet:navigate", { detail: "/" }))
        })
        .catch((error) => {
          button.disabled = false
          report(error)
        })
    } else if (button.dataset.location) {
      const place = getLocation(button.dataset.location)
      for (const item of Array.from(content.querySelectorAll<HTMLButtonElement>(".world-locations button")))
        item.setAttribute("aria-pressed", String(item === button))
      const preview = content.querySelector<HTMLImageElement>("#world-preview-image")!
      preview.src = webAsset(`/regions/${place.id}/scene.svg`)
      preview.alt = IntlModule.translate("controller.pixelLandscape", { name: place.name })
      const travel = content.querySelector<HTMLButtonElement>("#world-travel")!
      travel.dataset.location = place.id
      travel.querySelector("span")!.textContent =
        visit.locationId === place.id
          ? IntlModule.translate("controller.youAreHere")
          : IntlModule.translate("controller.travelHere")
    }
  })
  await refresh()
}
