export const initMoreMenu = () => {
  const wrapper = document.querySelector(".nav-more")
  const button = document.getElementById("more-button")
  const menu = document.getElementById("more-menu")
  const options = document.getElementById("options-dialog")
  const close = () => {
    const restoreFocus = !menu.hidden && menu.contains(document.activeElement)
    menu.hidden = true
    button.setAttribute("aria-expanded", "false")
    if (restoreFocus) button.focus()
  }
  const open = (focusFirst) => {
    menu.hidden = false
    button.setAttribute("aria-expanded", "true")
    if (focusFirst) menu.querySelector("button").focus()
  }
  button.addEventListener("click", (event) => {
    if (menu.hidden) open(event.detail === 0)
    else close()
  })
  button.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return
    event.preventDefault()
    open(true)
  })
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) close()
  })
  document.addEventListener("pointerdown", (event) => {
    if (!wrapper.contains(event.target)) close()
  })
  document.addEventListener("focusin", (event) => {
    if (!wrapper.contains(event.target)) close()
  })
  window.addEventListener("blur", close)
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || menu.hidden) return
    event.preventDefault()
    close()
    button.focus()
  })
  options.addEventListener("close", () => {
    const active = document.activeElement
    if (active === document.body || active.id === "options-button" || options.contains(active)) button.focus()
  })
  return { close }
}
