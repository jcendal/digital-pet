import { afterEach, beforeEach, expect, test } from "bun:test"
import { execFileSync, spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

const root = resolve(import.meta.dir, "../..")
const turbo = join(root, "node_modules/turbo/bin/turbo")
const web = "@jcendal/web-digital-pet"
const backend = "@jcendal/web-digital-pet-backend"
const opencode = "@jcendal/opencode-digital-pet"
const cursor = "cursor-digital-pet"
let directory: string

interface Plan {
  packages: string[]
  tasks: { taskId: string; hash: string; command: string; resolvedTaskDefinition: { cache: boolean } }[]
}

const write = (path: string, contents: string) => {
  mkdirSync(dirname(join(directory, path)), { recursive: true })
  writeFileSync(join(directory, path), contents)
}

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()

const commit = () => {
  git("add", ".")
  git("-c", "user.name=CI fixture", "-c", "user.email=ci@example.invalid", "commit", "-qm", "fixture")
}

const plan = (affected = false, env: Record<string, string> = {}): Plan =>
  JSON.parse(
    execFileSync(
      turbo,
      ["run", "check", "test", "test:persistence", "build", "--dry=json", ...(affected ? ["--affected"] : [])],
      {
        cwd: directory,
        env: {
          ...process.env,
          TURBO_TELEMETRY_DISABLED: "1",
          TURBO_SCM_BASE: "HEAD~1",
          TURBO_SCM_HEAD: "HEAD",
          ...env,
        },
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  )

const tasks = (result: Plan) =>
  result.tasks.filter((task) => task.command !== "<NONEXISTENT>").map((task) => task.taskId)
const hash = (result: Plan, taskId: string) => {
  const task = result.tasks.find((task) => task.taskId === taskId)
  if (!task) throw new Error(`Missing task: ${taskId}`)
  return task.hash
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "digital-pet-turbo-"))
  for (const file of ["package.json", "package-lock.json", "turbo.json", ".gitignore"])
    copyFileSync(join(root, file), join(directory, file))
  for (const name of readdirSync(join(root, "packages"))) {
    write(`packages/${name}/package.json`, readFileSync(join(root, "packages", name, "package.json"), "utf8"))
    write(`packages/${name}/src/fixture.ts`, "export const value = 1\n")
  }
  git("init", "-q")
  commit()
})

afterEach(() => rmSync(directory, { recursive: true, force: true }))

test("a web-only change selects web and backend without OpenCode or Cursor tests", () => {
  write("packages/web-digital-pet/src/fixture.ts", "export const value = 2\n")
  commit()
  const selected = tasks(plan(true))
  expect(selected).toContain(`${web}#test`)
  expect(selected).toContain(`${backend}#test`)
  expect(selected.some((task) => task.startsWith(`${opencode}#`))).toBe(false)
  expect(selected.some((task) => task.startsWith(`${cursor}#`))).toBe(false)
})

test("an OpenCode-only change does not select web or Cursor tasks", () => {
  write("packages/opencode-digital-pet/src/fixture.ts", "export const value = 2\n")
  commit()
  const selected = tasks(plan(true))
  expect(selected).toContain(`${opencode}#test:persistence`)
  expect(selected.some((task) => task.startsWith(`${web}#`) || task.startsWith(`${cursor}#`))).toBe(false)
})

test("shared core changes select all consumers and invalidate their cached results", () => {
  const before = plan()
  write("packages/digital-pet-core/src/fixture.ts", "export const value = 2\n")
  commit()
  const after = plan(true)
  for (const name of [web, backend, opencode, cursor]) {
    expect(tasks(after)).toContain(`${name}#test`)
    expect(hash(after, `${name}#test`)).not.toBe(hash(before, `${name}#test`))
  }
})

test("unrelated source changes preserve web cache keys", () => {
  const before = plan()
  write("packages/opencode-digital-pet/src/fixture.ts", "export const value = 2\n")
  commit()
  const after = plan()
  expect(hash(after, `${web}#test`)).toBe(hash(before, `${web}#test`))
  expect(hash(after, `${web}#build`)).toBe(hash(before, `${web}#build`))
  expect(hash(after, `${opencode}#test`)).not.toBe(hash(before, `${opencode}#test`))
})

test("root configuration, shared assets and infrastructure trigger broad validation", () => {
  for (const file of [
    "tsconfig.json",
    "types/shared.d.ts",
    "assets/branding/logo.png",
    "infra/web.yml",
    ".github/workflows/ci.yml",
  ]) {
    write(file, "changed\n")
    commit()
    expect(tasks(plan(true))).toEqual(tasks(plan()))
  }
})

