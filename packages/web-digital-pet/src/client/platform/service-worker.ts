/** Only the static browser app owns an offline worker; SQLite responses stay live. */
export const configureWebWorker = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) return
  if (import.meta.env.PROD && document.documentElement.dataset.saveHost === "browser") {
    await navigator.serviceWorker.register("/service-worker.js", { updateViaCache: "none" })
    return
  }
  // Retire registrations left by versions that also installed a worker on localhost.
  for (const registration of await navigator.serviceWorker.getRegistrations()) {
    const worker = registration.active ?? registration.waiting ?? registration.installing
    if (registration.scope === `${location.origin}/` && worker?.scriptURL === `${location.origin}/service-worker.js`) {
      await registration.unregister()
      for (const key of await caches.keys()) if (key.startsWith("web-digital-pet-")) await caches.delete(key)
    }
  }
}
