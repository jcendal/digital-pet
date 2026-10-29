;(() => {
  const root = document.getElementById("team-members")
  if (!root) return
  let model
  let eggs = []
  let chosen = 0
  let expected
  let pending = false
  const byId = (id) => document.getElementById(id)
  const copy = (key, values) => getIntlModule().scope("webviews").translate(key, values)
  const send = (action) => window.dispatchEvent(new CustomEvent("digital-pet:team-action", { detail: action }))
  const expectation = () => ({
    expectedRevision: model.revision,
    expectedPrincipalId: model.principal?.partnerId ?? null,
    expectedReserveId: model.reserve?.partnerId ?? null,
  })
  const svg = (member) => {
    const art = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    art.dataset.monsterId = member.nodeId
    art.dataset.eggOrigin = member.originEggId ?? ""
    art.setAttribute("viewBox", member.viewBox)
    art.setAttribute("aria-hidden", "true")
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", member.artwork)
    art.append(path)
    return art
  }
  const render = () => {
    root.replaceChildren()
    for (const slot of ["principal", "reserve"]) {
      const member = model[slot]
      const row = document.createElement(member ? "a" : "article")
      row.className = "team-member"
      if (member) {
        row.href = `/dex?selected=${encodeURIComponent(member.nodeId)}`
        row.dataset.teamSlot = slot
        row.addEventListener("click", (event) => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          window.dispatchEvent(new CustomEvent("digital-pet:navigate", { detail: row.getAttribute("href") }))
        })
      }
      if (member) row.append(svg(member))
      else {
        const empty = document.createElement("span")
        empty.className = "team-empty-art"
        empty.textContent = "—"
        empty.setAttribute("aria-hidden", "true")
        row.append(empty)
      }
      const detail = document.createElement("div")
      const role = document.createElement("p")
      role.className = "team-caption"
      role.textContent = copy(`team.${slot}`)
      const title = document.createElement("h3")
      title.textContent = member?.name ?? copy("team.empty")
      detail.append(role, title)
      if (member) {
        const stage = document.createElement("p")
        stage.className = "team-caption"
        stage.textContent =
          member.stageKey && getIntlModule().locale !== "en"
            ? getIntlModule().translate(member.stageKey, {}, "core")
            : member.stage
        detail.append(stage)
      }
      row.append(detail)
      root.append(row)
    }
    byId("team-switch").disabled = pending || !model.canSwitch
  }
  const renderEgg = () => {
    const egg = eggs[chosen]
    if (!egg) return
    byId("egg-name").textContent = egg.name
    byId("egg-preview").querySelector("path").setAttribute("d", egg.artwork)
    byId("egg-preview").dataset.monsterId = "0-001"
    byId("egg-preview").dataset.eggOrigin = egg.id
    byId("egg-preview").setAttribute("viewBox", egg.viewBox)
    byId("egg-unlock").textContent = egg.unlocked ? copy("eggs.available") : egg.hint
    byId("egg-create").textContent = copy("eggs.chooseThis")
    byId("egg-create").disabled = pending || !egg.unlocked || !model?.canCreate
    const slot = byId("egg-slot").value
    byId("egg-replacement").textContent = model?.[slot]
      ? copy("eggs.replaces", { name: model[slot].name })
      : copy("eggs.freeSlot")
  }
  const openEggs = (id) => {
    if (!model?.canCreate || !eggs.length) return
    expected = expectation()
    chosen = Math.max(
      0,
      eggs.findIndex((egg) => egg.id === id),
    )
    byId("egg-slot").value = model.reserve ? "principal" : "reserve"
    byId("egg-status").textContent = ""
    renderEgg()
    byId("egg-carousel").showModal()
  }
  byId("team-switch").addEventListener("click", () => {
    if (!model?.canSwitch || pending) return
    pending = true
    send({ kind: "switch", ...expectation() })
    render()
  })
  byId("egg-close").addEventListener("click", () => byId("egg-carousel").close())
  byId("egg-previous").addEventListener("click", () => {
    chosen = (chosen + eggs.length - 1) % eggs.length
    renderEgg()
  })
  byId("egg-next").addEventListener("click", () => {
    chosen = (chosen + 1) % eggs.length
    renderEgg()
  })
  let swipeStart = null
  byId("egg-carousel").addEventListener(
    "touchstart",
    (event) => {
      swipeStart = event.touches[0]?.clientX ?? null
    },
    { passive: true },
  )
  byId("egg-carousel").addEventListener(
    "touchend",
    (event) => {
      const end = event.changedTouches[0]?.clientX
      if (swipeStart !== null && end !== undefined && Math.abs(end - swipeStart) > 48 && eggs.length) {
        chosen = (chosen + (end < swipeStart ? 1 : -1) + eggs.length) % eggs.length
        renderEgg()
      }
      swipeStart = null
    },
    { passive: true },
  )
  byId("egg-slot").addEventListener("change", renderEgg)
  byId("egg-carousel").addEventListener("keydown", (event) => {
    if (event.target.closest("select") || !["ArrowLeft", "ArrowRight"].includes(event.key)) return
    event.preventDefault()
    chosen = (chosen + (event.key === "ArrowLeft" ? -1 : 1) + eggs.length) % eggs.length
    renderEgg()
  })
  byId("egg-create").addEventListener("click", () => {
    if (pending || !eggs[chosen]?.unlocked || !expected) return
    pending = true
    send({ ...expected, kind: "create-egg", familyId: eggs[chosen].id, slot: byId("egg-slot").value })
    renderEgg()
  })
  window.addEventListener("digital-pet:new-egg", () => openEggs("starter"))
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return
    const data = event.data
    if (data?.type === "team-model") {
      model = data.model
      render()
    }
    if (data?.type === "eggs-model") {
      eggs = data.eggs
      if (byId("egg-carousel").open) renderEgg()
    }
    if (data?.type === "team-result") {
      pending = false
      byId("team-status").textContent = data.message
      byId("egg-status").textContent = data.message
      if (data.accepted) byId("egg-carousel").close()
      if (model) render()
      renderEgg()
    }
  })
})()