test("web endpoint configuration and local env files invalidate the web build cache", () => {
  const before = plan(false, { DIGITAL_PET_WEBSOCKET_URL: "wss://one.example.invalid" })
  const after = plan(false, { DIGITAL_PET_WEBSOCKET_URL: "wss://two.example.invalid" })
  expect(hash(after, `${web}#build`)).not.toBe(hash(before, `${web}#build`))
  expect(hash(after, `${opencode}#build`)).toBe(hash(before, `${opencode}#build`))
  write("packages/web-digital-pet/.env.local", "VITE_FIXTURE=changed\n")
  expect(hash(plan(false, { DIGITAL_PET_WEBSOCKET_URL: "wss://one.example.invalid" }), `${web}#build`)).not.toBe(
    hash(before, `${web}#build`),
  )
})

test("backend-only changes skip unrelated packaging", () => {
  write("packages/web-digital-pet-backend/src/fixture.ts", "export const value = 2\n")
  commit()
  write("plan.json", JSON.stringify(plan(true)))
  execFileSync(process.execPath, [join(root, "scripts/ci-affected.mjs"), join(directory, "plan.json")], {
    cwd: directory,
    env: {
      ...process.env,
      TURBO_SCM_BASE: "HEAD~1",
      TURBO_SCM_HEAD: "HEAD",
      GITHUB_OUTPUT: join(directory, "outputs"),
    },
    stdio: "pipe",
  })
  expect(readFileSync(join(directory, "outputs"), "utf8")).toBe("opencode=false\ncursor=false\nimporters=false\n")
})

test("importer validation is selected for Python and catalog changes, not web UI changes", () => {
  for (const [file, selected] of [
    ["packages/web-digital-pet/src/panel.ts", false],
    ["scripts/import-attack-artwork.py", true],
    ["scripts/tests/test_color_sprites.py", true],
    ["scripts/requirements-tests.txt", true],
    ["packages/digital-pet-core/src/data/evolution-reference.json", true],
  ] as const) {
    write(file, "changed\n")
    commit()
    write("plan.json", JSON.stringify({ packages: [] }))
    write("outputs", "")
    execFileSync(process.execPath, [join(root, "scripts/ci-affected.mjs"), join(directory, "plan.json")], {
      cwd: directory,
      env: {
        ...process.env,
        TURBO_SCM_BASE: "HEAD~1",
        TURBO_SCM_HEAD: "HEAD",
        GITHUB_OUTPUT: join(directory, "outputs"),
      },
      stdio: "pipe",
    })
    expect(readFileSync(join(directory, "outputs"), "utf8")).toContain(`importers=${selected}\n`)
  }
})

test("successful builds restore missing artifacts from cache", () => {
  const path = "packages/web-digital-pet/package.json"
  const manifest = JSON.parse(readFileSync(join(directory, path), "utf8"))
  manifest.scripts.build =
    "node -e \"const fs = require('node:fs'); fs.mkdirSync('dist', {recursive:true}); fs.writeFileSync('dist/result.txt', 'built')\""
  write(path, JSON.stringify(manifest))
  const run = () =>
    execFileSync(turbo, ["run", "build", `--filter=${web}`], {
      cwd: directory,
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  run()
  rmSync(join(directory, "packages/web-digital-pet/dist"), { recursive: true })
  expect(run()).toContain("cache hit")
  expect(readFileSync(join(directory, "packages/web-digital-pet/dist/result.txt"), "utf8")).toBe("built")
})

test("a failed test exits unsuccessfully and is never reused from cache", () => {
  const path = "packages/web-digital-pet/package.json"
  const manifest = JSON.parse(readFileSync(join(directory, path), "utf8"))
  manifest.scripts.test = 'node -e "process.exit(1)"'
  write(path, JSON.stringify(manifest))
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = spawnSync(turbo, ["run", "test", `--filter=${web}`], {
      cwd: directory,
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
      encoding: "utf8",
    })
    expect(result.status).toBe(1)
    expect(result.stdout).not.toContain("cache hit")
  }
})

test("browser checks build only the web, depend on backend sources, and never cache their result", () => {
  const result = JSON.parse(
    execFileSync(turbo, ["run", "test:browser:run", "--dry=json"], {
      cwd: directory,
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  ) as Plan
  expect(tasks(result).sort()).toEqual([`${web}#build`, `${web}#test:browser:run`])
  expect(result.tasks.find((task) => task.taskId === `${web}#test:browser:run`)?.resolvedTaskDefinition.cache).toBe(
    false,
  )
  expect(result.tasks.some((task) => task.taskId === `${backend}#transit`)).toBe(true)
})
