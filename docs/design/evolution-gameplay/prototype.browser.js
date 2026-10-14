;(() => {
  const root = document.getElementById("evolution-gameplay-preview")
  const status = root.querySelector("#design-status")
  const dialog = root.querySelector("#design-confirmation")
  const titles = {
    companion: "Compañero",
    team: "Equipo",
    recruitment: "Encuentro",
    fusion: "Jogress",
    routes: "Dex",
    eggs: "Huevos",
    region: "Regiones",
    achievements: "Logros",
  }
  let pendingAction = () => {}
  const show = (view) => {
    for (const screen of root.querySelectorAll("[data-screen]")) screen.hidden = screen.dataset.screen !== view
    for (const button of root.querySelectorAll("[data-view]"))
      button.setAttribute("aria-pressed", String(button.dataset.view === view))
    root.querySelector("#design-title").textContent = titles[view]
    status.textContent = ""
  }
  const confirm = (title, description, action) => {
    root.querySelector("#confirmation-title").textContent = title
    root.querySelector("#confirmation-description").textContent = description
    pendingAction = action
    root.querySelector("#egg-slot-label").hidden = true
    dialog.showModal()
  }
  for (const button of root.querySelectorAll("[data-view], [data-go]")) {
    button.classList.add("cursor-interaction")
    button.addEventListener("click", () => show(button.dataset.view ?? button.dataset.go))
  }
  root.querySelector("#switch-partner").addEventListener("click", () => {
    const main = root.querySelector("#main-partner")
    const reserve = root.querySelector("#reserve-partner")
    const parent = main.parentNode
    parent.insertBefore(reserve, main)
    main.id = "reserve-partner"
    reserve.id = "main-partner"
    main.querySelector(".role-label").textContent = "Reserva"
    reserve.querySelector(".role-label").textContent = "Principal"
    const mainStage = main.querySelector("h3").textContent === "Garurumon" ? "Adulto" : "Niño"
    const reserveStage = reserve.querySelector("h3").textContent === "Garurumon" ? "Adulto" : "Niño"
    main.querySelector("p").textContent = `${mainStage} · Descansando`
    reserve.querySelector("p").textContent = `${reserveStage} · Lago Ojo de Dragón`
    status.textContent = `${reserve.querySelector("h3").textContent} es ahora el principal.`
  })
  for (const button of root.querySelectorAll("[data-replace]")) {
    button.addEventListener("click", () =>
      confirm(
        "Incorporar a Devimon",
        `Sustituirá al compañero en ${button.dataset.replace}. El anterior quedará en el Historial.`,
        () => {
          status.textContent = `Devimon se incorpora como ${button.dataset.replace}.`
        },
      ),
    )
  }
  root.querySelector("#decline-recruit").addEventListener("click", () => {
    status.textContent = "La aventura continúa con tu equipo actual."
  })
  root.querySelector("#fusion-button").addEventListener("click", () =>
    confirm(
      "Fusionar compañeros",
      "Garurumon y Devimon se convertirán en Orochimon. La reserva quedará libre. Los dos orígenes se conservarán en el Historial.",
      () => {
        root.querySelector("#fusion-button").disabled = true
        root.querySelector("#fusion-button").textContent = "Fusión completada"
        status.textContent = "Orochimon es tu principal. Tienes un hueco libre en reserva."
      },
    ),
  )
  for (const button of root.querySelectorAll("[data-egg]")) {
    button.addEventListener("click", () => {
      confirm(
        "Criar un huevo",
        `Elige dónde criar el huevo ${button.dataset.egg}. El compañero sustituido quedará en el Historial.`,
        () => {
          const slot = root.querySelector("#egg-slot").value
          status.textContent = `Huevo ${button.dataset.egg} en ${slot}. Actívalo para empezar a criarlo.`
        },
      )
      root.querySelector("#egg-slot-label").hidden = false
    })
  }
  root.querySelector("#confirm-action").addEventListener("click", () => {
    dialog.close()
    pendingAction()
  })
  root.querySelector("#cancel-action").addEventListener("click", () => dialog.close())
  for (const button of root.querySelectorAll("button")) button.classList.add("cursor-interaction")
})()
