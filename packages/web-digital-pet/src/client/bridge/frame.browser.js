import { LOCATIONS } from "@jcendal/digital-pet-fields/data/regions.ts"
import { webAsset } from "../platform/assets.ts"
import "./styles.css"

function initWebBridge(page, locationIds) {
  const key = "digital-pet:" + page
  let width = 40
  let busy = false
  let refreshRequested = false
  let dexSelection = null
  const hostBrowser = document.documentElement.dataset.saveHost === "browser"
  let scenery
  let localPresenter
  if (page === "sidebar")
    window.addEventListener(
      "DOMContentLoaded",
      async () => {
        scenery = (await import("../features/world/scenery.ts")).initPartnerScenery()
      },
      { once: true },
    )
  const deliver = (data) => window.dispatchEvent(new MessageEvent("message", { data }))
  const navigate = (path) => {
    if (window.parent === window) {
      location.href = path
      return
    }
    window.parent.postMessage({ type: "digital-pet:navigate", path }, location.origin)
  }
  const pageVisible = () =>
    document.visibilityState !== "hidden" && (!window.frameElement || window.frameElement.classList.contains("active"))
  const browserSave = () => {
    const preferred = localStorage.getItem("digital-pet:preferred-source")
    return preferred === "browser"
  }
  const refresh = async () => {
    if (!pageVisible()) return
    if (busy) {
      refreshRequested = true
      return
    }
    busy = true
    const preferred = localStorage.getItem("digital-pet:preferred-source")
    const deliverCurrent = (data) => {
      if (preferred !== localStorage.getItem("digital-pet:preferred-source")) {
        refreshRequested = true
        return
      }
      if (data.type === "dex-model" && dexSelection !== null) {
        const id = dexSelection === "current" ? data.model.currentNodeId : dexSelection
        dexSelection = null
        if (id) deliver({ type: "dex-select", id })
      }
      deliver(data)
      if (page === "sidebar" && data.type === "animation-frame") scenery?.update(data.motion)
    }
    try {
      const path = page === "sidebar" ? "/api/sidebar?width=" + width : "/api/" + page
      let data
      try {
        if (hostBrowser || browserSave()) data = { mode: "browser" }
        else {
          const response = await fetch(path, { cache: "no-store" })
          if (!response.ok) throw new Error("Could not read Digital Pet data")
          data = await response.json()
        }
      } catch (error) {
        if (preferred === "sqlite" || localStorage.getItem("digital-pet:source") !== "browser") throw error
        data = { mode: "browser" }
      }
      if (preferred !== localStorage.getItem("digital-pet:preferred-source")) {
        refreshRequested = true
        return
      }
      if (data.mode === "browser") {
        localStorage.setItem("digital-pet:source", "browser")
        const local = await import("../presentation/browser-session.ts")
        if (page === "sidebar") {
          localPresenter = local
          const snapshot = await local.sidebar(width)
          if (!local.isPresentingEvolution()) {
            deliverCurrent(snapshot.model)
            deliverCurrent(snapshot.frame)
          }
          const active = () =>
            pageVisible() && window.top.document.hasFocus() && !window.top.document.querySelector("dialog[open]")
          const valid = () =>
            preferred === localStorage.getItem("digital-pet:preferred-source") &&
            localStorage.getItem("digital-pet:source") === "browser"
          local.updateFoodButton(snapshot.food, width, deliverCurrent, active, valid, () => {
            window.parent.postMessage({ type: "digital-pet:save-changed" }, location.origin)
            refresh()
          })
          if (snapshot.pending)
            void local
              .presentPendingEvolution(width, deliverCurrent, active, valid, () => {
                window.parent.postMessage({ type: "digital-pet:save-changed" }, location.origin)
              })
              .catch((error) => {
                const notice = document.getElementById("empty")
                if (notice) {
                  notice.hidden = false
                  notice.textContent = String(error)
                }
              })
        } else {
          deliverCurrent({ type: page + "-model", model: await local[page]() })
        }
      } else {
        localPresenter?.cancelEvolutionPresentation()
        if (page === "sidebar")
          localPresenter?.updateFoodButton(
            null,
            width,
            deliverCurrent,
            () => false,
            () => false,
            () => {},
          )
        deliverCurrent({ type: "presentation-state", state: { phase: "idle" } })
        localStorage.setItem("digital-pet:source", "sqlite")
        if (page === "sidebar") {
          deliverCurrent(data.model)
          deliverCurrent(data.frame)
        } else {
          deliverCurrent({ type: page + "-model", model: data })
        }
      }
    } catch (error) {
      const notice = document.getElementById("notice") || document.getElementById("empty")
      if (notice) {
        notice.hidden = false
        notice.textContent = String(error)
      }
    } finally {
      busy = false
      if (refreshRequested) {
        refreshRequested = false
        queueMicrotask(refresh)
      }
    }
  }
  window.digitalPetBridge = {
    getState: () => {
      try {
        return JSON.parse(sessionStorage.getItem(key) || "null")
      } catch {
        return null
      }
    },
    setState: (state) => sessionStorage.setItem(key, JSON.stringify(state)),
    postMessage: (message) => {
      if (message.type === "artwork-width") {
        width = message.width
        return
      }
      if (message.type === "open-panel") {
        navigate("/" + message.panel)
        return
      }
      if (message.type === "history-dex") {
        navigate("/dex?selected=" + encodeURIComponent(message.id))
        return
      }
      if (message.type === "dex-reference") {
        if (localStorage.getItem("digital-pet:source") === "browser") {
          if (typeof message.url === "string" && message.url.startsWith("https://digimon.net/"))
            window.open(message.url, "_blank", "noopener")
        } else {
          window.open("/api/reference?id=" + encodeURIComponent(message.id) + "&source=sqlite", "_blank", "noopener")
        }
        return
      }
      if (message.type.endsWith("-ready")) {
        if (page === "dex" && dexSelection === null)
          dexSelection = new URLSearchParams(location.search).get("selected") || "current"
        refresh()
        setInterval(
          () => {
            if (pageVisible()) refresh()
          },
          page === "sidebar" ? 800 : 5000,
        )
        document.addEventListener("visibilitychange", () => {
          if (pageVisible()) refresh()
        })
        if (page === "dex") {
          const selected = new URLSearchParams(location.search).get("selected")
          if (selected) setTimeout(() => deliver({ type: "dex-select", id: selected }), 0)
        }
        return
      }
      if (message.type.endsWith("-refresh")) refresh()
    },
  }
  window.addEventListener("storage", (event) => {
    if (event.key === "digital-pet:preferred-source") {
      localPresenter?.cancelEvolutionPresentation()
      refresh()
    }
  })
  if (page === "sidebar") {
    document.addEventListener("click", (event) => {
      if (event.target.closest("#world-location"))
        window.parent.postMessage({ type: "digital-pet:world-open" }, location.origin)
    })
    window.addEventListener("message", (event) => {
      if (
        event.source !== window.parent ||
        event.origin !== location.origin ||
        event.data?.type !== "digital-pet:world-changed"
      )
        return
      if (!locationIds.includes(event.data.locationId)) return
      document.querySelector(".arena").style.backgroundImage =
        `url("${webAsset(`/regions/${event.data.locationId}/scene.svg`)}")`
      document.querySelector(".arena").dataset.locationId = event.data.locationId
      scenery?.setLocation(event.data.locationId)
      document.getElementById("world-location").textContent = event.data.name + " →"
    })
  }
  window.addEventListener("message", (event) => {
    if (
      event.source === window.parent &&
      event.origin === location.origin &&
      event.data?.type === "digital-pet:view-visible"
    ) {
      if (page === "dex") dexSelection = event.data.selected || "current"
      refresh()
    }
    if (
      event.source === window.parent &&
      event.origin === location.origin &&
      event.data?.type === "browser-save-updated"
    ) {
      localPresenter?.cancelEvolutionPresentation()
      refresh()
    }
  })
}

initWebBridge(
  document.body.dataset.page,
  LOCATIONS.map((place) => place.id),
)
