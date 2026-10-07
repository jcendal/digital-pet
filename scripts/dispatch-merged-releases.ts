type ReleaseBump = "patch" | "minor" | "major"
type Product = "opencode" | "cursor" | "web"

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
  readonly web: boolean
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

const workflowFor = (product: Product): string => {
  if (product === "opencode") return "release-opencode.yml"
  if (product === "cursor") return "release-cursor.yml"
  return "release-web.yml"
}

const pause = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const readJson = async <T>(response: Response, operation: string): Promise<T> => {
  if (!response.ok) throw new Error(`${operation} failed: HTTP ${response.status} ${await response.text()}`)
  return (await response.json()) as T
}

const readRun = async (
  request: typeof fetch,
  runUrl: string,
  headers: HeadersInit,
  workflow: string,
): Promise<RunResponse | undefined> => {
  const response = await request(runUrl, { headers })
  if (response.status === 404) return undefined
  return readJson<RunResponse>(response, `Checking ${workflow}`)
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

  const selected = (
    [
      ["opencode", options.opencode],
      ["cursor", options.cursor],
      ["web", { release: options.web }],
    ] as const
  ).filter(([, release]) => release.release)

  const started = []
  for (const [product, release] of selected) {
    const workflow = workflowFor(product)
    const dispatch = await readJson<DispatchResponse>(
      await request(`${baseUrl}/actions/workflows/${workflow}/dispatches`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ref: "main",
          ...(product === "web" ? {} : { inputs: { bump: release.bump, release_note: options.releaseNote } }),
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
    started.push({ product, workflow, runUrl })
  }

  const results = await Promise.all(
    started.map(async ({ product, workflow, runUrl }) => {
      for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
        if (attempt > 0) await wait(POLL_INTERVAL_MS)
        const run = await readRun(request, runUrl, headers, workflow)
        if (run === undefined || run.status !== "completed" || run.conclusion == null) continue
        if (run.conclusion !== "success") {
          return `${workflow} finished with ${run.conclusion}: ${run.html_url ?? runUrl}`
        }
        report(`Published ${product}: ${run.html_url ?? runUrl}`)
        return undefined
      }
      return `${workflow} did not finish successfully within 30 minutes: ${runUrl}`
    }),
  )
  const failures = results.filter((failure) => failure !== undefined)
  if (failures.length > 0) throw new Error(failures.join("\n"))
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
    RELEASE_WEB,
  } = process.env
  await dispatchSelectedReleases({
    repository: GITHUB_REPOSITORY ?? "",
    token: GITHUB_TOKEN ?? "",
    releaseNote: RELEASE_NOTE ?? "",
    opencode: { release: RELEASE_OPENCODE === "true", bump: parseBump(OPENCODE_BUMP) },
    cursor: { release: RELEASE_CURSOR === "true", bump: parseBump(CURSOR_BUMP) },
    web: RELEASE_WEB === "true",
  })
}
