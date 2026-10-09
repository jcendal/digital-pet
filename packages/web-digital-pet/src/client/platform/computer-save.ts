/** A static website has no local computer bridge; a local app can reconnect later. */
export const checkComputerSave = async (
  browserOnly: boolean,
  request: typeof fetch = fetch,
): Promise<boolean | null> => {
  if (browserOnly) return false
  try {
    const response = await request("/api/mode", { cache: "no-store", signal: AbortSignal.timeout(3000) })
    if (!response.ok) return null
    const data: unknown = await response.json()
    if (typeof data !== "object" || data === null || !("mode" in data)) return null
    return data.mode === "sqlite" ? true : data.mode === "browser" ? false : null
  } catch {
    return null
  }
}
