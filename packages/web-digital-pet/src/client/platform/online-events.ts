type Notice = { name: "online-ready" | "online-social" | "online-battle" | "online-released"; id?: string | undefined }
const channel = typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel("digital-pet:online-events")
const deliver = (notice: Notice) =>
  window.dispatchEvent(new CustomEvent(`digital-pet:${notice.name}`, { detail: notice.id ?? "" }))
channel?.addEventListener("message", (event: MessageEvent<Notice>) => deliver(event.data))
export const announceOnline = (name: Notice["name"], id?: string | undefined, local = true): void => {
  const notice = { name, id }
  if (local) deliver(notice)
  channel?.postMessage(notice)
}
