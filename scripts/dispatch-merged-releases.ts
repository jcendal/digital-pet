type ReleaseBump = "patch" | "minor" | "major"
type Product = "opencode" | "cursor"

type SelectedRelease = {
  readonly release: boolean
  readonly bump: ReleaseBump
}

export type DispatchOptions = {
  readonly repository: string
  readonly token: string
  readonly releaseNote: string
  readonly opencode: SelectedRelease
  readonly cursor: SelectedRelease
}

type DispatchResponse = {
  readonly workflow_run_id?: number
  readonly html_url?: string
}

type RunResponse = {
  readonly status?: string
  readonly conclusion?: string | null
  readonly html_url?: string
}

const API_VERSION = "2026-03-10"
const MAX_POLLS = 120
const POLL_INTERVAL_MS = 15_000

const workflowFor = (product: Product): string =>
  product === "opencode" ? "release-opencode.yml" : "release-cursor.yml"

const pause = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const readJson = async <T>(response: Response, operation: string): Promise<T> => {
  if (!response.ok) throw new Error(`${operation} failed: HTTP ${response.status} ${await response.text()}`)
  return (await response.json()) as T
}

export const dispatchSelectedReleases = async (
  options: DispatchOptions,
  request: typeof fetch = fetch,
  wait: (milliseconds: number) => Promise<void> = pause,
  report: (message: string) => void = (message) => process.stdout.write(`${message}\n`),
): Promise<void> => {
  if (options.repository !== "jcendal/digital-pet" || options.token.length === 0) {
    throw new Error("Release dispatch requires the jcendal/digital-pet repository and a GitHub token.")
  }

  const baseUrl = `https://api.github.com/repos/${options.repository}`
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${options.token}`,
    "X-GitHub-Api-Version": API_VERSION,
  }

  for (const [product, selected] of [
    ["opencode", options.opencode],
    ["cursor", options.cursor],
  ] as const) {
    if (!selected.release) continue
    const workflow = workflowFor(product)
    const dispatch = await readJson<DispatchResponse>(
      await request(`${baseUrl}/actions/workflows/${workflow}/dispatches`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ref: "main",
          inputs: { bump: selected.bump, release_note: options.releaseNote },
          return_run_details: true,
        }),
      }),
      `Dispatching ${workflow}`,
    )
    if (!Number.isSafeInteger(dispatch.workflow_run_id) || (dispatch.workflow_run_id ?? 0) <= 0) {
      throw new Error(`GitHub did not return a run ID for ${workflow}.`)
    }

    const runUrl = `${baseUrl}/actions/runs/${dispatch.workflow_run_id}`
    report(`Started ${workflow}: ${dispatch.html_url ?? runUrl}`)
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      if (attempt > 0) await wait(POLL_INTERVAL_MS)
      const run = await readJson<RunResponse>(await request(runUrl, { headers }), `Checking ${workflow}`)
      if (run.status !== "completed") continue
      if (run.conclusion !== "success") {
        throw new Error(`${workflow} finished with ${run.conclusion ?? "no conclusion"}: ${run.html_url ?? runUrl}`)
      }
      report(`Published ${product}: ${run.html_url ?? runUrl}`)
      break
    }
    const lastRun = await readJson<RunResponse>(await request(runUrl, { headers }), `Confirming ${workflow}`)
    if (lastRun.status !== "completed" || lastRun.conclusion !== "success") {
      throw new Error(`${workflow} did not finish successfully within 30 minutes: ${lastRun.html_url ?? runUrl}`)
    }
  }
}

const parseBump = (value: string | undefined): ReleaseBump => {
  if (value === "patch" || value === "minor" || value === "major") return value
  throw new Error(`Invalid release bump: ${value ?? "missing"}.`)
}

if (import.meta.main) {
  const {
    GITHUB_REPOSITORY,
    GITHUB_TOKEN,
    RELEASE_NOTE,
    RELEASE_OPENCODE,
    OPENCODE_BUMP,
    RELEASE_CURSOR,
    CURSOR_BUMP,
  } = process.env
  await dispatchSelectedReleases({
    repository: GITHUB_REPOSITORY ?? "",
    token: GITHUB_TOKEN ?? "",
    releaseNote: RELEASE_NOTE ?? "",
    opencode: { release: RELEASE_OPENCODE === "true", bump: parseBump(OPENCODE_BUMP) },
    cursor: { release: RELEASE_CURSOR === "true", bump: parseBump(CURSOR_BUMP) },
  })
}
