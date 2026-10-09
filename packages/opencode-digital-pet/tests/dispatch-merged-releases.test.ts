import { describe, expect, test } from "bun:test"

import { type DispatchOptions, dispatchSelectedReleases } from "../../../scripts/dispatch-merged-releases.ts"

const options: DispatchOptions = {
  repository: "jcendal/digital-pet",
  token: "token",
  releaseNote: "feat: sidebar",
  opencode: { release: true, bump: "minor" },
  cursor: { release: true, bump: "patch" },
  web: { release: true, bump: "patch" },
}

const workflowName = (url: string, method: string | undefined): string => {
  if (method === "POST") return url.split("/").at(-2) ?? ""
  if (url.endsWith("/11")) return "release-opencode.yml"
  if (url.endsWith("/22")) return "release-cursor.yml"
  return "release-web.yml"
}

describe("dispatch merged releases", () => {
  test("Given three products When dispatching Then all runs start before any is checked", async () => {
    const calls: string[] = []
    const gets = new Map<string, number>()
    const request = async (url: string, init?: RequestInit): Promise<Response> => {
      const workflow = workflowName(url, init?.method)
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { return_run_details?: boolean; inputs?: unknown }
        calls.push(`POST ${workflow}`)
        expect(body.return_run_details).toBe(true)
        const bump = workflow.includes("opencode") ? "minor" : "patch"
        expect(body.inputs).toEqual({ bump, release_note: "feat: sidebar" })
        return Response.json({
          workflow_run_id: workflow.includes("opencode") ? 11 : workflow.includes("cursor") ? 22 : 33,
          html_url: "https://github.com/run",
        })
      }
      const seen = (gets.get(workflow) ?? 0) + 1
      gets.set(workflow, seen)
      if (workflow.includes("cursor") && seen === 1) return new Response("missing", { status: 404 })
      return Response.json({ status: "completed", conclusion: "success", html_url: "https://github.com/run" })
    }

    await dispatchSelectedReleases(
      options,
      request as typeof fetch,
      async () => {},
      () => {},
    )

    expect(calls.slice(0, 3)).toEqual(["POST release-opencode.yml", "POST release-cursor.yml", "POST release-web.yml"])
  })

  test("Given an OpenCode failure When both runs start Then Cursor still finishes and the failure is reported", async () => {
    const posts: string[] = []
    const request = async (url: string, init?: RequestInit): Promise<Response> => {
      const workflow = workflowName(url, init?.method)
      if (init?.method === "POST") {
        posts.push(workflow)
        return Response.json({
          workflow_run_id: workflow.includes("opencode") ? 11 : workflow.includes("cursor") ? 22 : 33,
          html_url: "https://github.com/run",
        })
      }
      const conclusion = workflow.includes("opencode") ? "failure" : "success"
      return Response.json({ status: "completed", conclusion, html_url: "https://github.com/run" })
    }

    await expect(
      dispatchSelectedReleases(
        options,
        request as typeof fetch,
        async () => {},
        () => {},
      ),
    ).rejects.toThrow("release-opencode.yml finished with failure")
    expect(posts).toEqual(["release-opencode.yml", "release-cursor.yml", "release-web.yml"])
  })

  test("Given only web changes When dispatching Then only the web release starts", async () => {
    const posts: string[] = []
    const request = async (url: string, init?: RequestInit): Promise<Response> => {
      if (init?.method === "POST") {
        posts.push(workflowName(url, init.method))
        return Response.json({ workflow_run_id: 33 })
      }
      return Response.json({ status: "completed", conclusion: "success" })
    }

    await dispatchSelectedReleases(
      { ...options, opencode: { ...options.opencode, release: false }, cursor: { ...options.cursor, release: false } },
      request as typeof fetch,
      async () => {},
      () => {},
    )

    expect(posts).toEqual(["release-web.yml"])
  })
})
