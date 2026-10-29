;(() => {
  const $ = (selector) => document.querySelector(selector)
  const $$ = (selector) => [...document.querySelectorAll(selector)]
  const escapeHtml = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    )
  const monster = (name, className = "") =>
    `<div class="monster ${className}"><svg viewBox="0 0 16 16" aria-hidden="true"><use href="./monsters.svg#${escapeHtml(name)}"/></svg></div>`
  // Mirrors the existing pairing transport's format; these remain isolated design fixtures.
  const normalizeCode = (value) => value.toUpperCase().replace(/[\s-]/g, "")
  const validCode = (value) => /^[A-HJ-NP-Z2-9]{16}$/.test(value)
  const displayCode = (value) => value.match(/.{1,4}/g)?.join("-") ?? value
  const ownCode = "K7MD9QXR4NWA6TBY"
  const friends = [
    {
      alias: "sbugallo",
      code: "R8FA3VPC7HNK2MZW",
      species: "greymon",
      stage: "CHAMPION",
      online: true,
    },
    { alias: "marta", code: "D4YE8BRS2XGK9QNF", species: "gabumon", stage: "ROOKIE", online: false },
    { alias: "dani", code: "T6NW4ZMA8KRD3VYH", species: "patamon", stage: "ROOKIE", online: false },
  ]
  const team = [
    { species: "agumon", stage: "ROOKIE", label: "COMPAÑERO ACTUAL" },
    { species: "tentomon", stage: "ROOKIE", label: "RESERVA" },
  ]
  let ownAlias = "jcendal"
  let currentSpecies = "agumon"
  let currentFriend = friends[0]
  let chosenSpecies = "tentomon"
  let timer
  let tradeFinished = false
  let dialogRevision = 0
  const sentGifts = new Set()
  const resolvedInbox = new Set()
  const dialog = $("#action-dialog")
  const outboxKey = "digital-pet:multiplayer-design:outbox:v1"
  const outgoingRequests = new Map()

  function loadOutbox() {
    try {
      const saved = localStorage.getItem(outboxKey)
      if (saved === null) {
        outgoingRequests.set("Y8KC4TNB7RWA2VDF", {
          code: "Y8KC4TNB7RWA2VDF",
          alias: "noa",
          id: crypto.randomUUID(),
          state: "unavailable",
          attempts: 1,
        })
        saveOutbox()
        return
      }
      const records = JSON.parse(saved)
      if (!Array.isArray(records)) return
      for (const item of records.slice(0, 30)) {
        if (
          !item ||
          typeof item.code !== "string" ||
          !validCode(item.code) ||
          item.code === ownCode ||
          typeof item.id !== "string" ||
          item.id.length > 64
        )
          continue
        outgoingRequests.set(item.code, {
          code: item.code,
          alias: typeof item.alias === "string" && /^[a-z0-9]{3,16}$/i.test(item.alias) ? item.alias : "",
          id: item.id,
          state: item.state === "awaiting_acceptance" ? item.state : "unavailable",
          attempts: Number.isSafeInteger(item.attempts) ? Math.max(0, Math.min(item.attempts, 100)) : 0,
        })
      }
    } catch {
      /* The design stays usable when browser storage is unavailable. */
    }
  }

  function saveOutbox() {
    try {
      localStorage.setItem(outboxKey, JSON.stringify([...outgoingRequests.values()]))
    } catch {
      notify("No se ha podido guardar el pendiente en este navegador.")
    }
  }

  function renderOutgoingRequests() {
    $("#outgoing-requests").innerHTML = [...outgoingRequests.values()]
      .map(
        (entry) => `<article class="activity-item" id="outgoing-${entry.code}">
      <span class="eyebrow" role="status">${entry.state === "connecting" ? "CONECTANDO…" : entry.state === "awaiting_acceptance" ? "ENVIADA · ESPERANDO ACEPTACIÓN" : "SIN ENTREGAR · SIN RESPUESTA"}</span>
      <h3>${escapeHtml(entry.alias || "JUGADOR")}</h3><p class="hint request-code">${displayCode(entry.code)}</p>
      ${entry.state === "unavailable" ? "" : `<p class="hint">${entry.state === "connecting" ? "Intentando conectar con el otro jugador." : "El otro navegador ha confirmado la recepción. Falta que acepte la amistad."}</p>`}
      <div class="actions">${entry.state === "unavailable" ? `<button type="button" class="primary" data-retry-request="${entry.code}">Reintentar</button>` : ""}<button type="button" data-cancel-request="${entry.code}">Cancelar</button></div></article>`,
      )
      .join("")
    renderInbox()
  }

  function attemptRequest(code, alias = "") {
    if (!validCode(code)) return notify("El enlace no contiene un código válido.")
    if (code === ownCode) return notify("Este es tu propio código.")
    if (!ownAlias) return notify("Elige tu alias en Perfil antes de enviar solicitudes.")
    if (friends.some((friend) => friend.code === code)) return notify("Ya está en tus amigos.")
    const existing = outgoingRequests.get(code)
    if (existing?.state === "awaiting_acceptance") {
      showView("activity")
      return notify("Ya hay una solicitud recibida pendiente de aceptación.")
    }
    const request = existing ?? { code, alias, id: crypto.randomUUID(), attempts: 0 }
    request.attempts += 1
    request.state = "connecting"
    outgoingRequests.set(code, request)
    saveOutbox()
    showView("activity")
    renderOutgoingRequests()
    const attempt = request.attempts
    setTimeout(() => {
      if (outgoingRequests.get(code) !== request || request.attempts !== attempt) return
      // Fixture: Kenji is online; Noa reconnects before the second attempt.
      const available = code === "B9XT7RME4VNK6DPA" || (code === "Y8KC4TNB7RWA2VDF" && attempt >= 2)
      request.state = available ? "awaiting_acceptance" : "unavailable"
      if (available) request.alias = code === "B9XT7RME4VNK6DPA" ? "kenji" : "noa"
      saveOutbox()
      renderOutgoingRequests()
      if (available) addLog("SOLICITUD RECIBIDA", `${request.alias} · Esperando aceptación`)
      notify(
        available
          ? "Recepción confirmada. Pendiente de aceptación."
          : "Sin respuesta. Puedes reintentar desde Actividad.",
      )
    }, 1100)
  }

  function invitationUrl() {
    const url = new URL(location.href)
    url.search = ""
    url.hash = `invite?${new URLSearchParams({ code: ownCode, alias: ownAlias })}`
    return url.href
  }

  function openInvitation(fragment) {
    const parameters = new URLSearchParams(fragment.slice("invite?".length))
    const code = normalizeCode(parameters.get("code") ?? "")
    const proposedAlias = parameters.get("alias") ?? ""
    const alias = /^[a-z0-9]{3,16}$/i.test(proposedAlias) ? proposedAlias : ""
    if (!validCode(code))
      return openDialog(
        "ENLACE NO VÁLIDO",
        "INVITACIÓN",
        '<p class="hint">La invitación no contiene un código completo. Pide que te envíen el enlace de nuevo.</p><button type="button" class="full" data-close>Cerrar</button>',
      )
    const own = code === ownCode
    openDialog(
      alias ? `${alias} TE INVITA` : "INVITACIÓN DE AMISTAD",
      "DIGITAL PET · CONECTAR",
      `<div class="arrival-hero"><svg class="invitation-avatar" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3h6v6H9zM6 12h12v3h3v6H3v-6h3z"/></svg><h3>${escapeHtml(alias || "UN NUEVO AMIGO")}</h3><span class="eyebrow request-code">${displayCode(code)}</span></div><p class="hint">${own ? "Esta invitación contiene tu propio código." : "El alias se confirmará al conectar. Ambos debéis tener la aplicación abierta para enviar y recibir la solicitud."}</p><button type="button" class="primary full" data-invite-request="${code}" data-invite-alias="${escapeHtml(alias)}" ${own ? "disabled" : ""}>Intentar enviar solicitud</button><button type="button" class="full" data-close>Ahora no</button>`,
    )
  }

  function hydrateMonsters(root = document) {
    for (const element of root.querySelectorAll("[data-monster]")) {
      element.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><use href="./monsters.svg#${escapeHtml(element.dataset.monster)}"/></svg>`
    }
  }

  function notify(message) {
    clearTimeout(timer)
    $("#notice").textContent = message
    $("#notice").hidden = false
    timer = setTimeout(() => {
      $("#notice").hidden = true
    }, 4500)
  }

  function showView(view, updateHash = true) {
    if (!ownAlias) view = "profile"
    if (view === "activity") renderInbox()
    for (const section of $$(".panels > section")) section.hidden = section.id !== view
    const isCombat = ["arena", "friends", "activity"].includes(view)
    $(".dex-tabs").hidden = !isCombat
    for (const tab of $$("[role=tab]")) {
      tab.setAttribute("aria-selected", String(tab.id === `tab-${view}`))
      tab.tabIndex = tab.id === `tab-${view}` ? 0 : -1
    }
    $("#page-name").textContent = isCombat ? "COMBATE" : view === "profile" ? "PERFIL" : "DIGIDEX"
    $("#footer-label").textContent = isCombat ? "VPET · CONEXIÓN ENTRE JUGADORES" : "VPET · ARCHIVO DE DATOS"
    $("#combat-nav").removeAttribute("aria-current")
    $("#more-button").removeAttribute("aria-current")
    if (isCombat) $("#combat-nav").setAttribute("aria-current", "page")
    if (view === "profile") $("#more-button").setAttribute("aria-current", "page")
    $("#more-menu").hidden = true
    $("#more-button").setAttribute("aria-expanded", "false")
    $("#notice").hidden = true
    $(".panels").scrollTop = 0
    if (updateHash) history.replaceState(null, "", `#${view}`)
  }

  function renderFriends() {
    $("#friend-count").textContent = String(friends.length).padStart(2, "0")
    $("#friend-list").innerHTML = friends
      .map(
        (friend, index) => `<article class="friend">
      <div class="friend-heading"><button type="button" class="avatar-button" data-avatar-details="${index}" aria-label="Ver miniatura de ${escapeHtml(friend.alias)}: ${friend.species}">${monster(friend.species)}</button><div class="friend-identity"><h3>${escapeHtml(friend.alias)}</h3><p class="friend-code">${displayCode(friend.code)}</p></div><button type="button" class="remove-friend" data-remove="${index}" aria-label="Eliminar a ${escapeHtml(friend.alias)}">×</button></div>
      <div class="presence"><span>${friend.online ? "■ EN LÍNEA" : "□ SIN CONEXIÓN"}</span><span>${friend.species.toUpperCase()} · ${friend.stage}</span></div>
      <div class="friend-actions"><button type="button" ${friend.online ? 'class="primary"' : "disabled"} data-friend-challenge="${index}">Retar</button><button type="button" data-gift="${index}" ${sentGifts.has(friend.code) || !friend.online ? "disabled" : ""}>${sentGifts.has(friend.code) ? "Enviado ✓" : "Regalo"}</button><button type="button" data-trade="${index}" ${friend.online ? "" : 'disabled title="Tu amigo debe estar conectado"'}>Intercambiar</button></div>
    </article>`,
      )
      .join("")
  }

  function openDialog(title, eyebrow, content) {
    dialogRevision += 1
    $("#dialog-title").textContent = title
    $("#dialog-eyebrow").textContent = eyebrow
    $("#dialog-content").innerHTML = content
    $("#dialog-close").disabled = false
    if (!dialog.open) dialog.showModal()
    dialog.scrollTop = 0
    return dialogRevision
  }

  function closeDialog() {
    dialogRevision += 1
    dialog.close()
  }

  function later(callback, delay, revision = dialogRevision) {
    setTimeout(() => {
      if (dialog.open && revision === dialogRevision) callback()
    }, delay)
  }

  function personHeader(friend) {
    return `<div class="dialog-person"><h3>${escapeHtml(friend.alias)}</h3><span class="eyebrow">${displayCode(friend.code)}</span></div>`
  }

  function addLog(title, description) {
    const entry = document.createElement("div")
    entry.className = "log-row"
    const name = document.createElement("span")
    name.textContent = title
    const detail = document.createElement("span")
    detail.className = "hint"
    detail.textContent = description
    entry.append(name, detail)
    $("#activity-log").prepend(entry)
  }

  function resolvePending(id, message) {
    resolvedInbox.add(id.slice(1))
    renderInbox()
    notify(message)
  }

  function renderInbox() {
    let count = 0
    for (const group of $$("[data-inbox-group]")) {
      const items = [...group.querySelectorAll(".activity-item")]
      for (const item of items) item.hidden = resolvedInbox.has(item.id)
      const groupCount = items.filter((item) => !resolvedInbox.has(item.id)).length
      group.querySelector(".group-count").textContent = String(groupCount).padStart(2, "0")
      group.querySelector(".group-empty").hidden = groupCount > 0
      count += groupCount
    }
    $("#pending-count").textContent = `${String(count).padStart(2, "0")} EN TOTAL`
    $("#activity-count").textContent = String(count)
    $("#activity-heading").textContent = "PENDIENTES"
  }

  function renderAvatar() {
    $("#profile-avatar").dataset.monster = currentSpecies
    $("#profile-avatar-name").textContent = `COMPAÑERO ACTUAL · ${currentSpecies.toUpperCase()}`
    hydrateMonsters($(".profile-portrait"))
  }

  function openGift(friend) {
    if (!friend.online) return notify("Tu amigo debe estar conectado para recibir el regalo.")
    currentFriend = friend
    openDialog(
      "ENVIAR UN REGALO",
      "AMIGOS · REGALO",
      `${personHeader(friend)}
      <div class="arrival-hero"><svg class="food-art" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M7 1h2v4H7zM10 1h3v1h-1v1H9V2h1zM3 4h3v1h4V4h3v1h1v2h1v5h-1v2h-2v1H9v-1H7v1H4v-1H2v-2H1V7h1V5h1z"/><path fill="var(--lcd)" d="M3 6h3v1h4V6h3v1h1v5h-1v1h-2v1H9v-1H7v1H5v-1H3v-1H2V7h1z"/><path fill="currentColor" d="M4 8h1v3H4zM5 7h2v1H5zM11 11h2v1h-2z"/></svg><h3>UNA RACIÓN</h3><p class="hint">Comida para su compañero.</p></div>
      <p class="history-note">Puedes enviar una ración al día a cada amigo. Ambos debéis estar conectados para entregarla.</p>
      <button type="button" class="primary full" id="send-gift">Enviar a ${escapeHtml(friend.alias)}</button><button type="button" class="full" data-close>Cancelar</button>`,
    )
  }

  function openChallenge(friend) {
    currentFriend = friend
    openDialog(
      "RETAR A UN AMIGO",
      "ARENA · COMBATE",
      `${personHeader(friend)}
      <div class="trade-pair"><div><span class="eyebrow">TU COMPAÑERO</span>${monster(currentSpecies)}<p>${currentSpecies.toUpperCase()}</p></div><span class="exchange-arrow">VS</span><div><span class="eyebrow">SU COMPAÑERO</span>${monster(friend.species)}<p>${friend.species.toUpperCase()}</p></div></div>
      <p class="hint">Ambos debéis mantener la aplicación abierta. El combate comienza cuando tu amigo acepte.</p><button type="button" class="primary full" id="send-challenge">Enviar reto</button><button type="button" class="full" data-close>Cancelar</button>`,
    )
  }

  function openTrade(friend, incoming = false) {
    currentFriend = friend
    chosenSpecies = team.find((entry) => entry.species !== currentSpecies)?.species ?? team[0].species
    const available = team
    openDialog(
      "ELIGE A QUIÉN ENVIAR",
      `INTERCAMBIO · ${incoming ? "PROPUESTA RECIBIDA" : "PASO 1 DE 3"}`,
      `${personHeader(friend)}
      ${incoming ? '<p class="hint">Marta ofrece a Gabumon. Elige a quién enviarías a cambio.</p>' : '<p class="hint">Elige un Digimon de tu equipo. La otra persona elegirá el suyo después.</p>'}
      <div id="trade-selection">${available.map((entry) => `<button type="button" class="selection-row" data-select-species="${entry.species}" aria-pressed="${entry.species === chosenSpecies}">${monster(entry.species)}<span>${entry.species.toUpperCase()}<span class="eyebrow">${entry.stage} · ${entry.label}</span></span><b aria-hidden="true">${entry.species === chosenSpecies ? "✓" : "□"}</b></button>`).join("")}</div>
      <p class="hint">Los huevos y los Digimon ocupados no se pueden intercambiar.</p><button type="button" class="primary full" id="propose-trade" ${available.some((entry) => entry.species === chosenSpecies) ? "" : "disabled"}>${incoming ? "Revisar intercambio" : "Proponer intercambio"}</button><button type="button" class="full" data-close>Cancelar</button>`,
    )
    $("#propose-trade").dataset.incoming = String(incoming)
  }

  function reviewTrade() {
    openDialog(
      "REVISAR INTERCAMBIO",
      "INTERCAMBIO · PASO 2 DE 3",
      `${personHeader(currentFriend)}
      <div class="trade-pair"><div><span class="eyebrow">TÚ ENVÍAS</span>${monster(chosenSpecies)}<p>${chosenSpecies.toUpperCase()}</p><span class="eyebrow">ROOKIE</span></div><span class="exchange-arrow">↔</span><div><span class="eyebrow">TÚ RECIBES</span>${monster("gabumon")}<p>GABUMON</p><span class="eyebrow">ROOKIE</span></div></div>
      <div class="history-note"><p>■ Tu historial de ${chosenSpecies} terminará como «Enviado a ${escapeHtml(currentFriend.alias)}».</p><p>■ Gabumon comenzará un nuevo historial contigo: «Recibido de ${escapeHtml(currentFriend.alias)}».</p><p>Ambos conservan su etapa y EXP. Los historiales anteriores quedan con cada jugador.</p></div>
      <div class="confirmation-lines"><p>✓ ${escapeHtml(currentFriend.alias)} ha elegido a Gabumon.</p><p>□ Falta vuestra confirmación final.</p></div>
      ${currentFriend.online ? "" : '<p class="hint">Tu amigo está sin conexión. Ambos debéis estar en línea para confirmar.</p>'}
      <button type="button" class="primary full" id="confirm-trade" ${currentFriend.online ? "" : "disabled"}>${currentFriend.online ? "Confirmar intercambio" : "Esperando conexión"}</button><button type="button" class="full" id="change-offer">Cambiar mi Digimon</button><button type="button" class="text-button full" data-close>Cancelar intercambio</button>`,
    )
  }

  function animateTrade() {
    const revision = openDialog(
      "CONEXIÓN ESTABLECIDA",
      "INTERCAMBIO · PASO 3 DE 3",
      `
      <p class="phase-name" id="phase-name" role="status" aria-live="polite">PREPARANDO DATOS</p>
      <div class="trade-animation" data-phase="pack"><p class="travel-label">${escapeHtml(ownAlias)} → ${escapeHtml(currentFriend.alias)}</p><div class="transfer-track"></div><div class="transfer-gate left"></div><div class="transfer-gate right"></div>${monster(chosenSpecies, "traveler out")}${monster("gabumon", "traveler in")}<div class="data-packet"></div><div class="data-packet return"></div><p class="travel-label bottom">${chosenSpecies.toUpperCase()} ↔ GABUMON</p></div>
      <div class="phase-progress" aria-hidden="true"><span class="done"></span><span></span><span></span></div><p class="hint" id="phase-description">Vuestros Digimon se convierten en datos.</p>`,
    )
    $("#dialog-close").disabled = true
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    const pace = reduced ? 0.15 : 1
    later(
      () => {
        $(".trade-animation").dataset.phase = "travel"
        $("#phase-name").textContent = "CRUZANDO LA CONEXIÓN"
        $("#phase-description").textContent = "Los datos viajan en ambas direcciones."
        $$(".phase-progress span")[1].className = "done"
      },
      1400 * pace,
      revision,
    )
    later(
      () => {
        $(".trade-animation").dataset.phase = "reveal"
        $("#phase-name").textContent = "MATERIALIZANDO COMPAÑEROS"
        $("#phase-description").textContent = "Gabumon llega a tu equipo."
        $$(".phase-progress span")[2].className = "done"
      },
      4050 * pace,
      revision,
    )
    later(completeTrade, 5500 * pace, revision)
  }

  function completeTrade() {
    tradeFinished = true
    const slot = team.findIndex((entry) => entry.species === chosenSpecies)
    if (slot >= 0)
      team[slot] = {
        species: "gabumon",
        stage: "ROOKIE",
        label: chosenSpecies === currentSpecies ? "COMPAÑERO ACTUAL" : "RESERVA",
      }
    if (currentSpecies === chosenSpecies) setCompanion("gabumon")
    renderAvatar()
    if (!$("#incoming-trade").hidden && currentFriend.alias === "marta")
      resolvePending("#incoming-trade", "Intercambio completado.")
    addLog("INTERCAMBIO COMPLETADO", `${chosenSpecies} → ${currentFriend.alias} · Gabumon recibido`)
    openDialog(
      "INTERCAMBIO COMPLETADO",
      "CONEXIÓN · RECIBIDO",
      `<div class="arrival-hero">${monster("gabumon-happy")}<h3>¡HOLA, GABUMON!</h3><span class="eyebrow">ROOKIE · NUEVO EN TU EQUIPO</span></div><div class="history-note"><p>✓ ${chosenSpecies} está con ${escapeHtml(currentFriend.alias)}.</p><p>✓ Gabumon ya forma parte de tu equipo.</p></div><p class="hint">Su historia contigo empieza aquí.</p><button type="button" class="primary full" id="view-trade-history">Ver historiales</button><button type="button" class="full" data-close>Volver a Amigos</button>`,
    )
  }

  function renderJourney(received = true) {
    $("#journey-content").innerHTML =
      `<div class="history-switch"><button type="button" aria-pressed="${!received}" data-history="sent">ENVIADO</button><button type="button" aria-pressed="${received}" data-history="received">RECIBIDO</button></div>
      <div class="arrival-hero">${monster(received ? "gabumon" : chosenSpecies)}<h3>${received ? "GABUMON" : chosenSpecies.toUpperCase()}</h3><span class="eyebrow">${received ? "HISTORIA CONTIGO · EN CURSO" : "HISTORIA CONTIGO · CERRADA"}</span></div>
      <div class="timeline">${received ? `<div><span class="eyebrow">HOY · LLEGADA</span><h3>RECIBIDO DE ${escapeHtml(currentFriend.alias)}</h3><p class="hint">Gabumon · Rookie · EXP conservada.</p></div><div><span class="eyebrow">A PARTIR DE AHORA</span><h3>UNA NUEVA HISTORIA CONTIGO</h3><p class="hint">Aquí se registrarán vuestros próximos pasos.</p></div>` : `<div><span class="eyebrow">18 OCT · INICIO</span><h3>NACE UN NUEVO COMPAÑERO</h3><p class="hint">Pabumon comienza su viaje contigo.</p></div><div><span class="eyebrow">19 OCT · EVOLUCIÓN</span><h3>${chosenSpecies.toUpperCase()} · ROOKIE</h3></div><div><span class="eyebrow">HOY · FIN DE TU HISTORIA</span><h3>ENVIADO A ${escapeHtml(currentFriend.alias)}</h3><p class="hint">Su historia contigo queda guardada hasta este intercambio.</p></div>`}</div><button type="button" class="full" data-view="friends">Volver a Amigos</button>`
  }

  async function copyCode(button, value) {
    const label = button.textContent
    try {
      await navigator.clipboard.writeText(value)
      button.textContent = "Copiado ✓"
      setTimeout(() => {
        button.textContent = label
      }, 1800)
    } catch {
      notify(`Tu código: ${value}`)
    }
  }

  function setCompanion(species) {
    currentSpecies = species
    for (const entry of team) entry.label = entry.species === species ? "COMPAÑERO ACTUAL" : "RESERVA"
    const hero = $("#arena .fighter-hero")
    hero.querySelector(".monster").dataset.monster = species
    hero.querySelector("p").textContent = species.toUpperCase()
    hydrateMonsters(hero)
    renderAvatar()
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button")
    if (!button || button.disabled) return
    const data = button.dataset
    if (data.retryRequest) attemptRequest(data.retryRequest)
    if (data.cancelRequest) {
      outgoingRequests.delete(data.cancelRequest)
      saveOutbox()
      renderOutgoingRequests()
      notify("Pendiente cancelado en este navegador.")
    }
    if (data.inviteRequest) {
      closeDialog()
      attemptRequest(data.inviteRequest, data.inviteAlias)
    }
    if (button.id === "copy-invitation") copyCode(button, invitationUrl())
    if (data.avatarDetails !== undefined) {
      const friend = friends[Number(data.avatarDetails)]
      openDialog(
        friend.species.toUpperCase(),
        "COMPAÑERO ACTUAL",
        `${personHeader(friend)}<div class="arrival-hero">${monster(friend.species)}<h3>${friend.species.toUpperCase()}</h3></div><p class="hint">Este es el compañero activo de ${escapeHtml(friend.alias)}. La miniatura se actualiza cuando cambia de compañero.</p><button class="full" type="button" data-close>Volver a Amigos</button>`,
      )
    }
    if (data.view) showView(data.view)
    if (button.matches("[role=tab]")) showView(button.id.replace("tab-", ""))
    if (data.copy !== undefined) copyCode(button, displayCode(ownCode))
    if (data.close !== undefined) {
      closeDialog()
      if (tradeFinished) showView("friends")
    }
    if (data.context) {
      showView("context")
      $("#page-name").textContent = data.context
      $("#context-title").textContent = data.context
    }
    if (data.remove !== undefined) {
      currentFriend = friends[Number(data.remove)]
      openDialog(
        "ELIMINAR AMIGO",
        "AMIGOS",
        `${personHeader(currentFriend)}<p class="hint">Dejaréis de aparecer en vuestras listas de amigos. Se conservan los combates, regalos e intercambios anteriores.</p><button type="button" id="confirm-remove" class="primary full">Eliminar amistad</button><button type="button" class="full" data-close>Conservar amigo</button>`,
      )
    }
    if (data.gift !== undefined) openGift(friends[Number(data.gift)])
    if (data.friendChallenge !== undefined) openChallenge(friends[Number(data.friendChallenge)])
    if (data.challenge !== undefined) openChallenge(friends[0])
    if (data.trade !== undefined) openTrade(friends[Number(data.trade)])
    if (data.selectSpecies) {
      chosenSpecies = data.selectSpecies
      for (const option of $$("[data-select-species]")) {
        const selected = option === button
        option.setAttribute("aria-pressed", String(selected))
        option.querySelector("b").textContent = selected ? "✓" : "□"
      }
      $("#propose-trade").disabled = false
    }
    if (data.history) renderJourney(data.history === "received")
    if (data.pickCompanion) {
      setCompanion(data.pickCompanion)
      closeDialog()
      notify(`${data.pickCompanion} es tu compañero para combatir.`)
    }
    if (button.id === "more-button") {
      const open = $("#more-menu").hidden
      $("#more-menu").hidden = !open
      button.setAttribute("aria-expanded", String(open))
    }
    if (button.id === "dialog-close") closeDialog()
    if (button.id === "add-friend") {
      const open = $("#add-friend-form").hidden
      $("#add-friend-form").hidden = !open
      button.setAttribute("aria-expanded", String(open))
      if (open) $("#friend-code").focus()
    }
    if (button.id === "confirm-remove") {
      friends.splice(friends.indexOf(currentFriend), 1)
      renderFriends()
      closeDialog()
      notify("Amigo eliminado. Tus historiales se conservan.")
    }
    if (button.id === "send-gift") {
      sentGifts.add(currentFriend.code)
      addLog("REGALO ENVIADO", `Una ración para ${currentFriend.alias}`)
      renderFriends()
      openDialog(
        "REGALO ENVIADO",
        "AMIGOS · RECEPCIÓN CONFIRMADA",
        `${personHeader(currentFriend)}<p class="history-note">✓ Tu amigo ha recibido el regalo y lo ha guardado en su Actividad.</p><button type="button" class="primary full" data-close>Hecho</button>`,
      )
    }
    if (button.id === "accept-friend") {
      friends.push({
        alias: "laura",
        code: "W3HP6NTA9FRC2KXD",
        species: "gatomon",
        stage: "CHAMPION",
        online: false,
      })
      renderFriends()
      resolvePending("#incoming-friend", "Laura ya está en tus amigos.")
      addLog("AMISTAD ACEPTADA", "Laura · Ahora")
    }
    if (button.id === "decline-friend") resolvePending("#incoming-friend", "Solicitud rechazada.")
    if (button.id === "collect-gift") {
      resolvePending("#incoming-gift", "Ración recogida. Tu compañero ya puede comer.")
      addLog("REGALO RECOGIDO", "Una ración de Sbugallo")
    }
    if (button.id === "review-trade")
      openTrade(
        friends.find((friend) => friend.alias === "marta") ?? { alias: "marta", code: "D4YE8BRS2XGK9QNF" },
        true,
      )
    if (button.id === "change-offer") openTrade(currentFriend)
    if (button.id === "propose-trade") {
      if (data.incoming === "true") reviewTrade()
      else {
        const revision = openDialog(
          "PROPUESTA ENVIADA",
          "INTERCAMBIO · ESPERANDO",
          `${personHeader(currentFriend)}<p class="history-note">Ofreces a ${chosenSpecies}. ${escapeHtml(currentFriend.alias)} está eligiendo su Digimon.</p><p class="hint">Todavía no se ha enviado ningún Digimon.</p><button type="button" class="full" data-close>Cancelar propuesta</button>`,
        )
        later(reviewTrade, 1800, revision)
      }
    }
    if (button.id === "confirm-trade") {
      button.disabled = true
      button.textContent = "ESPERANDO CONFIRMACIÓN…"
      $(".confirmation-lines").innerHTML =
        `<p>✓ Has confirmado el intercambio.</p><p>□ Esperando a ${escapeHtml(currentFriend.alias)}.</p>`
      later(animateTrade, 1400)
    }
    if (button.id === "view-trade-history") {
      closeDialog()
      renderJourney()
      showView("journey")
    }
    if (button.id === "send-challenge") {
      button.disabled = true
      button.textContent = "ESPERANDO RESPUESTA…"
      later(
        () =>
          openDialog(
            "RETO ACEPTADO",
            "ARENA · AMBOS LISTOS",
            `<div class="trade-pair"><div>${monster("agumon")}<p>AGUMON</p></div><span>VS</span><div>${monster(currentFriend.species)}<p>${currentFriend.species.toUpperCase()}</p></div></div><p class="history-note">✓ Ambos habéis aceptado. Aquí comienza el combate con la animación actual del juego.</p><button class="primary full" type="button" data-close>Volver a Arena</button>`,
          ),
        1800,
      )
    }
    if (button.id === "copy-battle") copyCode(button, "323262")
    if (button.id === "choose-fighter")
      openDialog(
        "ELEGIR COMPAÑERO",
        "ARENA · EQUIPO",
        team
          .map(
            (entry) =>
              `<button type="button" class="selection-row" data-pick-companion="${entry.species}" aria-pressed="${entry.species === currentSpecies}">${monster(entry.species)}<span>${entry.species.toUpperCase()}<span class="eyebrow">${entry.stage} · ${entry.label}</span></span></button>`,
          )
          .join(""),
      )
    if (button.id === "options-context") {
      $("#more-menu").hidden = true
      $("#more-button").setAttribute("aria-expanded", "false")
      notify("Opciones mantiene sus ajustes actuales.")
    }
  })

  $(".dex-tabs").addEventListener("keydown", (event) => {
    const tabs = $$("[role=tab]")
    const index = tabs.indexOf(document.activeElement)
    if (index < 0) return
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1
    if (next < 0) return
    event.preventDefault()
    tabs[next].focus()
    showView(tabs[next].id.replace("tab-", ""))
  })
  dialog.addEventListener("cancel", (event) => {
    if ($("#dialog-close").disabled) event.preventDefault()
    else dialogRevision += 1
  })
  $("#profile-form").addEventListener("submit", (event) => {
    event.preventDefault()
    ownAlias = $("#alias").value.toLowerCase()
    $("#alias").value = ownAlias
    for (const element of $$("[data-own-alias]")) element.textContent = ownAlias
    $("#profile-heading").textContent = "TU PERFIL"
    $("#combat-nav").disabled = false
    $("#profile [data-view=friends]").disabled = false
    $("#profile-feedback").textContent = "Alias guardado."
    if (location.hash.startsWith("#invite?")) openRoute()
  })
  $("#add-friend-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const code = normalizeCode($("#friend-code").value)
    const feedback = $("#friend-feedback")
    if (!validCode(code)) {
      feedback.textContent = "Introduce los 16 caracteres del código permanente."
      return
    }
    if (code === ownCode) {
      feedback.textContent = "Este es tu propio código."
      return
    }
    if (friends.some((friend) => friend.code === code)) {
      feedback.textContent = "Ya está en tus amigos."
      return
    }
    if (code !== "B9XT7RME4VNK6DPA") {
      attemptRequest(code)
      return
    }
    openDialog(
      "¿AÑADIR A KENJI?",
      "AMIGOS · JUGADOR CONECTADO",
      `<div class="arrival-hero">${monster("patamon")}<h3>KENJI</h3><span class="eyebrow">B9XT-7RME-4VNK-6DPA</span></div><p class="hint">Kenji te muestra este alias al conectar. Revisa su código antes de enviar la solicitud.</p><button type="button" class="primary full" id="confirm-add-friend">Enviar solicitud</button><button type="button" class="full" data-close>Cancelar</button>`,
    )
    $("#confirm-add-friend").addEventListener(
      "click",
      () => {
        feedback.textContent = "Intentando enviar la solicitud a Kenji."
        $("#friend-code").value = ""
        closeDialog()
        attemptRequest(code, "kenji")
      },
      { once: true },
    )
  })
  $("#quick-battle").addEventListener("submit", (event) => {
    event.preventDefault()
    openChallenge(friends[0])
  })
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      $("#more-menu").hidden = true
      $("#more-button").setAttribute("aria-expanded", "false")
    }
  })
  function openRoute() {
    const view = location.hash.slice(1)
    if (dialog.open) closeDialog()
    if (view.startsWith("invite?")) {
      showView("friends", false)
      openInvitation(view)
      return
    }
    if (view === "setup") {
      ownAlias = ""
      $("#alias").value = ""
      $("#profile-feedback").textContent = ""
      $("#profile-heading").textContent = "ELIGE TU ALIAS"
      $("#combat-nav").disabled = true
      $("#profile [data-view=friends]").disabled = true
    }
    showView(["arena", "activity", "profile", "friends"].includes(view) ? view : "friends", false)
    if (view === "trade") openTrade(friends[0])
    if (view === "review") reviewTrade()
    if (view === "gift") openGift(friends[0])
    if (view === "history") {
      renderJourney()
      showView("journey", false)
    }
  }
  window.addEventListener("hashchange", openRoute)
  loadOutbox()
  renderOutgoingRequests()
  renderFriends()
  hydrateMonsters()
  openRoute()
  // Only the isolated design outbox survives reload; real saves and peer connections are never accessed.
})()
