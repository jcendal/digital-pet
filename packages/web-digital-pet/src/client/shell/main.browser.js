import { initBrowserInstallation } from "../features/installation/controller.ts"
import { initBrowserMusic } from "../features/music/controller.ts"
import { configureWebWorker } from "../platform/service-worker.ts"
import { initMoreMenu } from "./more-menu.browser.js"
import "./styles.css"
;(() => {
  initBrowserInstallation()
  initBrowserMusic()
  const moreMenu = initMoreMenu()
  const frames = Array.from(document.querySelectorAll(".web-view"))
  const links = Array.from(document.querySelectorAll(".web-nav a"))
  const mapView = document.getElementById("world-map-view")
  const mapButton = document.getElementById("map-button")
  const pageFromPath = (path) => (path === "/dex" ? "dex" : path === "/history" ? "history" : "sidebar")
  const show = (path) => {
    moreMenu.close()
    mapView.hidden = true
    mapButton.removeAttribute("aria-current")
    const page = pageFromPath(new URL(path, location.origin).pathname)
    moreMenu.setCurrent(page === "history")
    for (const frame of frames) {
      const active = frame.dataset.page === page
      frame.classList.toggle("active", active)
      if (active) frame.removeAttribute("aria-hidden")
      else frame.setAttribute("aria-hidden", "true")
    }
    for (const link of links) {
      if (link.dataset.page === page) link.setAttribute("aria-current", "page")
      else link.removeAttribute("aria-current")
    }
    const frame = frames.find((frame) => frame.dataset.page === page)
    const deliver = () => {
      if (frame?.classList.contains("active"))
        frame.contentWindow?.postMessage(
          { type: "digital-pet:view-visible", selected: new URL(path, location.origin).searchParams.get("selected") },
          location.origin,
        )
    }
    if (frame?.contentDocument?.readyState === "complete") deliver()
    else frame?.addEventListener("load", deliver, { once: true })
  }
  const navigate = (path) => {
    history.pushState(null, "", path)
    show(path)
  }
  const showMap = () => {
    if (!mapView.hidden) return
    navigate("/")
    for (const frame of frames) {
      frame.classList.remove("active")
      frame.setAttribute("aria-hidden", "true")
    }
    for (const link of links) link.removeAttribute("aria-current")
    mapButton.setAttribute("aria-current", "page")
    mapView.hidden = false
    window.dispatchEvent(new Event("digital-pet:map-open"))
  }
  mapButton.addEventListener("click", showMap)
  for (const link of links)
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      navigate(link.getAttribute("href"))
    })
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return
    if (!frames.some((frame) => frame.contentWindow === event.source)) return
    if (event.data?.type === "digital-pet:map-open") {
      showMap()
      return
    }
    if (event.data?.type === "digital-pet:save-changed") {
      for (const frame of frames) frame.contentWindow?.postMessage({ type: "browser-save-updated" }, location.origin)
      window.dispatchEvent(new Event("digital-pet:save-updated"))
      return
    }
    if (event.data?.type !== "digital-pet:navigate") return
    navigate(event.data.path)
  })
  window.addEventListener("digital-pet:navigate", (event) => {
    const path = event.detail
    if (typeof path === "string" && /^\/(?:dex(?:\?selected=[0-7]-[0-9]{3})?|history)?$/.test(path)) navigate(path)
  })
  import("../features/world/controller.ts").then((module) => module.initBrowserWorld()).catch(() => {})
  window.addEventListener("popstate", () => show(location.pathname + location.search))
  show(location.pathname + location.search)
  import("../features/options/controller.ts")
    .then((module) => module.initBrowserOptions())
    .catch((error) => {
      const dialog = document.getElementById("options-dialog")
      document.getElementById("options-status").textContent = String(error)
      document.getElementById("options-button").addEventListener("click", () => {
        if (!dialog.open) dialog.showModal()
      })
    })
  window.addEventListener(
    "load",
    () => {
      void configureWebWorker().catch(() => {})
    },
    { once: true },
  )
})()
