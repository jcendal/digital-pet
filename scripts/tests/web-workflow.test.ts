import { expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { planMergedRelease } from "../plan-merged-release.ts"

const root = resolve(import.meta.dir, "../..")
type Step = { name?: string; id?: string; uses?: string; run?: string; if?: string; with?: Record<string, string> }
type Workflow = {
  on: Record<string, { inputs?: Record<string, { options: string[] }>; types?: string[]; branches?: string[] }>
  concurrency: { group: string; "cancel-in-progress": boolean }
  jobs: Record<
    string,
    { environment?: string; needs?: string; if?: string; env?: Record<string, string>; steps: Step[] }
  >
}
const workflow = (name: string) =>
  Bun.YAML.parse(readFileSync(resolve(root, `.github/workflows/${name}.yml`), "utf8")) as Workflow

test("the web release deploys one tagged revision after checks, then publishes with deployed outputs", () => {
  const release = workflow("release-web")
  const job = release.jobs.deploy
  expect(job.environment).toBe("web-production")
  expect(job.needs).toBe("version")
  expect(job.if).toContain("github.ref == 'refs/heads/main'")
  // biome-ignore lint/suspicious/noTemplateCurlyInString: This is a literal GitHub Actions expression.
  expect(job.steps[0].with?.ref).toBe("${{ needs.version.outputs.release_tag }}")
  const steps = job.steps
  const index = (run: string) => steps.findIndex((step) => step.run?.includes(run))
  const auth = steps.findIndex((step) => step.uses?.startsWith("aws-actions/configure-aws-credentials@"))
  // biome-ignore lint/suspicious/noTemplateCurlyInString: This is a literal GitHub Actions expression.
  expect(steps[auth].with?.["role-to-assume"]).toBe("${{ vars.BACKEND_DEPLOY_ROLE_ARN }}")
  const ordered = [
    index("npm run validate:web"),
    auth,
    index("npm run backend -- deploy"),
    index("npm run backend -- cdn-plan"),
    index("node --experimental-strip-types packages/web-digital-pet-backend/scripts/export-web-env.ts"),
    index("npm run build:static"),
    index("npm run backend -- cdn-apply"),
    index("bash scripts/publish-web.sh"),
  ]
  expect(ordered.every((value, i) => value >= 0 && (i === 0 || value > ordered[i - 1]))).toBe(true)
  for (const position of ordered) expect(steps[position].if).toBeUndefined()
  expect(JSON.stringify(job)).not.toContain("BACKEND_STACK_NAME")
  expect(existsSync(resolve(root, ".github/workflows/deploy-web-backend.yml"))).toBe(false)
})

test("Actions leave Playwright to local runs while retaining checks, unit tests and builds", () => {
  for (const file of readdirSync(resolve(root, ".github/workflows")).filter((name) => /\.ya?ml$/.test(name))) {
    const content = readFileSync(resolve(root, ".github/workflows", file), "utf8")
    expect(content).not.toMatch(/playwright|test:browser|browser-checks|browser-failures/)
  }
  const runs = workflow("ci")
    .jobs.validate.steps.map((step) => step.run ?? "")
    .join("\n")
  expect(runs).toContain("npx turbo run check --affected")
  expect(runs).toContain("npx turbo run test test:persistence --affected")
  expect(runs).toContain("npx turbo run build --affected")
  expect(workflow("release-web").jobs.deploy.steps.some((step) => step.run === "npm run validate:web")).toBe(true)
})

test("merged PRs select releases automatically while infrastructure plans cannot publish", () => {
  const trigger = workflow("release-after-merge")
  expect(trigger.on.pull_request_target.types).toContain("closed")
  expect(trigger.on.pull_request_target.branches).toEqual(["main"])
  expect(trigger.jobs.plan.if).toContain("github.event.pull_request.merged == true")
  expect(trigger.jobs.publish.steps.some((step) => step.run?.includes("dispatch-merged-releases.ts"))).toBe(true)
  const plan = workflow("plan-web-infrastructure")
  expect(plan.on.workflow_dispatch).toEqual({})
  expect(plan.jobs.plan.steps.at(-1)?.run).toBe('npm run backend -- cdn-plan --environment "$DEPLOY_ENV"')
  expect(plan.jobs.plan.steps.some((step) => step.run?.includes("publish-web"))).toBe(false)
  expect(plan.concurrency).toEqual(workflow("release-web").concurrency)
  expect(plan.concurrency["cancel-in-progress"]).toBe(false)
})

test("backend and web infrastructure changes release only the web product", () => {
  for (const path of [
    "packages/web-digital-pet-backend/src/index.ts",
    "packages/digital-pet-online/src/contracts.ts",
    "packages/digital-pet-intl/src/index.ts",
    "infra/web-digital-pet.yml",
    "scripts/publish-web.sh",
    "assets/battle.png",
  ]) {
    expect(
      planMergedRelease({
        changedFiles: [path],
        tags: ["opencode-digital-pet-v0.2.0", "cursor-digital-pet-v0.2.0", "web-digital-pet-v0.17.0"],
        title: "fix(web): update production",
        labels: [],
        opencodeVersion: "0.2.1-dev.0",
        alreadyReleased: { opencode: false, cursor: false, web: false },
      }),
    ).toEqual({
      opencode: { release: false, bump: "patch" },
      cursor: { release: false, bump: "patch" },
      web: { release: true, bump: "patch" },
    })
  }
})
