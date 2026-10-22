import { IntlModule } from "../../shared/i18n.ts"
import { initBrowserInstallation } from "../features/installation/controller.ts"
import { initBrowserMusic } from "../features/music/controller.ts"
import { configureWebWorker } from "../platform/service-worker.ts"
import { initMoreMenu } from "./more-menu.browser.js"
import "./styles.css"
import { initBrowserTeam } from "../features/team/controller.ts"
;(() => {
  initBrowserInstallation()
  initBrowserMusic()
  const moreMenu = initMoreMenu()
  const frames = Array.from(document.querySelectorAll(".web-view"))
  const links = Array.from(document.querySelectorAll(".web-nav a"))
  const mapView = document.getElementById("world-map-view")
  const mapButton = document.getElementById("map-button")
  const dexView = document.getElementById("dex-view")
  const dexTabs = Array.from(document.querySelectorAll("[data-dex-page]"))
  const socialView = document.getElementById("social-view")
  const socialTabs = Array.from(document.querySelectorAll("[data-social-tab]"))
  const pageFromPath = (path) => {
    const url = new URL(path, location.origin)
    const tab = url.searchParams.get("tab")
    return url.pathname === "/dex"
      ? tab === "team"
        ? tab
        : "dex"
      : url.pathname === "/history"
        ? "history"
        : "sidebar"
  }
  const show = (path, preserveSelection = false) => {
    moreMenu.close()
    mapView.hidden = true
    mapButton.removeAttribute("aria-current")
    const page = pageFromPath(path)
    const hash = new URL(path, location.origin).hash.slice(1).split("?")[0]
    const social = ["combat", "friends", "activity", "profile", "invite"].includes(hash)
    const socialPage = ["friends", "activity", "profile"].includes(hash) ? hash : "arena"
    if (socialView.hidden || socialView.dataset.page !== socialPage)
      socialView.querySelector(".social-scroll").scrollTop = 0
    socialView.dataset.page = socialPage
    socialView.hidden = !social
    document.getElementById("social-tabs").hidden = socialPage === "profile"
    for (const panel of socialView.querySelectorAll(".social-scroll > section"))
      panel.hidden = panel.id !== `social-${socialPage}`
    for (const tab of socialTabs) {
      const selected = tab.dataset.socialTab === socialPage
      tab.setAttribute("aria-selected", String(selected))
      tab.tabIndex = selected ? 0 : -1
    }
    document.getElementById("social-page-name").textContent = IntlModule.translate(
      socialPage === "profile" ? "social.profile" : "social.combat",
    )
    const footer = document.getElementById("social-footer-label")
    footer.dataset.i18n = socialPage === "profile" ? "web:social.profileFooter" : "web:social.connectionFooter"
    footer.textContent = IntlModule.translate(
      socialPage === "profile" ? "social.profileFooter" : "social.connectionFooter",
    )
    document.getElementById("battle-button").toggleAttribute("aria-current", social && socialPage !== "profile")
    if (social && socialPage !== "profile")
      document.getElementById("battle-button").setAttribute("aria-current", "page")
    document.getElementById("more-button").toggleAttribute("aria-current", social && socialPage === "profile")
    if (social && socialPage === "profile") document.getElementById("more-button").setAttribute("aria-current", "page")
    dexView.hidden = social || page === "sidebar"
    for (const tab of dexTabs) {
      const selected = tab.dataset.dexPage === page
      tab.setAttribute("aria-selected", String(selected))
      tab.tabIndex = selected ? 0 : -1
    }
    for (const frame of frames) {
      const active = !social && frame.dataset.page === page
      frame.classList.toggle("active", active)
      if (active) frame.removeAttribute("aria-hidden")
      else frame.setAttribute("aria-hidden", "true")
    }
    document.getElementById("dex-team-panel").hidden = page !== "team"
    for (const link of links) {
      if (
        !social &&
        (link.dataset.page === page || (link.dataset.page === "dex" && ["history", "team"].includes(page)))
      )
        link.setAttribute("aria-current", "page")
      else link.removeAttribute("aria-current")
    }
    const frame = frames.find((frame) => frame.dataset.page === page)
    const deliver = () => {
      if (frame?.classList.contains("active"))
        frame.contentWindow?.postMessage(
          {
            type: "digital-pet:view-visible",
            selected: new URL(path, location.origin).searchParams.get("selected"),
            preserveSelection,
          },
          location.origin,
        )
    }
    if (frame?.contentDocument?.readyState === "complete") deliver()
    else frame?.addEventListener("load", deliver, { once: true })
  }
  const navigate = (path, preserveSelection = false) => {
    history.pushState(null, "", path)
    show(path, preserveSelection)
  }
  for (const [index, tab] of socialTabs.entries()) {
    const pathFor = (item) => `/#${item.dataset.socialTab === "arena" ? "combat" : item.dataset.socialTab}`
    tab.addEventListener("click", () => navigate(pathFor(tab)))
    tab.addEventListener("keydown", (event) => {
      let next = index
      if (event.key === "ArrowRight") next = (index + 1) % socialTabs.length
      else if (event.key === "ArrowLeft") next = (index + socialTabs.length - 1) % socialTabs.length
      else if (event.key === "Home") next = 0
      else if (event.key === "End") next = socialTabs.length - 1
      else return
      event.preventDefault()
      navigate(pathFor(socialTabs[next]))
      socialTabs[next].focus()
    })
  }
  document.getElementById("battle-button").addEventListener("click", () => navigate("/#combat"))
  document.getElementById("profile-button").addEventListener("click", () => navigate("/#profile"))
  for (const [index, tab] of dexTabs.entries()) {
    const pathFor = (page) => (page === "team" ? "/dex?tab=team" : `/${page}`)
    tab.addEventListener("click", () => navigate(pathFor(tab.dataset.dexPage), true))
    tab.addEventListener("keydown", (event) => {
      let next = index
      if (event.key === "ArrowRight") next = (index + 1) % dexTabs.length
      else if (event.key === "ArrowLeft") next = (index + dexTabs.length - 1) % dexTabs.length
      else if (event.key === "Home") next = 0
      else if (event.key === "End") next = dexTabs.length - 1
      else return
      event.preventDefault()
      navigate(pathFor(dexTabs[next].dataset.dexPage), true)
      dexTabs[next].focus()
    })
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
    if (
      typeof path === "string" &&
      /^\/(?:dex(?:\?(?:selected=[0-7]-[0-9]{3}|tab=team))?|history|#(?:combat|friends|activity|profile))?$/.test(path)
    )
      navigate(path)
  })
  import("../features/world/controller.ts").then((module) => module.initBrowserWorld()).catch(() => {})
  window.addEventListener("hashchange", () => show(location.pathname + location.search + location.hash))
  window.addEventListener("popstate", () => show(location.pathname + location.search + location.hash))
  show(location.pathname + location.search + location.hash)
  initBrowserTeam().catch((error) => {
    document.getElementById("team-status").textContent = String(error)
  })
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
